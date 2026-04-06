-- 批量生成餐食排期：每周开始时间线性递增（第1周=yesterday，第2周=yesterday+7，...）
-- 在 Supabase Dashboard → SQL Editor 中执行此脚本

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
  days_diff int;
BEGIN
  FOR elem IN SELECT jsonb_array_elements(entries) LOOP
    BEGIN
      t := (elem->>'type');
      start_ts := (elem->>'start_time')::timestamptz;
      IF start_ts IS NULL THEN
        RAISE EXCEPTION 'invalid start_time';
      END IF;

      IF t = 'meal' THEN
        -- 餐食排期：线性日历，start >= yesterday 即可，每周 7 天
        days_diff := (start_ts::date - yesterday);
        IF days_diff < 0 THEN
          RAISE EXCEPTION 'meal start_time 不能早于 %', yesterday;
        END IF;
        end_ts := (start_ts + interval '6 day')::timestamptz + interval '23 hours 59 minutes 59 seconds';
        INSERT INTO meal_schedules(schedule_name, start_time, end_time, created_by)
        VALUES (elem->>'schedule_name', start_ts, end_ts, creator);
        ok_count := ok_count + 1;
      ELSIF t = 'supplement' THEN
        IF start_ts::date <> yesterday THEN
          RAISE EXCEPTION 'start_time must equal yesterday (%)', yesterday;
        END IF;
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
