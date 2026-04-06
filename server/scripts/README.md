# 管理员账户创建脚本

## 快速开始

### 方法1：使用脚本（推荐）

1. 确保后端服务器环境变量已配置（`server/.env`文件中有Supabase配置）

2. 运行脚本：
```bash
cd server
node scripts/create-admin.js <邮箱> <密码>
```

例如：
```bash
node scripts/create-admin.js admin@example.com mypassword123
```

### 方法2：通过Supabase Dashboard

1. 在Supabase Dashboard中创建用户：
   - 进入 Authentication > Users
   - 点击 "Add user"
   - 输入邮箱和密码
   - 创建用户

2. 在SQL Editor中运行以下SQL（替换YOUR_USER_ID为实际用户ID）：
```sql
INSERT INTO admin_users (user_id, role, permissions, is_active)
VALUES (
  'YOUR_USER_ID_HERE',  -- 替换为实际的用户ID
  'super_admin',
  '{}'::jsonb,
  true
);
```

### 方法3：通过管理后台API（需要已有管理员）

如果已经有管理员账户，可以：
1. 登录管理后台
2. 进入"权限管理"页面
3. 创建新的管理员账户

## 注意事项

- 密码长度至少6个字符
- 首次创建的管理员建议使用 `super_admin` 角色
- 请妥善保管管理员凭据
- 所有管理员操作都会记录在审计日志中











