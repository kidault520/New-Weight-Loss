-- 用户历史配送脏数据清理脚本（按手机号）
-- 目标场景：用户当前无有效订单/未开启服务，但仍残留历史 delivery_schedules 等数据。
-- 使用方式：
-- 1) 先跑 A 区（只读盘点）
-- 2) 确认无误后跑 B 区（事务删除）
-- 3) 再跑 C 区（复核）
--
-- 默认目标手机号：
--   13100000000

-- ============================================================
-- A) 只读盘点（不会改数据）
-- ============================================================

with target_user as (
  select up.user_id, up.phone, up.nickname
  from user_profiles up
  where up.phone = '13100000000'
  order by up.updated_at desc nulls last, up.created_at desc nulls last
  limit 1
),
active_paid_orders as (
  select o.*
  from orders o
  join target_user tu on tu.user_id = o.user_id
  where o.payment_status = 'paid'
    and coalesce(o.order_status, '') not in ('cancelled', 'completed', 'refunded')
),
user_schedules as (
  select ds.*, o.id as joined_order_id, o.payment_status as joined_payment_status, o.order_status as joined_order_status
  from delivery_schedules ds
  join target_user tu on tu.user_id = ds.user_id
  left join orders o on o.id = ds.order_id
)
select
  (select user_id from target_user) as user_id,
  (select phone from target_user) as phone,
  (select nickname from target_user) as nickname,
  (select count(*) from active_paid_orders) as active_paid_order_count,
  (select count(*) from user_schedules) as delivery_schedule_total,
  (select count(*) from user_schedules where order_id is null) as schedule_order_id_null_count,
  (select count(*) from user_schedules where order_id is not null and joined_order_id is null) as schedule_order_missing_count,
  (select count(*) from user_schedules where joined_order_id is not null and (joined_payment_status <> 'paid' or coalesce(joined_order_status,'') in ('cancelled','completed','refunded'))) as schedule_order_invalid_state_count;

-- 抽样看残留配送计划
with target_user as (
  select up.user_id
  from user_profiles up
  where up.phone = '13100000000'
  order by up.updated_at desc nulls last, up.created_at desc nulls last
  limit 1
)
select
  ds.id,
  ds.delivery_date,
  ds.meal_type,
  ds.status as schedule_status,
  ds.order_id,
  o.payment_status,
  o.order_status,
  ds.updated_at
from delivery_schedules ds
join target_user tu on tu.user_id = ds.user_id
left join orders o on o.id = ds.order_id
order by ds.updated_at desc
limit 200;

-- ============================================================
-- B) 安全删除（事务，默认直接 COMMIT）
-- 说明：仅删除“脏配送计划”：
--   1) order_id 为空
--   2) 关联订单不存在
--   3) 关联订单不是 paid 或已终态（cancelled/completed/refunded）
--
-- 同时删除依赖表：
--   delivery_callback_events（按 schedule_id）
--   delivery_audit_logs（按 entity_id）
-- ============================================================

begin;

-- 1) 防误删：若该用户存在有效 paid 订单，阻断删除
do $$
declare
  v_user_id uuid;
  v_active_paid_count integer;
begin
  select up.user_id
    into v_user_id
  from user_profiles up
  where up.phone = '13100000000'
  order by up.updated_at desc nulls last, up.created_at desc nulls last
  limit 1;

  if v_user_id is null then
    raise exception '未找到手机号 13100000000 对应用户，已中止';
  end if;

  select count(*)
    into v_active_paid_count
  from orders o
  where o.user_id = v_user_id
    and o.payment_status = 'paid'
    and coalesce(o.order_status, '') not in ('cancelled', 'completed', 'refunded');

  if v_active_paid_count > 0 then
    raise exception '检测到该用户存在有效 paid 订单（% 条），中止删除以防误删', v_active_paid_count;
  end if;
end
$$;

-- 2) 收集待删 schedule id（临时表）
create temporary table tmp_stale_delivery_schedule_ids on commit drop as
with target_user as (
  select up.user_id
  from user_profiles up
  where up.phone = '13100000000'
  order by up.updated_at desc nulls last, up.created_at desc nulls last
  limit 1
)
select ds.id
from delivery_schedules ds
join target_user tu on tu.user_id = ds.user_id
left join orders o on o.id = ds.order_id
where ds.order_id is null
   or o.id is null
   or o.payment_status <> 'paid'
   or coalesce(o.order_status, '') in ('cancelled', 'completed', 'refunded');

-- 3) 删除依赖与主数据
delete from delivery_callback_events dce
where dce.schedule_id in (select id from tmp_stale_delivery_schedule_ids);

delete from delivery_audit_logs dal
where dal.entity_type = 'delivery_schedule'
  and dal.entity_id in (select id::text from tmp_stale_delivery_schedule_ids);

delete from delivery_schedules ds
where ds.id in (select id from tmp_stale_delivery_schedule_ids);

-- 4) 可选：若该用户无有效 paid 订单，删除孤立 execution_programs（保留可注释）
delete from execution_programs ep
where ep.user_id = (
  select up.user_id
  from user_profiles up
  where up.phone = '13100000000'
  order by up.updated_at desc nulls last, up.created_at desc nulls last
  limit 1
)
and not exists (
  select 1
  from orders o
  where o.user_id = ep.user_id
    and o.payment_status = 'paid'
    and coalesce(o.order_status, '') not in ('cancelled', 'completed', 'refunded')
);

commit;

-- ============================================================
-- C) 删除后复核（只读）
-- ============================================================

with target_user as (
  select up.user_id
  from user_profiles up
  where up.phone = '13100000000'
  order by up.updated_at desc nulls last, up.created_at desc nulls last
  limit 1
)
select
  (select count(*) from delivery_schedules ds join target_user tu on tu.user_id = ds.user_id) as delivery_schedule_total_after,
  (select count(*) from execution_programs ep join target_user tu on tu.user_id = ep.user_id) as execution_program_total_after,
  (select count(*) from orders o join target_user tu on tu.user_id = o.user_id where o.payment_status = 'paid' and coalesce(o.order_status, '') not in ('cancelled','completed','refunded')) as active_paid_order_count_after;
