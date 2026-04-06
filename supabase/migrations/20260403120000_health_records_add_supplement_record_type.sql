/*
  # health_records.record_type：补全 supplement

  quickEntrySyncService 写入 record_type = 'supplement'，但 20251202000000 约束未包含该值，
  会导致 INSERT 违反 CHECK（与按 chat_message_id 去重的 SELECT 无关，但属同类 schema 漂移）。
*/

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
    'supplement'
  ));
