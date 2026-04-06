# AI聊天三大域全量数据来源规则 v1.0

## 1. 文档目的

本规则用于统一 AI 聊天可用数据的来源边界、字段映射、隐私口径与字段生命周期治理，避免以下问题：

- 回答使用了非权威或过期数据
- 业务侧新增字段后未纳入 AI 快照
- 字段下线后仍被 AI 引用造成污染
- 回答中泄露敏感个人信息

本规则覆盖三大来源域：

1. `我的`：基础资料、报告档案、我的报告
2. `我的服务`：订单、配送计划、餐食计划、补剂计划、阶段与进度
3. `我的健康档案`：全部卡片字段与记录明细（设备同步、AI创建/同步、手动录入）

---

## 2. 总体快照结构

```ts
snapshot = {
  schema_version: "v1",
  generated_at: string,
  profile_domain: {},
  service_domain: {},
  health_archive_domain: {},
  quality: {
    source_coverage: {},
    missing_reasons: [],
    freshness: {},
  },
}
```

---

## 3. 三大域逐字段映射（表-字段-快照键）

## 3.1 我的域（profile_domain）

### 3.1.1 基础资料（user_profiles）

| 表 | 字段 | 快照键 |
|---|---|---|
| user_profiles | nickname | profile_domain.basic.nickname |
| user_profiles | name | profile_domain.basic.name |
| user_profiles | gender | profile_domain.basic.gender |
| user_profiles | age | profile_domain.basic.age |
| user_profiles | height | profile_domain.body.height_cm |
| user_profiles | current_weight | profile_domain.body.current_weight_kg |
| user_profiles | target_weight | profile_domain.body.target_weight_kg |
| user_profiles | bmr | profile_domain.body.bmr_kcal_day |
| user_profiles | fitness_goal | profile_domain.goals.fitness_goal |
| user_profiles | health_goal | profile_domain.goals.health_goal |
| user_profiles | activity_level | profile_domain.lifestyle.activity_level |
| user_profiles | dietary_preferences | profile_domain.lifestyle.dietary_preferences |
| user_profiles | exercise_habits | profile_domain.lifestyle.exercise_habits |
| user_profiles | sleep_hours | profile_domain.lifestyle.sleep_hours |
| user_profiles | water_intake | profile_domain.lifestyle.water_intake_ml |
| user_profiles | health_concerns | profile_domain.health_flags.concerns |
| user_profiles | special_conditions | profile_domain.health_flags.special_conditions |
| user_profiles | food_allergies | profile_domain.health_flags.food_allergies |
| user_profiles | onboarding_completed | profile_domain.flags.onboarding_completed |
| user_profiles | has_viewed_health_report | profile_domain.flags.has_viewed_health_report |
| user_profiles | onboarding_data | profile_domain.raw.onboarding_data |

### 3.1.2 报告列表与明细（health_assessments）

| 表 | 字段 | 快照键 |
|---|---|---|
| health_assessments | id | profile_domain.reports.list[].assessment_id |
| health_assessments | assessment_date | profile_domain.reports.list[].assessment_date |
| health_assessments | overall_score | profile_domain.reports.list[].scores.overall |
| health_assessments | diet_score | profile_domain.reports.list[].scores.diet |
| health_assessments | fitness_score | profile_domain.reports.list[].scores.fitness |
| health_assessments | rest_score | profile_domain.reports.list[].scores.rest |
| health_assessments | psychology_score | profile_domain.reports.list[].scores.psychology |
| health_assessments | exercise_score | profile_domain.reports.list[].scores.exercise |
| health_assessments | primary_improvement_area | profile_domain.reports.list[].primary_improvement_area |
| health_assessments | questionnaire_data | profile_domain.reports.detail_map[assessment_id].questionnaire_data |

### 3.1.3 派生字段（不直接来自单表）

- `profile_domain.body.bmi`：由 `current_weight_kg` 与 `height_cm` 计算
- `profile_domain.body.bmr_effective`：优先 `bmr_kcal_day`，否则按公式计算

---

## 3.2 我的服务域（service_domain）

### 3.2.1 订单信息（orders + products）

| 表 | 字段 | 快照键 |
|---|---|---|
| orders | id | service_domain.orders.active.order_id |
| orders | order_status | service_domain.orders.active.order_status |
| orders | payment_status | service_domain.orders.active.payment_status |
| orders | created_at | service_domain.orders.active.timeline.created_at |
| orders | payment_time | service_domain.orders.active.timeline.payment_time |
| orders | start_time | service_domain.orders.active.timeline.start_time |
| products | id | service_domain.orders.active.product.product_id |
| products | product_name | service_domain.orders.active.product.product_name |
| products | duration_days | service_domain.orders.active.product.duration_days |
| products | supplement_plan_id | service_domain.orders.active.product.supplement_plan_id |

### 3.2.2 阶段与进度（execution_programs + daily_execution_tasks）

