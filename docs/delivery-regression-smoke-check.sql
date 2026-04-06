-- 配送链路 1 分钟巡检脚本（只读）
-- 用途：版本发布后快速核对地址归属、回调唯一性、状态分布、北京时间边界数据。

-- 0) 基础总览
select
  now() as server_now_utc,
  timezone('Asia/Shanghai', now()) as server_now_bj,
  count(*) as total_delivery_rows,
  count(*) filter (where delivery_type = 'meal') as meal_rows,
  count(*) filter (where status = 'pending') as pending_rows,
  count(*) filter (where status = 'scheduled') as scheduled_rows,
  count(*) filter (where status = 'preparing') as preparing_rows,
  count(*) filter (where status = 'shipped') as shipped_rows,
  count(*) filter (where status = 'delivered') as delivered_rows,
  count(*) filter (where status = 'cancelled') as cancelled_rows
from delivery_schedules;

-- 1) 地址归属一致性（期望为 0）
select
  count(*) as address_owner_mismatch_count
from delivery_schedules ds
join delivery_addresses da
  on da.id = ds.delivery_address_id
where ds.delivery_address_id is not null
  and ds.user_id <> da.user_id;

-- 2) external_order_id 重复分组数量（期望为 0）
select
  count(*) as duplicate_external_order_id_group_count
from (
  select external_order_id
  from delivery_schedules
  where external_order_id is not null
  group by external_order_id
  having count(*) > 1
) t;

-- 3) 回调事件类型分布（观察 status_ignored/status_conflict）
select
  event_type,
  count(*) as cnt
from delivery_callback_events
group by event_type
order by cnt desc;

-- 4) 最近回调事件（快速定位异常）
select
  id, provider, event_type, schedule_id, event_key, created_at
from delivery_callback_events
order by created_at desc
limit 20;

-- 5) 北京时间边界分布（昨天/今天/明天）
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
where ds.delivery_date in (d.yesterday_bj, d.today_bj, d.tomorrow_bj)
group by ds.delivery_date
order by ds.delivery_date;
