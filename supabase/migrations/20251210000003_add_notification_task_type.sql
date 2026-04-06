/*
  # Add 'notification' task type to daily_execution_tasks
  
  Fix: Allow 'notification' as a valid task_type value
*/

-- Drop the existing CHECK constraint
ALTER TABLE daily_execution_tasks 
  DROP CONSTRAINT IF EXISTS daily_execution_tasks_task_type_check;

-- Add new CHECK constraint that includes 'notification'
ALTER TABLE daily_execution_tasks 
  ADD CONSTRAINT daily_execution_tasks_task_type_check 
  CHECK (task_type IN ('meal', 'exercise', 'water', 'sleep', 'checkin', 'notification'));


