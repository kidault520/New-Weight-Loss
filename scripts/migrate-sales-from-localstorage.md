# B 端 localStorage 数据迁移到 Supabase

## 数据来源

迁移脚本从 B 端项目（童颜社长寿抗衰-ai-平台）的 localStorage 读取以下 key：

| localStorage Key | 对应表 |
|------------------|--------|
| organization-persons | sales_persons |
| organization-teams | sales_teams |
| organization-regions | sales_regions |
| organization-promotion-history | sales_promotion_history |
| organization-leave-history | sales_leave_history |
| organization-demotion-history | sales_demotion_history |
| commission-rule-sets | sales_rule_sets |
| current-rule-set-id | sales_current_rule_set |
| evaluation_notifications | sales_evaluation_notifications |
| evaluation_approval_history | sales_approval_history |

## 迁移步骤

1. **确保 Supabase 迁移已执行**
   ```bash
   supabase db push
   # 或
   supabase migration up
   ```

2. **在 B 端项目根目录打开浏览器控制台**，执行导出脚本：
   ```javascript
   const data = {
     persons: JSON.parse(localStorage.getItem('organization-persons') || '[]'),
     teams: JSON.parse(localStorage.getItem('organization-teams') || '[]'),
     regions: JSON.parse(localStorage.getItem('organization-regions') || '[]'),
     promotionHistory: JSON.parse(localStorage.getItem('organization-promotion-history') || '[]'),
     leaveHistory: JSON.parse(localStorage.getItem('organization-leave-history') || '[]'),
     demotionHistory: JSON.parse(localStorage.getItem('organization-demotion-history') || '[]'),
     ruleSets: JSON.parse(localStorage.getItem('commission-rule-sets') || '[]'),
     currentRuleSetId: localStorage.getItem('current-rule-set-id'),
     notifications: JSON.parse(localStorage.getItem('evaluation_notifications') || '[]'),
     approvalHistory: JSON.parse(localStorage.getItem('evaluation_approval_history') || '[]'),
   };
   copy(JSON.stringify(data));
   // 将复制的内容保存为 B 端项目根目录的 migration-data.json
   ```

3. **在 B 端项目根目录运行迁移**：
   ```bash
   npm run migrate:localstorage
   ```

4. **ID 映射**：脚本自动处理。B 端使用 string ID（如 `person-1`），Supabase 使用 uuid，脚本会建立映射并更新外键引用。

## 注意事项

- 需先执行 migration 创建表
- RLS 要求 authenticated：若使用 anon key 报权限错误，可在 Supabase 控制台临时放宽 RLS，或使用 service_role key（需保密）
- 建议在测试环境先跑一遍
