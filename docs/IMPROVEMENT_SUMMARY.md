# 应用架构与数据流转机制文档

**更新日期**: 2025-12-09  
**文档版本**: v2.2  
**状态**: ✅ 当前架构文档

---

## 📐 整体架构

### 架构层次（3层架构规范）

```
┌─────────────────────────────────────────┐
│          UI层 (Components)              │
│  - React组件                            │
│  - 使用Hooks获取数据                    │
│  - 使用Context获取全局状态              │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│      数据管理层 (Hooks + Context)         │
│  - React Query Hooks (数据查询/更新)     │
│  - Context (全局状态管理)                │
│  - 数据缓存和同步                        │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│      数据访问层 (Services)                │
│  - Service层直接操作Supabase              │
│  - 数据格式转换                           │
│  - 错误处理                               │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│      数据存储层 (Supabase)                │
│  - PostgreSQL数据库                      │
│  - 行级安全策略(RLS)                     │
│  - 实时订阅(Realtime)                    │
└──────────────────────────────────────────┘
```

### 核心原则

1. **单一数据源**：数据库是唯一真实数据源
2. **3层架构**：Component → Hook → Supabase（最多3层）
3. **React Query缓存**：自动缓存、自动刷新、乐观更新
4. **用户数据隔离**：所有查询自动附加`user_id`过滤

---

## 💾 数据存储机制

### 1. 数据库存储（Supabase PostgreSQL）

**主要数据表**：

- `auth.users` - 用户认证信息（Supabase Auth管理）
- `user_profiles` - 用户健康档案
- `health_records` - 健康记录（统一表，通过`record_type`区分）
  - `weight` - 体重记录
  - `water` - 饮水记录
  - `steps` - 步数记录
  - `sleep` - 睡眠记录
  - `blood_glucose` - 血糖记录
  - `exercise` - 运动记录
  - `food` - 食物记录
  - `measurements` - 身体测量记录
  - `calories` - 卡路里记录
  - `hrv` - 心率变异性记录
  - `blood_pressure` - 血压记录（未来功能）
- `health_assessments` - 健康评估记录
- `chat_messages` - AI聊天消息
- `user_addresses` - 用户地址
- `meal_plans` - 餐食计划
- `supplement_plans` - 补剂计划

**数据隔离机制**：

```sql
-- 所有表启用RLS（行级安全策略）
ALTER TABLE health_records ENABLE ROW LEVEL SECURITY;

-- 用户只能访问自己的数据
CREATE POLICY "用户访问自己的数据" 
ON health_records FOR ALL 
USING (auth.uid() = user_id);
```

### 2. 本地存储（localStorage）

**React Query自动持久化**：
- 使用 `@tanstack/query-persist-client-core` 自动持久化查询缓存
- 存储键：`REACT_QUERY_OFFLINE_CACHE`
- 缓存时长：24小时
- 自动管理：React Query自动处理缓存的保存和恢复

**手动localStorage管理**（仅用于非业务数据）：
- 引导流程状态（`onboarding_step`, `onboarding_data`）- 临时状态
- 用户UI偏好（`dashboardCardOrder`, `hiddenDashboardCards`）- 界面配置
- 同步时间戳（`sync_last_sync_times:user:${userId}`）- 同步元数据

**已移除**：
- ❌ 离线队列（`sync_offline_queue`）- 已移除，V1版本断网时直接提示错误

**用户隔离**：
- 所有localStorage键都包含用户ID：`key:user:${userId}`
- 用户切换时自动清除旧用户数据

---

## 📥 数据加载机制

### 1. React Query数据查询

**查询Hook模式**：

```typescript
// hooks/useWeightRecordsQuery.ts
export function useWeightRecordsQuery(startDate?: Date, endDate?: Date) {
  const { user } = useAuth();
  
  const query = useQuery({
    queryKey: ['weight-records', user?.id, startDate, endDate],
    queryFn: () => weightService.getRecords(user.id, startDate, endDate),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5分钟缓存
  });
  
  return {
    records: query.data || [],
    isLoading: query.isLoading,
    refresh: () => query.refetch(),
  };
}
```

