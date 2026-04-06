# UI 配色体系与全模块对照（用户端 App）

> **版本**：v2.0（全量重写）  
> **范围**：`project/src` 用户端（Vite + React + Tailwind）。**不含** `project/admin` 管理端（若需可另开文档）。  
> **性质**：基于仓库内 **Tailwind 类名**、**内联 style**、**SVG/Canvas 十六进制色** 的静态归纳；**非设计定稿**。`tailwind.config.js` 当前 **未** 扩展 `theme.colors`，配色几乎全部来自 **Tailwind 默认色阶** 与 **硬编码 hex**。

---

## 1. 文档怎么用

| 读者 | 建议 |
|------|------|
| 产品 / 设计 | 先看 **§3 全局语义与冲突**，再看 **§4 按模块**，定位「同一动作多种颜色」的模块。 |
| 前端 | 改某屏时，用 **§4** 对应小节 + 文件名列跳转代码；统一品牌色时配合 **§6** 做 token 迁移。 |

**维护**：大改版后可对 `src` 重新检索 `bg-|text-|from-|#[0-9a-fA-F]{6}` 等与本文对照更新修订记录。

---

## 2. 全局层（所有页面之下）

| 层级 | 实现 | 文件/位置 |
|------|------|-----------|
| 页面根背景 | `#f3f4f6`（与 `gray-100` 接近） | `src/index.css` → `html, body`；`App.tsx` 加载/根容器亦有内联同色 |
| 主内容手机宽度容器 | 白底 `#ffffff` | `App.tsx` → `max-w-sm` 主列 |
| 健康档案 Tab 内容区背景 | `#F5F7FA` | `App.tsx` 中 `currentScreen === 'dashboard'` |
| AI / 其它主 Tab 内容区 | `bg-white` | `App.tsx` |
| 顶栏高度 CSS 变量 | `--app-header-height` | `AppHeader.tsx` 写入 `documentElement` |
| 顶栏壳层工具类 | `app-header-shell-fullscreen` 等 | `src/index.css` `@layer components` |

---

## 3. 全局语义色与「产品线」速览

以下为 **代码中实际出现** 的语义分工（非理想 token，仅描述现状）。

### 3.1 品牌与主操作（多条并行）

| 视觉角色 | 常见 Tailwind / 备注 | 主要出现位置 |
|----------|----------------------|--------------|
| **紫系（主品牌感）** | `purple-200`～`purple-600`、`violet-*` | 全屏顶栏渐变、日历选中、用户聊天气泡、快捷卡主按钮/描边、阶段标签、部分状态徽章 |
| **翠绿（登录/确认感）** | `emerald-400/500` | 登录主按钮与勾选、协议 focus；**反馈气泡**整卡 `emerald-50/200/800` |
| **黄系（报告/订单 CTA）** | `yellow-400/500` | 健康报告底栏、营养方案选中、我的订单主按钮、部分地址/支付 |
| **绿渐变（履约/配送）** | `green-400 → emerald-500` | 配送计划页、加地址页、部分餐别选择主 CTA |
| **蓝系（信息/次主操作）** | `blue-500/600`、`indigo-*` | 详情图表、配送/日反馈卡片顶栏渐变、Alert `info`、多页说明块 |
| **专属方案** | `violet-*`、`cyan-400` | ExclusivePlan*、RecipeIntro 列表点 |
| **深色沉浸** | `#0a0e1a` + 紫蓝径向渐变 | `BreathingPracticeOverlay` 全屏练习 |

### 3.2 功能语义（相对统一）

| 语义 | 常见实现 | 典型位置 |
|------|----------|----------|
| 成功 | `green-*` | Alert success、订单完成、任务勾选、部分确认态 |
| 错误 / 危险 | `red-*` | Alert error、删除侧栏、校验错误、顶栏红点角标 |
| 警告 | `yellow-*`、`amber-*` | Alert warning、支付提示、运动图表强调 |
| 中性表面 | `gray-*`、`white`、`stone-*` | 卡片底、分割线、次要文案 |
| 信息强调 | `blue-*` | 链接态、数值强调、配送卡片区块 |

### 3.3 数据可视化硬编码（与 Tailwind 并存）

