/*
  # Daily step goal on user_profiles (与 water_intake 同级持久化)

  - `daily_steps_goal` (integer, nullable) — 每日步数目标，单位：步
  - NULL 表示使用应用默认（当前为 8000）
  - CHECK：NULL 或 1000–100000（与客户端编辑范围一致）
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_profiles'
      AND column_name = 'daily_steps_goal'
  ) THEN
    ALTER TABLE public.user_profiles
      ADD COLUMN daily_steps_goal integer
      CHECK (
        daily_steps_goal IS NULL
        OR (daily_steps_goal >= 1000 AND daily_steps_goal <= 100000)
      );
    COMMENT ON COLUMN public.user_profiles.daily_steps_goal IS
      'Daily step goal (1000-100000 steps); NULL uses app default (8000)';
  END IF;
END $$;