**缓存策略**：
- `staleTime`: 5分钟（数据在5分钟内视为新鲜，不重新请求）
- `queryKey`: 包含用户ID和查询参数，确保缓存隔离
- 自动去重：相同queryKey的多个组件共享同一查询

### 2. Context全局状态

**UserProfileContext**：
- 用户档案数据（`user_profiles`表）
- 用户套餐信息（`user_packages`表）
- 健康评估数据（`health_assessments`表）
- 餐食计划配置

**加载流程**：
```typescript
// 1. 初始化时从localStorage读取缓存
const [profile, setProfile] = useState(() => {
  // 尝试从localStorage读取
  const cached = localStorage.getItem(`userProfile:user:${userId}`);
  return cached ? JSON.parse(cached) : null;
});

// 2. 从数据库加载最新数据
useEffect(() => {
  loadProfile(); // 查询Supabase
}, [userId]);

// 3. 更新localStorage缓存
const updateProfile = async (updates) => {
  // 更新数据库
  await supabase.from('user_profiles').update(updates);
  // 更新Context
  setProfile(newProfile);
  // 更新localStorage
  localStorage.setItem(`userProfile:user:${userId}`, JSON.stringify(newProfile));
};
```

### 2. Dashboard数据加载（聚合模式）

**Dashboard数据聚合**：
- 使用 `useDashboardData` Hook 管理首页数据
- 通过 `dashboardDataService.getDayHealthData()` 并行聚合多个Service的数据
- 聚合来源：体重、饮水、步数、食物、运动、测量、睡眠、血糖、情绪等9种数据类型
- 数据格式转换：将数据库原始数据转换为Dashboard所需的 `DayData` 格式

**加载流程**：
```typescript
// useDashboardData Hook
const loadDayData = async (date: Date) => {
  // 并行调用各个Service获取数据
  const healthData = await dashboardDataService.getDayHealthData(date);
  // 转换为Dashboard格式
  const dayData = convertHealthDataToDayData(healthData, targetWeight, userProfile);
  setRealTimeData(dayData);
};
```

### 3. 数据加载优先级

1. **首次加载**：React Query从localStorage恢复缓存（快速显示）
2. **后台刷新**：从Supabase加载最新数据（确保准确性）
3. **数据更新**：React Query自动更新缓存（保持同步）

---

## 🔄 数据更新机制

### 1. React Query Mutations

**更新模式**：

```typescript
// hooks/useWeightRecordsQuery.ts
const addMutation = useMutation({
  mutationFn: ({ weight, date, notes }) => 
    weightService.addRecord(user.id, weight, date, notes),
  onSuccess: () => {
    // 自动失效相关查询，触发重新获取
    queryClient.invalidateQueries({ 
      queryKey: ['weight-records', user?.id] 
    });
  },
});
```

**自动同步**：
- Mutation成功后自动失效相关查询（`invalidateQueries`）
- 所有使用该查询的组件自动更新
- React Query自动重新获取最新数据
- 无需手动刷新

**详情页与首页数据同步**（2025-12-09 重构）：
- ✅ Dashboard 数据使用 React Query 管理（`useDashboardData` Hook）
- ✅ 详情页操作（新增/删除/更新）后，Mutation 自动 invalidate dashboard-data query
- ✅ 首页数据自动刷新，无需手动回调
- ✅ 统一的数据管理方式，降低组件间耦合

### 2. 乐观更新（Optimistic Updates）

**场景**：用户操作后立即更新UI，不等待服务器响应

```typescript
const updateMutation = useMutation({
  mutationFn: updateRecord,
  onMutate: async (newRecord) => {
    // 取消正在进行的查询
    await queryClient.cancelQueries({ queryKey: ['weight-records'] });
    
    // 保存当前数据快照
    const previousRecords = queryClient.getQueryData(['weight-records']);
    
    // 乐观更新
    queryClient.setQueryData(['weight-records'], (old) => 
      [...old, newRecord]
    );
    
    return { previousRecords };
  },
  onError: (err, newRecord, context) => {
    // 回滚到之前的状态
    queryClient.setQueryData(['weight-records'], context.previousRecords);
  },
});
```

