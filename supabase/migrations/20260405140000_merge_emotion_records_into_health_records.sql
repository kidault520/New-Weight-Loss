/*
  # 将 emotion_records 合并入 health_records

  - 新增 emotion_data jsonb（emotion / intensity / message）
  - record_type 增加 'emotion'
  - 迁移旧数据后删除 emotion_records
  - get_user_day_health_data 改为从 health_records 读情绪
*/

-- 1. 结构
ALTER TABLE public.health_records
  ADD COLUMN IF NOT EXISTS emotion_data jsonb;

-- 2. 暂时去掉 CHECK，以便写入 emotion
ALTER TABLE public.health_records DROP CONSTRAINT IF EXISTS health_records_record_type_check;

-- 3. 迁移数据（保留原 UUID，避免外部引用断裂）
INSERT INTO public.health_records (
  id,
  user_id,
  record_type,
  value,
  unit,
  notes,
  emotion_data,
  recorded_at,
  created_at,
  updated_at
)
SELECT
  er.id,
  er.user_id,
  'emotion',
  COALESCE(er.intensity, 0.5)::numeric,
  NULL,
  er.message,
  jsonb_build_object(
    'emotion', er.emotion,
    'intensity', COALESCE(er.intensity, 0.5),
    'message', er.message
  ),
  er.recorded_at,
  er.created_at,
  er.created_at
FROM public.emotion_records er
WHERE NOT EXISTS (SELECT 1 FROM public.health_records hr WHERE hr.id = er.id);

-- 4. 日聚合函数：情绪改从 health_records 读取
CREATE OR REPLACE FUNCTION get_user_day_health_data(
  p_user_id uuid,
  p_start_date timestamptz,
  p_end_date timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
  v_weight_records jsonb;
  v_water_records jsonb;
  v_steps_records jsonb;
  v_food_records jsonb;
  v_exercise_records jsonb;
  v_measurement_records jsonb;
  v_sleep_records jsonb;
  v_glucose_records jsonb;
  v_emotion_records jsonb;
BEGIN
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized access';
  END IF;

  SELECT jsonb_agg(row_to_json(hr.*)) INTO v_weight_records
  FROM health_records hr
  WHERE hr.user_id = p_user_id
    AND hr.record_type = 'weight'
    AND hr.recorded_at >= p_start_date
    AND hr.recorded_at <= p_end_date;

  SELECT jsonb_agg(row_to_json(hr.*)) INTO v_water_records
  FROM health_records hr
  WHERE hr.user_id = p_user_id
    AND hr.record_type = 'water'
    AND hr.recorded_at >= p_start_date
    AND hr.recorded_at <= p_end_date;

  SELECT jsonb_agg(row_to_json(hr.*)) INTO v_steps_records
  FROM health_records hr
  WHERE hr.user_id = p_user_id
    AND hr.record_type = 'steps'
    AND hr.recorded_at >= p_start_date
    AND hr.recorded_at <= p_end_date;

  SELECT jsonb_agg(row_to_json(hr.*)) INTO v_food_records
  FROM health_records hr
  WHERE hr.user_id = p_user_id
    AND hr.record_type = 'food'
    AND hr.recorded_at >= p_start_date
    AND hr.recorded_at <= p_end_date;

  SELECT jsonb_agg(row_to_json(hr.*)) INTO v_exercise_records
  FROM health_records hr
  WHERE hr.user_id = p_user_id
    AND hr.record_type = 'exercise'
    AND hr.recorded_at >= p_start_date
    AND hr.recorded_at <= p_end_date;

  SELECT jsonb_agg(row_to_json(hr.*)) INTO v_measurement_records
  FROM health_records hr
  WHERE hr.user_id = p_user_id
    AND hr.record_type = 'measurements'
    AND hr.recorded_at >= p_start_date
    AND hr.recorded_at <= p_end_date;

  SELECT jsonb_agg(row_to_json(hr.*)) INTO v_sleep_records
  FROM health_records hr
  WHERE hr.user_id = p_user_id
    AND hr.record_type = 'sleep'
    AND hr.recorded_at >= p_start_date
    AND hr.recorded_at <= p_end_date;

  SELECT jsonb_agg(row_to_json(hr.*)) INTO v_glucose_records
  FROM health_records hr
  WHERE hr.user_id = p_user_id
    AND hr.record_type = 'blood_glucose'
    AND hr.recorded_at >= p_start_date
    AND hr.recorded_at <= p_end_date;

  SELECT jsonb_agg(row_to_json(hr.*)) INTO v_emotion_records
  FROM health_records hr
  WHERE hr.user_id = p_user_id
    AND hr.record_type = 'emotion'
    AND hr.recorded_at >= p_start_date
    AND hr.recorded_at <= p_end_date;

  v_result := jsonb_build_object(
    'weight_records', COALESCE(v_weight_records, '[]'::jsonb),
    'water_records', COALESCE(v_water_records, '[]'::jsonb),
    'steps_records', COALESCE(v_steps_records, '[]'::jsonb),
    'food_records', COALESCE(v_food_records, '[]'::jsonb),
    'exercise_records', COALESCE(v_exercise_records, '[]'::jsonb),
    'measurement_records', COALESCE(v_measurement_records, '[]'::jsonb),
    'sleep_records', COALESCE(v_sleep_records, '[]'::jsonb),
    'glucose_records', COALESCE(v_glucose_records, '[]'::jsonb),
    'emotion_records', COALESCE(v_emotion_records, '[]'::jsonb)
  );

  RETURN v_result;
END;
$$;

-- 5. 删除旧表与索引
DROP INDEX IF EXISTS idx_emotion_records_user_date;
DROP TABLE IF EXISTS public.emotion_records;

-- 6. 恢复 CHECK（与 supplement 迁移一致，并含 emotion）
ALTER TABLE public.health_records ADD CONSTRAINT health_records_record_type_check
  CHECK (record_type IN (
    'weight',
    'water',
    'steps',
    'food',
    'exercise',
    'measurements',
    'calories',
    'hrv',
    'blood_pressure',
    'sleep',
    'blood_glucose',
    'supplement',
    'emotion'
  ));
