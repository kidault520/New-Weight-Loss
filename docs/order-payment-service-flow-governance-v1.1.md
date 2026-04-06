# 订单创建-支付-流转-开启服务标准治理文档（v1.2）

## 0. 文档定位

本规范用于统一订单模块的业务流程、状态规则、前后端契约与巡检口径，确保：

- 用户侧体验一致（可预期、可解释、可恢复）
- 后端状态可控（不可乱序、不可回退、可幂等）
- 运营排障可执行（有审计、有巡检、有分级）

适用范围：`orders`、`order_items`、`delivery_schedules`、`payment_callback_events`、`order_audit_logs`。

---

## 1. 入口矩阵（从哪里进，怎么拦截）

| 入口 | 触发方 | 前置条件 | 无权限/无数据拦截 | 用户提示 |
|---|---|---|---|---|
| `POST /api/orders/:id/confirm-payment` | C端用户 | 已登录、订单归属本人、`payment_status=pending` | 401/403/404/409 | 未登录、无权、订单不存在、已支付 |
| `POST /api/orders/:id/start-service` | C端用户 | 已登录、订单归属本人、`payment_status=paid` | 401/403/404/400 | 未支付不能开启服务 |
| `POST /api/orders/payment/callback` | 第三方回调 | `x-payment-callback-token`、必要字段完整 | 401/400/404/409 | 回调未授权、参数缺失、订单不存在、状态冲突 |
| `POST /api/admin/orders/:id/refund` | 管理后台 | 管理员权限、订单已支付 | 403/404/400 | 非已支付订单不可退 |
| `POST /api/admin/orders/:id/cancel` | 管理后台 | 管理员权限、订单未支付 | 403/404/400 | 已支付订单不可取消，请走退款 |

---

## 2. 状态矩阵（核心状态与流转）

### 2.1 `payment_status`

- 枚举：`pending`、`paid`、`refunded`、`cancelled`
- 允许：`pending -> paid -> refunded/cancelled`
- 禁止：任意回退（例如 `paid -> pending`）
- 终态锁：`refunded/cancelled` 后禁止再改为非终态

### 2.2 `order_status`

- 枚举：`pending`、`confirmed`、`processing`、`completed`、`cancelled`
- 推荐主链：`pending/confirmed -> processing -> completed`
- 反向链：退款或业务取消后进入 `cancelled`
- 约束：`payment_status != paid` 时不得进入服务中

### 2.3 关键组合规则

- `payment_status=paid` 且服务已开启时，`order_status` 应在 `processing/completed`
- `payment_status=refunded` 时，`order_status` 应为 `cancelled`（或受控终态）
- 若进入 `processing`，应存在可追溯的执行数据（如 `delivery_schedules`）

---

## 3. 主流程（标准链路）

1. **创建订单**：写入 `orders`、`order_items`，默认 `payment_status=pending`
2. **确认支付/支付回调**：状态推进到 `paid`，记录 `payment_time`
3. **开启服务**：校验支付成功后推进 `order_status=processing`
4. **落地执行**：生成/关联 `delivery_schedules`
5. **结束服务**：服务结束后推进 `completed`（按业务时机）

主流程必须满足：每个关键状态变化都可追踪（审计日志/回调事件）。

---

## 4. 异常流程（失败、超时、重复、乱序）

### 4.1 失败

- 接口失败必须返回结构化错误：`success=false + code + message`
- 前端按 `code` 映射用户提示，不依赖字符串模糊匹配

### 4.2 超时

- 网络/服务异常可重试，但重试不得破坏状态一致性
- 重试后如仍失败，进入巡检待办

### 4.3 重复提交

- 用户重复确认支付：返回 `PAYMENT_ALREADY_CONFIRMED`
- 回调重复事件：命中幂等键，返回 `PAYMENT_EVENT_DUPLICATE`

### 4.4 回调乱序

- 通过 `payment_status` 状态机判定，只允许正向推进
- 回退/终态改写请求返回 `ORDER_STATE_CONFLICT`
- 冲突事件要保留在 `payment_callback_events.process_result`

---

## 5. 数据口径（主表、快照、SoT）

- **SoT 主表**：`orders`
  - 支付口径：`orders.payment_status`
  - 订单口径：`orders.order_status`
- **执行落地**：`delivery_schedules`（是否开启服务的执行证据）
- **回调事件账本**：`payment_callback_events`（幂等与回放依据）
- **审计日志**：`order_audit_logs`（谁在何时因何改状态）

口径原则：查询优先以 SoT 为准，事件与审计用于追溯，不反客为主。

### 5.1 餐次口径一致性（新增强制规则）

- **订单餐次 SoT**：`orders.included_meal_types`（订单快照）
- **回退口径**：仅当订单快照为空时，允许回退 `products -> meal_plans.included_meal_types`
- **C 端配置链路强约束**：
  1. 订单详情展示餐次：优先读 `orders.included_meal_types`
  2. 开启服务进入配送配置：优先读订单快照餐次
  3. 日期选择页：餐次严格跟单，不允许新增或取消订单外餐次
  4. 配送计划页展示与生成：仅使用当前配置链路餐次（来源于订单快照口径）
  5. 添加地址默认餐次：可选范围必须受当前订单餐次约束
- **管理端订单详情**：展示口径与 C 端一致，优先订单快照，商品疗程仅作兜底