### 3. 批量更新

**场景**：多个相关数据需要同时更新

```typescript
// 更新用户档案后，失效多个相关查询
queryClient.invalidateQueries({ queryKey: ['user-profile'] });
queryClient.invalidateQueries({ queryKey: ['health-assessment'] });
queryClient.invalidateQueries({ queryKey: ['weight-records'] });
```

---

## 📡 数据通信机制

### 1. 组件间通信

**Props传递**：
- 父子组件：通过props传递数据和回调
- 兄弟组件：通过共同的父组件或Context

**Context共享**：
- `AuthContext` - 认证状态
- `UserProfileContext` - 用户档案
- `OnboardingContext` - 引导流程状态
- `ChatContext` - 聊天状态

### 2. 跨页面实时同步

**Supabase实时订阅**：

```typescript
// 订阅数据库变更
const channel = supabase
  .channel('chat-messages')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'chat_messages',
    filter: `user_id=eq.${userId}`
  }, (payload) => {
    // 实时更新UI
    updateMessage(payload.new);
  })
  .subscribe();
```

**事件总线（离线兜底）**：

```typescript
// 派发事件
window.dispatchEvent(new CustomEvent('chat:update', {
  detail: { id: messageId, data: newData }
}));

// 监听事件
useEffect(() => {
  const handler = (e: CustomEvent) => {
    updateMessage(e.detail);
  };
  window.addEventListener('chat:update', handler);
  return () => window.removeEventListener('chat:update', handler);
}, []);
```

### 3. 数据同步策略

**在线同步**：
1. 用户操作 → Mutation → Supabase
2. Mutation成功 → 失效查询 → 自动刷新
3. 实时订阅 → 跨页面同步

**离线支持**：
1. 操作失败 → 加入离线队列
2. 网络恢复 → 自动重试队列
3. 本地缓存 → 显示最后已知状态

---

## 🔀 数据流转机制

### 1. 数据读取流程

```
用户打开页面
    ↓
组件调用Hook (useWeightRecordsQuery)
    ↓
Hook检查React Query缓存
    ├─ 缓存有效 → 直接返回缓存数据
    └─ 缓存失效 → 调用Service
            ↓
        Service查询Supabase
            ↓
        返回数据 → Hook → 更新缓存
            ↓
        组件接收数据 → 渲染UI
```

### 2. 数据写入流程

```
用户操作（添加/更新/删除）
    ↓
组件调用Mutation (addRecord)
    ↓
Hook执行Mutation
    ↓
Service操作Supabase
    ├─ 成功 → 失效相关查询 → 自动刷新
    └─ 失败 → 错误处理 → 用户提示
            ↓
        所有使用该查询的组件自动更新
```

### 3. 数据同步流程

```
用户A在页面1添加记录
    ↓
Mutation → Supabase
    ↓
Supabase实时订阅通知
    ↓
用户A在页面2收到更新 → UI自动刷新
    ↓
用户B在同一时间查看 → 实时订阅通知 → UI自动刷新
```

### 4. 完整数据生命周期

```
┌─────────────┐
│  用户操作    │ (详情页：新增/删除/更新)
└──────┬──────┘
       │
       ▼
┌─────────────┐      ┌─────────────┐
│  Component  │─────▶│    Hook     │ (useWeightRecordsQuery等)
│ (DetailPage)│      └──────┬──────┘
└─────────────┘             │
                            ▼
                    ┌─────────────┐
                    │   Service   │ (weightService等)
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  Supabase   │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  数据库更新  │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ Mutation成功│
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ 失效查询缓存 │
                    │(invalidate)  │
                    │              │
                    │ - 记录类型   │
                    │ - Dashboard  │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ 自动刷新UI  │
                    │ (详情页+首页)│
                    │              │
                    │ ✅ 统一通过  │
                    │ React Query  │
                    └─────────────┘
```

