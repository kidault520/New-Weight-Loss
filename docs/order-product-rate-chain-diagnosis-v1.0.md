# 第三链路全量诊断：订单商品项目、费率、订单管理（v1.1）

## 0. 诊断范围与目标

本诊断覆盖三大模块：

- 模块A：订单商品项目管理（`products`）
- 模块B：费率管理（B 端品类/映射/折算率）
- 模块C：订单管理（创建-支付-回调-开启服务-退款/取消）

目标：按统一 10 步给出“现状、风险、改进优先级（P0/P1/P2）”，作为下一轮治理执行基线。

---

## 模块A：订单商品项目管理

### 1) 入口矩阵

- 管理端入口：`/api/admin/products`（列表、详情、创建、更新、删除、状态切换）
- 前端入口：`ProductManagement`、`ProductForm`、`OrderForm` 中商品选择
- 权限拦截：后端 `checkPermission('manage_menu')`
- 无数据拦截：前端展示“暂无商品数据/暂无商品”
- 当前缺口：无“被订单引用时不可删”的前置提示，仅依赖后端/数据库报错

### 2) 状态矩阵

- 核心状态：`is_active=true/false`（上架/下架）
- 允许流转：`true <-> false`
- 缺少状态：无“归档/禁编辑/待审核”状态
- 风险：硬删除与状态禁用并存，语义不统一

### 3) 主流程

1. 管理员新增商品（含餐食/补剂计划、价格、时长）
2. 商品默认可上架（`is_active=true`）
3. 订单创建页只拉取 `is_active=true` 的商品
4. 可执行启用/禁用切换
5. 可编辑商品信息（价格、计划、文案等）

### 4) 异常流程

- 失败：后端返回通用 `error/details`，前端多处 `alert(error.message)`，提示不统一
- 超时：无请求重试策略，用户需手动重试
- 重复提交：无显式幂等键，双击可能重复创建（依赖用户操作习惯）
- 并发：`generateProductCode` 先查后写，存在并发冲突窗口（虽然最终受唯一索引保护）

### 5) 数据口径（主表/快照/SoT）

- SoT：`products`
- 订单快照：`orders.product_id + unit_price + total_amount`（价格已快照到订单）
- 口径结论：商品主数据与订单交易数据已分离，方向正确
- 风险点：商品删除策略与订单引用关系未治理成业务规则（当前更像“数据库兜底”）

### 6) 前后端契约

- 输入：创建/更新商品参数结构基本稳定
- 输出：已统一为 `success/code/message`，并兼容 `error/details`
- 错误码：已补标准化 `code` 字段（如 `PRODUCT_NOT_FOUND`、`VALIDATION_ERROR`）
- 用户提示：前端已支持“code 优先”映射，降低对后端文案字符串依赖

### 7) 一致性策略

- 缓存刷新：前端保存/删除/切换状态后会重新拉列表（具备最小一致性）
- 并发保护：无乐观锁（`updated_at` compare-and-swap）
- 幂等规则：无创建幂等键
- 结论：满足基础可用，但不满足“可审计 + 可重放 + 可并发安全”治理标准

### 8) 可观测性

- 日志：有服务端 logger
- 审计：商品操作无独立审计表
- 巡检 SQL：暂无商品治理专项巡检

### 9) 验收清单（最小10条）

1. 新增商品必填校验生效（名称、时长、价格）
2. 至少一个计划组件（餐食/补剂）必填
3. 商品编码唯一约束生效
4. 上下架切换后列表状态正确
5. 下架商品不出现在订单创建选择器
6. 商品编辑后订单创建页可见最新主数据
7. 已被订单引用商品删除行为可预期（禁止或软删）
8. 创建失败时提示可读且不丢失上下文
9. 高并发创建无重复编码脏数据
10. 商品查询分页/筛选口径一致

### 10) 分级处理

- **P0**
  - 无“引用保护策略”的删除路径（业务层未显式拦截，风险直接暴露到运行时）
- **P1**
  - 创建无幂等键、更新无乐观锁
  - 商品删除/上下架操作仍缺审计日志
- **P2**
  - 缺少商品专项巡检 SQL

---

## 模块B：费率管理（B端品类/映射/折算率）

### 1) 入口矩阵

- 前端入口：`ProductManagement` -> `ProductConfig`
- 子流程：品类与属性、商品同步映射、折算率配置
- 数据来源：数据库 `sales_product_config` 为主，`localStorage` 为兜底缓存
- 同步入口：独立 API `GET/PUT /api/admin/sales-product-config`
- 当前缺口：尚未做版本化发布（effective version）