| 表 | 字段 | 快照键 |
|---|---|---|
| execution_programs | id | service_domain.execution.program_id |
| execution_programs | status | service_domain.execution.status |
| execution_programs | current_day | service_domain.execution.current_day |
| execution_programs | total_days | service_domain.execution.total_days |
| execution_programs | program_type | service_domain.execution.program_type |
| execution_programs | start_date | service_domain.execution.start_date |
| execution_programs | end_date | service_domain.execution.end_date |
| execution_programs | order_id | service_domain.execution.order_id |
| daily_execution_tasks | task_date | service_domain.execution.tasks[date].date |
| daily_execution_tasks | task_type | service_domain.execution.tasks[date].items[].task_type |
| daily_execution_tasks | task_status | service_domain.execution.tasks[date].items[].task_status |
| daily_execution_tasks | scheduled_time | service_domain.execution.tasks[date].items[].scheduled_time |

### 3.2.3 配送与餐食计划（delivery_schedules + delivery_addresses）

| 表 | 字段 | 快照键 |
|---|---|---|
| delivery_schedules | delivery_date | service_domain.delivery_plan[date].date |
| delivery_schedules | delivery_type | service_domain.delivery_plan[date].type |
| delivery_schedules | meal_type | service_domain.delivery_plan[date].meals[].meal_type |
| delivery_schedules | status | service_domain.delivery_plan[date].meals[].status |
| delivery_schedules | delivery_address_label | service_domain.delivery_plan[date].meals[].address.label |
| delivery_schedules | delivery_address | service_domain.delivery_plan[date].meals[].address.street_raw |
| delivery_schedules | delivery_contact_name | service_domain.delivery_plan[date].meals[].address.contact_name |
| delivery_schedules | delivery_contact_phone | service_domain.delivery_plan[date].meals[].address.contact_phone_masked |
| delivery_addresses | label | service_domain.delivery_plan[date].meals[].address.ref_label |
| delivery_addresses | address | service_domain.delivery_plan[date].meals[].address.ref_street |
| delivery_addresses | door_number | service_domain.delivery_plan[date].meals[].address.ref_door |

### 3.2.4 补剂计划（supplement_* + custom_supplements）

| 表 | 字段 | 快照键 |
|---|---|---|
| supplement_schedules | id | service_domain.supplements.schedule.id |
| supplement_schedules | schedule_name | service_domain.supplements.schedule.name |
| supplement_schedules | total_days | service_domain.supplements.schedule.total_days |
| supplement_schedule_stages | id | service_domain.supplements.stages[].stage_id |
| supplement_schedule_stages | stage_name | service_domain.supplements.stages[].stage_name |
| supplement_schedule_stages | duration_days | service_domain.supplements.stages[].duration_days |
| supplement_schedule_stages | sort_order | service_domain.supplements.stages[].sort_order |
| supplement_schedule_stage_items | stage_id | service_domain.supplements.stages[].items[].stage_id |
| supplement_schedule_stage_items | supplement_id | service_domain.supplements.stages[].items[].supplement_id |
| supplement_schedule_stage_items | per_day_qty | service_domain.supplements.stages[].items[].per_day_qty |
| supplement_products | name | service_domain.supplements.stages[].items[].supplement_name |
| custom_supplements | id | service_domain.supplements.custom_active[].id |
| custom_supplements | supplement_name | service_domain.supplements.custom_active[].name |
| custom_supplements | status | service_domain.supplements.custom_active[].status |

---

## 3.3 我的健康档案域（health_archive_domain）

### 3.3.1 卡片记录主表（health_records）

| 表 | 字段 | 快照键 |
|---|---|---|
| health_records | id | health_archive_domain.records[].record_id |
| health_records | record_type | health_archive_domain.records[].type |
| health_records | value | health_archive_domain.records[].value |
| health_records | unit | health_archive_domain.records[].unit |
| health_records | recorded_at | health_archive_domain.records[].recorded_at |
| health_records | notes | health_archive_domain.records[].notes |
| health_records | source | health_archive_domain.records[].source.raw |
| health_records | chat_message_id | health_archive_domain.records[].source.chat_message_id |
| health_records | nutrition_data | health_archive_domain.records[].detail.food |
| health_records | exercise_data | health_archive_domain.records[].detail.exercise |
| health_records | measurement_data | health_archive_domain.records[].detail.measurements |

### 3.3.2 情绪记录（emotion_records）

| 表 | 字段 | 快照键 |
|---|---|---|
| emotion_records | id | health_archive_domain.emotions[].emotion_id |
| emotion_records | recorded_at | health_archive_domain.emotions[].recorded_at |
| emotion_records | emotion | health_archive_domain.emotions[].emotion_type |
| emotion_records | intensity | health_archive_domain.emotions[].intensity |
| emotion_records | message | health_archive_domain.emotions[].message |

### 3.3.3 AI 快捷卡片（chat_messages）

