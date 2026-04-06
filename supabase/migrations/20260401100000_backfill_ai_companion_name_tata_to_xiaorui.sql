-- 历史默认 AI 伙伴名 TATA → 小瑞（与前端 DEFAULT_AI_COMPANION_NAME 一致）
-- 1) 已存在资料中 json name 为精确 TATA（去空白后）的行
-- 2) 列默认值改为小瑞，避免后续依赖 DB 默认的新行仍为 TATA

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

-- 新插入且未显式写入 ai_companion_settings 时使用与产品一致的默认
ALTER TABLE public.user_profiles
  ALTER COLUMN ai_companion_settings SET DEFAULT jsonb_build_object(
    'name', '小瑞',
    'owner_name', 'owner',
    'gender', '保密',
    'identity', '你的教练',
    'description', '虽然命令和利嘴讯不断，外冷内热，但关心隐藏在严厉下。'
  );
