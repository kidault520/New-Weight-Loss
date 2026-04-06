-- 允许用户更新自己的待支付订单为已支付（模拟支付流程）
-- 仅当 payment_status = 'pending' 时可更新
DROP POLICY IF EXISTS "Users can update own pending order payment" ON orders;
CREATE POLICY "Users can update own pending order payment"
  ON orders
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND payment_status = 'pending'
  )
  WITH CHECK (auth.uid() = user_id);
