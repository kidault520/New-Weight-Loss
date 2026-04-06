# 订单创建-支付-流转-开启服务标准治理文档（v1.1，历史稿）

> 最新整理版请优先使用：`docs/order-payment-service-flow-governance-v1.1.md`

## 1. 文档目的

本规范用于统一订单从创建到支付、再到服务开启的全链路规则，确保前端、后端、数据库、运营口径一致。

### 1.1 目标

- 避免“支付成功但服务未开启”
- 避免“多订单串单推进”
- 避免“退款后状态未回收”
- 保证关键流程可追溯、可验收、可巡检

### 1.2 适用范围

- C 端：下单、支付、开启服务入口
- B 端：订单管理、状态流转、退单
- 后端：订单/支付/服务状态推进逻辑
- 数据库：`orders`、`order_items`、`delivery_schedules`、执行相关表

---

## 2. 核心实体与单一真相

### 2.1 核心实体

- `orders`：订单主档（状态与支付口径）
- `order_items`：订单商品明细
- `delivery_schedules`：服务开启后的配送执行记录
- `execution_programs`（若启用）：执行计划记录

### 2.2 单一真相（SoT）

- 订单状态以 `orders` 为准
- 支付状态以 `orders.payment_status` 为准
- 服务是否已落地以执行数据是否生成为准（如 `delivery_schedules` 关联）

---

## 3. 标准状态机

> 以现网字段与业务语义为准，命名可按系统实际扩展，但必须保持“可追溯 + 不跳变”。

### 3.1 订单状态（`order_status`）

- `confirmed`：订单创建完成，待支付或待推进
- `processing`：支付成功并已开启服务
- `completed`：服务结束
- `cancelled`：订单取消
- `refunded`：订单退款

### 3.2 支付状态（`payment_status`）

- `pending`：待支付
- `paid`：已支付
- `failed`：支付失败
- `refunded`：已退款

### 3.3 状态推进原则

1. 所有推进必须有明确触发事件
2. 禁止前端本地“直接写终态”
3. 终态（`cancelled/refunded/completed`）禁止无规则回退
4. 每次关键推进必须可追踪（日志/审计）

---

## 4. 标准流程定义

## 4.1 创建订单

输入：用户、商品、金额、销售归属（如适用）  
输出：`orders` + `order_items` 基础记录

规则：

- 金额、商品、用户必须校验通过
- 订单号唯一
- 创建成功后默认 `payment_status=pending`

## 4.2 发起支付

输入：订单 ID  
输出：支付参数/支付链接

规则：

- 仅允许未支付订单发起支付
- 重复发起不应破坏已有状态

## 4.3 支付回调

输入：第三方支付回调  
输出：订单支付状态更新

规则：

- 必须幂等（同一事件重复回调不重复推进）
- 成功支付只允许将 `payment_status` 推进到 `paid`
- 回调异常必须有日志，禁止静默吞掉

## 4.4 开启服务（关键）

触发：支付成功 + 满足服务开启前置条件

动作：

1. 订单推进到 `processing`
2. 生成服务执行数据（如 `delivery_schedules`）
3. 同步前端可见状态

规则：

- 未明确 `order_id` 时禁止推进多条已支付订单（防串单）
- 生成执行数据失败时，必须可见告警并可补偿

## 4.5 退款/取消反向链路

触发：人工退单、支付退款回调、业务取消

动作：

- 更新 `order_status/payment_status`
- 同步影响服务展示（不可继续执行）
- 保留可追溯记录

---

## 5. 强制规则（红线）

1. **支付回调幂等**：必须开启，不能关闭
2. **多订单防串单**：缺少明确订单 ID 时，不得自动推进多条
3. **服务开启前置条件**：未支付不得开启服务
4. **终态保护**：取消/退款后不得恢复为进行中（除明确补偿流程）
5. **失败可见性**：关键失败必须有用户或运营可见提示

---

## 6. 异常场景标准处理

## 6.1 paid 但未 processing