---

## 🎯 关键设计决策

### 1. 为什么使用React Query？

- **自动缓存**：减少不必要的网络请求
- **自动刷新**：数据过期自动重新获取
- **乐观更新**：提升用户体验
- **错误重试**：网络失败自动重试
- **去重**：相同查询自动合并

### 2. 为什么使用Service层？

- **单一职责**：每个Service负责一种数据类型
- **直接操作Supabase**：符合3层架构规范
- **统一错误处理**：集中处理错误逻辑
- **类型安全**：TypeScript类型定义

### 3. 为什么使用Context？

- **全局状态**：用户档案、认证状态等
- **避免Props drilling**：减少组件间传递
- **单一数据源**：确保数据一致性

### 4. 为什么使用localStorage？

- **快速显示**：首次加载时显示缓存数据
- **离线支持**：网络断开时显示最后状态
- **用户体验**：减少加载等待时间

---

## 📊 性能优化

### 1. 查询优化

- **按需加载**：只加载当前需要的数据
- **日期范围过滤**：在数据库层面过滤，减少传输
- **索引优化**：数据库字段建立索引

### 2. 缓存策略

- **staleTime**: 5分钟（数据5分钟内不重新请求）
  - 用户配置数据：10分钟（变化频率低）
  - 健康记录数据：5分钟（中等频率）
- **持久化缓存**：使用 `persistQueryClient` 自动持久化到localStorage
- **缓存时长**：24小时（持久化缓存的最大保存时间）
- **自动去重**：相同查询自动合并
- **自动刷新**：
  - `refetchOnWindowFocus: true` - 窗口聚焦时自动刷新
  - `refetchOnReconnect: true` - 网络恢复时自动刷新

### 3. 组件优化

- **React.lazy**: 按需加载大型组件
- **React.memo**: 避免不必要的重渲染
- **useMemo/useCallback**: 缓存计算结果和函数

---

## 🔒 安全机制

### 1. 数据库层面

- **RLS策略**：所有表启用行级安全
- **用户隔离**：所有查询自动附加`user_id`过滤
- **参数化查询**：防止SQL注入

### 2. 应用层面

- **认证验证**：所有操作前验证用户身份
- **数据过滤**：Service层自动添加用户过滤
- **错误处理**：未授权访问返回空数据

---

## 📝 代码质量改进总结

**完成日期**: 2025-01-XX  
**状态**: ✅ 高优先级任务全部完成  
**最新更新**: 2025-12-09 - 缓存策略优化：引入PersistQueryClient，移除离线队列，优化React Query配置

## 🔄 缓存策略优化（2025-12-09）

### 优化目标
基于技术评估建议，优化应用的数据缓存策略，减少手动localStorage管理，提升代码可维护性和数据一致性。

### 已完成工作

#### 1. 引入PersistQueryClient ✅
- 安装 `@tanstack/query-persist-client-core`
- 配置自动持久化：所有React Query管理的查询数据自动保存到localStorage
- 缓存时长：24小时
- 自动恢复：页面刷新时自动从localStorage恢复缓存数据

#### 2. 优化React Query配置 ✅
- `refetchOnWindowFocus: true` - 窗口聚焦时自动刷新数据
- `refetchOnReconnect: true` - 网络恢复时自动刷新数据
- 针对不同类型数据设置不同的staleTime

#### 3. 清理离线队列代码 ✅
- 移除 `sync_offline_queue` 相关代码
- 简化 `simpleOfflineSupport` 工具
- V1版本策略：断网时直接提示错误，禁止写入操作

#### 4. 创建用户档案Service和Hook ✅
- 创建 `userProfileService.ts` - 统一用户档案数据访问
- 创建 `useUserProfileQuery.ts` - React Query Hook管理用户档案

