-- 补剂疗程「服务结构锁定」：一次查询返回存在进行中已支付订单的 supplement_plan_id 集合
-- 替代原先 products + 全量 orders 行拉取，避免列表/详情接口在订单多时极慢

CREATE OR REPLACE FUNCTION public.supplement_plan_ids_in_active_service(plan_ids uuid[])
RETURNS TABLE (supplement_plan_id uuid)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT DISTINCT p.supplement_plan_id
  FROM public.orders o
  INNER JOIN public.products p ON p.id = o.product_id
  WHERE cardinality(plan_ids) > 0
    AND p.supplement_plan_id = ANY(plan_ids)
    AND o.payment_status = 'paid'
    AND o.order_status <> 'cancelled'
    AND o.order_status <> 'completed';
$$;

COMMENT ON FUNCTION public.supplement_plan_ids_in_active_service(uuid[]) IS
  'Which supplement_plans (ids) have at least one paid, non-terminal order via products; used for admin structure lock.';

GRANT EXECUTE ON FUNCTION public.supplement_plan_ids_in_active_service(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.supplement_plan_ids_in_active_service(uuid[]) TO service_role;

-- 加速 orders ↔ products 反查（可选，对大数据量订单表效果明显）
CREATE INDEX IF NOT EXISTS idx_orders_active_paid_product
  ON public.orders (product_id)
  WHERE payment_status = 'paid'
    AND order_status IS NOT NULL
    AND order_status <> 'cancelled'
    AND order_status <> 'completed';