| 用途 | 颜色示例 | 文件 |
|------|----------|------|
| 折线图默认线/点 | `#3b82f6` | `common/LineChart.tsx` |
| 正常区间带 | `#fef3c7`（对应 yellow-100） | 多详情页传入；`LineChart` 内 colorMap |
| 健康环 | `#10B981`、`#F59E0B`、`#3B82F6`、`#EF4444` 等 | `HealthRingsDetailScreen.tsx` |
| 心情罐子环分段 | `#ef4444`、`#06b6d4`、`#3b82f6`、`#8b5cf6`、`#a855f7`、`#9ca3af` | `EmotionJarScreen.tsx` |
| 体成分示意图 | `#93C4F6`、`#5EA5EA`、`#101828`、`#4F93DA` | `BodyCompositionDetailScreen.tsx` |
| 滚轮刻度文字 | `#1f2937`～`#d1d5db` | `ScrollPicker.tsx` |
| Tooltip | 背景 `#fef3c7`、字 `#78350f` | `common/ChartTooltip.tsx` |

---

## 4. 按模块：全 App 配色对照

### 4.1 顶栏、日历、加号菜单

| 元素 | 配色要点 | 文件 |
|------|----------|------|
| 顶栏背景 | `bg-gradient-to-br from-purple-200 via-purple-100 to-purple-50`（四主 Tab 相同） | `AppHeader.tsx` |
| 标题与图标 | `text-gray-700` / `gray-800` | 同上 |
| 日历按钮 | `bg-white/70` hover `white/80` | 同上 |
| 日历弹层容器 | `bg-white rounded-xl shadow-lg` | 同上 |
| 日历选中/今天 | `purple-500` 相关（选中 `bg-purple-500 text-white` 等） | `AppHeader.tsx`（与 `Dashboard` 内日历协同） |
| 菜单红点 | `bg-red-500` | 同上 |
| PlusMenuPopup | 白底、灰边框、紫/灰图标 hover | `PlusMenuPopup.tsx` |

### 4.2 登录

| 元素 | 配色要点 | 文件 |
|------|----------|------|
| 主按钮、输入 focus | `emerald-400/500` | `LoginPage.tsx` |
| 协议勾选 | `emerald-400` 填充边框 | 同上 |
| 微信图标按钮 | `green-500` 图标；`emerald` hover 边 | 同上 |
| 错误提示 | `red` / `AlertCircle` 系 | 同上 |

### 4.3 引导（`onboarding/*`）

| 页面/组件 | 配色要点 | 文件 |
|-----------|----------|------|
| Welcome | 背景 `purple-50 → blue-50`；头像区 teal；按钮 **emerald** | `WelcomePage.tsx` |
| 多页表单 | 主按钮 **emerald-400/500** | `AboutYouPages.tsx`、`BodyDataPages.tsx` 等 |
| 选择控件 | 选中 **emerald**、ring **emerald** | `OnboardingSelectButton.tsx`、`OnboardingMultiSelectButton.tsx` |
| 进度 | **emerald-400** | `ProgressIndicator.tsx` |
| 健康信息四卡头 | **blue / purple / amber-orange / pink-rose** 渐变 | `HealthInfoCards.tsx` |
| 健康报告页 | 页背景 **`#FAF8F3`**；底栏 CTA **yellow-400/500**；错误 **red-50** 等 | `HealthReportPage.tsx` |
| 营养方案 | `gray-50` 内容区；横幅 green→blue；**yellow-400** 分区条、选中、底栏 | `NutritionSolutionPage.tsx`、`NutritionItemCard.tsx` |
| 兜底页 | 与营养方案类似的灰底 | `NutritionSolutionPageFallback.tsx` |

### 4.4 健康档案首页（Dashboard）

| 元素 | 配色要点 | 文件 |
|------|----------|------|
| 页背景 | `#F5F7FA` | `Dashboard.tsx` |
| 身体分等卡片 | 边框 `#E6EBF2`；主分 `text-[#101828]` | 同上 |
| 日历与选中 | `purple` 系选中/hover（与顶栏一致） | 同上 |
| 仪表盘卡片 | 各 `*CardForDashboard.tsx`、`NutritionCardForDashboard.tsx` 等：**蓝/紫/绿/靛** 等分指标配色 | `components/*Card*.tsx` |
| 呼吸入口卡 | 浅紫边框/渐变倾向 | `breathing/BreathingCardForDashboard.tsx` |
| 情绪卡 | 暖色与灰 | `EmotionCard.tsx` |

### 4.5 快捷录入（弹窗 + 聊天卡片）

| 元素 | 配色要点 | 文件 |
|------|----------|------|
| 弹窗主按钮 | **purple / blue / indigo / red** 分业务类型 | `dashboard/QuickEntryModals.tsx` |
| 聊天内 QuickEntryCard | 容器 `bg-gray-50/90`；边框待确认 **purple-200**、已确认 **green-300**；主按钮 **purple-500**；多类型图标 **橙/蓝/绿/紫/靛/粉/黄/红/violet** | `QuickEntryCard.tsx` |
| 表单 focus | `border-purple-300` / `focus:ring-purple-200` | 同上 |