---

## 6. 前后端契约（输入输出、错误码、提示）

### 6.1 统一返回结构

- 成功：`{ success: true, code?: string, message?: string, data?: any }`
- 失败：`{ success: false, code: string, message: string, error?: string, details?: any }`

### 6.2 核心错误码（最小集）

- `OK`
- `ORDER_NOT_FOUND`
- `ORDER_FORBIDDEN`
- `ORDER_UNAUTHORIZED`
- `ORDER_NOT_PAID`
- `ORDER_ALREADY_STARTED`
- `PAYMENT_ALREADY_CONFIRMED`
- `PAYMENT_CALLBACK_UNAUTHORIZED`
- `PAYMENT_CALLBACK_INVALID_PAYLOAD`
- `PAYMENT_EVENT_DUPLICATE`
- `ORDER_STATE_CONFLICT`
- `SYSTEM_INTERNAL_ERROR`

### 6.3 前端提示映射（示例）

- `ORDER_NOT_PAID` -> 订单未支付，暂不能开启服务
- `ORDER_ALREADY_STARTED` -> 该订单已开启服务，无需重复操作
- `SYSTEM_INTERNAL_ERROR` -> 系统繁忙，请稍后重试

---

## 7. 一致性策略（缓存刷新、并发保护、幂等）

- **缓存刷新**：订单状态变更后触发对应 Query 失效/刷新（前端）
- **并发保护**：无明确 `order_id` 时禁止自动推进多条已支付订单（防串单）
- **幂等规则**：
  - 支付回调基于 `payment_event_id` 唯一索引去重
  - 重放请求只返回 deduplicated，不重复推进业务状态
- **回退保护**：终态锁 + 状态机守卫，不允许状态回滚
- **餐次一致性保护**：
  - 禁止“历史订单被当前商品疗程改动反向污染”
  - 禁止在订单配置链路中额外扩餐（如订单仅午晚餐却配置早餐）
  - 任何餐次缺地址在“生成配送计划”环节必须硬拦截

---

## 8. 可观测性（日志、审计、巡检 SQL）

### 8.1 事件/审计

- 回调事件：`payment_callback_events`
- 订单审计：`order_audit_logs`
- 最低要求：支付确认、开启服务、回调处理、退款、取消都写审计

### 8.2 巡检脚本

- 文件：`docs/order-payment-service-flow-smoke-check.sql`
- 包含：总览、异常候选、关联抽样、幂等冲突、回退检查、覆盖率、补偿待办

### 8.3 巡检频率

- 上线当天：每 2 小时
- 稳定期：每日一次
- 重大变更后：立即补跑一轮全量巡检

---

## 9. 验收清单（最小回归包 14 条）

1. 创建订单后默认 `payment_status=pending`
2. 单订单完成支付确认后变为 `paid`
3. 已支付订单开启服务后进入 `processing`
4. 未支付订单开启服务被拦截（`ORDER_NOT_PAID`）
5. 重复确认支付返回 `PAYMENT_ALREADY_CONFIRMED`
6. 支付回调重复提交命中幂等（`PAYMENT_EVENT_DUPLICATE`）
7. 支付回调乱序回退被拦截（`ORDER_STATE_CONFLICT`）
8. 多订单并存时无明确 `order_id` 不自动串单推进
9. 退款后订单状态与执行状态一致（无未回收执行）
10. 巡检 SQL 的补偿待办（第9/10/11项）结果为空
11. 订单详情（C 端/管理端）餐次优先显示 `orders.included_meal_types`
12. 开启服务进入配送配置时，餐次来源与订单快照一致（非商品主数据漂移）
13. 日期选择页不允许新增订单外餐次，也不允许取消订单内餐次
14. 存在餐次缺地址时，“生成配送计划/确认配送计划”被硬拦截并提示缺失餐次

通过门槛：关键异常清单为 0，或全部有“已登记例外 + 责任人 + 处理时限”。

---

## 10. 分级处理（P0/P1/P2）

### P0（立即处理，阻断级）

- 支付回调幂等失效（重复回调导致重复推进）
- 支付状态回退（`paid -> pending`）
- 多订单串单推进

要求：立即止血 + 当日修复 + 形成复盘记录。

### P1（高优先，24h 内）

- `paid` 但未进入 `processing`
- `processing` 但无执行数据
- 错误码不一致导致前端提示混乱

要求：24h 内修复并回归验证。

### P2（常规优化）

- 文档与实现轻微不一致
- 审计字段缺少非关键信息
- 巡检可读性优化

要求：纳入迭代，不阻断上线。

---

## 11. 当前实现对齐（2026-03）

- 已落地：回调幂等、状态机防回退、错误码最小集、订单审计、补偿待办 SQL
- 已落地：订单餐次快照优先读取（`orders.included_meal_types`），并贯穿订单展示、开启服务、日期选择、配送计划、地址默认餐次范围
- 已验证：最近一轮巡检关键异常为 0（含补偿待办）
- 后续建议：保持脚本日巡检，版本变更后更新本文件与 SQL 一起评审

---

## 12. 版本记录

- v1.0：基础治理框架
- v1.1：按 10 项框架重排，补全入口矩阵、契约、一致性、可观测与分级处理
- v1.2：新增“订单餐次快照优先”全链路规则，补齐餐次一致性约束与验收项
