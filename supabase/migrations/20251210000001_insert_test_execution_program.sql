/*
  # Insert Test Execution Program
  为测试用户创建执行计划测试数据
  
  使用方法：
  1. 在 Supabase Dashboard 的 SQL Editor 中运行此脚本
  2. 脚本会自动查找第一个已支付订单并创建执行计划
  3. 如果执行计划已存在，会更新当前天数
  4. 会自动创建今日的测试任务
*/

DO $$
DECLARE
  v_user_id uuid;
  v_order_id uuid;
  v_program_id uuid;
  v_start_date date;
  v_end_date date;
  v_current_day integer;
BEGIN
  -- 获取第一个已支付订单的用户ID和订单ID
  SELECT o.user_id, o.id INTO v_user_id, v_order_id
  FROM orders o
  WHERE o.payment_status = 'paid'
  ORDER BY o.created_at DESC
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE '没有找到已支付的订单，无法创建测试数据';
    RETURN;
  END IF;

  RAISE NOTICE '找到用户: %, 订单: %', v_user_id, v_order_id;

  -- 计算日期（从订单创建日期开始，21天）
  v_start_date := (SELECT DATE(created_at) FROM orders WHERE id = v_order_id);
  v_end_date := v_start_date + INTERVAL '20 days'; -- 21天 = 开始日期 + 20天
  
  -- 计算当前是第几天（修复：使用正确的日期差计算）
  v_current_day := GREATEST(1, LEAST(21, (CURRENT_DATE - v_start_date)::integer + 1));

  -- 检查是否已存在执行计划
  SELECT id INTO v_program_id
  FROM execution_programs
  WHERE user_id = v_user_id AND order_id = v_order_id
  LIMIT 1;

  IF v_program_id IS NOT NULL THEN
    RAISE NOTICE '执行计划已存在: %', v_program_id;
    -- 更新现有计划
    UPDATE execution_programs
    SET 
      current_day = v_current_day,
      status = CASE WHEN CURRENT_DATE > v_end_date THEN 'completed' ELSE 'active' END,
      updated_at = NOW()
    WHERE id = v_program_id;
    RAISE NOTICE '已更新执行计划: %', v_program_id;
  ELSE
    -- 创建新执行计划
    INSERT INTO execution_programs (
      user_id,
      order_id,
      program_type,
      start_date,
      end_date,
      status,
      current_day,
      total_days
    ) VALUES (
      v_user_id,
      v_order_id,
      21, -- 21天套餐
      v_start_date,
      v_end_date,
      CASE WHEN CURRENT_DATE > v_end_date THEN 'completed' ELSE 'active' END,
      v_current_day,
      21
    ) RETURNING id INTO v_program_id;
    
    RAISE NOTICE '已创建执行计划: %, 当前第 % 天', v_program_id, v_current_day;
  END IF;

  -- 为今天创建一些测试任务
  INSERT INTO daily_execution_tasks (
    program_id,
    task_date,
    task_type,
    task_status,
    scheduled_time,
    task_data
  ) VALUES 
    (v_program_id, CURRENT_DATE, 'meal', 'pending', '08:00:00', '{"meal_type": "breakfast", "description": "早餐时间"}'::jsonb),
    (v_program_id, CURRENT_DATE, 'meal', 'pending', '12:00:00', '{"meal_type": "lunch", "description": "午餐时间"}'::jsonb),
    (v_program_id, CURRENT_DATE, 'meal', 'pending', '18:00:00', '{"meal_type": "dinner", "description": "晚餐时间"}'::jsonb),
    (v_program_id, CURRENT_DATE, 'water', 'pending', '10:00:00', '{"target_ml": 2000, "description": "今日饮水目标"}'::jsonb),
    (v_program_id, CURRENT_DATE, 'sleep', 'pending', '22:00:00', '{"target_hours": 8, "description": "今日睡眠目标"}'::jsonb),
    (v_program_id, CURRENT_DATE, 'checkin', 'pending', '23:00:00', '{"description": "每日健康打卡"}'::jsonb)
  ON CONFLICT (program_id, task_date, task_type, scheduled_time) DO NOTHING;

  RAISE NOTICE '已创建今日任务';
END $$;