### 4.6 编辑首页卡片

| 元素 | 配色要点 | 文件 |
|------|----------|------|
| 多色标签背景 | `bg-*-100` | `EditDashboardScreen.tsx` |
| 拖拽高亮 | `blue` | 同上 |
| 删除 / 完成 | `red-500`、`green-500` | 同上 |

### 4.7 AI 聊天主界面（壳 + 输入 + 能力条）

| 元素 | 配色要点 | 文件 |
|------|----------|------|
| 聊天页背景 | `bg-white` | `AIChatScreenContent.tsx` |
| 历史日条 | `bg-white/95 border-gray-100`；文字 gray | 同上 |
| Sticky 顶区 | `bg-white` | 同上 |
| **我的健康**标题壳 | `bg-white/95 border-gray-200`；阶段 pill **`purple-50/700/100`** | `TopSummaryRowHeader.tsx` |
| 置顶卡骨架（若启用） | 白卡灰边；图标 **purple-500** | `TopCardStack.tsx` |
| 展开区内容 | 灰白底 + 紫/蓝等数据强调 | `TopSummaryRowContent.tsx`、`TopSummaryRowBlock.tsx` |
| **用户气泡** | `bg-purple-500 text-white` | `common/ChatMessageBubble.tsx` |
| **AI 气泡** | `bg-gray-100 text-gray-800 border-gray-200`；地址高亮 `text-black` | 同上 |
| AI 头像按钮 | `bg-purple-200 hover:bg-purple-300` | 同上 |
| **反馈气泡** | `bg-emerald-50 border-emerald-200`；图标/字 **emerald** | `chat/ChatFeedbackBubble.tsx` |
| 输入条容器 | `border-gray-200 bg-white shadow-sm` | `AIChatScreenContent.tsx` |
| 键盘模式切换 | 激活 **`text-purple-500 bg-purple-50`** | 同上 |
| 发送等 | 紫/灰按钮（同文件后部） | 同上 |
| 纯输入框 | `text-gray-700 placeholder-gray-400` | `chat/TextInput.tsx` |
| **AbilityBar** | `bg-white/95 border-gray-200/50`；`text-gray-700`；`hover:text-purple-600` | `singlepage/AbilityBar.tsx` |

### 4.8 聊天内「便签」大卡

| 卡片 | 顶栏/强调 | 主 CTA / 区块 | 文件 |
|------|-----------|---------------|------|
| 今日配送 | `from-blue-50 to-indigo-50`；图标 blue-600；内层 **blue-50** 区块；确认 **emerald**；锁状态 **绿/黄/灰** | `chat/DeliveryPlanCard.tsx` |
| 日反馈 | 顶栏同 **blue→indigo**；任务 **green** 勾选；待办灰框；删除露红 **red-600**；数值 **blue-600** | `chat/DailyReportCard.tsx` |
| 今日餐 / 今日补剂 | 与业务一致的浅彩底+边框（蓝/绿/紫等，见文件内） | `TodayMealsCard.tsx`、`TodaySupplementsCard.tsx` |
| **练习呼吸便签** | **violet** 边框与渐变底；主按钮 **`from-violet-600 to-indigo-600`** | `chat/BreathingChatAbilityCard.tsx` |
| 其它 Ability 便签 | 与 `ABILITY_CARD_TRIGGER_LABEL` 对应组件（配送/餐/补剂/报告） | 同目录相关卡 |

### 4.9 呼吸全屏练习

| 元素 | 配色要点 | 文件 |
|------|----------|------|
| 背景 | 深色 `#0a0e1a` + 紫蓝径向渐变 | `breathing/BreathingPracticeOverlay.tsx` |
| 练习球/光晕 | **violet / indigo** 多层 radial | 同上 |

### 4.10 心情罐子与情绪

| 元素 | 配色要点 | 文件 |
|------|----------|------|
| 多段圆弧 | 红/青/蓝/紫/灰等 **SVG stroke 硬编码** | `EmotionJarScreen.tsx` |
| 渐变背景块 | 多段 `from-* to-*` | 同上 |

### 4.11 左侧抽屉（日历对话流）

| 元素 | 配色要点 | 文件 |
|------|----------|------|
| 抽屉面 | 白/灰背景；紫/蓝图标；选中/hover 灰底 | `LeftDrawer.tsx` |
| 删除确认等 | 复用 `ConfirmModal` | 同上 |

### 4.12 餐食计划 / 食谱 / 食物详情

