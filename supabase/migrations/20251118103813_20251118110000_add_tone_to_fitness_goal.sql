/*
  # 添加 'tone' 到 fitness_goal 约束

  1. 问题
    - 前端使用 'tone' 作为健身目标选项
    - 数据库约束不包含 'tone'，导致保存失败

  2. 变更
    - 删除旧的 fitness_goal 约束
    - 创建新的约束，包含 'tone' 选项

  3. 允许的值
    - weight_loss: 减轻体重
    - maintain_health: 焕肤
    - tone: 保持健康
    - confidence: 保持自信
    - muscle_gain: 增肌
    - other: 其它

  4. 注意
    - 使用 IF EXISTS 确保安全删除旧约束
    - 保持所有现有值的兼容性
*/

-- 删除旧的 fitness_goal 约束
ALTER TABLE user_profiles 
DROP CONSTRAINT IF EXISTS user_profiles_fitness_goal_check;

-- 创建新的约束，包含 'tone'
ALTER TABLE user_profiles
ADD CONSTRAINT user_profiles_fitness_goal_check 
CHECK (
  fitness_goal = ANY (ARRAY[
    'weight_loss'::text,
    'maintain_health'::text,
    'tone'::text,
    'confidence'::text,
    'muscle_gain'::text,
    'other'::text
  ])
);
