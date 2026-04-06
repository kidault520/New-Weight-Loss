/*
  # RLS策略审计脚本
  
  此脚本用于检查所有表的RLS状态和策略配置
  执行此脚本可以验证数据库安全性
*/

-- ============================================================================
-- 1. 检查所有表的RLS启用状态
-- ============================================================================
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled,
  CASE 
    WHEN rowsecurity THEN '✅ RLS已启用'
    ELSE '❌ RLS未启用 - 安全风险！'
  END as status
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- ============================================================================
-- 2. 列出所有表的RLS策略
-- ============================================================================
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd as command,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ============================================================================
-- 3. 检查没有RLS策略的表（高风险）
-- ============================================================================
SELECT 
  t.tablename,
  COUNT(p.policyname) as policy_count,
  CASE 
    WHEN t.rowsecurity = false THEN '❌ RLS未启用'
    WHEN COUNT(p.policyname) = 0 THEN '⚠️ RLS已启用但无策略'
    ELSE '✅ 有策略'
  END as security_status
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename AND t.schemaname = p.schemaname
WHERE t.schemaname = 'public'
GROUP BY t.tablename, t.rowsecurity
HAVING t.rowsecurity = false OR COUNT(p.policyname) = 0
ORDER BY t.tablename;

-- ============================================================================
-- 4. 检查关键用户数据表的RLS策略完整性
-- ============================================================================
WITH critical_tables AS (
  SELECT unnest(ARRAY[
    'user_profiles',
    'health_records',
    'exercise_records',
    'chat_messages',
    'health_assessments',
    'orders',
    'order_items',
    'user_packages',
    'delivery_addresses',
    'emotion_records'
  ]) as tablename
)
SELECT 
  ct.tablename,
  t.rowsecurity as rls_enabled,
  COUNT(p.policyname) as policy_count,
  STRING_AGG(p.cmd::text, ', ') as commands,
  CASE 
    WHEN t.rowsecurity = false THEN '❌ 严重：RLS未启用'
    WHEN COUNT(p.policyname) = 0 THEN '❌ 严重：无RLS策略'
    WHEN COUNT(p.policyname) < 3 THEN '⚠️ 警告：策略可能不完整'
    ELSE '✅ 策略完整'
  END as security_status
FROM critical_tables ct
LEFT JOIN pg_tables t ON ct.tablename = t.tablename AND t.schemaname = 'public'
LEFT JOIN pg_policies p ON ct.tablename = p.tablename AND p.schemaname = 'public'
GROUP BY ct.tablename, t.rowsecurity
ORDER BY 
  CASE 
    WHEN t.rowsecurity = false THEN 1
    WHEN COUNT(p.policyname) = 0 THEN 2
    WHEN COUNT(p.policyname) < 3 THEN 3
    ELSE 4
  END,
  ct.tablename;

-- ============================================================================
-- 5. 检查策略中是否都包含user_id过滤（防止数据泄露）
-- ============================================================================
SELECT 
  tablename,
  policyname,
  cmd,
  qual as using_expression,
  CASE 
    WHEN qual LIKE '%auth.uid()%' OR qual LIKE '%user_id%' THEN '✅ 包含用户验证'
    ELSE '⚠️ 可能缺少用户验证'
  END as user_verification
FROM pg_policies
WHERE schemaname = 'public'
  AND cmd IN ('SELECT', 'UPDATE', 'DELETE')
  AND tablename IN (
    'user_profiles',
    'health_records',
    'exercise_records',
    'chat_messages',
    'health_assessments'
  )
ORDER BY tablename, policyname;

-- ============================================================================
-- 6. 生成RLS策略报告
-- ============================================================================
DO $$
DECLARE
  total_tables INTEGER;
  enabled_rls INTEGER;
  disabled_rls INTEGER;
  tables_with_policies INTEGER;
  tables_without_policies INTEGER;
BEGIN
  -- 统计总数
  SELECT COUNT(*) INTO total_tables
  FROM pg_tables 
  WHERE schemaname = 'public';
  
  -- 统计RLS启用情况
  SELECT COUNT(*) INTO enabled_rls
  FROM pg_tables 
  WHERE schemaname = 'public' AND rowsecurity = true;
  
  SELECT COUNT(*) INTO disabled_rls
  FROM pg_tables 
  WHERE schemaname = 'public' AND rowsecurity = false;
  
  -- 统计有策略的表
  SELECT COUNT(DISTINCT tablename) INTO tables_with_policies
  FROM pg_policies
  WHERE schemaname = 'public';
  
  -- 统计无策略的表
  SELECT COUNT(*) INTO tables_without_policies
  FROM pg_tables t
  WHERE t.schemaname = 'public'
    AND t.rowsecurity = true
    AND NOT EXISTS (
      SELECT 1 FROM pg_policies p 
      WHERE p.tablename = t.tablename AND p.schemaname = 'public'
    );
  
  -- 输出报告
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RLS策略审计报告';
  RAISE NOTICE '========================================';
  RAISE NOTICE '总表数: %', total_tables;
  RAISE NOTICE 'RLS已启用: %', enabled_rls;
  RAISE NOTICE 'RLS未启用: %', disabled_rls;
  RAISE NOTICE '有策略的表: %', tables_with_policies;
  RAISE NOTICE '无策略的表: %', tables_without_policies;
  RAISE NOTICE '========================================';
  
  IF disabled_rls > 0 OR tables_without_policies > 0 THEN
    RAISE WARNING '发现安全风险！请检查上述统计结果';
  ELSE
    RAISE NOTICE '✅ 所有表RLS策略配置正常';
  END IF;
END $$;

