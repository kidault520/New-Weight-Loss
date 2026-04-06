# 管理后台使用说明

## 概述

这是健康追踪应用的管理后台系统，允许管理员通过Web界面管理平台内容、用户和用户数据，无需修改代码。

## 功能特性

- **用户管理**：查看、编辑、删除用户，重置密码，查看用户数据
- **内容管理**：管理补剂产品、营养方案页内容、内容模板
- **数据统计**：查看平台概览、用户统计、健康数据统计
- **系统配置**：管理系统配置参数
- **权限管理**：管理管理员账户和角色权限

## 安装和运行

### 1. 安装依赖

```bash
cd admin
npm install
```

### 2. 配置环境变量

创建 `.env` 文件：

```env
VITE_API_BASE_URL=http://localhost:3001
```

### 3. 运行开发服务器

```bash
npm run dev
```

管理后台将在 `http://localhost:5174` 运行。

## 创建第一个管理员账户

### 方法1：通过Supabase Dashboard

1. 在Supabase Dashboard中创建一个新用户（Auth > Users > Add user）
2. 在SQL编辑器中运行以下SQL，将用户添加为管理员：

```sql
INSERT INTO admin_users (user_id, role, permissions, is_active)
VALUES (
  'YOUR_USER_ID_HERE',  -- 替换为实际的用户ID
  'super_admin',
  '{}'::jsonb,
  true
);
```

### 方法2：通过API（需要先有一个超级管理员）

使用已有的超级管理员账户登录后，在权限管理页面创建新的管理员。

## 访问管理后台

1. 打开浏览器访问 `http://localhost:5174/admin/login`
2. 使用管理员邮箱和密码登录
3. 登录成功后会自动跳转到仪表盘

## 主要页面

- **仪表盘** (`/admin/dashboard`)：查看平台概览数据
- **用户管理** (`/admin/users`)：管理用户账户和数据
- **内容管理** (`/admin/content`)：管理补剂、营养方案等内容
- **数据统计** (`/admin/statistics`)：查看各类统计数据
- **系统配置** (`/admin/config`)：管理系统配置
- **权限管理** (`/admin/permissions`)：管理管理员和角色

## 权限说明

系统支持基于角色的权限控制：

- **super_admin**：超级管理员，拥有所有权限
- **admin**：标准管理员，可以管理用户和内容
- **content_manager**：内容管理员，只能管理内容
- **support**：客服人员，可以管理用户和查看统计

## 注意事项

1. 所有管理操作都会记录在审计日志中
2. 删除用户操作不可撤销，请谨慎操作
3. 修改内容后，前端应用会自动从数据库读取最新内容
4. 确保后端服务器（端口3001）正在运行

## 开发说明

管理后台使用以下技术栈：

- React 18 + TypeScript
- Vite
- Tailwind CSS
- React Router
- Axios (通过自定义apiClient)

## 部署

构建生产版本：

```bash
npm run build
```

构建产物在 `dist/` 目录，可以部署到任何静态文件服务器。











