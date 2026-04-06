/**
 * 管理员 - 组织数据同步到数据库
 * POST /api/admin/sync-organization
 * Body: { persons, teams, regions, promotionHistory, leaveHistory, demotionHistory, ruleSet?, productConfig? }
 */

const express = require('express');
const { authenticateAdmin } = require('../../middleware/adminAuth');
const { supabaseAdmin } = require('../../config/supabase');
const { toBeijingDateString } = require('../../utils/timezone');
const logger = require('../../utils/logger');
const router = express.Router();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toUuid(id, idMap) {
  if (UUID_REGEX.test(id)) return id;
  let u = idMap.get(id);
  if (!u) {
    u = require('crypto').randomUUID();
    idMap.set(id, u);
  }
  return u;
}

/**
 * 生成 191 开头的手机号（11位）
 */
function generatePhone(used) {
  let phone;
  do {
    const suffix = String(Math.floor(Math.random() * 100000000)).padStart(8, '0');
    phone = '191' + suffix;
  } while (used.has(phone));
  used.add(phone);
  return phone;
}

router.post('/', authenticateAdmin, async (req, res) => {
  try {
    const {
      persons: personsArray,
      teams: teamsArray,
      regions: regionsArray,
      promotionHistory = [],
      leaveHistory = [],
      demotionHistory = [],
      ruleSet,
      productConfig,
      generatePhones = true,
    } = req.body;

    if (!personsArray || !Array.isArray(personsArray)) {
      return res.status(400).json({ error: '缺少 persons 数据' });
    }

    const persons = new Map(personsArray);
    const teams = new Map(teamsArray || []);
    const regions = new Map(regionsArray || []);

    const idMap = new Map();
    const usedPhones = new Set();

    // 1. 同步商品配置（品类、商品映射、折算率）
    if (productConfig) {
      try {
        const { data: existing } = await supabaseAdmin
          .from('sales_product_config')
          .select('id, version')
          .eq('config_key', 'default')
          .maybeSingle();
        const nextVersion = existing?.id ? Number(existing.version || 1) + 1 : 1;
        const row = {
          config_key: 'default',
          categories: productConfig.categories || [],
          product_mappings: productConfig.productMappings || [],
          discount_rates: productConfig.discountRates || [],
          version: nextVersion,
          effective_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        if (existing) {
          await supabaseAdmin.from('sales_product_config').update(row).eq('id', existing.id);
        } else {
          await supabaseAdmin.from('sales_product_config').insert({ ...row, id: 'a0000000-0000-0000-0000-000000000010' });
        }

        // Append immutable version snapshot.
        await supabaseAdmin.from('sales_product_config_versions').insert({
          config_key: 'default',
          version: nextVersion,
          effective_at: row.effective_at,
          categories: row.categories,
          product_mappings: row.product_mappings,
          discount_rates: row.discount_rates,
          created_by_admin_id: req.admin?.id || null,
          source: 'sync_organization',
          note: 'saved from organization sync',
        });
      } catch (cfgError) {
        logger.warn('Sync product config error (table may not exist):', cfgError?.message || cfgError);
      }
    }

    // 2. 同步规则集
    if (ruleSet && ruleSet.id && ruleSet.rules) {
      const ruleId = UUID_REGEX.test(ruleSet.id) ? ruleSet.id : require('crypto').randomUUID();
      const { error: ruleError } = await supabaseAdmin
        .from('sales_rule_sets')
        .upsert(
          {
            id: ruleId,
            name: ruleSet.name || '默认规则',
            version: ruleSet.version ?? 1,
            effective_date: ruleSet.effectiveDate || '2025-01-01',
            description: ruleSet.description || null,
            rules: ruleSet.rules || [],
            promotion_rules: ruleSet.promotionRules || [],
            evaluation_rules: ruleSet.evaluationRules || [],
          },
          { onConflict: 'id' }
        );
      if (ruleError) {
        logger.warn('Sync rule set error:', ruleError);
      } else {
        await supabaseAdmin
          .from('sales_current_rule_set')
          .update({ rule_set_id: ruleId })
          .eq('id', 'a0000000-0000-0000-0000-000000000001');
      }
    }

    // 3. 同步地区
    for (const [, r] of regions) {
      const id = toUuid(r.id, idMap);
      await supabaseAdmin.from('sales_regions').upsert(
        {
          id,
          name: r.name,
          type: r.type,
          parent_id: r.parentId ? (idMap.get(r.parentId) || (UUID_REGEX.test(r.parentId) ? r.parentId : toUuid(r.parentId, idMap))) : null,
          path: r.path || '',
        },
        { onConflict: 'id' }
      );
      if (r.id !== id) idMap.set(r.id, id);
    }

    // 4. 为无手机号人员生成手机号
    const personsToSync = [];
    for (const [pid, p] of persons) {
      let phone = p.phone;
      if ((!phone || !phone.startsWith('191')) && generatePhones) {
        phone = generatePhone(usedPhones);
      }
      personsToSync.push({ ...p, phone: phone || p.phone });
    }

    // 5. 同步人员（需先插入，因为 teams 依赖 leader_id）
    for (const p of personsToSync) {
      const id = toUuid(p.id, idMap);
      const parentId = p.parentId ? (idMap.get(p.parentId) ?? (UUID_REGEX.test(p.parentId) ? p.parentId : toUuid(p.parentId, idMap))) : null;
      const teamId = p.teamId ? (idMap.get(p.teamId) ?? (UUID_REGEX.test(p.teamId) ? p.teamId : toUuid(p.teamId, idMap))) : null;
      const recommenderId = p.recommenderId ? (idMap.get(p.recommenderId) ?? (UUID_REGEX.test(p.recommenderId) ? p.recommenderId : toUuid(p.recommenderId, idMap))) : null;

      const { error } = await supabaseAdmin.from('sales_persons').upsert(
        {
          id,
          code: p.code,
          display_id: p.displayId ?? null,
          name: p.name,
          level: p.level,
          original_level: p.originalLevel,
          performance: Number(p.performance ?? 0),
          avatar_url: p.avatarUrl ?? '',
          status: p.status ?? '活跃',
          parent_id: parentId ?? p.parentId,
          team_id: teamId ?? p.teamId,
          recommender_id: recommenderId ?? p.recommenderId,
          region_id: p.regionId ? (idMap.get(p.regionId) ?? p.regionId) : null,
          province_id: p.provinceId ? (idMap.get(p.provinceId) ?? p.provinceId) : null,
          city_id: p.cityId ? (idMap.get(p.cityId) ?? p.cityId) : null,
          join_date: p.joinDate,
          promote_date: p.promoteDate ?? null,
          leave_date: p.leaveDate ?? null,
          join_method: p.joinMethod ?? null,
          is_seed: Boolean(p.isSeed),
          legacy_id: UUID_REGEX.test(p.id) ? null : p.id,
          phone: p.phone ?? null,
          is_activated: p.accountStatus === '禁用' ? false : Boolean(p.isActivated),
          birth_date: p.birthDate ?? null,
          gender: p.gender ?? null,
          ethnicity: p.ethnicity ?? null,
          education: p.education ?? null,
          id_number: p.idNumber ?? null,
          work_history: p.workHistory ?? null,
          account_status: p.accountStatus ?? null,
        },
        { onConflict: 'id' }
      );
      if (error) {
        logger.error('Upsert person error:', p.code, error);
        throw error;
      }
      if (p.id !== id) idMap.set(p.id, id);
    }

    // 6. 同步队伍
    for (const [, t] of teams) {
      const id = toUuid(t.id, idMap);
      const leaderId = t.leaderId ? (idMap.get(t.leaderId) ?? (UUID_REGEX.test(t.leaderId) ? t.leaderId : toUuid(t.leaderId, idMap))) : null;
      const originalLeaderId = t.originalLeaderId ? (idMap.get(t.originalLeaderId) ?? (UUID_REGEX.test(t.originalLeaderId) ? t.originalLeaderId : toUuid(t.originalLeaderId, idMap))) : null;

      const { error } = await supabaseAdmin.from('sales_teams').upsert(
        {
          id,
          code: t.code,
          display_id: t.displayId ?? null,
          name: t.name,
          custom_name: t.customName ?? null,
          leader_id: leaderId ?? t.leaderId,
          original_leader_id: originalLeaderId ?? t.originalLeaderId,
          region_id: t.regionId ? (idMap.get(t.regionId) ?? t.regionId) : null,
          province_id: t.provinceId ? (idMap.get(t.provinceId) ?? t.provinceId) : null,
          city_id: t.cityId ? (idMap.get(t.cityId) ?? t.cityId) : null,
          member_count: Number(t.memberCount ?? 0),
          active_count: Number(t.activeCount ?? 0),
          total_performance: Number(t.totalPerformance ?? 0),
          created_date: t.createdDate ?? toBeijingDateString(new Date()),
          is_temporary: Boolean(t.isTemporary),
        },
        { onConflict: 'id' }
      );
      if (error) {
        logger.error('Upsert team error:', t.code, error);
        throw error;
      }
      if (t.id !== id) idMap.set(t.id, id);
    }

    // 7. 同步历史（去重插入）
    const existingPromo = await supabaseAdmin.from('sales_promotion_history').select('person_id, promote_date, from_level, to_level');
    const promoKeys = new Set((existingPromo.data || []).map((h) => `${h.person_id}|${h.promote_date}|${h.from_level}|${h.to_level}`));

    for (const h of promotionHistory) {
      const pid = idMap.get(h.personId) ?? h.personId;
      const key = `${pid}|${h.promoteDate}|${h.fromLevel}|${h.toLevel}`;
      if (!promoKeys.has(key)) {
        await supabaseAdmin.from('sales_promotion_history').insert({
          person_id: pid,
          from_level: h.fromLevel,
          to_level: h.toLevel,
          promote_date: h.promoteDate,
          team_id: h.teamId ? (idMap.get(h.teamId) ?? h.teamId) : null,
          reason: h.reason ?? null,
        });
        promoKeys.add(key);
      }
    }

    const existingLeave = await supabaseAdmin.from('sales_leave_history').select('person_id, leave_date');
    const leaveKeys = new Set((existingLeave.data || []).map((h) => `${h.person_id}|${h.leave_date}`));

    for (const h of leaveHistory) {
      const pid = idMap.get(h.personId) ?? h.personId;
      const key = `${pid}|${h.leaveDate}`;
      if (!leaveKeys.has(key)) {
        await supabaseAdmin.from('sales_leave_history').insert({
          person_id: pid,
          leave_type: h.leaveType ?? null,
          leave_date: h.leaveDate,
          reason: h.reason ?? null,
          reassigned_team_id: h.reassignedTeamId ? (idMap.get(h.reassignedTeamId) ?? h.reassignedTeamId) : null,
        });
        leaveKeys.add(key);
      }
    }

    const existingDemote = await supabaseAdmin.from('sales_demotion_history').select('person_id, demote_date, from_level, to_level');
    const demoteKeys = new Set((existingDemote.data || []).map((h) => `${h.person_id}|${h.demote_date}|${h.from_level}|${h.to_level}`));

    for (const h of demotionHistory) {
      const pid = idMap.get(h.personId) ?? h.personId;
      const key = `${pid}|${h.demoteDate}|${h.fromLevel}|${h.toLevel}`;
      if (!demoteKeys.has(key)) {
        await supabaseAdmin.from('sales_demotion_history').insert({
          person_id: pid,
          from_level: h.fromLevel,
          to_level: h.toLevel,
          demote_date: h.demoteDate,
          reason: h.reason ?? null,
          evaluation_rule_id: h.evaluationRuleId ?? null,
        });
        demoteKeys.add(key);
      }
    }

    res.json({
      success: true,
      message: '同步成功',
      stats: {
        persons: persons.size,
        teams: teams.size,
        regions: regions.size,
        promotionHistory: promotionHistory.length,
        leaveHistory: leaveHistory.length,
        demotionHistory: demotionHistory.length,
      },
      idMap: Object.fromEntries(idMap),
    });
  } catch (err) {
    logger.error('Sync organization error:', err);
    res.status(500).json({ error: err.message || '同步失败' });
  }
});

module.exports = router;
