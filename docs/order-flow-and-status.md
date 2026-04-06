# 订单流程与状态梳理

## 一、订单生命周期

```
创建 → 支付 → 确认 → 开启服务 → 结束 → 评论
```

| 阶段 | 说明 | 相关字段 | 触发方 |
|------|------|----------|--------|
| **创建** | 管理员创建订单 | `created_at` | 管理后台 |
| **支付** | 用户完成支付 | `payment_status=paid`, `payment_time` | C端支付 / 管理后台代录 |
| **确认** | 销售/财务确认订单 | `confirm_status=confirmed`, `confirm_time` | 管理后台（预留） |
| **开启服务** | 用户配置配送计划完成 | `order_status=processing`, `delivery_state=started`, `start_time` | C端用户 |
| **结束** | 服务周期结束 | `end_time`, `delivery_state=ended` | 系统/管理后台 |
| **评论** | 用户评价 | `comment_time` | C端用户（预留） |

## 二、状态字段对应关系

### 2.1 管理后台「开启」状态

- **判断条件**：`delivery_state === 'started' && start_time`
- **展示**：状态时间节点中「开启：已开启 / 未开启」

### 2.2 C端「服务中」状态

- **判断条件**：`order_status === 'processing'` 或存在关联的活跃 `execution_program`
- **展示**：我的订单中按钮「服务中」、状态标签「服务中」

### 2.3 统一更新逻辑

用户完成配送计划配置后，`promoteOrderToProcessing` 会同时更新：

- `order_status` → `'processing'`
- `delivery_state` → `'started'`
- `start_time` → 当前时间

确保管理后台与 C 端状态一致。

## 三、销售人员（健康顾问）

### 3.1 数据流

- **创建订单**：管理后台 OrderForm **须选择销售人员（业务必填）** → `salesperson_id` 写入 `orders` 表（可与「推荐人自动带出」等能力并存，但提交前须确认为有效销售人员）
- **展示**：
  - 管理后台：`sales_person`（由 API 关联查询）
  - C端：`sales_persons:salesperson_id (id, name)` 通过 Supabase 关联

### 3.2 销售人员为空时怎么办

- **订单创建后不可修改**：一旦订单创建，所有数据（含销售人员）均不可修改
- **若显示「—」**：表示创建时未关联，无法事后补录。新建订单时请务必选择销售人员
- **排查**：订单管理 → 点击订单 → 订单详情 →「销售人员」字段

### 3.3 常见问题

1. **销售人员显示「—」**
   - 订单创建时未选择销售人员
   - 或销售人员来自 OrganizationStorage（localStorage）且 ID 不在 `sales_persons` 表中，插入时可能被置为 null
   - 建议：创建订单时从 API 返回的销售人员列表中选择，确保 ID 有效

2. **支付流程**
   - C 端调用**后端** `POST /api/orders/:id/confirm-payment`，仅更新 `payment_status`、`payment_time`、`order_status`（非 Supabase Edge）
   - 不修改 `salesperson_id`，创建时写入的值会保留

## 四、订单创建入口

| 入口 | 销售人员 | 说明 |
|------|----------|------|
| 管理后台添加订单 | **必填**；可支持推荐人自动带出/预选，须最终确认 | 创建时写入 `salesperson_id` |
| C端支付 | 无 | 订单由管理后台预先创建，支付仅更新支付相关字段 |

## 五、开启服务流程（C端）

1. 用户支付完成
2. 点击「开启服务」→ 进入空状态配置
3. 选择配送日期 → 选择地址 → 配置每餐地址
4. 确认生成配送计划
5. `handleDeliveryPlanComplete` 调用 `promoteOrderToProcessing`
6. 更新：`order_status`、`delivery_state`、`start_time`
7. 管理后台与 C 端均显示「已开启 / 服务中」

## 六、订单不可修改与退单/删除

### 6.1 订单不可修改

- 订单创建后，除退单、内部备注外，**所有数据不可修改**（含金额、商品、销售人员等）
- 仅允许更新 `notes`（内部备注）

### 6.2 退单（仅已支付订单）

- **入口**：订单详情 → 退单按钮
- **字段**：`refund_amount`（留空=全额）、`refund_time`、`refund_reason`
- **效果**：`payment_status` → `refunded`，`order_status` → `cancelled`
- **业绩与佣金**：退单后该订单自动从销售业绩与佣金统计中排除（业绩接口仅统计 `payment_status=paid`）

### 6.3 删除（仅未支付订单）

- **已支付订单不可删除**
- 仅 `payment_status` 为 `pending`、`cancelled` 等非 `paid` 的订单可删除
