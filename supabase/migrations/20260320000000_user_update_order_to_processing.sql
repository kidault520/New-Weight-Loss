-- 允许用户将已支付订单的 order_status 更新为 processing（开启服务后）
-- 支付完成 → 用户配置配送计划 → 配置成功后自动变为「服务中」
DROP POLICY IF EXISTS "Users can update own order to processing" ON orders;
CREATE POLICY "Users can update own order to processing"
  ON orders
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND payment_status = 'paid'
    AND order_status IN ('pending', 'confirmed')
  )
  WITH CHECK (auth.uid() = user_id);
