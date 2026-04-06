-- 业务订单号强制 ORD + YYYYMMDD + 6 位数字；禁止外部单号写入 orders.order_number；创建后不可改。
-- 回填历史非规范单号（如支付沙箱商户号 TSTSVC…），并同步排期/结算快照中的订单号展示字段。

-- 1) 回填 orders：单号非 ORD+14 位数字的一律分配新 ORD（id 不变）
DO $$
DECLARE
  r RECORD;
  new_number TEXT;
  exists_check BOOLEAN;
BEGIN
  FOR r IN
    SELECT id
    FROM public.orders
    WHERE order_number IS NULL
       OR btrim(order_number) = ''
       OR order_number !~ '^ORD[0-9]{14}$'
  LOOP
    LOOP
      new_number := 'ORD' || to_char(now(), 'YYYYMMDD')
        || lpad(floor(random() * 1000000)::text, 6, '0');
      SELECT EXISTS(SELECT 1 FROM public.orders WHERE order_number = new_number) INTO exists_check;
      EXIT WHEN NOT exists_check;
    END LOOP;
    UPDATE public.orders
    SET order_number = new_number,
        updated_at = now()
    WHERE id = r.id;
  END LOOP;
END $$;

-- 2) 排期、结算快照与当前订单号对齐
UPDATE public.delivery_schedules ds
SET delivery_order_number = o.order_number,
    updated_at = coalesce(ds.updated_at, now())
FROM public.orders o
WHERE ds.order_id = o.id
  AND (ds.delivery_order_number IS DISTINCT FROM o.order_number);

-- 快照表为 append-only，需暂时关闭 UPDATE 防护触发器后再对齐 order_number
ALTER TABLE public.order_settlement_snapshots DISABLE TRIGGER trg_order_settlement_snapshots_prevent_update;

UPDATE public.order_settlement_snapshots s
SET order_number = o.order_number
FROM public.orders o
WHERE s.order_id = o.id
  AND (s.order_number IS DISTINCT FROM o.order_number);

ALTER TABLE public.order_settlement_snapshots ENABLE TRIGGER trg_order_settlement_snapshots_prevent_update;

-- 3) INSERT：空值、空串或非 ORD+14 位数字 → 重新生成（禁止客户端/集成层覆盖）
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  new_number TEXT;
  exists_check BOOLEAN;
BEGIN
  IF NEW.order_number IS NULL
     OR btrim(NEW.order_number) = ''
     OR NEW.order_number !~ '^ORD[0-9]{14}$'
  THEN
    LOOP
      new_number := 'ORD' || to_char(now(), 'YYYYMMDD')
        || lpad(floor(random() * 1000000)::text, 6, '0');
      SELECT EXISTS(SELECT 1 FROM public.orders WHERE order_number = new_number) INTO exists_check;
      EXIT WHEN NOT exists_check;
    END LOOP;
    NEW.order_number := new_number;
  END IF;
  RETURN NEW;
END;
$$;

-- 4) UPDATE：禁止修改 order_number
CREATE OR REPLACE FUNCTION public.prevent_orders_order_number_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.order_number IS DISTINCT FROM OLD.order_number THEN
    RAISE EXCEPTION 'orders.order_number is immutable (order id=%)', OLD.id
      USING ERRCODE = '55000',
            HINT = '业务订单号仅由库内生成；支付渠道商户单号请记在 payment 流水或回调 payload，勿写入 orders.order_number。';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_orders_order_number_mutation ON public.orders;
CREATE TRIGGER trg_prevent_orders_order_number_mutation
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_orders_order_number_mutation();

-- 5) 表级约束（与触发器格式一致）
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_order_number_format_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_order_number_format_check
  CHECK (order_number ~ '^ORD[0-9]{14}$');

COMMENT ON FUNCTION public.generate_order_number() IS
  'BEFORE INSERT ON orders: 强制业务单号 ORD+YYYYMMDD+6位随机数，忽略非规范入参。';
COMMENT ON FUNCTION public.prevent_orders_order_number_mutation() IS
  'BEFORE UPDATE ON orders: order_number 创建后不可变。';
