/**
 * RLS策略审计测试脚本
 * 用于检查数据库安全性
 * 
 * 使用方法：
 * 1. 在Supabase Dashboard的SQL编辑器中执行
 * 2. 或通过命令行：node scripts/test-rls-audit.js（需要配置数据库连接）
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 缺少Supabase环境变量');
  console.error('请设置 VITE_SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function auditRLSPolicies() {
  console.log('🔍 开始RLS策略审计...\n');

  try {
    // 1. 检查所有表的RLS启用状态
    console.log('📊 1. 检查所有表的RLS启用状态');
    console.log('='.repeat(60));
    
    const { data: tables, error: tablesError } = await supabase.rpc('exec_sql', {
      query: `
        SELECT 
          tablename,
          rowsecurity as rls_enabled,
          CASE 
            WHEN rowsecurity THEN '✅ RLS已启用'
            ELSE '❌ RLS未启用 - 安全风险！'
          END as status
        FROM pg_tables 
        WHERE schemaname = 'public'
        ORDER BY tablename;
      `
    });

    if (tablesError) {
      console.log('⚠️ 无法通过RPC执行，请直接在Supabase SQL编辑器中执行审计脚本');
      console.log('📄 脚本位置: project/supabase/migrations/20241220000000_audit_rls_policies.sql\n');
      return;
    }

    if (tables && tables.length > 0) {
      tables.forEach(table => {
        console.log(`${table.status} ${table.tablename}`);
      });
    }

    // 2. 检查关键表的策略数量
    console.log('\n📊 2. 检查关键表的RLS策略数量');
    console.log('='.repeat(60));

    const criticalTables = [
      'user_profiles',
      'health_records',
      'chat_messages',
      'health_assessments',
      'orders',
      'order_items',
      'user_packages',
      'delivery_addresses'
    ];

    for (const tableName of criticalTables) {
      const { data: policies, error } = await supabase
        .from('pg_policies')
        .select('policyname')
        .eq('tablename', tableName);

      if (!error && policies) {
        const count = policies.length;
        const status = count >= 3 ? '✅' : count > 0 ? '⚠️' : '❌';
        console.log(`${status} ${tableName}: ${count} 个策略`);
      }
    }

    console.log('\n✅ RLS审计完成');
    console.log('\n💡 提示: 如需详细报告，请在Supabase SQL编辑器中执行:');
    console.log('   project/supabase/migrations/20241220000000_audit_rls_policies.sql');

  } catch (error) {
    console.error('❌ 审计过程出错:', error.message);
    console.log('\n💡 建议: 直接在Supabase Dashboard的SQL编辑器中执行审计脚本');
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  auditRLSPolicies().then(() => {
    console.log('\n✨ 完成');
    process.exit(0);
  }).catch(error => {
    console.error('❌ 执行失败:', error);
    process.exit(1);
  });
}

module.exports = { auditRLSPolicies };