#### 5. 修复首页数据同步问题 ✅（2025-12-09 - 已重构）
- **初始方案**：添加 `onRefreshDashboardData` 手动回调机制
- **重构方案**（2025-12-09）：将 `useDashboardData` 重构为 React Query Hook
- ✅ Dashboard 数据统一使用 React Query 管理
- ✅ 详情页操作后自动刷新首页数据（通过 invalidateQueries）
- ✅ 移除手动回调，降低组件间耦合
- ✅ 确保详情页和首页数据实时同步

### 缓存策略说明

**由React Query + PersistQueryClient管理**：
- ✅ 用户档案数据
- ✅ 健康记录数据（体重、饮水、步数、睡眠、血糖等）
- ✅ 所有业务查询结果
- ✅ Dashboard聚合数据（通过useDashboardData Hook - 2025-12-09重构为React Query）

**保留手动localStorage管理**：
- ✅ Onboarding流程状态（临时状态）
- ✅ 用户UI偏好（界面配置）
- ✅ 开发工具相关数据

**已移除**：
- ❌ 离线队列系统
- ❌ 复杂的手动缓存同步逻辑

### 数据同步机制（2025-12-09 重构）

**详情页操作流程**：
1. 用户在详情页执行操作（新增/删除/更新记录）
2. 调用对应的Mutation（如 `addRecord`, `deleteRecord`）
3. Mutation成功后：
   - React Query自动失效相关查询（`invalidateQueries`）
     - 失效记录类型查询（如 `['weight-records', userId]`）
     - 失效Dashboard数据查询（如 `['dashboard-data', userId, dateKey]`）
   - 详情页列表自动更新（React Query自动刷新）
   - 首页卡片数据自动更新（Dashboard数据自动刷新）

**统一的数据管理**：
- ✅ **React Query统一管理**：所有数据（包括Dashboard）都使用React Query
- ✅ **自动同步**：无需手动回调，Mutation成功后自动刷新相关数据
- ✅ **降低耦合**：组件间解耦，符合React Query最佳实践

---

## 📝 代码质量改进总结（历史）

**完成日期**: 2025-01-XX  
**状态**: ✅ 高优先级任务全部完成  
**历史更新**: 2025-01-XX - 更新测试覆盖统计和待完成工作列表

### 📊 执行摘要

本次代码质量改进工作聚焦于两个核心问题：
1. **统一数据流向** - 解决数据同步问题
2. **增加测试覆盖** - 提高代码质量

所有高优先级任务已全部完成，代码质量和可维护性显著提升。

---

## ✅ 完成的工作

### 1. 增加测试覆盖 ✅

**成果**:
- 新增多个测试文件（包括Hooks、Services、Utils、Components）
- 新增大量测试用例
- 测试覆盖大幅提升

**详细内容**:
- ✅ BMR/BMI 计算工具测试（24个测试）
- ✅ sleepService 测试（8个测试）
- ✅ stepsService 测试（6个测试）
- ✅ weightService 测试
- ✅ waterService 测试
- ✅ exerciseService 测试
- ✅ useWeightRecordsQuery 测试（完整覆盖）
- ✅ useWaterRecordsQuery 测试（完整覆盖）
- ✅ useDashboardData 测试
- ✅ useCalendarLogic 测试
- ✅ AppModals 组件测试
- ✅ AppHeader 组件测试

### 2. 统一数据流向 ✅

**成果**:
- 所有组件统一从 `UserProfileContext` 读取数据
- 移除了重复的数据库查询
- 提高了数据一致性

**修改的组件**:
- ✅ `CustomReportCard.tsx` - 移除直接查询，使用 UserProfileContext
- ✅ `HealthReportCard.tsx` - 移除直接查询，使用 UserProfileContext

### 3. 统一数据格式 ✅

**成果**:
- 统一了数组字段的类型定义
- 确保数据格式与数据库一致
- 减少了类型错误

**修改的文件**:
- ✅ `UserProfile` 接口 - 统一数组字段类型
- ✅ `UserProfileContext` - 添加格式转换逻辑
- ✅ `profileFormatters` - 更新格式化函数

