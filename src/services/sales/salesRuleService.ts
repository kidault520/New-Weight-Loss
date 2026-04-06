/**
 * 规则集服务
 * 对应 B 端 ruleStorage
 */

import { supabase } from '../../config/supabase';

export interface RuleSet {
  id: string;
  name: string;
  version: number;
  effectiveDate: string;
  description?: string;
  rules: unknown[];
  promotionRules: unknown[];
  evaluationRules: unknown[];
  createdAt?: string;
  updatedAt?: string;
}

function rowToRuleSet(r: Record<string, unknown>): RuleSet {
  return {
    id: r.id as string,
    name: r.name as string,
    version: Number(r.version ?? 1),
    effectiveDate: r.effective_date as string,
    description: r.description as string | undefined,
    rules: (r.rules as unknown[]) || [],
    promotionRules: (r.promotion_rules as unknown[]) || [],
    evaluationRules: (r.evaluation_rules as unknown[]) || [],
    createdAt: r.created_at as string | undefined,
    updatedAt: r.updated_at as string | undefined,
  };
}

export const salesRuleService = {
  async getAll(): Promise<RuleSet[]> {
    const { data, error } = await supabase
      .from('sales_rule_sets')
      .select('*')
      .order('effective_date', { ascending: false });

    if (error) throw error;
    return (data || []).map(rowToRuleSet);
  },

  async getById(id: string): Promise<RuleSet | null> {
    const { data, error } = await supabase
      .from('sales_rule_sets')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data ? rowToRuleSet(data) : null;
  },

  async getCurrentRuleSetId(): Promise<string | null> {
    const { data, error } = await supabase
      .from('sales_current_rule_set')
      .select('rule_set_id')
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data?.rule_set_id as string | null;
  },

  async getCurrentRuleSet(): Promise<RuleSet | null> {
    const id = await this.getCurrentRuleSetId();
    if (!id) return null;
    return this.getById(id);
  },

  async setCurrentRuleSetId(ruleSetId: string): Promise<void> {
    const FIXED_CONFIG_ID = 'a0000000-0000-0000-0000-000000000001';
    const { error } = await supabase
      .from('sales_current_rule_set')
      .upsert(
        { id: FIXED_CONFIG_ID, rule_set_id: ruleSetId },
        { onConflict: 'id' }
      );

    if (error) throw error;
  },

  async upsert(ruleSet: Partial<RuleSet> & { name: string; version: number; effectiveDate: string }): Promise<RuleSet> {
    const row: Record<string, unknown> = {
      name: ruleSet.name,
      version: ruleSet.version,
      effective_date: ruleSet.effectiveDate,
      description: ruleSet.description ?? null,
      rules: ruleSet.rules ?? [],
      promotion_rules: ruleSet.promotionRules ?? [],
      evaluation_rules: ruleSet.evaluationRules ?? [],
    };

    const { data, error } = await supabase
      .from('sales_rule_sets')
      .upsert(row, { onConflict: 'id' })
      .select()
      .single();

    if (error) throw error;
    return rowToRuleSet(data);
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('sales_rule_sets').delete().eq('id', id);
    if (error) throw error;
  },
};
