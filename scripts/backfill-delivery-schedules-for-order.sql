-- 根据订单号回填 delivery_schedules，并关联 order_id
-- 优先从 user_profiles.meal_plan_config_data 读取；若无则从订单+商品推算日期
-- 在 Supabase SQL Editor 中执行
--
-- 用法：将下方 'ORD20260315879071' 替换为实际订单号

DO $$
DECLARE
  v_order_id uuid;
  v_user_id uuid;
  v_config jsonb;
  v_dates text[];
  v_meal_types text[];
  v_address_id uuid;
  v_date text;
  v_meal text;
  v_meal_time_start text;
  v_meal_time_end text;
  v_item_name text;
  v_inserted int := 0;
  v_i int;
  v_j int;
  v_start_date date;
  v_duration_days int;
BEGIN
  -- 1. 获取订单
  SELECT o.id, o.user_id INTO v_order_id, v_user_id
  FROM orders o
  WHERE o.order_number = 'ORD20260315879071';

  IF v_order_id IS NULL OR v_user_id IS NULL THEN
    RAISE EXCEPTION '订单不存在: ORD20260315879071';
  END IF;

  -- 2. 获取 meal_plan_config_data（可能为空）
  SELECT up.meal_plan_config_data INTO v_config
  FROM user_profiles up
  WHERE up.user_id = v_user_id;

  -- 3. 日期与餐次：优先 config，否则从订单+商品推算
  IF v_config IS NOT NULL AND v_config->'selected_dates' IS NOT NULL AND v_config->'selected_meal_types' IS NOT NULL THEN
    SELECT array_agg(elem) INTO v_dates FROM jsonb_array_elements_text(v_config->'selected_dates') AS elem;
    SELECT array_agg(elem) INTO v_meal_types FROM jsonb_array_elements_text(v_config->'selected_meal_types') AS elem;
  END IF;

  IF v_dates IS NULL OR v_meal_types IS NULL THEN
    -- 兜底：从订单的 product.duration_days 和 start_time/payment_time 推算
    SELECT
      (COALESCE(o.start_time, o.payment_time, o.created_at))::date,
      COALESCE(p.duration_days, 14)
    INTO v_start_date, v_duration_days
    FROM orders o
    LEFT JOIN products p ON p.id = o.product_id
    WHERE o.order_number = 'ORD20260315879071';
    IF v_start_date IS NULL THEN
      RAISE EXCEPTION '订单无有效开始日期';
    END IF;
    v_duration_days := GREATEST(COALESCE(v_duration_days, 14), 1);
    SELECT array_agg((v_start_date + (g - 1))::text) INTO v_dates
    FROM generate_series(1, v_duration_days) g;
    v_meal_types := ARRAY['lunch', 'dinner'];
    RAISE NOTICE '使用订单+商品推算：% 天，午餐+晚餐，自 %', v_duration_days, v_start_date;
  END IF;

  IF v_dates IS NULL OR v_meal_types IS NULL THEN
    RAISE EXCEPTION '无法获取配送日期或餐次';
  END IF;

  -- 4. 默认地址：优先 config，否则订单地址，否则用户默认/首个
  IF v_config IS NOT NULL THEN
    BEGIN
      v_address_id := (v_config->>'delivery_address_id')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_address_id := NULL;
    END;
  END IF;
  IF v_address_id IS NULL THEN
    SELECT delivery_address_id INTO v_address_id FROM orders WHERE order_number = 'ORD20260315879071';
  END IF;
  IF v_address_id IS NULL THEN
    SELECT id INTO v_address_id FROM delivery_addresses WHERE user_id = v_user_id AND is_default = true LIMIT 1;
  END IF;
  IF v_address_id IS NULL THEN
    SELECT id INTO v_address_id FROM delivery_addresses WHERE user_id = v_user_id LIMIT 1;
  END IF;
  IF v_address_id IS NULL THEN
    RAISE EXCEPTION '用户 % 无配送地址', v_user_id;
  END IF;

  -- 5. 按日期+餐次插入 delivery_schedules
  FOR v_i IN 1..array_length(v_dates, 1)
  LOOP
    v_date := split_part(v_dates[v_i], 'T', 1);
    FOR v_j IN 1..array_length(v_meal_types, 1)
    LOOP
      v_meal := v_meal_types[v_j];
      -- 餐次时间
      v_meal_time_start := CASE v_meal
        WHEN 'breakfast' THEN '06:30'
        WHEN 'lunch' THEN '11:30'
        WHEN 'dinner' THEN '17:30'
        ELSE '11:30'
      END;
      v_meal_time_end := CASE v_meal
        WHEN 'breakfast' THEN '07:30'
        WHEN 'lunch' THEN '12:30'
        WHEN 'dinner' THEN '18:30'
        ELSE '12:30'
      END;
      v_item_name := CASE v_meal
        WHEN 'breakfast' THEN '早餐健康餐'
        WHEN 'lunch' THEN '午餐健康餐'
        WHEN 'dinner' THEN '晚餐健康餐'
        ELSE '健康餐'
      END;

      INSERT INTO delivery_schedules (
        user_id,
        order_id,
        delivery_type,
        delivery_date,
        delivery_time,
        delivery_time_start,
        delivery_time_end,
        meal_type,
        item_name,
        quantity,
        delivery_address_id,
        is_locked,
        status
      ) VALUES (
        v_user_id,
        v_order_id,
        'meal',
        v_date::date,
        v_meal_time_start || '-' || v_meal_time_end,
        v_meal_time_start,
        v_meal_time_end,
        v_meal,
        v_item_name,
        1,
        v_address_id,
        true,
        'scheduled'
      )
      ON CONFLICT (user_id, delivery_date, meal_type) WHERE meal_type IS NOT NULL DO UPDATE SET
        order_id = EXCLUDED.order_id,
        delivery_address_id = EXCLUDED.delivery_address_id,
        is_locked = EXCLUDED.is_locked,
        updated_at = now();

      v_inserted := v_inserted + 1;
    END LOOP;
  END LOOP;

  RAISE NOTICE '订单 % 回填完成，共 % 条配送计划', 'ORD20260315879071', v_inserted;
END $$;
