# 童颜健康 - Health Tracking App

一个现代化的健康追踪应用，包含AI助手、情绪记录、营养分析等功能。

## 功能特性

- 📊 **健康数据追踪**: 体重、饮水、步数、运动等
- 🤖 **AI健康助手**: 智能对话和健康建议
- 😊 **情绪记录**: 情感追踪和分析
- 🍽️ **营养分析**: 食物识别和营养计算
- 📱 **响应式设计**: 移动端优先的用户界面

## 技术栈

### 前端
- React 18 + TypeScript
- Tailwind CSS
- Vite
- Lucide React (图标)

### 后端
- Node.js + Express
- Supabase (数据库 + 认证)
- OpenAI API (AI功能)

## 快速开始

### 环境配置

1. 复制环境变量文件：
```bash
cp .env.example .env
```

2. 配置环境变量：
```env
# Supabase配置
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# OpenAI API
OPENAI_API_KEY=your_openai_api_key

# 服务器配置
PORT=3001
JWT_SECRET=your_jwt_secret
```

### 数据库设置

1. 在Supabase中创建新项目
2. 运行数据库迁移：
```sql
-- 在Supabase SQL编辑器中运行 supabase/migrations/create_database_schema.sql
```

### 安装和运行

1. 安装依赖：
```bash
npm install
```

2. 启动前端开发服务器：
```bash
npm run dev
```

3. 启动后端服务器：
```bash
npm run server:dev
```

## API文档

