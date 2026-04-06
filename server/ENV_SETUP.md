# 后端服务器环境变量配置

## 必需的环境变量

在 `server/.env` 文件中需要以下配置：

```env
# Supabase配置
VITE_SUPABASE_URL=https://cnnfwimcewbvrvnqoehx.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_DXuN9IpOYaLqUAvRw4fjNw_wv3UtKMy
SUPABASE_SERVICE_ROLE_KEY=sb_secret_P5w2sQP6rt_15iuOKlgbNg_aj_RrIqy

# 服务器配置
PORT=3001
NODE_ENV=development

# OpenAI API (可选，用于AI功能)
OPENAI_API_KEY=your_openai_api_key
```

## 如何获取Supabase密钥

1. 打开 Supabase Dashboard: https://app.supabase.com
2. 选择您的项目
3. 进入 **Settings** > **API**
4. 复制以下值：
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ **重要：这个密钥有完全访问权限，请保密！**

## 检查配置

运行以下命令检查环境变量：

```powershell
cd server
Get-Content .env | Select-String "SUPABASE"
```

应该看到所有三个Supabase相关的环境变量。

## 配置完成后

重启后端服务器：

```bash
cd server
npm run server:dev
```











