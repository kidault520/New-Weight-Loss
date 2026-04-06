# 三方配送回调字段映射表

本文定义三方回调到系统 `delivery_schedules.status` 的精确映射口径。  
系统内部状态仅允许：`pending` / `scheduled` / `preparing` / `shipped` / `delivered` / `cancelled`。

## 1) 映射优先级

1. `provider + status_code`（最高优先级）
2. `provider + status`（文本）
3. 全局默认 `status` 文本映射
4. 未识别时兜底 `pending`

## 2) Provider 映射明细

## 2.1 美团（`provider=meituan`）

| status_code | 内部状态 |
|---|---|
| 10 | pending |
| 20 | scheduled |
| 30 | preparing |
| 40 | shipped |
| 50 | delivered |
| 60 | cancelled |

文本补充映射：

| status | 内部状态 |
|---|---|
| mt_created | pending |
| mt_accept | scheduled |
| mt_preparing | preparing |
| mt_delivering | shipped |
| mt_delivered | delivered |
| mt_cancelled | cancelled |

## 2.2 饿了么（`provider=eleme`）

| status_code | 内部状态 |
|---|---|
| 1 | pending |
| 2 | scheduled |
| 3 | preparing |
| 4 | shipped |
| 5 | delivered |
| 9 | cancelled |

文本补充映射：

| status | 内部状态 |
|---|---|
| waiting | pending |
| accepted | scheduled |
| cooking | preparing |
| delivering | shipped |
| success | delivered |
| closed | cancelled |

## 2.3 顺丰同城（`provider=sf`）

| status_code | 内部状态 |
|---|---|
| 100 | pending |
| 200 | scheduled |
| 300 | preparing |
| 400 | shipped |
| 500 | delivered |
| 900 | cancelled |

文本补充映射：

| status | 内部状态 |
|---|---|
| created | pending |
| accepted | scheduled |
| picking | preparing |
| delivering | shipped |
| delivered | delivered |
| cancelled | cancelled |

## 3) 全局文本兜底映射

| 回调文本 | 内部状态 |
|---|---|
| delivered / completed / finish / done / signed | delivered |
| in_transit / on_the_way / shipping / shipped | shipped |
| preparing / ready / packing | preparing |
| scheduled / pending_dispatch / assigned | scheduled |
| cancelled / canceled / failed / rejected / timeout | cancelled |
| pending / created | pending |

## 4) 已接入点

- 回调入口：`project/server/routes/deliveryCallbacks.js`
- 映射配置：`project/server/config/deliveryStatusMapping.js`
- 对账脚本：`project/server/scripts/reconcile-delivery-status.js`
- 映射查看接口（用于联调）：`GET /api/delivery-callbacks/mapping`（需回调 token）

## 5) 调度与参数

系统已接入定时对账调度，默认每 10 分钟执行一次 `--apply`：

- 调度实现：`project/server/services/deliveryReconcileScheduler.js`
- 启动入口：`project/server/index.js`

环境变量：

- `DELIVERY_RECONCILE_ENABLED=true|false`（默认 `true`）
- `DELIVERY_RECONCILE_CRON`（默认 `*/10 * * * *`）
- `TZ`（默认 `Asia/Shanghai`）
- `DELIVERY_CALLBACK_TOKEN`（回调鉴权）
