# 前端 App：按钮、弹窗、顶栏与容器交互差异化清单 v1.0

> **范围**：用户端 `project/src` 内主要页面与公共组件。基于当前代码结构的**静态整理**，用于产品与前端统一交互规范时对照；**配色**详见 [UI配色审计清单-全模块对照-v1.0.md](./UI配色审计清单-全模块对照-v1.0.md)。

---

## 1. 总览：三类「壳」与主导航

| 壳类型 | 典型行为 | 代表组件/文件 | 常见 z-index |
|--------|----------|----------------|--------------|
| **自顶向下全屏面板** | 从底部滑入/拖动手势关闭；可无遮罩；可嵌套第二层居中面板 | `DragPanel` | 默认 60；子层常 70–90 |
| **自右向左抽屉** | 自右侧滑入；可选遮罩；右滑超过阈值关闭；可选顶部拖条 | `DrawerScreen` | 固定 `z-[80]` |
| **左侧抽屉（聊天）** | 自左侧滑入；遮罩 `z-40`；与主内容区对齐 `max-w-sm` | `LeftDrawer` | 遮罩 40 / 抽屉 50 |
| **主 Tab 路由** | 四 Tab：首页 / AI / 套餐 / 我的（由 `currentScreen` 切换） | `AppRouter` + `AppHeader` 等；**无** `BottomNav` 组件 | AI 页底部能力条见下 |

---

## 2. 顶部栏（Header）形态差异

| 形态 | 使用场景 | 视觉与交互要点 | 文件 |
|------|----------|----------------|------|
| **AppHeader** | 首页、AI、套餐、我的 | 紫渐变底；首页含日历按钮；AI 含菜单开 **LeftDrawer**；标题随 Tab 变化 | `AppHeader.tsx` |
| **SecondaryPageHeader** | 引导内子页、营养方案、部分白底全屏 | 白底 + 底边框；左返回；标题居中；`app-header-shell-fullscreen` | `SecondaryPageHeader.tsx` |
| **DetailHeader** | 多数 **DragPanel** 内详情 | 透明顶区 + `app-header-shell-inset`；左返回/右操作；防事件冒泡到 DragPanel | `DetailHeader.tsx` |
| **HealthReportPage 自定义顶栏** | 报告页（非查看模式） | 居中标题行，**无** SecondaryPageHeader 组件 | `onboarding/HealthReportPage.tsx` |
| **Sticky 白顶** | 报告页内容区上方 | `sticky top-0 bg-white shadow-sm` 包一层顶栏 | 同上 |

**差异小结**：同一 App 内并存 **渐变全局顶栏**、**白底二级顶栏**、**透明详情顶栏** 三种层级语言；引导/报告与档案详情不一致。

---

## 3. 底部栏与全局遮罩

| 元素 | 行为 | 文件 |
|------|------|------|
| **AbilityBar（对话主界面）** | 固定底区；四入口（今日配送/餐/补剂/日反馈）；`bg-white/95`、顶部分割线 | `singlepage/AbilityBar.tsx`（经 `AIChatScreenContent` 挂载） |
| **PlusMenuPopup** | 全屏透明点击层 `z-[55]` + 菜单 `z-[60]`；支持 `fixed` / `absolute` | `PlusMenuPopup.tsx` |
| **ModalOverlay** | `max-w-sm` 内 `bg-black/50`；点击关闭（由调用方传入） | `ModalOverlay.tsx` |

---

## 4. 首页（健康档案）卡片与按钮交互

| 项目 | 实现要点 | 文件 |
|------|----------|------|
| **卡片网格** | 两列 `gap-3`；顺序由 `dashboardCardOrder` 与隐藏列表决定 | `DashboardCardGrid.tsx` |
| **卡片按压** | `DashboardCard`：`onCardClick` 时内部 **缩小动画**（约 100ms）再跳转；**Plus** 区域 `.plus-button` 不参与卡片点击 | `common/DashboardCard.tsx` |
| **禁用点击** | `disableClick`（如部分特殊卡片） | 同上 |
| **日历弹层** | Dashboard 内日期选择；选中态与主按钮色见配色文档 | `Dashboard.tsx` |
| **快捷录入** | `QuickEntryModals`：多类弹窗，主按钮色按类型分化（紫/蓝/靛/红） | `dashboard/QuickEntryModals.tsx` |
| **Alert / Confirm** | 首页体重等仍用 `AlertDialog` 等 | `Dashboard.tsx` |

