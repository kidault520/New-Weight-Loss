-- 呼吸练习：record_type breathing + breathing_data；并入今日快捷合并 RPC

ALTER TABLE public.health_records
  ADD COLUMN IF NOT EXISTS breathing_data jsonb;

ALTER TABLE public.health_records DROP CONSTRAINT IF EXISTS health_records_record_type_check;

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
    'emotion',
    'breathing'
  ));

CREATE OR REPLACE FUNCTION public.get_today_quick_entry_merge_inputs(
  p_user_id uuid,
  p_day_start timestamptz,
  p_day_end timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chat jsonb;
  v_health jsonb;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO v_chat
  FROM (
    SELECT id, created_at, is_quick_entry_confirmed, quick_entry_data
    FROM chat_messages
    WHERE user_id = p_user_id
      AND message_type = 'quickEntry'
      AND quick_entry_data IS NOT NULL
      AND created_at >= p_day_start
      AND created_at <= p_day_end
    ORDER BY created_at ASC
    LIMIT 300
  ) t;

  SELECT coalesce(jsonb_agg(row_to_json(h)), '[]'::jsonb)
  INTO v_health
  FROM (
    SELECT *
    FROM health_records
    WHERE user_id = p_user_id
      AND recorded_at >= p_day_start
      AND recorded_at <= p_day_end
      AND record_type = ANY (
        ARRAY[
          'food',
          'water',
          'steps',
          'weight',
          'sleep',
          'measurements',
          'blood_glucose',
          'supplement',
          'exercise',
          'emotion',
          'breathing'
        ]::text[]
      )
    ORDER BY recorded_at ASC
    LIMIT 800
  ) h;

  RETURN jsonb_build_object('chat_messages', v_chat, 'health_records', v_health);
END;
$$;

COMMENT ON FUNCTION public.get_today_quick_entry_merge_inputs(uuid, timestamptz, timestamptz) IS
  'Returns raw chat quickEntry rows + health_records for Beijing calendar window; merge/dedupe in mergeQuickEntryAggregate.ts (Edge + Vite).';

REVOKE ALL ON FUNCTION public.get_today_quick_entry_merge_inputs(uuid, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_today_quick_entry_merge_inputs(uuid, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_today_quick_entry_merge_inputs(uuid, timestamptz, timestamptz) TO service_role;