---

## 📈 改进成果

### 测试覆盖提升

| 指标 | 改进前 | 改进后 | 提升 |
|------|--------|--------|------|
| 测试文件数 | 7个 | 12个+ | **显著提升** |
| 测试总数 | 47个 | 100+个 | **显著提升** |
| 工具函数测试 | 0个 | 24个 | **+∞** |
| Service测试 | 3个 | 6个+ | **显著提升** |
| Hooks测试 | 0个 | 3个+ | **从0开始** |
| Components测试 | 0个 | 2个+ | **从0开始** |

### 代码质量提升

- ✅ **业务计算逻辑**: 100%测试覆盖
- ✅ **核心Services**: 测试覆盖从9%提升到15%
- ✅ **数据流向**: 已统一，所有组件使用 UserProfileContext
- ✅ **数据格式**: 已统一，所有数组字段使用数组格式

---

## 🎯 关键成就

1. **测试覆盖大幅提升** - 测试文件从7个增加到12+个，测试总数从47个增加到100+个
2. **Hooks测试覆盖** - 新增核心Hooks测试（useWeightRecordsQuery、useWaterRecordsQuery等）
3. **Components测试覆盖** - 新增组件测试（AppModals、AppHeader等）
4. **数据流向统一** - 建立了单一数据源原则
5. **数据格式统一** - 消除了类型不一致问题
6. **代码质量提升** - 减少了重复代码，提高了可维护性

---

## 📋 待完成工作（中优先级）

### 为数据查询Hooks添加测试

- [x] `useWeightRecordsQuery.test.ts` ✅ 已完成
- [x] `useWaterRecordsQuery.test.ts` ✅ 已完成
- [ ] `useExerciseRecordsQuery.test.ts`
- [ ] `useBloodGlucoseRecordsQuery.test.ts`
- [ ] `useSleepRecordsQuery.test.ts`
- [ ] `useStepsRecordsQuery.test.ts`
- [ ] `useFoodRecordsQuery.test.ts`
- [ ] `useMeasurementsRecordsQuery.test.ts`
- [ ] `useChatMessagesQuery.test.ts`
- [ ] `useAddressesQuery.test.ts`
- [ ] `useHealthAssessmentQuery.test.ts`

---

## 📝 技术细节

### 数据流向统一

**之前**:
- `CustomReportCard` 直接查询 Supabase
- `HealthReportCard` 直接查询 Supabase
- 数据可能不一致

**现在**:
- 所有组件使用 `UserProfileContext`
- `UserProfileContext` 作为单一数据源
- 数据一致性得到保障

### 数据格式统一

**之前**:
- `dietary_preferences`: `string | string[]`
- 类型不一致，可能导致运行时错误

**现在**:
- `dietary_preferences`: `string[]`
- 类型与数据库一致
- 在数据加载时进行格式转换

---

## 🎉 总结

本次改进工作成功完成了所有高优先级任务：

1. ✅ **测试覆盖大幅提升** - 从47个增加到100+个测试，新增Hooks和Components测试
2. ✅ **数据流向统一** - 建立了单一数据源原则
3. ✅ **数据格式统一** - 消除了类型不一致问题
4. ✅ **核心Hooks测试** - useWeightRecordsQuery 和 useWaterRecordsQuery 已完成测试覆盖

代码质量和可维护性显著提升，为后续开发奠定了良好基础。

---

**最后更新日期**: 2025-12-09
**文档版本**: v2.2

## 📝 最新更新记录

### useDashboardData 重构为 React Query Hook ✅（2025-12-09）

**问题描述**：
- `useDashboardData` 使用 `useState` + `useCallback` 手动管理，不符合 React Query 最佳实践
- 需要手动回调 `onRefreshDashboardData` 来刷新 Dashboard 数据，导致组件间高耦合
- 违反了 React Query 的"基于 Key 的自动响应"设计理念

