-- 每个补剂疗程（supplement_plans）至多一条排期：与 C 端按 course_id 取「最新一条」的语义一致，避免静默多版本。

-- 若历史数据存在同一 course_id 多条排期，保留 created_at 最新的一条（并列则 id 较大者），其余删除（级联删阶段与阶段补剂行）。
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY course_id
      ORDER BY created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM public.supplement_schedules
  WHERE course_id IS NOT NULL
)
DELETE FROM public.supplement_schedules s
USING ranked r
WHERE s.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS supplement_schedules_course_id_key
  ON public.supplement_schedules (course_id)
  WHERE course_id IS NOT NULL;

COMMENT ON INDEX public.supplement_schedules_course_id_key IS
  'One supplement schedule per supplement_plans id (course_id); aligns with user active-supplement-stage lookup.';