### 认证接口
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/logout` - 用户登出

### 健康数据接口
- `GET /api/health/records` - 获取健康记录
- `POST /api/health/records` - 添加健康记录
- `PUT /api/health/records/:id` - 更新健康记录
- `DELETE /api/health/records/:id` - 删除健康记录
- `GET /api/health/nutrition/analysis` - 营养分析

### AI接口
- `POST /api/ai/chat` - AI对话
- `POST /api/ai/analyze-food` - 食物分析
- `GET /api/ai/emotions/stats` - 情绪统计

### 用户接口
- `GET /api/users/profile` - 获取用户资料
- `PUT /api/users/profile` - 更新用户资料

## 页面组件说明

### 主要页面

#### 核心功能页面
- **Dashboard.tsx** - 主仪表盘，展示健康数据概览、卡片管理
- **LoginPage.tsx** - 用户登录页面
#### AI功能
- **AIChatScreen.tsx** - AI健康助手对话界面
- **AISettingsScreen.tsx** - AI助手设置页面（主题、对话管理）

#### 餐食计划
- **MealPlan.tsx** - 餐食计划主页面
- **MealPlanDetailScreen.tsx** - 单日餐食详情（早中晚餐、营养成分）
- **CustomMealPlanScreen.tsx** - 自定义餐食计划（菜单浏览、食谱详情）
- **FoodDetailScreen.tsx** - 食物详情页（营养成分录入、拍照识别）
- **MealPlanConfirmationModal.tsx** - 餐食计划配置确认弹窗
- **SyncMealFoodsModal.tsx** - 同步餐食数据弹窗
- **SyncSuccessModal.tsx** - 同步成功提示弹窗
- **RecipeIntroScreen.tsx** - 菜谱介绍页面

#### 健康数据详情页
- **WeightDetailScreen.tsx** - 体重详情（记录查看、图表展示、目标设定）
- **WaterDetailScreen.tsx** - 饮水详情（每日饮水记录、目标追踪）
- **StepsDetailScreen.tsx** - 步数详情（步数统计、卡路里消耗）
- **SleepDetailScreen.tsx** - 睡眠详情（睡眠时长、质量分析）
- **BloodGlucoseDetailScreen.tsx** - 血糖详情（血糖记录、趋势分析）
- **MeasurementsDetailScreen.tsx** - 身体测量详情（腰围、臀围等）
- **ExerciseDetailScreen.tsx** - 运动详情（运动记录、卡路里）
- **ExerciseStatsDetailScreen.tsx** - 运动统计详情
- **HealthRingsDetailScreen.tsx** - 健康圆环详情（活动、运动、站立）
- **NutritionDetailScreen.tsx** - 营养详情（碳水、蛋白质、脂肪摄入）

#### 健康数据卡片组件
- **WeightCard.tsx** - 体重卡片
- **WaterCard.tsx** - 饮水卡片
- **CalorieCard.tsx** - 卡路里卡片
- **SleepCard.tsx** - 睡眠卡片
- **BloodGlucoseCard.tsx** - 血糖卡片
- **EmotionCard.tsx** - 情绪卡片
- **NutritionCard.tsx** - 营养卡片
- **HealthReportCard.tsx** - 健康报告卡片
- **CustomReportCard.tsx** - 定制报告卡片
- **CustomSupplementCard.tsx** - 定制补剂卡片

#### 个人中心
- **ProfileScreen.tsx** - 个人中心主页面（设置入口、报告、订单）
- **ProfileSettingsScreen.tsx** - 个人资料设置（基本信息、健康目标）
- **MyReportsScreen.tsx** - 我的报告列表
- **MyOrdersScreen.tsx** - 我的订单列表
- **MyDevicesScreen.tsx** - 我的设备管理
- **CustomReportScreen.tsx** - 定制健康报告详情
- **CustomSupplementScreen.tsx** - 定制补剂方案详情

#### 配送管理
- **AddDeliveryAddressPage.tsx** - 配送地址管理（新增、编辑、删除地址）
- **DateSelectionPage.tsx** - 配送日期选择页面
- **DateMealSelectionPage.tsx** - 配送日期和餐次选择
- **DeliveryPlanPage.tsx** - 配送计划详情页（日历视图、地址管理）

#### 其他功能
- **EmotionJarScreen.tsx** - 情绪罐页面（情绪记录、统计分析）
- **EditDashboardScreen.tsx** - 编辑仪表盘（卡片排序、显示/隐藏）
- **CalendarWeek.tsx** - 周历组件
- **FilterColumn.tsx** - 筛选列组件

#### 工具组件
- **ScrollPicker.tsx** - 滚动选择器
- **HeightRulerPicker.tsx** - 身高尺子选择器
- **WeightRulerSlider.tsx** - 体重尺子滑块

### 引导流程页面 (onboarding/)

- **OnboardingFlow.tsx** - 引导流程主控制器
- **WelcomePage.tsx** - 欢迎页
- **GenderSelectionPage.tsx** - 性别选择页
- **AboutYouPages.tsx** - 关于你的信息收集（年龄、身高等）
- **BodyDataPages.tsx** - 身体数据收集（体重、目标体重）
- **GoalSelectionPage.tsx** - 健康目标选择
- **HealthReportPage.tsx** - 健康评估报告页
- **NutritionSolutionPage.tsx** - 营养方案推荐页
- **CompletionPage.tsx** - 引导完成页
- **SectionTransitionPage.tsx** - 章节过渡页
- **ProgressIndicator.tsx** - 进度指示器

## 数据库结构

### 主要表格
- `user_profiles` - 用户资料
- `health_records` - 健康记录
- `ai_conversations` - AI对话记录
- `emotion_records` - 情绪记录
- `meal_plans` - 餐食计划
- `exercise_records` - 运动记录
- `delivery_addresses` - 配送地址
- `user_packages` - 用户套餐
- `user_devices` - 用户设备
- `health_assessments` - 健康评估
- `nutrition_plans` - 营养计划
- `custom_reports` - 定制报告
- `custom_supplements` - 定制补剂

## 部署

### 前端部署
应用已部署到: https://redanwell-cro4.bolt.host

### 后端部署
推荐使用以下平台部署后端：
- Railway
- Render
- Vercel (Serverless Functions)
- Heroku

## 开发指南

### 添加新的健康数据类型
1. 在数据库schema中添加新的record_type
2. 在后端API中添加相应的处理逻辑
3. 在前端添加UI组件和数据处理

### 集成新的AI模型
1. 在`server/services/aiService.js`中添加新的API集成
2. 更新环境变量配置
3. 在路由中添加新的端点

## 贡献

欢迎提交Issue和Pull Request来改进这个项目！

## 许可证

MIT License