判定：`payment_status=paid` 且 `order_status` 不在 `processing/completed/refunded/cancelled`  
处理：进入补偿任务清单，人工确认后推进或标记为例外。

## 6.2 processing 但无执行数据

判定：`order_status=processing` 且 `linked_delivery_rows=0`（按业务类型判定）  
处理：补生成执行数据，并记录补偿来源。

## 6.3 退款后仍可执行

判定：`payment_status=refunded` 但服务仍显示执行中  
处理：立即回收执行展示状态并核查回调链路。

---

## 7. 验收标准

## 7.1 最小回归包

1. 单订单：创建 -> 支付成功 -> 开启服务（全链路）
2. 重复支付回调：验证幂等
3. 多订单并存：验证不串单
4. 退款后：订单、服务、展示状态一致
5. 无订单/未支付：入口拦截与提示正确

## 7.2 通过门槛

- “paid 但未推进”异常清单为 0（或全部有已登记例外）
- 退款状态不一致清单为 0
- 当前活跃订单执行数据关联符合预期

---

## 8. 运维巡检与频率

- 巡检脚本：`docs/order-payment-service-flow-smoke-check.sql`
- 建议频率：
  - 上线当天：每 2 小时一次
  - 稳定期：每日一次

重点关注：

- paid 未推进
- 退款不一致
- 多订单异常分布
- 订单与执行数据关联异常

---

## 9. 版本记录

- v1.0：初版治理文档
- v1.1：标准版（补充状态机、异常处理、验收门槛、巡检频率）

---

## 10. 下一步执行台（按 P0/P1）

> 原则：不做过度设计，只补关键闭环与可追溯能力。

### 卡片 A（P0）：真实支付回调幂等与乱序防护

**目标**

- 将“模拟支付确认”升级为“真实回调驱动的支付状态推进”。
- 保证重复回调、乱序回调不破坏订单状态。

**涉及改动**

- 后端：`server/routes/orders.js`（新增回调入口或扩展现有支付确认入口）
- 后端：新增 `server/utils/orderStatusTransition.js`（统一订单状态流转判定）
- 数据库：新增支付回调事件表（建议 `payment_callback_events`，含唯一幂等键）

**契约建议**

- 输入：`external_order_id`、`payment_event_id`、`payment_status`、`paid_at`、`raw_payload`
- 输出：`{ success, deduplicated, transitioned, reason }`
- 错误码：`PAYMENT_CALLBACK_UNAUTHORIZED`、`PAYMENT_EVENT_DUPLICATE`、`ORDER_NOT_FOUND`、`ORDER_STATE_CONFLICT`

**核心规则**

- 以 `payment_event_id` 或第三方交易号作为幂等键（数据库唯一约束）。
- 同一订单仅允许 `pending -> paid -> refunded` 正向推进；禁止回退。
- 若回调状态不满足推进条件，记录 ignored 事件并返回可观测结果（非静默）。

**验收 SQL（新增到巡检脚本）**

1. 幂等冲突检查：同一 `payment_event_id` 仅一条有效记录
2. paid 状态回退检查：`payment_status='pending'` 且存在历史 `paid` 事件应为 0
3. 回调事件覆盖率：最近 24h `paid` 订单应有对应回调事件

**通过标准**

- 重复回调 2~5 次，订单仅推进一次。
- 乱序回调（先失败后成功/先成功后失败）状态最终正确且有事件留痕。

---

### 卡片 B（P1）：统一前后端错误码与用户提示映射

**目标**

- 消除“后端错误语义不稳定、前端提示不一致”问题。
- 把订单关键接口统一为“稳定错误码 + 友好文案”。

**涉及改动**

- 后端：`server/routes/orders.js`、`server/routes/admin/orders.js`（统一 error code）
- 前端：`src/services/paymentService.ts`、`src/services/orderService.ts`、`src/App.tsx`（错误码映射）
- 文档：本文件新增“错误码字典”小节

**建议错误码（最小集）**

