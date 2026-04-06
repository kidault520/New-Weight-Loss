-- 在 Supabase Dashboard → SQL Editor 中执行，核对 user_profiles / user_preferences 的 RLS 是否与客户端一致。
-- 客户端：anon JWT + auth.uid()；查询条件 .eq('user_id', userId)，userId 须等于 auth.users.id。

-- 1) RLS 是否开启
SELECT c.relname AS table_name,
       c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('user_profiles', 'user_preferences')
ORDER BY 1;

-- 2) 当前策略（应与迁移 20251118042044、20251115051910 一致）
SELECT tablename,
       policyname,
       cmd,
       roles,
       qual AS using_expr,
       with_check AS with_check_expr
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('user_profiles', 'user_preferences')
ORDER BY tablename, cmd, policyname;

-- 期望摘要（人工核对）：
-- user_profiles:
--   SELECT authenticated USING (user_id = auth.uid())
--   INSERT authenticated WITH CHECK (user_id = auth.uid())
--   UPDATE authenticated USING + WITH CHECK (user_id = auth.uid())
-- user_preferences:
--   SELECT authenticated USING (auth.uid() = user_id)
--   INSERT authenticated WITH CHECK (auth.uid() = user_id)
--   UPDATE authenticated USING + WITH CHECK (auth.uid() = user_id)
--
-- 若线上仍残留旧策略「id = auth.uid()」且未应用 20251118042044_fix_user_profiles_rls_policies，
-- 则 SELECT 会永远查不到自己的行（表现为「无档案」），但通常不会「请求挂起几十秒」；
-- 长时间无响应更常见是到 *.supabase.co 的网络问题，而非 RLS 表达式本身。
