/**
 * 规则版本存储服务
 * 使用 localStorage 持久化规则版本数据
 * 当配置 Supabase 时，自动使用 Supabase 作为后端
 */

import { RuleSet } from '../types/commissionRules';
import { getDefaultRules } from './commissionRules';
import { isSupabaseConfigured } from '@/config/supabase';
import { salesRuleService } from '../services/sales/salesRuleService';

const STORAGE_KEY = 'commission-rule-sets';
const CURRENT_RULE_SET_KEY = 'current-rule-set-id';
const DEFAULT_RULES_UUID = 'a0000000-0000-0000-0000-000000000002';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let _ruleCache: RuleSet[] | null = null;
let _currentRuleIdCache: string | null = null;

export class RuleStorage {
  static async initAsync(): Promise<void> {
    if (!isSupabaseConfigured) return;
    try {
      const [all, currentId] = await Promise.all([
        salesRuleService.getAll(),
        salesRuleService.getCurrentRuleSetId(),
      ]);
      if (all.length > 0) {
        _ruleCache = all as RuleSet[];
        _currentRuleIdCache = currentId || all[0]?.id || getDefaultRules().id;
      } else {
        const defaultRules = { ...getDefaultRules(), id: DEFAULT_RULES_UUID };
        await salesRuleService.upsert(defaultRules);
        await salesRuleService.setCurrentRuleSetId(DEFAULT_RULES_UUID);
        _ruleCache = [defaultRules];
        _currentRuleIdCache = DEFAULT_RULES_UUID;
      }
    } catch (e) {
      console.error('RuleStorage init failed:', e);
      _ruleCache = [{ ...getDefaultRules(), id: DEFAULT_RULES_UUID }];
      _currentRuleIdCache = DEFAULT_RULES_UUID;
    }
  }

