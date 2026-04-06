/*
  # 下线 exercise_records 表

  前提：运动数据已迁入 health_records（record_type = exercise），且已核对条数。
  CASCADE：删除依赖该表的约束/对象（若有）。
*/

DROP TABLE IF EXISTS public.exercise_records CASCADE;
