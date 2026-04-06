-- Backfill settlement snapshots for historical paid orders.
-- Idempotent: only inserts orders that do not have snapshots yet.

WITH paid_orders AS (
  SELECT
    o.id,
    o.order_number,
    o.user_id,
    o.salesperson_id,
    o.product_id,
    o.payment_time,
    o.created_at,
    COALESCE(o.total_amount, 0)::numeric AS total_amount,
    COALESCE(o.payment_time, o.created_at) AS order_ts
  FROM public.orders o
  LEFT JOIN public.order_settlement_snapshots s ON s.order_id = o.id
  WHERE o.payment_status = 'paid'
    AND s.order_id IS NULL
),
resolved_version AS (
  SELECT
    po.*,
    COALESCE(v_hit.version, v_fallback.version) AS used_version,
    COALESCE(v_hit.effective_at, v_fallback.effective_at) AS used_effective_at,
    COALESCE(v_hit.product_mappings, v_fallback.product_mappings, '[]'::jsonb) AS used_product_mappings,
    COALESCE(v_hit.discount_rates, v_fallback.discount_rates, '[]'::jsonb) AS used_discount_rates
  FROM paid_orders po
  LEFT JOIN LATERAL (
    SELECT v.version, v.effective_at, v.product_mappings, v.discount_rates
    FROM public.sales_product_config_versions v
    WHERE v.config_key = 'default'
      AND v.effective_at <= po.order_ts
    ORDER BY v.effective_at DESC
    LIMIT 1
  ) v_hit ON TRUE
  LEFT JOIN LATERAL (
    SELECT v.version, v.effective_at, v.product_mappings, v.discount_rates
    FROM public.sales_product_config_versions v
    WHERE v.config_key = 'default'
    ORDER BY v.effective_at ASC
    LIMIT 1
  ) v_fallback ON TRUE
),
resolved_mapping AS (
  SELECT
    rv.*,
    mp.category AS mapped_category,
    COALESCE(mp.attribute, '') AS mapped_attribute
  FROM resolved_version rv
  LEFT JOIN LATERAL (
    SELECT
      m->>'category' AS category,
      COALESCE(m->>'attribute', '') AS attribute
    FROM jsonb_array_elements(rv.used_product_mappings) AS m
    WHERE COALESCE(m->>'productId', m->>'product_id', '') = COALESCE(rv.product_id::text, '')
    LIMIT 1
  ) mp ON TRUE
),
resolved_rate AS (
  SELECT
    rm.*,
    COALESCE(
      exact_rate.discount_rate,
      category_rate.discount_rate,
      0.6::numeric
    ) AS used_discount_rate
  FROM resolved_mapping rm
  LEFT JOIN LATERAL (
    SELECT
      CASE
        WHEN (COALESCE(r->>'discountRate', r->>'discount_rate', '')) ~ '^-?[0-9]+(\.[0-9]+)?$'
          THEN (COALESCE(r->>'discountRate', r->>'discount_rate'))::numeric
        ELSE NULL
      END AS discount_rate
    FROM jsonb_array_elements(rm.used_discount_rates) AS r
    WHERE COALESCE(r->>'category', '') = COALESCE(rm.mapped_category, '')
      AND COALESCE(r->>'attribute', '') = COALESCE(rm.mapped_attribute, '')
    LIMIT 1
  ) exact_rate ON TRUE
  LEFT JOIN LATERAL (
    SELECT
      CASE
        WHEN (COALESCE(r->>'discountRate', r->>'discount_rate', '')) ~ '^-?[0-9]+(\.[0-9]+)?$'
          THEN (COALESCE(r->>'discountRate', r->>'discount_rate'))::numeric
        ELSE NULL
      END AS discount_rate
    FROM jsonb_array_elements(rm.used_discount_rates) AS r
    WHERE COALESCE(r->>'category', '') = COALESCE(rm.mapped_category, '')
      AND COALESCE(r->>'attribute', '') = ''
    LIMIT 1
  ) category_rate ON TRUE
)
INSERT INTO public.order_settlement_snapshots (
  order_id,
  order_number,
  user_id,
  salesperson_id,
  product_id,
  payment_time,
  settled_amount,
  config_version,
  discount_rate,
  commission_rate,
  estimated_commission,
  config_snapshot
)
SELECT
  rr.id,
  rr.order_number,
  rr.user_id,
  rr.salesperson_id,
  rr.product_id,
  rr.payment_time,
  rr.total_amount::numeric(12,2),
  rr.used_version,
  rr.used_discount_rate::numeric(8,6),
  0.27::numeric(8,6),
  ROUND((rr.total_amount * rr.used_discount_rate * 0.27)::numeric, 2)::numeric(12,2),
  CASE
    WHEN rr.used_version IS NULL THEN NULL
    ELSE jsonb_build_object(
      'version', rr.used_version,
      'effective_at', rr.used_effective_at,
      'product_mappings', rr.used_product_mappings,
      'discount_rates', rr.used_discount_rates
    )
  END
FROM resolved_rate rr
ON CONFLICT (order_id) DO NOTHING;