- `ORDER_NOT_FOUND`
- `ORDER_FORBIDDEN`
- `ORDER_NOT_PAID`
- `ORDER_ALREADY_STARTED`
- `ORDER_TERMINAL_LOCKED`
- `PAYMENT_ALREADY_CONFIRMED`
- `PAYMENT_CALLBACK_UNAUTHORIZED`
- `SYSTEM_INTERNAL_ERROR`

**返回格式建议**

- 成功：`{ success: true, data?: any, message?: string }`
- 失败：`{ success: false, code: string, message: string, details?: any }`

**用户提示映射（示例）**

- `ORDER_NOT_PAID` -> “订单未支付，暂不能开启服务”
- `ORDER_ALREADY_STARTED` -> “该订单已开启服务，无需重复操作”
- `SYSTEM_INTERNAL_ERROR` -> “系统繁忙，请稍后重试”

**通过标准**

- 订单相关接口错误返回格式一致率 100%。
- 前端不再依赖字符串模糊匹配判断错误类型。

---

### 卡片 C（P1）：订单级审计与补偿闭环

**目标**

- 实现“谁在何时因何改变状态”的订单级可追溯。
- 对“paid 但未 processing”“processing 但无执行数据”形成固定补偿流程。

**涉及改动**

- 数据库：新增/复用 `audit_logs` 订单事件类型（如 `order_payment_confirmed`、`order_service_started`）
- 后端：`server/routes/orders.js`、`server/routes/admin/orders.js`（关键动作写审计）
- SQL：`docs/order-payment-service-flow-smoke-check.sql`（增加补偿待办查询）

**审计字段建议**

- `user_id`、`action`、`entity_type='order'`、`entity_id`
- `before_data`、`after_data`、`reason`、`source`（app/admin/callback）

**补偿清单（最小）**

1. `payment_status='paid'` 且 `order_status not in ('processing','completed','cancelled','refunded')`
2. `order_status='processing'` 且执行表关联为 0（按适用业务过滤）
3. `payment_status='refunded'` 但仍有可执行状态/执行数据未回收

**通过标准**

- 三类异常清单可一键查出，且每条均有处理状态（待处理/已处理/已豁免）。
- 抽检任意 10 条订单变更，审计信息完整可读。

---

## 11. 建议执行顺序（不超量）

1. 先做卡片 A（P0，先堵资金与状态风险）
2. 再做卡片 B（P1，统一契约降低前后端沟通成本）
3. 最后做卡片 C（P1，把治理闭环固化为日常运营能力）

> 若资源有限，至少先完成 A + B，即可显著降低线上风险。

---

## 12. 订单接口错误码字典（最小集）

> 适用范围：`/api/orders/:id/confirm-payment`、`/api/orders/:id/start-service`、`/api/orders/payment/callback`

- `OK`：处理成功
- `ORDER_NOT_FOUND`：订单不存在
- `ORDER_FORBIDDEN`：无权操作该订单
- `ORDER_UNAUTHORIZED`：未登录或登录态失效
- `ORDER_NOT_PAID`：订单未支付，不能开启服务
- `ORDER_ALREADY_STARTED`：订单已是服务中或已完成（幂等成功）
- `PAYMENT_ALREADY_CONFIRMED`：订单已支付，确认支付重复提交
- `PAYMENT_CALLBACK_UNAUTHORIZED`：支付回调 token 校验失败
- `PAYMENT_CALLBACK_INVALID_PAYLOAD`：支付回调参数缺失或非法
- `PAYMENT_EVENT_DUPLICATE`：支付回调事件重复（幂等命中）
- `ORDER_STATE_CONFLICT`：支付状态流转冲突（回退/终态修改）
- `SYSTEM_INTERNAL_ERROR`：系统内部异常

统一失败返回格式：

```json
{
  "success": false,
  "code": "ORDER_NOT_PAID",
  "message": "订单未支付，无法开启服务",
  "error": "订单未支付，无法开启服务",
  "details": null
}
```