| 文件 | 配色要点 |
|------|----------|
| `MealPlan.tsx` | 空态 **purple**；提示 **amber** |
| `CustomMealPlanScreen.tsx` | 宏量 **pink/blue/green**；说明 **amber** 系 |
| `MealPlanConfirmationModal.tsx` | 成功 **green** 系 |
| `DateMealSelectionPage.tsx` | **purple→pink** 强调区；餐次 **green**；主 CTA **green→emerald 渐变** |
| `MealSectionCard.tsx`、`MealCard.tsx`、`RecipeCard.tsx`、`RecipeInfoHeader.tsx`、`MealTypeSelector.tsx` | 灰白底 + 绿/紫/蓝 分块强调 |
| `FoodDetailScreen.tsx` | 多色标签与按钮（蓝/绿/紫等） |
| `SyncMealFoodsModal.tsx`、`SyncSuccessModal.tsx` | 成功绿、信息蓝灰 |

### 4.13 配送、地址、支付

| 文件 | 配色要点 |
|------|----------|
| `DeliveryPlanPage.tsx`、`AddDeliveryAddressPage.tsx` | Tab/主按钮 **green→emerald 渐变** |
| `DeliveryPlanTable.tsx`、`DeliveryPlanConfirmationModal.tsx`、`AddressForm.tsx`、`AddressList.tsx` | 表格灰白；强调绿/蓝/红错误 |
| `AddressSelectionModal.tsx`（及 `delivery/` 下同名） | 选中 **purple**；标签 **blue/yellow**；确认 **purple** |
| `AddAddressModal.tsx` | **yellow-400/500** 主 CTA；**yellow-100** 选中 |
| `BatchAddressUpdateModal.tsx` | 黄/绿/灰组合 |
| `PaymentModal.tsx` | 方式图标 **蓝/绿/红**；勾选 **amber**；主支付 **yellow** |

### 4.14 专属方案

| 文件 | 配色要点 |
|------|----------|
| `ExclusivePlanCard.tsx` | **violet-100/600** |
| `ExclusivePlanHubScreen.tsx` | Tab **violet-700**；圆点 **cyan-400** |
| `RecipeIntroScreen.tsx` | **cyan-400** 列表点 |

### 4.15「我的」及二级页

| 文件 | 配色要点 |
|------|----------|
| `ProfileScreen.tsx` | **green-500** 勾选；**red-500** 角标 |
| `ProfileSettingsScreen.tsx` | 头像区 **blue** 渐变；注销 **red** |
| `MyHealthProfileScreen.tsx` | **blue-50/800/900** 说明 |
| `MyDevicesScreen.tsx` | **blue–cyan** 横幅；**amber**；连接 **green**；断开 **red** |
| `MyOrdersScreen.tsx` | 状态 **amber/green/blue**；主按钮 **yellow**；区块 **green/orange** 渐变 |
| `MyReportsScreen.tsx` | **yellow** 系；滑动 **red** |
| `CustomReportScreen.tsx` | **blue→purple** 浅渐变底 |
| `CustomSupplementScreen.tsx`、`CustomSupplementCard.tsx` | 卡片 **green** 渐变；信息 **blue-50**；按钮 **purple-300/400** |
| `AISettingsScreen.tsx` | 装饰 **blue/orange/green**；保存 **emerald 渐变** 与 **purple 渐变** 并存 |
| `HealthReportCard.tsx`、`HealthReportView.tsx` | 与报告页米黄/黄 CTA 一致 |

### 4.16 健康指标详情页（图表 + CTA）

| 页面 | 主色倾向 | 文件 |
|------|----------|------|
| 体重 | **purple-500/600**；区间 `#fef3c7` | `WeightDetailScreen.tsx` |
| 饮水 | **blue-500/600** | `WaterDetailScreen.tsx` |
| 营养 | **blue / green** 进度 | `NutritionDetailScreen.tsx` |
| 睡眠 | **indigo-500/600** | `SleepDetailScreen.tsx` |
| 运动 | **blue-500** 等 | `ExerciseDetailScreen.tsx` |
| 运动统计 | **amber** 图表 `#f59e0b` | `ExerciseStatsDetailScreen.tsx` |
| 血糖 | **blue-500** 选中 | `BloodGlucoseDetailScreen.tsx` |
| 步数 | **amber** `#fbbf24` | `StepsDetailScreen.tsx` |
| 围度 | 粉/紫/灰组合 | `MeasurementsDetailScreen.tsx` |
| 体成分 | 自定义蓝 `#93C4F6` 等 | `BodyCompositionDetailScreen.tsx` |
| 健康环 | 绿/琥珀/蓝/红 SVG | `HealthRingsDetailScreen.tsx` |
| 其它 | `BloodGlucoseCard`、`SleepCard`、`StepsCard`、`WaterCardForDashboard` 等与上表呼应 | 各 `*Card*.tsx`、`*DetailScreen.tsx` |

