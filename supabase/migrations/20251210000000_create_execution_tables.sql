/*
  # Create Execution Engine Tables

  1. New Tables
    - `execution_programs` - 执行计划表（从订单同步）
    - `daily_execution_tasks` - 每日任务表
    - `execution_feedbacks` - 执行反馈表
    - `execution_reports` - 进度报告表

  2. Features
    - 执行计划从订单自动同步（基于 orders.payment_status = 'paid'）
    - 通过 orders.product_id → products.duration_days 获取套餐天数
    - 自动生成每日任务流
    - AI生成进度报告和情绪托管

  3. Security
    - Enable RLS on all tables
    - Users can only access their own execution data
*/

-- Execution programs table (执行计划表)
CREATE TABLE IF NOT EXISTS execution_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  program_type integer NOT NULL CHECK (program_type > 0), -- 21, 90等套餐天数
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
  current_day integer NOT NULL DEFAULT 1 CHECK (current_day > 0),
  total_days integer NOT NULL CHECK (total_days > 0),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT valid_date_range CHECK (end_date >= start_date),
  CONSTRAINT valid_current_day CHECK (current_day <= total_days),
  CONSTRAINT unique_user_order UNIQUE(user_id, order_id)
);

-- Daily execution tasks table (每日任务表)
CREATE TABLE IF NOT EXISTS daily_execution_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES execution_programs(id) ON DELETE CASCADE,
  task_date date NOT NULL,
  task_type text NOT NULL CHECK (task_type IN ('meal', 'exercise', 'water', 'sleep', 'checkin')),
  task_status text NOT NULL DEFAULT 'pending' CHECK (task_status IN ('pending', 'completed', 'skipped')),
  scheduled_time time, -- 计划执行时间，如 "12:00:00"
  completed_at timestamptz,
  task_data jsonb DEFAULT '{}'::jsonb, -- 存储任务详情，如餐食信息
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT unique_program_task UNIQUE(program_id, task_date, task_type, scheduled_time)
);

-- Execution feedbacks table (执行反馈表)
CREATE TABLE IF NOT EXISTS execution_feedbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES daily_execution_tasks(id) ON DELETE CASCADE,
  feedback_type text NOT NULL CHECK (feedback_type IN ('completion', 'emotion', 'progress')),
  feedback_data jsonb DEFAULT '{}'::jsonb, -- 用户反馈数据
  ai_interpretation text, -- AI生成的解释
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Execution reports table (进度报告表)
CREATE TABLE IF NOT EXISTS execution_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES execution_programs(id) ON DELETE CASCADE,
  report_type text NOT NULL CHECK (report_type IN ('daily', 'weekly', 'milestone')),
  report_date date NOT NULL,
  report_content jsonb DEFAULT '{}'::jsonb, -- AI生成的报告内容
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT unique_program_report UNIQUE(program_id, report_type, report_date)
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_execution_programs_user_id ON execution_programs(user_id);
CREATE INDEX IF NOT EXISTS idx_execution_programs_order_id ON execution_programs(order_id);
CREATE INDEX IF NOT EXISTS idx_execution_programs_status ON execution_programs(status);
CREATE INDEX IF NOT EXISTS idx_execution_programs_dates ON execution_programs(start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_daily_tasks_program_id ON daily_execution_tasks(program_id);
CREATE INDEX IF NOT EXISTS idx_daily_tasks_date ON daily_execution_tasks(task_date);
CREATE INDEX IF NOT EXISTS idx_daily_tasks_status ON daily_execution_tasks(task_status);
CREATE INDEX IF NOT EXISTS idx_daily_tasks_type ON daily_execution_tasks(task_type);

CREATE INDEX IF NOT EXISTS idx_execution_feedbacks_task_id ON execution_feedbacks(task_id);
CREATE INDEX IF NOT EXISTS idx_execution_feedbacks_type ON execution_feedbacks(feedback_type);

CREATE INDEX IF NOT EXISTS idx_execution_reports_program_id ON execution_reports(program_id);
CREATE INDEX IF NOT EXISTS idx_execution_reports_type ON execution_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_execution_reports_date ON execution_reports(report_date);

-- Enable RLS
ALTER TABLE execution_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_execution_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_feedbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for execution_programs
DROP POLICY IF EXISTS "Users can view their own execution programs" ON execution_programs;
CREATE POLICY "Users can view their own execution programs"
  ON execution_programs FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own execution programs" ON execution_programs;
CREATE POLICY "Users can insert their own execution programs"
  ON execution_programs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own execution programs" ON execution_programs;
CREATE POLICY "Users can update their own execution programs"
  ON execution_programs FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for daily_execution_tasks
DROP POLICY IF EXISTS "Users can view their own execution tasks" ON daily_execution_tasks;
CREATE POLICY "Users can view their own execution tasks"
  ON daily_execution_tasks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM execution_programs
      WHERE execution_programs.id = daily_execution_tasks.program_id
      AND execution_programs.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert their own execution tasks" ON daily_execution_tasks;
CREATE POLICY "Users can insert their own execution tasks"
  ON daily_execution_tasks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM execution_programs
      WHERE execution_programs.id = daily_execution_tasks.program_id
      AND execution_programs.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their own execution tasks" ON daily_execution_tasks;
CREATE POLICY "Users can update their own execution tasks"
  ON daily_execution_tasks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM execution_programs
      WHERE execution_programs.id = daily_execution_tasks.program_id
      AND execution_programs.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM execution_programs
      WHERE execution_programs.id = daily_execution_tasks.program_id
      AND execution_programs.user_id = auth.uid()
    )
  );

-- RLS Policies for execution_feedbacks
DROP POLICY IF EXISTS "Users can view their own execution feedbacks" ON execution_feedbacks;
CREATE POLICY "Users can view their own execution feedbacks"
  ON execution_feedbacks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM daily_execution_tasks
      JOIN execution_programs ON execution_programs.id = daily_execution_tasks.program_id
      WHERE daily_execution_tasks.id = execution_feedbacks.task_id
      AND execution_programs.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert their own execution feedbacks" ON execution_feedbacks;
CREATE POLICY "Users can insert their own execution feedbacks"
  ON execution_feedbacks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM daily_execution_tasks
      JOIN execution_programs ON execution_programs.id = daily_execution_tasks.program_id
      WHERE daily_execution_tasks.id = execution_feedbacks.task_id
      AND execution_programs.user_id = auth.uid()
    )
  );

-- RLS Policies for execution_reports
DROP POLICY IF EXISTS "Users can view their own execution reports" ON execution_reports;
CREATE POLICY "Users can view their own execution reports"
  ON execution_reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM execution_programs
      WHERE execution_programs.id = execution_reports.program_id
      AND execution_programs.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert their own execution reports" ON execution_reports;
CREATE POLICY "Users can insert their own execution reports"
  ON execution_reports FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM execution_programs
      WHERE execution_programs.id = execution_reports.program_id
      AND execution_programs.user_id = auth.uid()
    )
  );