**差异小结**：首页卡片交互**统一在 DashboardCard**；但弹窗层与详情页不是同一套按钮规范。

---

## 5. 健康档案「详情页」与嵌套弹窗

### 5.1 主详情层（全屏 DragPanel）

多数指标详情为：**`DragPanel` + `mask.visible: false` + `DetailHeader`**，下接可滚动内容。典型：`WeightDetailScreen`、`WaterDetailScreen`、`StepsDetailScreen`、`SleepDetailScreen`、`MeasurementsDetailScreen`、`HealthRingsDetailScreen`、`BodyCompositionDetailScreen`、`EmotionJarScreen`、`NutritionDetailScreen`、`ExerciseStatsDetailScreen` 等。

**z-index 不一致示例（需注意叠放）**：

| 页面 | 主面板 zIndex |
|------|----------------|
| 多数详情 | 60 |
| `NutritionDetailScreen` | 70 |
| `ExerciseDetailScreen` | 70 |
| `BloodGlucoseDetailScreen` | 80 |
| `FoodDetailScreen` | 外层 `z-[90]` 包一层 + 内 DragPanel 90 |

### 5.2 详情内「添加/编辑」第二层（居中 DragPanel）

常见模式：`maxHeight="70vh"`、`maxWidth="max-w-xs"`、`mask.visible: true, clickable: true`，顶栏为 **简单文字标题**（非 DetailHeader）。用于体重/水/步数/睡眠/血糖等录入；**水**另有「编辑目标」第三层 DragPanel（示例 `zIndex={80}`）。

### 5.3 详情内 Alert

多处详情在保存失败、删除确认等使用 **`AlertDialog`**（与 `ModalOverlay` 栈配合）。

**差异小结**：详情主层交互统一度较高，但 **zIndex 不统一**；食物详情额外 **fixed 外包**；嵌套录入层与主层 **头部组件形态不同**。

---

## 6.「我的」与个人中心二级流

### 6.1 ProfileScreen（Tab「我的」）

- **列表行**：Chevron 导航；部分 `AlertDialog` / `ConfirmModal`（退出登录等）。
- **登录**：可打开全屏 **`LoginPage`**（覆盖当前上下文）。
- **入口**：订单、配送计划、地址、报告、设备、设置等通过回调交给 `App` 打开对应全屏/抽屉。

### 6.2 右侧抽屉 `DrawerScreen`（二级页主力）

| 页面 | showDragHandle | showMask | 备注 |
|------|----------------|----------|------|
| `MyOrdersScreen` | false | false | 无遮罩 |
| `MyDevicesScreen` | false | false | 同上 |
| `ProfileSettingsScreen` | false | false | 同上 |
| `CustomReportScreen` | false | false | 同上 |
| `MyReportsScreen` | false | false | 内嵌 `MyHealthProfileScreen` 等，注释说明勿卸 Drawer 防露底 |
| `AddDeliveryAddressPage`（管理） | false | false | 与上一致 |
| `AddDeliveryAddressPage`（选择） | false | **默认 true** | 配送计划场景有遮罩 |
| `DeliveryPlanPage` | false | 默认 true | |
| `ExclusivePlanHubScreen` | false | 默认 true | 内嵌 Tab + `CustomMealPlanScreen` |
| `DateSelectionPage` | false | 默认 true | |

**差异小结**：同为「我的/订单相关」，**多数关遮罩、关拖条**；**配送/日期选择** 开遮罩。交互预期（点外侧是否关闭）不一致。

### 6.3 我的档案（特殊）

- **`MyHealthProfileScreen`**（从 AppModals 打开）：**DragPanel + DetailHeader**，注释写明与体重详情一致、避免双层弹窗。
- **从 `MyReportsScreen` 内再开档案**：嵌在 Drawer 内，叠层规则需依赖内层 z-index。

---

## 7. 服务套餐页（MealPlan Tab）

| 项目 | 说明 |
|------|------|
| **布局** | 非 Drawer；主路由内一屏滚动内容 |
| **卡片** | `CustomReportCard`、`ExclusivePlanCard` 等可点进子流程 |
| **弹窗** | `ConfirmModal`（重置配置）、`AlertDialog`（结果提示） |
| **下游** | 配送计划、专属方案 Hub 等多从本页入口进入 **DrawerScreen** 或其它全屏 |

**差异小结**：套餐 Tab **本身**是内容页 + 居中确认类弹窗；**配送/专属**进入另一套容器（抽屉），交互语境切换明显。

