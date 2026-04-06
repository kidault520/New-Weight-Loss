/*
  # 将历史 exercise_records 迁入 health_records（record_type = exercise）

  - 按 id 幂等：health_records 已存在同 id 则跳过
  - value/unit：消耗千卡
  - 明细写入 exercise_data
  - chat_message_id：仅当 health_records 上已有该列时才写入（避免未跑 20260312 迁移时报错）
  - exercise_records 多数库无 updated_at：目标 updated_at 用 created_at / recorded_at 兜底，不引用 er.updated_at
*/

DO $$
DECLARE
  hr_has_chat_id boolean;
  er_has_chat_id boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'health_records'
      AND column_name = 'chat_message_id'
  ) INTO hr_has_chat_id;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'exercise_records'
      AND column_name = 'chat_message_id'
  ) INTO er_has_chat_id;

  IF hr_has_chat_id AND er_has_chat_id THEN
    INSERT INTO public.health_records (
      id,
      user_id,
      record_type,
      value,
      unit,
      exercise_data,
      notes,
      recorded_at,
      created_at,
      updated_at,
      chat_message_id
    )
    SELECT
      er.id,
      er.user_id,
      'exercise',
      COALESCE(er.calories_burned::numeric, 0),
      'kcal',
      jsonb_strip_nulls(
        jsonb_build_object(
          'name', er.exercise_name,
          'exercise_type', COALESCE(er.exercise_type::text, 'other'),
          'duration', COALESCE(er.duration_minutes, 0),
          'calories_burned', COALESCE(er.calories_burned::numeric, 0),
          'intensity', er.intensity,
          'source', COALESCE(er.source, 'manual')
        )
      ),
      CASE
        WHEN er.notes IS NOT NULL
          AND trim(er.notes) <> ''
          AND left(trim(er.notes), 1) <> '{'
        THEN er.notes
        ELSE NULL
      END,
      er.recorded_at,
      COALESCE(er.created_at, er.recorded_at),
      COALESCE(er.created_at, er.recorded_at),
      er.chat_message_id
    FROM public.exercise_records er
    WHERE NOT EXISTS (
      SELECT 1 FROM public.health_records h WHERE h.id = er.id
    );

  ELSIF hr_has_chat_id AND NOT er_has_chat_id THEN
    INSERT INTO public.health_records (
      id,
      user_id,
      record_type,
      value,
      unit,
      exercise_data,
      notes,
      recorded_at,
      created_at,
      updated_at,
      chat_message_id
    )
    SELECT
      er.id,
      er.user_id,
      'exercise',
      COALESCE(er.calories_burned::numeric, 0),
      'kcal',
      jsonb_strip_nulls(
        jsonb_build_object(
          'name', er.exercise_name,
          'exercise_type', COALESCE(er.exercise_type::text, 'other'),
          'duration', COALESCE(er.duration_minutes, 0),
          'calories_burned', COALESCE(er.calories_burned::numeric, 0),
          'intensity', er.intensity,
          'source', COALESCE(er.source, 'manual')
        )
      ),
      CASE
        WHEN er.notes IS NOT NULL
          AND trim(er.notes) <> ''
          AND left(trim(er.notes), 1) <> '{'
        THEN er.notes
        ELSE NULL
      END,
      er.recorded_at,
      COALESCE(er.created_at, er.recorded_at),
      COALESCE(er.created_at, er.recorded_at),
      NULL::uuid
    FROM public.exercise_records er
    WHERE NOT EXISTS (
      SELECT 1 FROM public.health_records h WHERE h.id = er.id
    );

  ELSE
    INSERT INTO public.health_records (
      id,
      user_id,
      record_type,
      value,
      unit,
      exercise_data,
      notes,
      recorded_at,
      created_at,
      updated_at
    )
    SELECT
      er.id,
      er.user_id,
      'exercise',
      COALESCE(er.calories_burned::numeric, 0),
      'kcal',
      jsonb_strip_nulls(
        jsonb_build_object(
          'name', er.exercise_name,
          'exercise_type', COALESCE(er.exercise_type::text, 'other'),
          'duration', COALESCE(er.duration_minutes, 0),
          'calories_burned', COALESCE(er.calories_burned::numeric, 0),
          'intensity', er.intensity,
          'source', COALESCE(er.source, 'manual')
        )
      ),
      CASE
        WHEN er.notes IS NOT NULL
          AND trim(er.notes) <> ''
          AND left(trim(er.notes), 1) <> '{'
        THEN er.notes
        ELSE NULL
      END,
      er.recorded_at,
      COALESCE(er.created_at, er.recorded_at),
      COALESCE(er.created_at, er.recorded_at)
    FROM public.exercise_records er
    WHERE NOT EXISTS (
      SELECT 1 FROM public.health_records h WHERE h.id = er.id
    );
  END IF;
END $$;
