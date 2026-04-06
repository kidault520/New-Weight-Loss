/*
  # 删除 execution_reports

  前端已移除 executionReportService / SmartReportScreen，不再写入或读取本表。
  删除不影响 execution_programs、daily_execution_tasks、日反馈（DailyReportCard）等业务。
*/

DROP POLICY IF EXISTS "Users can view their own execution reports" ON public.execution_reports;
DROP POLICY IF EXISTS "Users can insert their own execution reports" ON public.execution_reports;

DROP TABLE IF EXISTS public.execution_reports;
