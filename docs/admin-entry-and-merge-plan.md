# B 端总后台独立入口与合并方案

## 当前状态

- **B 端**（童颜社长寿抗衰-ai-平台）：SPA，同一应用内包含：
  - 销售员端：首页、学堂、创作、客户、我的
  - 总后台：规则管理、组织配置、产品配置、总部仪表板（仅 admin 可见）

- **权限**：`UserAuth.isAdmin()` 通过 localStorage 区分 admin/user，控制菜单显示

## 合并目标

- **总后台**：独立入口，合并 C 端管理 + B 端管理
- **B 端销售员端**：独立入口，仅销售员功能
- **C 端管理**：商品、订单、用户等
- **B 端管理**：规则版本管理、组织配置、产品配置、总部仪表板

## 入口设计

| 入口 | URL | 角色 | 内容 |
|------|-----|------|------|
| C 端 App | `/` 或独立域名 | c_user | 用户减重服务 |
| B 端销售员端 | `/b` 或 `/sales` 或独立域名 | salesperson | 首页、学堂、创作、客户、我的 |
| 总后台 | `/admin` 或独立域名 | admin | C 端管理 + B 端管理 |

## 实现方式

### 方案 A：独立部署 + 路由

```
总后台部署
├── /admin                    # 总后台入口
│   ├── /admin/c-orders       # C 端：订单管理
│   ├── /admin/c-users        # C 端：用户管理
│   ├── /admin/c-products     # C 端：商品管理
│   ├── /admin/b-rules        # B 端：规则版本管理
│   ├── /admin/b-org          # B 端：组织配置
│   ├── /admin/b-products     # B 端：产品配置
│   └── /admin/b-headquarters # B 端：总部仪表板
```

- 登录后根据 `user_type` 跳转：admin → `/admin`，salesperson → `/b`
- 总后台内菜单：C 端管理 | B 端管理，各自独立分组

### 方案 B：Monorepo 多应用

```
project/
├── apps/
│   ├── c-app/          # C 端健康 App
│   ├── b-sales/        # B 端销售员端（不含 admin 路由）
│   └── admin/          # 总后台（合并 C + B 管理）
├── packages/
│   ├── shared-types/
│   ├── shared-auth/
│   └── supabase-client/
└── supabase/
```

- `b-sales`：从 B 端项目移除 RuleVersionManager、OrganizationConfig、ProductConfig、HeadquartersDashboard 等 admin 组件
- `admin`：新建项目，引入上述组件 + C 端管理组件

## 权限与认证

1. **统一认证**：Supabase Auth
2. **角色扩展**：`user_profiles` 或单独 `app_users` 表增加 `user_type`：`c_user` | `salesperson` | `admin`
3. **销售员关联**：`sales_persons.auth_user_id` → `auth.users.id`
4. **登录后路由**：
   - admin → `/admin` 或 admin 子域名
   - salesperson → `/b` 或 B 端子域名
   - c_user → C 端 App

## 迁移步骤

1. 在 Supabase 增加 `user_type` 字段
2. 将 B 端 admin 相关组件（RuleVersionManager、OrganizationConfig、ProductConfig、HeadquartersDashboard）抽到独立模块或 admin 应用
3. 新建总后台应用，集成 C 端管理 + B 端管理
4. B 端销售员端移除 admin 相关路由和菜单
5. 统一登录入口：根据 `user_type` 跳转不同应用

## 独立入口

- **总后台**：`https://admin.example.com` 或 `https://example.com/admin`
- **B 端销售员端**：`https://sales.example.com` 或 `https://example.com/b`

两者独立入口，互不依赖，共用同一 Supabase 后端。
