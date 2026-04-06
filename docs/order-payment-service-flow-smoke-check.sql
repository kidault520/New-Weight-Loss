-- 订单/支付/服务开启巡检（只读）
-- 目标：快速发现“支付成功未推进、退款后不一致、多订单串单风险”。

-- 0) 订单总览
select
  count(*) as total_orders,
  count(*) filter (where payment_status = 'paid') as paid_orders,
  count(*) filter (where order_status = 'processing') as processing_orders,
  count(*) filter (where order_status = 'cancelled') as cancelled_orders,
  count(*) filter (where order_status = 'refunded' or payment_status = 'refunded') as refunded_orders
from orders;

-- 1) 支付成功但未进入服务中（异常候选）
select
  id, user_id, order_number, order_status, payment_status, payment_time, updated_at
from orders
where payment_status = 'paid'
  and coalesce(order_status, '') not in ('processing', 'completed', 'refunded', 'cancelled')
order by updated_at desc
limit 100;

-- 2) 退款相关状态不一致（异常候选）
select
  id, user_id, order_number, order_status, payment_status, updated_at
from orders
where payment_status = 'refunded'
  and coalesce(order_status, '') not in ('refunded', 'cancelled')
order by updated_at desc
limit 100;

-- 3) 多订单用户（支付成功）分布
select
  user_id,
  count(*) as paid_order_count
from orders
where payment_status = 'paid'
  and coalesce(order_status, '') <> 'cancelled'
group by user_id
having count(*) > 1
order by paid_order_count desc
limit 100;

-- 4) 最近订单状态变化（抽样）
select
  id, user_id, order_number, order_status, payment_status, total_amount, updated_at
from orders
order by updated_at desc
limit 200;

-- 5) 订单与配送计划关联抽样（用于确认服务开启后数据落地）
select
  o.id as order_id,
  o.order_number,
  o.user_id,
  o.order_status,
  o.payment_status,
  count(ds.id) as linked_delivery_rows
from orders o
left join delivery_schedules ds on ds.order_id = o.id
group by o.id, o.order_number, o.user_id, o.order_status, o.payment_status
order by o.updated_at desc
limit 100;

-- 6) 支付回调幂等检查（同一 payment_event_id 只能出现 1 条）
select
  payment_event_id,
  count(*) as row_count
from payment_callback_events
group by payment_event_id
having count(*) > 1
order by row_count desc, payment_event_id
limit 100;

-- 7) 支付状态回退检查（订单当前 pending，但历史事件已出现 paid）
select
  o.id,
  o.order_number,
  o.payment_status,
  max(e.created_at) as last_paid_event_at
from orders o
join payment_callback_events e on e.order_id = o.id
where o.payment_status = 'pending'
  and e.callback_payment_status = 'paid'
group by o.id, o.order_number, o.payment_status
order by last_paid_event_at desc
limit 100;

-- 8) 最近24小时 paid 订单的回调覆盖率
select
  count(*) filter (
    where exists (
      select 1
      from payment_callback_events e
      where e.order_id = o.id
    )
  ) as paid_orders_with_callback,
  count(*) as paid_orders_24h
from orders o
where o.payment_status = 'paid'
  and o.updated_at >= now() - interval '24 hours';

-- 9) 补偿待办A：paid 但未推进到 processing/completed/cancelled/refunded
select
  o.id as order_id,
  o.order_number,
  o.user_id,
  o.payment_status,
  o.order_status,
  o.updated_at,
  '待处理' as todo_status
from orders o
where o.payment_status = 'paid'
  and coalesce(o.order_status, '') not in ('processing', 'completed', 'cancelled', 'refunded')
order by o.updated_at desc
limit 100;

-- 10) 补偿待办B：processing 但无配送执行数据（按当前业务口径）
select
  o.id as order_id,
  o.order_number,
  o.user_id,
  o.payment_status,
  o.order_status,
  count(ds.id) as linked_delivery_rows,
  max(o.updated_at) as updated_at,
  '待处理' as todo_status
from orders o
left join delivery_schedules ds on ds.order_id = o.id
where o.order_status = 'processing'
group by o.id, o.order_number, o.user_id, o.payment_status, o.order_status
having count(ds.id) = 0
order by updated_at desc
limit 100;

-- 11) 补偿待办C：refunded 但仍有未取消配送状态
select
  o.id as order_id,
  o.order_number,
  o.user_id,
  o.payment_status,
  o.order_status,
  ds.id as schedule_id,
  ds.status as schedule_status,
  o.updated_at,
  '待处理' as todo_status
from orders o
join delivery_schedules ds on ds.order_id = o.id
where o.payment_status = 'refunded'
  and coalesce(ds.status, '') <> 'cancelled'
order by o.updated_at desc
limit 100;
