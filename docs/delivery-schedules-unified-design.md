# 统一配送计划表设计

## 设计目标

- **C端**：用户配置配送计划（日期、餐次、地址、锁定）
- **B端**：管理端查看、筛选、分配配送
- **三方配送**：对接美团/饿了么等，支持骑手信息、实时位置、物流单号

## 统一表：delivery_schedules

在现有 `delivery_schedules` 基础上扩展，合并 `meal_delivery_schedules` 能力，并预留三方配送字段。

### 字段分类

| 分类 | 字段 | 类型 | 说明 |
|------|------|------|------|
| **关联** | order_id | uuid (可空) | 关联订单，C端配置时可为空 |
| | user_id | uuid | 用户 |
| | delivery_address_id | uuid (可空) | 配送地址 |
| **类型** | delivery_type | text | meal / supplement |
| | meal_type | text (可空) | breakfast / lunch / dinner，餐食时必填 |
| **时间** | delivery_date | date | 配送日期 |
| | delivery_time | text | 兼容旧字段，如 "11:30-12:30" |
| | delivery_time_start | text | 开始时间 HH:MM |
| | delivery_time_end | text | 结束时间 HH:MM |
| | estimated_arrival_time | timestamptz | 预计送达时间（三方 API 返回） |
| **商品** | item_id | uuid (可空) | 餐食/补剂 ID |
| | item_name | text | 展示名称 |
| | quantity | int | 数量 |
| **C端** | is_locked | boolean | 是否锁定（用户不可改） |
| **状态** | status | text | pending/scheduled/preparing/shipped/delivered/cancelled |
| | delivered_at | timestamptz | 实际送达时间 |
| **地址快照** | delivery_address_label | text | 地址标签（家/公司） |
| | delivery_address | text | 完整地址快照 |
| | delivery_contact_name | text | 收件人 |
| | delivery_contact_phone | text | 联系电话 |
| **三方配送** | tracking_number | text | 物流单号 |
| | external_order_id | text | 第三方平台订单号 |
| | delivery_provider | text | 配送商：meituan/eleme/custom |
| | rider_id | text | 骑手 ID |
| | rider_name | text | 骑手姓名 |
| | rider_phone | text | 骑手电话 |
| | rider_lat | numeric | 骑手纬度 |
| | rider_lng | numeric | 骑手经度 |
| | rider_position_updated_at | timestamptz | 位置更新时间 |
| **通用** | notes | text | 备注 |
| | created_at, updated_at | timestamptz | |

### 唯一约束

- 同一用户、同一天、同一餐次仅一条：`UNIQUE (user_id, delivery_date, meal_type)`（meal_type 为空时用 delivery_type 区分）

### 索引

- order_id, user_id, delivery_date, status, delivery_provider
