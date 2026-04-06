# 快速测试指南

## 一键测试所有功能

### 1. RLS审计（5分钟）

```bash
# 在Supabase Dashboard的SQL编辑器中执行
# 文件: project/supabase/migrations/20241220000000_audit_rls_policies.sql
```

**检查点**:
- ✅ 所有表RLS已启用
- ✅ 关键表有至少3个策略

---

### 2. 实时订阅测试（10分钟）

1. 打开 `project/scripts/test-realtime-subscription.html`
2. 配置Supabase连接
3. 登录测试账号
4. 启动订阅
5. 执行INSERT/UPDATE/DELETE测试
6. 确认收到实时事件

**检查点**:
- ✅ 订阅状态: SUBSCRIBED
- ✅ 收到所有事件类型

---

### 3. 缓存监控（5分钟）

1. 打开 `project/scripts/monitor-cache-performance.html`
2. 点击"刷新统计"
3. 检查缓存大小和条目数
4. 点击"清理过期缓存"
5. 确认缓存减少

**检查点**:
- ✅ 缓存大小 < 5MB
- ✅ 清理功能正常

---

### 4. 批量同步测试（5分钟）

在浏览器控制台执行：

```javascript
// 测试关键操作（应该立即同步）
console.time('weight-sync');
await healthAPI.addWeight(70);
console.timeEnd('weight-sync');
// 应该 < 1000ms

// 测试非关键操作（应该批量同步）
await healthAPI.addSteps(5000);
await healthAPI.addWater(200);
// 应该在200ms后批量同步
```

**检查点**:
- ✅ 关键操作立即同步
- ✅ 非关键操作批量同步

---

## 总耗时: 约25分钟

## 预期结果

所有测试应该通过，系统运行正常。









