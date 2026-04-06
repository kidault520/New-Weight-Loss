-- 餐食疗程（meal_plans）仅表示时长与餐次等结构参数，与套餐（meal_packages）解耦。
-- CASCADE 会一并删除 RLS 策略等依赖对象。

DROP TABLE IF EXISTS meal_plan_packages CASCADE;
