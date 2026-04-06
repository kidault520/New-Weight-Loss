 
require('dotenv').config({ path: 'server/.env' });

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('缺少 Supabase 环境变量：VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const START_DATE = process.argv[2] || '2026-03-16';
const DAYS = 7;

const DISH_TYPES = ['主荤菜', '副荤菜', '主素菜', '副素菜', '主食'];

function addDays(dateStr, offset) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + offset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function pick(arr, idx) {
  return arr[idx % arr.length];
}

async function listActiveDishesByType(type) {
  const { data, error } = await supabase
    .from('dishes')
    .select('id, name, dish_type, is_active, created_at')
    .eq('dish_type', type)
    .eq('is_active', true)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function createMealPackage({ date, packageType, seq, dishMap }) {
  const packageCode = `AUTO-${packageType === '午餐' ? 'L' : 'D'}-${date.replace(/-/g, '')}-${String(seq).padStart(2, '0')}`;
  const packageName = `${date} ${packageType}自动搭配${String(seq).padStart(2, '0')}`;

  const { data: pkg, error: pErr } = await supabase
    .from('meal_packages')
    .insert({
      package_code: packageCode,
      name: packageName,
      package_type: packageType,
      supply_date: date,
      is_active: true,
    })
    .select('id, package_code, name, package_type, supply_date')
    .single();
  if (pErr) throw pErr;

  const items = DISH_TYPES.map((type, idx) => ({
    package_id: pkg.id,
    dish_id: dishMap[type].id,
    quantity: 1,
    sort_order: idx + 1,
  }));

  const { error: iErr } = await supabase.from('package_items').insert(items);
  if (iErr) throw iErr;

  return {
    package: pkg,
    dishes: DISH_TYPES.map((type) => ({ type, id: dishMap[type].id, name: dishMap[type].name })),
  };
}

async function createMealSchedule({ startDate, endDate }) {
  const scheduleName = `全局7天餐食排期（${startDate}~${endDate}）`;
  const scheduleCode = `MS-${startDate.slice(0, 7).replace('-', '')}-AUTO7`;

  let schedule = null;
  let insertError = null;

  ({ data: schedule, error: insertError } = await supabase
    .from('meal_schedules')
    .insert({
      schedule_name: scheduleName,
      schedule_code: scheduleCode,
      start_time: `${startDate}T00:00:00.000Z`,
      end_time: `${endDate}T23:59:59.999Z`,
    })
    .select('id, schedule_name, schedule_code, start_time, end_time')
    .single());

  // 兼容旧库字段
  if (insertError && String(insertError.message || '').includes('schedule_code')) {
    ({ data: schedule, error: insertError } = await supabase
      .from('meal_schedules')
      .insert({
        schedule_name: scheduleName,
        start_time: `${startDate}T00:00:00.000Z`,
        end_time: `${endDate}T23:59:59.999Z`,
      })
      .select('id, schedule_name, start_time, end_time')
      .single());
  }
  if (insertError) throw insertError;
  return schedule;
}

async function setEnabledSchedule(scheduleId) {
  const disableResult = await supabase
    .from('meal_schedules')
    .update({ is_enabled: false, enabled_at: null, enabled_by: null })
    .eq('is_enabled', true);

  // 兼容旧库无 is_enabled 字段
  if (disableResult.error && !String(disableResult.error.message || '').includes('is_enabled')) {
    throw disableResult.error;
  }

  const enableResult = await supabase
    .from('meal_schedules')
    .update({ is_enabled: true, enabled_at: new Date().toISOString() })
    .eq('id', scheduleId);

  if (enableResult.error && !String(enableResult.error.message || '').includes('is_enabled')) {
    throw enableResult.error;
  }
}

async function main() {
  // 清理旧的排期数据（含其明细）以及历史自动套餐
  const { error: oldScheduleErr } = await supabase
    .from('meal_schedules')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  if (oldScheduleErr) throw oldScheduleErr;

  const { data: autoPackages, error: autoPkgErr } = await supabase
    .from('meal_packages')
    .select('id')
    .like('package_code', 'AUTO-%');
  if (autoPkgErr) throw autoPkgErr;
  const autoPackageIds = (autoPackages || []).map((x) => x.id);
  if (autoPackageIds.length > 0) {
    const { error: delItemsErr } = await supabase
      .from('package_items')
      .delete()
      .in('package_id', autoPackageIds);
    if (delItemsErr) throw delItemsErr;

    const { error: delPkgErr } = await supabase
      .from('meal_packages')
      .delete()
      .in('id', autoPackageIds);
    if (delPkgErr) throw delPkgErr;
  }

  const pools = {};
  for (const type of DISH_TYPES) {
    pools[type] = await listActiveDishesByType(type);
    if (!pools[type].length) {
      throw new Error(`菜品不足：未找到已启用的「${type}」`);
    }
  }

  const startDate = START_DATE;
  const endDate = addDays(startDate, DAYS - 1);
  const createdPackages = [];
  const entries = [];

  let seq = 1;
  for (let i = 0; i < DAYS; i += 1) {
    const date = addDays(startDate, i);
    const lunchDishMap = {
      主荤菜: pick(pools['主荤菜'], i),
      副荤菜: pick(pools['副荤菜'], i + 1),
      主素菜: pick(pools['主素菜'], i + 2),
      副素菜: pick(pools['副素菜'], i + 3),
      主食: pick(pools['主食'], i + 4),
    };
    const dinnerDishMap = {
      主荤菜: pick(pools['主荤菜'], i + 5),
      副荤菜: pick(pools['副荤菜'], i + 6),
      主素菜: pick(pools['主素菜'], i + 7),
      副素菜: pick(pools['副素菜'], i + 8),
      主食: pick(pools['主食'], i + 9),
    };

    const lunch = await createMealPackage({ date, packageType: '午餐', seq, dishMap: lunchDishMap });
    seq += 1;
    const dinner = await createMealPackage({ date, packageType: '晚餐', seq, dishMap: dinnerDishMap });
    seq += 1;

    createdPackages.push({ date, meal: '午餐', ...lunch });
    createdPackages.push({ date, meal: '晚餐', ...dinner });

    entries.push({
      date,
      package_id: lunch.package.id,
      package_type: '午餐',
    });
    entries.push({
      date,
      package_id: dinner.package.id,
      package_type: '晚餐',
    });
  }

  const schedule = await createMealSchedule({ startDate, endDate });

  const { error: eErr } = await supabase.from('meal_schedule_entries').insert(
    entries.map((e) => ({
      schedule_id: schedule.id,
      date: e.date,
      package_id: e.package_id,
      package_type: e.package_type,
    })),
  );
  if (eErr) throw eErr;

  await setEnabledSchedule(schedule.id);

  console.log(JSON.stringify({
    ok: true,
    schedule,
    total_packages: createdPackages.length,
    total_entries: entries.length,
    plan_rows: createdPackages.map((row) => ({
      date: row.date,
      meal: row.meal,
      package_code: row.package.package_code,
      package_name: row.package.name,
      dishes: row.dishes.map((d) => `${d.type}:${d.name}`).join(' | '),
    })),
  }, null, 2));
}

main().catch((err) => {
  console.error('FAILED:', err?.message || err);
  process.exit(1);
});

