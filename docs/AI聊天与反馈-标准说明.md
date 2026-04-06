# AI 聊天窗口 — 反馈与对话标准说明

本文档统一说明 **聊天窗口内** 各类信息的定义、展示、数据流与实现位置，供产品、设计与研发对齐。范围包含：**AI 对话气泡**、**绿色反馈通知**、**快捷录入卡片**、**便签能力卡片**及与 **日反馈** 的衔接。

---

## 一、聊天窗口里的三类「声音」

| 类型 | 用户感知 | `message_type` / 前端 `type` | 典型组件 |
|------|----------|------------------------------|----------|
| **对话** | 和 AI 聊天 | `user` / `ai` | 用户气泡、`ChatMessageBubble`（AI） |
| **待办/待确认** | 要点的卡片 | `quickEntry` | `QuickEntryCard` |
| **系统反馈** | 操作结果提示，不打断对话节奏 | `feedback` | `ChatFeedbackBubble`（绿色、勾选） |

约定（与 `.cursor/rules/info-architecture.mdc` 一致）：

- **反馈通知**用于「已完成××」「已同步」「已撤回」等**结果告知**，与 AI 闲聊内容区分。
- **快捷卡片**用于 AI 识别出的结构化数据，用户确认后写入健康档案；确认成功应出现**绿色反馈**，形成闭环。

---

## 二、消息类型与数据库

| DB `message_type` | 前端 `ChatMessage.type` | 说明 |
|-------------------|-------------------------|------|
| `user` | `user` | 用户文本；可带 `abilityCardType` + `abilityCardVisible`（便签） |
| `ai` | `ai` | 模型回复 |
| `quickEntry` | `quickEntry` | 快捷录入卡片，`quick_entry_data` JSON，`is_quick_entry_confirmed` |
| `feedback` | `feedback` | 反馈通知，仅存文案 `content` |

持久化：`chat_messages` 表；`useChatLogic` / `useChatMessagesQuery` 负责加载与变更。

---

## 三、绿色反馈（`feedback`）— 标准行为

### 3.1 UI

- **组件**：`ChatFeedbackBubble` — 左对齐、绿色系、勾选图标，**不同于** AI 对话气泡。
- **列表渲染**：`ChatMessageList` 中 `message.type === 'feedback'` 走独立分支。

### 3.2 写入逻辑

- **入口**：`useChatLogic` → `addFeedbackMessage(content)`。
- **流程**：先插入本地消息（`id` 形如 `feedback-${Date.now()}`）→ `addMessageMutation` 落库 → 用服务端 `id` 更新本地。
- **失败**：`console.error`；界面可能仍保留临时消息，需监控。

### 3.3 文案格式（建议）

统一使用可扫描格式，便于运营与用户识别：

```text
{AI昵称}已完成[{业务标签}]记录，{用户称呼}加油！
```

- `{业务标签}`：用 **`[...]`** 标出记录类型与关键信息，如 `[血糖 6.7mmol/L]`、`[餐食 面条]`、`[补剂：某某]`。
- 默认 AI 昵称：`DEFAULT_AI_COMPANION_NAME`（如「小瑞」）；用户称呼来自 `user_profiles.ai_companion_settings.owner_name`（聊天 state：`ownerName`）。

### 3.4 触发场景（全量清单，代码为准）

| 场景 | 触发位置 | 说明 |
|------|----------|------|
| **聊天内快捷卡片确认** | `useChatLogic` → `handleQuickEntryConfirmFromMessage` | 同步健康记录 + 更新消息后，延迟 `CARD_FEEDBACK_DELAY_MS`（默认 2000ms）→ `addFeedbackMessage`；标签由 `getQuickEntryLabelForFeedback` 生成 |
| 日反馈内待确认确认/删除/任务 | `DailyReportCard` | 确认成功、撤回、任务失败提示等 |
| 今日餐食卡片 | `TodayMealsCard` | 摄入成功 / 同步失败 |
| 今日补剂卡片 | `TodaySupplementsCard` | 已摄入 |
| 餐后血糖自动完成 | `MealGlucoseAutoFeedback` | 完成记录 |
| 配送计划配置完成 | 全局事件 `deliveryPlanConfiguredFeedback` | 固定一句鼓励文案 |

新增反馈入口时：**必须**走 `addFeedbackMessage`，并在上表补充一行。

---

## 四、快捷录入（`quickEntry`）与闭环

### 4.1 产生

- 用户发送自然语言 → `healthMetricDetectionService` 解析 → 可能生成多条 `quickEntry` 消息并落库。

