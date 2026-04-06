-- =============================================================================
-- 手动在 Supabase Dashboard → SQL Editor 执行（与迁移 20260401100000 等价）
-- 将 user_profiles.ai_companion_settings.name 由历史默认 TATA 写为小瑞，并修正列默认
-- =============================================================================

-- 执行前：将命中行数（应为 UPDATE 影响行数）
SELECT count(*) AS would_update_rows
FROM public.user_profiles
WHERE ai_companion_settings IS NOT NULL
  AND btrim(ai_companion_settings->>'name') = 'TATA';

UPDATE public.user_profiles
SET
  ai_companion_settings = jsonb_set(
    ai_companion_settings,
    '{name}',
    to_jsonb('小瑞'::text),
    true
  ),
  updated_at = now()
WHERE ai_companion_settings IS NOT NULL
  AND btrim(ai_companion_settings->>'name') = 'TATA';

ALTER TABLE public.user_profiles
  ALTER COLUMN ai_companion_settings SET DEFAULT jsonb_build_object(
    'name', '小瑞',
    'owner_name', 'owner',
    'gender', '保密',
    'identity', '你的教练',
    'description', '虽然命令和利嘴讯不断，外冷内热，但关心隐藏在严厉下。'
  );

-- 执行后：应无 TATA（仅统计仍有 name 键的行）
SELECT user_id, ai_companion_settings->>'name' AS ai_name
FROM public.user_profiles
WHERE ai_companion_settings IS NOT NULL
  AND btrim(ai_companion_settings->>'name') = 'TATA'
LIMIT 20;
