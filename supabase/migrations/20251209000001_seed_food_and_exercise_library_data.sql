/*
  # Seed Food and Exercise Library with Initial Data
  
  This migration inserts the initial food and exercise items
  that are currently hardcoded in the frontend components.
  
  Note: This script will only insert if the items don't already exist
  (based on name matching).
*/

-- Insert initial food library data (only if not exists)
-- 肉蛋奶类、蔬果类、主食杂粮类
INSERT INTO food_library (name, icon, image_url, category, calories, unit, protein, carbs, fat, fiber, is_active, display_order)
SELECT * FROM (VALUES
('水煮蛋', '🥚', 'https://images.pexels.com/photos/162712/egg-white-food-protein-162712.jpeg?auto=compress&cs=tinysrgb&w=100', '肉蛋奶', 71, '个', 6.3, 0.6, 5.0, 0, true, 1),
('蔬菜沙拉', '🥗', 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=100', '蔬果', 76, '份', 2.5, 8.0, 4.2, 3.5, true, 2),
('火龙果', '🐲', 'https://images.pexels.com/photos/1435735/pexels-photo-1435735.jpeg?auto=compress&cs=tinysrgb&w=100', '蔬果', 153.7, '个', 1.8, 36.0, 0.6, 3.0, true, 3),
('苹果', '🍎', 'https://images.pexels.com/photos/102104/pexels-photo-102104.jpeg?auto=compress&cs=tinysrgb&w=100', '蔬果', 70.8, '个', 0.4, 18.8, 0.2, 2.4, true, 4),
('玉米', '🌽', 'https://images.pexels.com/photos/1268101/pexels-photo-1268101.jpeg?auto=compress&cs=tinysrgb&w=100', '主食杂粮', 119, '根', 4.2, 25.0, 1.2, 2.8, true, 5),
('清蒸山药段', '🍠', 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=100', '主食杂粮', 297.5, '份', 4.5, 68.0, 0.8, 4.2, true, 6),
('紫薯', '🍠', 'https://images.pexels.com/photos/1435735/pexels-photo-1435735.jpeg?auto=compress&cs=tinysrgb&w=100', '主食杂粮', 82, '个', 1.6, 20.0, 0.2, 3.0, true, 7)
) AS v(name, icon, image_url, category, calories, unit, protein, carbs, fat, fiber, is_active, display_order)
WHERE NOT EXISTS (
  SELECT 1 FROM food_library WHERE food_library.name = v.name
);

-- Insert initial exercise library data (only if not exists)
INSERT INTO exercise_library (name, icon, category, calories, duration, is_active, display_order)
SELECT * FROM (VALUES
('户外跑步', '🏃', '有氧', 720, 45, true, 1),
('跑步机跑步', '🏃', '有氧', 661, 45, true, 2),
('户外行走', '🚶', '有氧', 480, 60, true, 3),
('跑步机行走', '🚶', '有氧', 580, 60, true, 4),
('户外骑行', '🚴', '有氧', 511, 45, true, 5),
('动感单车', '🚴', '有氧', 611, 45, true, 6),
('跳绳', '🤸', '有氧', 450, 30, true, 7)
) AS v(name, icon, category, calories, duration, is_active, display_order)
WHERE NOT EXISTS (
  SELECT 1 FROM exercise_library WHERE exercise_library.name = v.name
);

-- Verify the data was inserted
SELECT 
  'food_library' as table_name,
  COUNT(*) as total_count,
  COUNT(*) FILTER (WHERE is_active = true) as active_count
FROM food_library
UNION ALL
SELECT 
  'exercise_library' as table_name,
  COUNT(*) as total_count,
  COUNT(*) FILTER (WHERE is_active = true) as active_count
FROM exercise_library;