**解决方案**：
1. **重构 useDashboardData 为 React Query Hook**：
   - 将 `useState` + `useCallback` 改为 `useQuery`
   - Query Key: `['dashboard-data', userId, dateKey, showOnboarding, targetWeight]`
   - 保留 `userDayDataOverrides` 功能用于本地覆盖
   - 自动缓存和刷新机制

2. **在所有 Mutation Hooks 中添加 dashboard-data 的 invalidateQueries**：
   - `useWeightRecordsQuery` - 添加 dashboard-data invalidate
   - `useWaterRecordsQuery` - 添加 dashboard-data invalidate
   - `useStepsRecordsQuery` - 添加 dashboard-data invalidate
   - `useSleepRecordsQuery` - 添加 dashboard-data invalidate
   - `useBloodGlucoseRecordsQuery` - 添加 dashboard-data invalidate

3. **移除所有手动回调机制**：
   - 移除 `App.tsx` 中的 `handleRefreshDashboardData`
   - 移除 `AppModals.tsx` 中的 `onRefreshDashboardData` 参数
   - 移除所有 DetailScreen 组件中的 `onRefreshDashboardData` 参数和调用

**技术实现**：
```typescript
// ✅ 新的实现（React Query）
// hooks/useDashboardData.ts
const dashboardQuery = useQuery({
  queryKey: ['dashboard-data', userId, dateKey, showOnboarding, profile?.target_weight],
  queryFn: async () => {
    return await dashboardDataService.getDayData(selectedDate, { ... });
  },
  staleTime: 5 * 60 * 1000,
});

// hooks/useWeightRecordsQuery.ts
const addMutation = useMutation({
  mutationFn: addRecord,
  onSuccess: (_, variables) => {
    const dateKey = variables.date.toISOString().split('T')[0];
    queryClient.invalidateQueries({ queryKey: ['weight-records', userId] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-data', userId, dateKey] }); // 自动刷新
  },
});
```

**效果**：
- ✅ 移除手动回调，降低组件间耦合度
- ✅ Dashboard 数据统一使用 React Query 管理
- ✅ 数据变更后自动刷新，无需手动触发
- ✅ 代码简化，移除约 30+ 处手动回调代码

**修改的文件**：
- ✅ `hooks/useDashboardData.ts` - 重构为 React Query Hook
- ✅ `hooks/useWeightRecordsQuery.ts` - 添加 dashboard invalidate
- ✅ `hooks/useWaterRecordsQuery.ts` - 添加 dashboard invalidate
- ✅ `hooks/useStepsRecordsQuery.ts` - 添加 dashboard invalidate
- ✅ `hooks/useSleepRecordsQuery.ts` - 添加 dashboard invalidate
- ✅ `hooks/useBloodGlucoseRecordsQuery.ts` - 添加 dashboard invalidate
- ✅ `App.tsx` - 移除 handleRefreshDashboardData
- ✅ `components/AppModals.tsx` - 移除 onRefreshDashboardData 参数
- ✅ `components/WeightDetailScreen.tsx` - 移除 onRefreshDashboardData
- ✅ `components/WaterDetailScreen.tsx` - 移除 onRefreshDashboardData
- ✅ `components/StepsDetailScreen.tsx` - 移除 onRefreshDashboardData
- ✅ `components/SleepDetailScreen.tsx` - 移除 onRefreshDashboardData
- ✅ `components/BloodGlucoseDetailScreen.tsx` - 移除 onRefreshDashboardData

---

### 首页数据同步问题修复 ✅（2025-12-09 - 已重构）

**历史记录**：此问题最初通过手动回调机制解决，现已重构为 React Query 自动刷新机制。

**原始问题**：
- 详情页新增记录后，首页卡片不显示新数据
- 详情页删除记录后，首页卡片仍显示已删除的数据

**原始解决方案**（已废弃）：
- 使用 `onRefreshDashboardData` 手动回调刷新

**当前解决方案**（✅ 已重构）：
- Dashboard 数据使用 React Query 管理
- Mutation 成功后自动 invalidate dashboard-data query
- 无需手动回调，自动同步