---

## 8. 按钮与确认组件矩阵

| 组件 | 按钮布局 | 典型用途 | 备注 |
|------|----------|----------|------|
| **BottomActionBar** | 底栏固定；默认主按钮 `bg-blue-600`；可被 `buttonClassName` 整页覆盖 | 引导、报告底「查看营养方案」、营养方案「开始旅程」 | 与默认蓝/业务黄/绿并存 |
| **AlertDialog** | 单按钮全宽；四类型配色（绿/红/黄/蓝） | 全局轻提示、错误、成功 | `ModalOverlay` zIndex-1 |
| **ConfirmModal** | 取消 \| 确认 双列；确认色 `red/blue/green/gray` | 删除、重置、左抽屉删除对话等 | 默认 confirm 文案「删除」 |
| **CenterModal** | 带标题栏与关闭钮；`ModalOverlay`；`zIndex` 可配 | **PaymentModal** 等 | 内部 `modalZIndex = zIndex + 5` |
| **DeliveryPlanConfirmationModal** | 手写 `fixed inset-0 z-[90]` | 配送确认 | 与 DragPanel 栈并行存在 |
| **AddressForm 内联弹层** | `fixed inset-0 z-[75]` | 地址相关表单 | 又一独立层级 |
| **BreathingPracticeOverlay** | `z-[200]` | 呼吸练习全屏 | 最高一类覆盖 |

**差异小结**：确认类交互至少 **4 套组件**（AlertDialog / ConfirmModal / BottomActionBar / CenterModal + 若干手写 fixed），**主次按钮文案、圆角、是否底栏** 不统一。

---

## 9. AI 聊天相关

| 项目 | 说明 |
|------|------|
| **LeftDrawer** | 时间线；长按菜单；多选删除；`ConfirmModal` | `singlepage/LeftDrawer.tsx` |
| **AIChatScreen / Content** | 主聊天 UI；`AlertDialog` | 与首页 Header 菜单联动 |
| **AISettingsScreen** | `DragPanel` | 与详情页同属全屏面板族 |

---

## 10. 引导、报告、营养（补充）

- **引导子页**：`BottomActionBar` + 大量自定义 `buttonClassName`（见配色文档）。
- **HealthReportView**：`absolute inset-0 bg-white z-50` 包 `HealthReportPage`。
- **NutritionSolutionPage**：`SecondaryPageHeader` + 滚动区 + `BottomActionBar`。

与档案详情 **DragPanel 无遮罩** 对比：引导/报告更偏 **白底 + 底栏 CTA** 的「文档型」布局。

---

## 11. 差异化总表（快速对照）

| 维度 | 健康档案详情（主流） | 我的二级（DrawerScreen） | 套餐 Tab | 引导/报告/营养 |
|------|----------------------|---------------------------|----------|----------------|
| 容器 | DragPanel 全屏 | 右侧抽屉 | 路由页 | 全屏/白底+SecondaryHeader |
| 遮罩 | 多为无 | 部分无/部分有 | — | 依页而定 |
| 顶栏 | DetailHeader | 各页自建或 Secondary | AppHeader | Secondary 或自定义 |
| 主确认 | 页内按钮 + AlertDialog | 黄/绿/蓝等 + Alert/Confirm | Confirm + Alert | BottomActionBar |
| 关闭 | 下滑 DragPanel / 返回 | 右滑阈值 / 返回 | Tab 切换 | 返回/onComplete |

---

## 12. 后续统一建议（可选）

1. **z-index**：收敛为枚举（如：底栏 50、抽屉 80、全屏面板 60、嵌套面板 70、支付 85、呼吸 200），文档化后替换魔法数字。
2. **抽屉**：统一「是否遮罩、是否可点遮罩关闭、是否显示拖条」三要素，按场景类型枚举而非每页随意。
3. **确认操作**：优先二选一：**双键用 ConfirmModal，单键提示用 AlertDialog**，支付等复杂流用 CenterModal；减少手写 `fixed`。
4. **详情录入二层**：统一标题栏为 **DetailHeader 小号变体** 或统一「居中卡片标题」样式，避免同一 App 两种头部语言。
5. **主按钮**：在视觉规范中定 1 个 Primary + 1 个 Destructive，替换分散的黄/绿/紫/蓝（与配色文档联动）。

---

## 13. 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0 | 2026-04-01 | 初版：容器、顶栏、按钮与弹窗交互静态整理 |