### 4.17 其它功能屏（抽样）

| 文件 | 配色要点 |
|------|----------|
| `DateSelectionPage.tsx` | 紫/绿/灰日历与 CTA |
| `NutritionSolutionPage.tsx`（引导外复用） | 同 §4.3 |
| `FilterColumn.tsx` | 多灰 + 强调色筛选态 |
| `CalorieCard.tsx`、`CaloriesCard.tsx`、`NutritionCard.tsx` | 能量/营养素多色条 |
| `DevToolsPanel.tsx` | 高对比调试色（紫/黄/红等） |
| `ErrorBoundary.tsx` | 错误页灰白 + 红强调 |
| `LazyLoadErrorBoundary.tsx` | 浅红底提示 |
| `modules/date/DatePickerModal.tsx` | 灰白 + 紫选中倾向 |

### 4.18 全局弹窗与底栏组件

| 组件 | 配色要点 | 文件 |
|------|----------|------|
| AlertDialog | **success/error/warning/info** 四套：**green / red / yellow / blue** 图标底+标题+按钮 | `common/AlertDialog.tsx` |
| ConfirmModal | 红/灰确认 destructive 变体 | `common/ConfirmModal.tsx` |
| CenterModal / BottomSheetModal / ModalOverlay | 白内容+灰遮罩 | `common/*.tsx` |
| BottomActionBar | 默认 **`bg-blue-600`** 主按钮；业务常 `buttonClassName` 覆盖为 **黄/绿** 等 | `common/BottomActionBar.tsx` |
| StatusBadge | **purple**（使用中/制作/配送）、**blue**（进行中）、**green**（完成）、**gray**（待开启等） | `common/StatusBadge.tsx` |
| LoadingState / EmptyState | 灰主色 | `common/LoadingState.tsx`、`EmptyState.tsx` |
| SecondaryPageHeader / DetailHeader / DrawerScreen | 白/透明顶；灰字 | 对应 `common/*.tsx` |
| DragPanel | 浅灰背景容器 | `common/DragPanel.tsx` |

### 4.19 聊天加载与语音

| 文件 | 配色要点 |
|------|----------|
| `chat/ChatLoadingIndicator.tsx`、`common/ChatLoadingIndicator.tsx` | 灰/紫 loading |
| `chat/AiReplyVoiceButton.tsx` | 灰紫 |
| `chat/EmotionAnimation.tsx` | 表情叠加，依赖 emoji/动效 |

---

## 5. 冲突与统一建议（执行清单）

1. **主 CTA 颜色过多**：紫（首页/聊天）、emerald（登录/反馈）、黄（报告/订单/支付）、绿渐变（配送）四线并行 → 建议定义 **`--color-primary`** 与 **`--color-primary-soft`**，分阶段替换。  
2. **聊天气泡紫 vs 呼吸便签 violet→indigo**：用户消息已是 **purple**，呼吸卡用 **violet/indigo** → 设计需明确是「同一品牌色相」还是「功能区分」。  
3. **BottomActionBar 默认蓝** 与全站主色不一致 → 默认改为 token 的 primary，或减少覆盖遗漏。  
4. **图表 hex** 与 Tailwind 类名混用 → 建议集中 `chartColors.ts` 或 CSS 变量，与 `LineChart` colorMap 对齐。  
5. **详情页按指标分色** 有意则可保留；若要求「档案一致主色」需单独设计规范。  
6. **DevTools** 高饱和色勿泄漏到生产 bundle 的默认可视路径（若担心可做 env 裁剪）。

**建议落地顺序（P0→）**：登录 + 顶栏 + 聊天主 CTA → 配送支付链 → 我的订单/报告 → 详情页图表 token 化。

---

## 6. 与其它文档的关系

- **交互与层级**（抽屉、z-index、AbilityBar 容器）：见 [UI交互与容器差异化清单-v1.0.md](./UI交互与容器差异化清单-v1.0.md)。  
- **架构与路由**：见 [应用完整架构说明.md](./应用完整架构说明.md)。

---

## 7. 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0 | 2026-04-01 | 初版静态审计（模块覆盖不全） |
| v2.0 | 2026-04-01 | **全量重写**：覆盖 `project/src` 全局壳、引导、档案、聊天全链路、便签卡、呼吸层、心情、餐食、配送支付、我的、详情页、图表硬编码、全局弹窗；声明不含 admin |
