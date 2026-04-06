-- 地址默认餐次：设为默认地址时，可指定该地址应用于哪些餐次
-- default_meal_types: null 或 [] = 沿用原逻辑；['all'] = 全部餐次；['lunch','dinner'] = 指定餐次
ALTER TABLE delivery_addresses ADD COLUMN IF NOT EXISTS default_meal_types jsonb DEFAULT NULL;

COMMENT ON COLUMN delivery_addresses.default_meal_types IS '默认应用于的餐次：null=原逻辑，["all"]=全部，["lunch","dinner"]=指定餐次';
