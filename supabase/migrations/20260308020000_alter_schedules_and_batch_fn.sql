ALTER TABLE meal_schedules ADD COLUMN IF NOT EXISTS start_time timestamptz;
ALTER TABLE meal_schedules ADD COLUMN IF NOT EXISTS end_time timestamptz;
ALTER TABLE meal_schedules ADD COLUMN IF NOT EXISTS created_by uuid;

ALTER TABLE supplement_schedules ADD COLUMN IF NOT EXISTS start_time timestamptz;
ALTER TABLE supplement_schedules ADD COLUMN IF NOT EXISTS end_time timestamptz;
ALTER TABLE supplement_schedules ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE supplement_schedules ADD COLUMN IF NOT EXISTS course_id uuid REFERENCES supplement_plans(id);

CREATE OR REPLACE FUNCTION schedules_batch_insert(entries jsonb, creator uuid)
RETURNS jsonb AS $$
DECLARE
  elem jsonb;
  t text;
  start_ts timestamptz;
  end_ts timestamptz;
  course uuid;
  total_days int;
  ok_count int := 0;
  fail_count int := 0;
  failures jsonb := '[]'::jsonb;
  yesterday date := (now()::date - 1);
BEGIN
  FOR elem IN SELECT jsonb_array_elements(entries) LOOP
    BEGIN
      t := (elem->>'type');
      start_ts := (elem->>'start_time')::timestamptz;
      IF start_ts IS NULL THEN
        RAISE EXCEPTION 'invalid start_time';
      END IF;
      IF start_ts::date <> yesterday THEN
        RAISE EXCEPTION 'start_time must equal yesterday (%)', yesterday;
      END IF;

      IF t = 'meal' THEN
        end_ts := (start_ts + interval '6 day')::timestamptz + interval '23 hours 59 minutes 59 seconds';
        INSERT INTO meal_schedules(schedule_name, start_time, end_time, created_by)
        VALUES (elem->>'schedule_name', start_ts, end_ts, creator);
        ok_count := ok_count + 1;
      ELSIF t = 'supplement' THEN
        course := (elem->>'course_id')::uuid;
        total_days := COALESCE((elem->>'total_days')::int, NULL);
        IF course IS NULL OR total_days IS NULL THEN
          RAISE EXCEPTION 'course_id and total_days required';
        END IF;
        IF EXISTS(SELECT 1 FROM supplement_schedules WHERE course_id = course) THEN
          RAISE EXCEPTION 'duplicate schedule for course_id %', course;
        END IF;
        end_ts := (start_ts + make_interval(days => total_days - 1)) + interval '23 hours 59 minutes 59 seconds';
        INSERT INTO supplement_schedules(schedule_name, total_days, course_id, start_time, end_time, created_by)
        VALUES (elem->>'schedule_name', total_days, course, start_ts, end_ts, creator);
        ok_count := ok_count + 1;
      ELSE
        RAISE EXCEPTION 'invalid type %', t;
      END IF;
    EXCEPTION WHEN others THEN
      fail_count := fail_count + 1;
      failures := failures || jsonb_build_array(jsonb_build_object(
        'entry', elem,
        'error', SQLERRM
      ));
    END;
  END LOOP;

  IF fail_count > 0 THEN
    PERFORM 1;
  END IF;

  RETURN jsonb_build_object(
    'success', ok_count,
    'failure', fail_count,
    'failures', failures
  );
END;
$$ LANGUAGE plpgsql;