### 2) 状态矩阵

- 当前无正式状态机（如 draft/active/published/archived）
- 折算率仅是配置项数组，无版本状态、无生效窗口
- 风险：无法回答“当前生效版本是谁、何时生效、谁发布”

### 3) 主流程

1. 本地配置品类与属性
2. 从商品管理同步商品并打标签（品类/属性）
3. 配置折算率
4. 通过组织同步接口一起写库（可选发生）

### 4) 异常流程

- 失败：同步失败时常驻 localStorage，库与本地可能分叉
- 超时：无自动补偿重试
- 重复提交：同一配置重复提交无版本号控制
- 回调乱序：不涉及回调，但多端并发编辑会相互覆盖（最后写入覆盖）

### 5) 数据口径（主表/快照/SoT）

- 设计 SoT：`sales_product_config`
- 实际 SoT：已切换为数据库优先读取，本地仅作离线兜底
- 结论：P0“双 SoT 冲突”已基本消除
- 剩余风险：缺版本发布机制与审计链

### 6) 前后端契约

- 已有独立 REST 契约：`GET/PUT /api/admin/sales-product-config`
- 配置不再强依赖 `sync-organization` 夹带提交
- 错误码已按 `success/code/message` 返回
- 前端提示已支持 `code` 优先映射

### 7) 一致性策略

- 缓存刷新：无统一 QueryKey/失效策略（多为本地 state + localStorage）
- 并发保护：无版本号（version/etag）比较
- 幂等规则：无配置幂等标识
- 结论：一致性能力弱，满足单人本地配置，不满足多人协作

### 8) 可观测性

- 日志：服务端同步接口有日志
- 审计：费率变更缺审计链（谁改了什么）
- 巡检：无“配置一致性”巡检脚本（localStorage 与 DB 一致性无法巡检）

### 9) 验收清单（最小10条）

1. 品类名称唯一
2. 属性去重
3. 商品同步后映射完整
4. 折算率范围在 `[0,1]`
5. 折算率与品类/属性关联合法
6. 配置保存后刷新页面不丢失
7. 组织同步成功后数据库可读到最新配置
8. 同步失败时给出明确可恢复提示
9. 多管理员并发修改有冲突处理策略
10. 费率配置可追溯到变更人和版本

### 10) 分级处理

- **P0（已关闭）**
  - 双 SoT（localStorage vs DB）导致费率口径不可信
  - 无独立后端配置契约，核心配置依赖“组织同步附带”
- **P1**
  - 无版本化发布机制（生效版本不可控）
  - 无审计与冲突检测
- **P2**
  - 无自动巡检与告警
  - 用户提示/错误码未标准化

---

## 模块C：订单管理（订单/支付/服务开启）

### 1) 入口矩阵

- C端：`POST /api/orders/:id/confirm-payment`、`POST /api/orders/:id/start-service`
- 支付回调：`POST /api/orders/payment/callback`
- 管理端：`/api/admin/orders`（列表、创建、取消、退款、状态更新等）
- 权限拦截：
  - C端使用 JWT 绑定 `user_id`
  - 管理端使用 `checkPermission('manage_orders')`
- 无数据拦截：404 + 错误信息已具备

### 2) 状态矩阵

- `payment_status`: `pending|paid|refunded|cancelled`
- `order_status`: `pending|confirmed|processing|completed|cancelled`
- `delivery_state`: `not_started|started|ended`
- 回调状态机：通过 `evaluatePaymentTransition` 防回退
- 已修复：管理端 `status/payment` PATCH 已统一走状态机守卫，禁止回退/终态改写

### 3) 主流程

1. 管理端创建订单（默认 pending/pending）
2. C端确认支付或第三方回调推进到 `paid`
3. 已支付订单开启服务推进 `processing + delivery_state=started`
4. 执行侧生成/关联配送计划
5. 退款时设置 `payment_status=refunded + order_status=cancelled`

### 4) 异常流程

- 失败：C端与管理端均已接入 code 化错误结构
- 超时：前端大多手动重试，无统一重试策略
- 重复提交：
  - 支付回调以 `payment_event_id` 唯一索引实现幂等
  - C端重复支付有 `PAYMENT_ALREADY_CONFIRMED`
- 回调乱序：状态机阻断并记录 `process_result`
- 风险：`orderService.promoteOrderToProcessing` 在网络异常下仍有 fallback 直连 Supabase 路径，可能绕过后端统一审计与错误码