  /**
   * 获取所有规则集
   */
  static getAllRuleSets(): RuleSet[] {
    if (isSupabaseConfigured && _ruleCache) return _ruleCache;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const defaultRules = getDefaultRules();
      if (stored) {
        const ruleSets = JSON.parse(stored);
        let needsUpdate = false;
        const updatedRuleSets = ruleSets.map((rs: RuleSet) => {
          if (rs.id === 'default-rules-v1' || rs.id === 'default-rules-v2') {
            needsUpdate = true;
            return defaultRules;
          }
          if (!rs.promotionRules || !rs.evaluationRules) {
            needsUpdate = true;
            return {
              ...rs,
              promotionRules: rs.promotionRules || defaultRules.promotionRules,
              evaluationRules: rs.evaluationRules || defaultRules.evaluationRules,
            };
          }
          return rs;
        });
        if (needsUpdate) {
          this.saveAllRuleSets(updatedRuleSets);
          const currentId = this.getCurrentRuleSetId();
          if (currentId === 'default-rules-v1') this.setCurrentRuleSetId(defaultRules.id);
          return updatedRuleSets;
        }
        return ruleSets;
      }
      this.saveAllRuleSets([defaultRules]);
      return [defaultRules];
    } catch (error) {
      console.error('Failed to load rule sets:', error);
      return [getDefaultRules()];
    }
  }

  /**
   * 保存所有规则集（内部方法）
   */
  private static saveAllRuleSets(ruleSets: RuleSet[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ruleSets));
    } catch (error) {
      console.error('Failed to save all rule sets:', error);
    }
  }

  /**
   * 保存规则集
   */
  static saveRuleSet(ruleSet: RuleSet): void {
    if (isSupabaseConfigured) {
      const id = UUID_REGEX.test(ruleSet.id) ? ruleSet.id : (ruleSet.id === 'default-rules-v1' || ruleSet.id === 'default-rules-v2' ? DEFAULT_RULES_UUID : crypto.randomUUID());
      const toSave = { ...ruleSet, id };
      salesRuleService.upsert(toSave).then(() => {
        if (_ruleCache) {
          const idx = _ruleCache.findIndex((rs) => rs.id === ruleSet.id || rs.id === id);
          const updated = { ...ruleSet, id };
          if (idx >= 0) _ruleCache[idx] = updated;
          else _ruleCache.push(updated);
        }
      }).catch((e) => console.error('Failed to save rule set:', e));
      return;
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const allRuleSets: RuleSet[] = stored ? JSON.parse(stored) : [];
      const index = allRuleSets.findIndex((rs) => rs.id === ruleSet.id);
      if (index >= 0) allRuleSets[index] = ruleSet;
      else allRuleSets.push(ruleSet);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(allRuleSets));
    } catch (error) {
      console.error('Failed to save rule set:', error);
    }
  }

  /**
   * 删除规则集
   */
  static deleteRuleSet(ruleSetId: string): void {
    if (isSupabaseConfigured) {
      const id = UUID_REGEX.test(ruleSetId) ? ruleSetId : (ruleSetId === 'default-rules-v1' || ruleSetId === 'default-rules-v2' ? DEFAULT_RULES_UUID : ruleSetId);
      salesRuleService.delete(id).then(() => {
        if (_ruleCache) {
          const filtered = _ruleCache.filter((rs) => rs.id !== ruleSetId && rs.id !== id);
          if (_currentRuleIdCache === ruleSetId || _currentRuleIdCache === id) {
            _currentRuleIdCache = filtered[0]?.id ?? getDefaultRules().id;
            salesRuleService.setCurrentRuleSetId(_currentRuleIdCache);
          }
          _ruleCache = filtered.length > 0 ? filtered : [getDefaultRules()];
        }
      }).catch((e) => console.error('Failed to delete rule set:', e));
      return;
    }
    try {
      const allRuleSets = this.getAllRuleSets();
      const filtered = allRuleSets.filter((rs) => rs.id !== ruleSetId);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
      const currentId = this.getCurrentRuleSetId();
      if (currentId === ruleSetId && filtered.length > 0) this.setCurrentRuleSetId(filtered[0].id);
    } catch (error) {
      console.error('Failed to delete rule set:', error);
    }
  }

  /**
   * 获取当前规则集ID
   */
  static getCurrentRuleSetId(): string {
    if (isSupabaseConfigured && _currentRuleIdCache) return _currentRuleIdCache;
    try {
      const stored = localStorage.getItem(CURRENT_RULE_SET_KEY);
      if (stored) return stored;
      const defaultRules = getDefaultRules();
      this.setCurrentRuleSetId(defaultRules.id);
      return defaultRules.id;
    } catch (error) {
      console.error('Failed to get current rule set ID:', error);
      return getDefaultRules().id;
    }
  }

  /**
   * 设置当前规则集ID
   */
  static setCurrentRuleSetId(ruleSetId: string): void {
    if (isSupabaseConfigured) {
      const id = UUID_REGEX.test(ruleSetId) ? ruleSetId : (ruleSetId === 'default-rules-v1' || ruleSetId === 'default-rules-v2' ? DEFAULT_RULES_UUID : ruleSetId);
      _currentRuleIdCache = ruleSetId;
      salesRuleService.setCurrentRuleSetId(id).catch((e) => console.error('Failed to set current rule set:', e));
      return;
    }
    try {
      localStorage.setItem(CURRENT_RULE_SET_KEY, ruleSetId);
    } catch (error) {
      console.error('Failed to set current rule set ID:', error);
    }
  }

  /**
   * 获取当前规则集
   */
  static getCurrentRuleSet(): RuleSet {
    if (isSupabaseConfigured && _ruleCache) {
      const currentId = _currentRuleIdCache ?? getDefaultRules().id;
      const ruleSet = _ruleCache.find((rs) => rs.id === currentId);
      return ruleSet ?? getDefaultRules();
    }
    const currentId = this.getCurrentRuleSetId();
    const allRuleSets = this.getAllRuleSets();
    const ruleSet = allRuleSets.find((rs) => rs.id === currentId);
    if (!ruleSet) {
      const defaultRules = getDefaultRules();
      this.setCurrentRuleSetId(defaultRules.id);
      return defaultRules;
    }
    return ruleSet;
  }
}
