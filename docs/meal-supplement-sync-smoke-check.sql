-- 餐食/补剂展示同步巡检（只读）
-- 目标：快速发现“同日分桶异常、订单有效性与展示不一致”等问题。

-- 0) 北京时间当前时间与日期边界
select
  now() as server_now_utc,
  timezone('Asia/Shanghai', now()) as server_now_bj,
  (timezone('Asia/Shanghai', now()))::date as today_bj;

-- 1) 餐食今日分布（每用户）
with today_bj as (
  select (timezone('Asia/Shanghai', now()))::date as d
)
select
  user_id,
  count(*) filter (where meal_type = 'breakfast') as breakfast_cnt,
  count(*) filter (where meal_type = 'lunch') as lunch_cnt,
  count(*) filter (where meal_type = 'dinner') as dinner_cnt,
  count(*) as total_cnt
from delivery_schedules ds, today_bj t
where ds.delivery_type = 'meal'
  and ds.delivery_date = t.d
group by user_id
order by total_cnt desc
limit 100;

-- 2) 餐食边界分布（昨天/今天/明天）
with bj_dates as (
  select
    (timezone('Asia/Shanghai', now()))::date as today_bj,
    ((timezone('Asia/Shanghai', now()))::date - interval '1 day')::date as yesterday_bj,
    ((timezone('Asia/Shanghai', now()))::date + interval '1 day')::date as tomorrow_bj
)
select
  ds.delivery_date,
  count(*) as cnt
from delivery_schedules ds, bj_dates d
where ds.delivery_type = 'meal'
  and ds.delivery_date in (d.yesterday_bj, d.today_bj, d.tomorrow_bj)
group by ds.delivery_date
order by ds.delivery_date;

-- 3) 有效订单用户数（对照展示基线）
select
  count(distinct user_id) as paid_order_users
from orders
where payment_status = 'paid'
  and coalesce(order_status, '') <> 'cancelled';

-- 4) 今日有餐食但无有效订单（异常候选）
with today_bj as (
  select (timezone('Asia/Shanghai', now()))::date as d
),
today_meal_users as (
  select distinct ds.user_id
  from delivery_schedules ds, today_bj t
  where ds.delivery_type = 'meal'
    and ds.delivery_date = t.d
),
paid_users as (
  select distinct o.user_id
  from orders o
  where o.payment_status = 'paid'
    and coalesce(o.order_status, '') <> 'cancelled'
)
select tm.user_id
from today_meal_users tm
left join paid_users pu on pu.user_id = tm.user_id
where pu.user_id is null
limit 100;

-- 5) 今日餐食记录明细（抽样）
with today_bj as (
  select (timezone('Asia/Shanghai', now()))::date as d
)
select
  id, user_id, delivery_date, meal_type, status, updated_at
from delivery_schedules ds, today_bj t
where ds.delivery_type = 'meal'
  and ds.delivery_date = t.d
order by user_id, meal_type, updated_at desc
limit 200;