### 4.2 确认

- 用户在 `QuickEntryCard` 上确认 → `handleQuickEntryConfirmFromMessage`：
  1. `quickEntrySyncService.syncCardToHealthRecords`
  2. 更新本地与 DB 的 `is_quick_entry_confirmed`、`quick_entry_data`
  3. `handleQuickEntryConfirm`（刷新今日卡片计数等）
  4. **延迟后** `addFeedbackMessage`（见 §3.4）

### 4.3 与「日反馈」数据源

- 待确认列表可与 `daily_statistics` / 今日快照明细对齐；写入 `health_records` 后通过 React Query `invalidateQueries`（如 `daily-feedback-fixed`）刷新日反馈。

---

## 五、AI 对话（Edge：`ai-chat`）

### 5.1 调用链

浏览器 → `ApiClient` → `POST /functions/v1/ai-chat`（`Authorization: Bearer` 用户 JWT）→ Edge 校验用户 → 组装上下文 → **DeepSeek** → 返回 `response` → 前端写入 `ai` 消息。

- **超时**：客户端约 **120s**；**重试**：`maxRetries: 2`（AI 请求相对保守）。
- **可选 Body**：`parsed_metrics`（本条解析出的结构化指标）、`client_daily_context`（如客户端补剂摄入日键）。

### 5.2 上下文组成（摘要）

- 用户画像：`user_profiles`（含 `ai_companion_settings`）。
- **日反馈对齐快照**：`buildDailyAdvisorSnapshot`（`advisor_snapshot.ts`）— 用于回答「今日配送 / 餐食 / 订单第几天」等，**禁止臆测**。
- **健康摘要**：`health_records`（近 30 天 + 今日餐食单独查询等）。
- **本条刚记录的数据**：来自 `parsed_metrics`，模型须优先使用，不得用常识替代。
- **最近对话**：`chat_messages` 中 `user`/`ai` 若干条，用于指代消解。

### 5.3 回复长度策略（重要）

系统提示词中含多条「篇幅」规则，并配合参数：

| 条件 | 行为 |
|------|------|
| `parsed_metrics` 为 **1～2 条**，且用户原文**未**匹配「分析、建议、正常吗、汇总、日报……」等 | 视为 **随手记短答** `isBriefMetricLogOnly`：`max_tokens` **220**，`temperature` **0.45**，并强调全文约 **80 字内**、不展开配送/补剂/日反馈长文、不对单指标主动长篇医学解读 |
| 否则 | `max_tokens` **500**，`temperature` **0.7** |

**说明**：快照仍会注入模型，用于**用户明确追问**时作答；短答场景下约束模型**不要主动**罗列全量日报。

### 5.4 时间与地区

- 业务日统一 **北京时间**（`Asia/Shanghai`），与 App 其它模块一致。

---

## 六、便签与能力条（简述）

- 能力条点击 → 插入 `user` 消息（内容为标签文案）+ `abilityCardType` → 约 **2s** 后 `abilityCardVisible: true` → 展示 `DeliveryPlanCard` / `TodayMealsCard` / `TodaySupplementsCard` / `DailyReportCard` 等。
- 与绿色 **反馈** 区分：便签是**能力入口**，反馈是**操作结果**。

---

## 七、性能与运维提示

- **Supabase 直连**、**Edge 冷启动**、**DeepSeek 延迟**均会影响体感；Network 中 **WebSocket 长期 Pending** 多为 **Realtime 长连接**，属正常现象。
- **反馈落库失败**目前主要打日志，生产建议接监控。

---

## 八、依赖与环境

| 项 | 说明 |
|----|------|
| `VITE_SUPABASE_URL`、anon key | 前端 |
| Edge `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY` | `ai-chat` 服务端 |
| `DeepSeek_API_KEY` | Edge 内调用模型 |
| 本地 Node `PORT=3001` | 部分登录/管理 API 代理（与直连 Supabase 的页面可并存） |

**部署**：修改 `supabase/functions/ai-chat` 后需执行 `supabase functions deploy ai-chat`（或 CI 等价步骤），否则线上仍为旧逻辑。

---

## 九、文档维护

- 变更 **反馈触发点**、**消息类型**、**AI 篇幅规则** 时，请同步更新本文档 §3.4、§5.3。
- 信息架构总纲仍以 `.cursor/rules/info-architecture.mdc` 为准。

**文档版本**：与仓库 `ChatContext` / `useChatLogic` / `supabase/functions/ai-chat/index.ts` 当前实现对齐。