### 5) 数据口径（主表/快照/SoT）

- SoT：`orders`
- 事件账本：`payment_callback_events`
- 审计：`order_audit_logs`
- 执行证据：`delivery_schedules`
- 结论：总体口径已成型，具备“主表+事件+审计”三件套

### 6) 前后端契约

- C端契约较标准：`success/code/message`
- 管理端契约：`admin/orders` 与 `admin/products` 已统一为 `success/code/message`（兼容 `error/details`）
- 错误码：订单主链与管理端主要接口已覆盖标准 `code`
- 用户提示：管理端订单页、商品页已支持 `code` 优先映射

### 7) 一致性策略

- 幂等：回调幂等已落地（唯一索引 + 去重返回）
- 防回退：已落地（状态机判定）
- 并发：管理端状态修改已补“状态机守卫”，乐观锁仍待补
- 缓存：管理端以刷新列表为主；C端使用查询失效刷新

### 8) 可观测性

- 日志：服务端 logger 已覆盖关键接口
- 审计：支付确认/开启服务/退款/取消/回调已写 `order_audit_logs`
- 巡检：已存在 `docs/order-payment-service-flow-smoke-check.sql`
- 缺口：仍需补“商品与费率审计日志”以及配置版本化追踪

### 9) 验收清单（最小12条）

1. 创建订单默认 `payment_status=pending`
2. C端仅能支付本人订单
3. 重复支付返回 `PAYMENT_ALREADY_CONFIRMED`
4. 回调重复事件返回 `PAYMENT_EVENT_DUPLICATE`
5. 回调回退请求返回 `ORDER_STATE_CONFLICT`
6. 未支付订单开启服务返回 `ORDER_NOT_PAID`
7. 已支付订单开启服务后进入 `processing`
8. 退款后订单进入 `cancelled` 且支付状态为 `refunded`
9. 已支付订单取消被拦截（必须走退款）
10. 审计日志覆盖支付/开启/退款/取消/回调
11. 巡检 SQL 第9/10/11项待办为空
12. 管理端状态变更接口不允许绕过状态机

### 10) 分级处理

- **P0（已关闭）**
  - 管理端存在可直接改 `payment_status/order_status` 的 PATCH 路径，可能绕过状态机防回退
- **P1**
  - 前端 `promoteOrderToProcessing` 网络失败 fallback 直连，绕过统一审计链
  - 管理端状态更新仍缺乐观锁并发保护
- **P2**
  - 订单统计/详情展示字段口径还可进一步统一（支付平台、审核人等字段来源分散）

---

## 全链路汇总（跨模块）

### 当前结论

- 订单主链（支付回调幂等、状态防回退、审计、巡检）已具备基础治理能力
- 商品管理可用，契约已统一；仍需补删除引用治理和审计
- 费率管理已完成 SoT 收敛，当前主要短板是版本与审计治理

### 总体分级

- **P0（已完成）**
  1. 订单管理端状态修改收敛到状态机守卫（禁旁路更新）
  2. 费率管理建立独立后端 SoT 契约（数据库优先）
- **P1（24-72h）**
  1. 商品与费率补审计日志
  2. 费率配置增加版本号/生效机制
  3. `promoteOrderToProcessing` 取消直连 fallback，强制后端口径
- **P2（迭代）**
  1. 商品/费率专项巡检 SQL
  2. 前端重试与并发冲突提示优化

---

## 建议执行顺序（不过度版）

1. 先收敛订单状态旁路（P0，最小改动、收益最高）
2. 再做费率 SoT 单一化（P0，先“可读可写 API + version 字段”）
3. 最后补契约统一与巡检（P1/P2，按发布节奏纳入）

该顺序遵循“先止血、再统一、后优化”，避免一次性大改带来连锁风险。

---

## 已落地变更（本轮）

1. 管理端订单状态旁路收敛：
   - `admin/orders` 的 `status/payment` 更新已接入状态机守卫，阻断回退与终态改写。
2. 费率配置 SoT 收敛：
   - 新增 `GET/PUT /api/admin/sales-product-config`，前端 `ProductConfig` 改为数据库优先读取/写入，本地仅兜底。
3. 契约与提示统一：
   - `admin/orders`、`admin/products` 后端返回统一为 `success/code/message`（兼容 `error/details`）。
   - 管理端订单页、商品页错误提示已支持 `code` 优先映射。