| 表 | 字段 | 快照键 |
|---|---|---|
| chat_messages | id | health_archive_domain.ai_cards[].message_id |
| chat_messages | created_at | health_archive_domain.ai_cards[].created_at |
| chat_messages | is_quick_entry_confirmed | health_archive_domain.ai_cards[].is_confirmed |
| chat_messages | quick_entry_data | health_archive_domain.ai_cards[].data |

### 3.3.4 来源分层（派生）

- `health_archive_domain.records[].source.type` 允许值：
  - `device`
  - `ai`
  - `order_auto`
  - `manual`

---

## 4. 时间与回答口径规则

- 计划类问题（如“明天吃什么”“后天送到哪”）优先使用 `service_domain.delivery_plan` / `service_domain.supplements`
- 实际类问题（如“昨天吃了什么”）优先使用 `health_archive_domain.records`
- 若计划与实际同时存在，回答必须标注“计划”或“实际”
- 不在订单服务周期内的数据，明确返回 `out_of_service_cycle`

---

## 5. 隐私与脱敏规则（强制）

以下字段为敏感信息，不得进入 AI 可复述明文：

- `display_user_id`
- `birthday`
- `phone`（完整手机号）
- 完整门牌级地址

允许进入 AI 上下文的必须脱敏：

- 联系电话：`138****0000`
- 地址：优先标签（家/公司），必要时街道级摘要，不含门牌号

---

## 6. 字段生命周期治理（新增/删除）

## 6.1 Registry 台账（必备）

维护 `snapshot_field_registry`（可为表或配置文件），最少字段：

- `domain`
- `table_name`
- `column_name`
- `snapshot_key`
- `privacy_level`（public/internal/sensitive）
- `answerable`（true/false）
- `status`（active/deprecated/removed）
- `introduced_in_version`
- `removed_in_version`

## 6.2 新增字段规则

- 数据表新增字段后，默认 `answerable=false`
- 必须先入 registry 并评估隐私级别，再允许接入快照

## 6.3 删除字段规则

- 先标记 `deprecated`，完成引用清理后标记 `removed`
- 任何 `removed` 字段不得再出现在快照构建和提示词中

## 6.4 发布门禁

CI 必须校验：

- 表结构新增字段是否登记
- registry 的 `active` 字段是否都可在代码中找到映射
- `removed` 字段是否仍被引用

任一失败即阻断发布。

---

## 7. 质量与可观测性

`quality` 节必须输出：

- `source_coverage`：三大域覆盖率
- `missing_reasons`：如 `not_scheduled`, `not_synced`, `out_of_service_cycle`, `no_record`
- `freshness`：各域更新时间戳

---

## 8. 版本与变更记录

- 当前版本：`v1.0`
- 变更策略：仅允许向后兼容新增；破坏性删除需升级 `schema_version`
- 所有版本变更需附：影响问答场景、回归用例、上线时间

---

## 9. v1.0 验收清单（可打勾）

> 用法：每次联调或发布前按顺序勾选，全部通过才允许进入下一阶段。

## 9.1 三大域数据接入

- [ ] `profile_domain` 字段齐全，且与本规则 3.1 映射一致
- [ ] `service_domain` 已覆盖订单周期内全量日期（非仅今日）
- [ ] `health_archive_domain` 已覆盖卡片主字段与明细来源分层
- [ ] 所有映射字段可追溯到具体表字段（无“未知来源”）

## 9.2 回答口径正确性

- [ ] 问“明天吃什么”返回计划数据（并标注为计划）
- [ ] 问“昨天吃了什么”优先返回实际记录（并标注为实际）
- [ ] 问“后天送到哪”在订单周期内可答，超周期明确 `out_of_service_cycle`
- [ ] 问“历史第 N 份报告”可基于 `reports.list + detail_map` 回答

## 9.3 隐私与合规

- [ ] `display_user_id`、`birthday`、完整 `phone` 不进入可复述区
- [ ] 配送联系人手机号在快照与回答中均为脱敏格式
- [ ] 地址默认仅标签/街道级摘要，不输出门牌级明文
- [ ] 对隐私字段追问时返回固定安全模板，不给具体值

## 9.4 字段生命周期治理

- [ ] 新增字段已登记 `snapshot_field_registry` 且评审通过
- [ ] 删除字段已完成 `deprecated -> removed` 流程
- [ ] CI 对账通过（新增已登记、removed 无引用、active 有映射）
- [ ] `schema_version` 与本次字段变更级别一致

## 9.5 质量与可观测性

- [ ] `quality.source_coverage` 三大域都有值
- [ ] `quality.missing_reasons` 使用标准原因码
- [ ] `quality.freshness` 含各域更新时间戳
- [ ] 问答日志可看到命中数据域与日期路由结果

## 9.6 回归场景（最小集）

- [ ] 今天/明天/后天/昨天四类日期问答全部通过
- [ ] 餐食、配送、补剂、报告四类问题全部通过
- [ ] 缺排期/缺记录场景不编造，返回原因码语义
- [ ] BMI/BMR 与权威值一致，不受历史对话污染

