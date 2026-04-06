# Vercel 部署 · 用户端前端环境变量清单 v1.0

适用于：**根目录为 `project/` 的 Vite 用户端**（已链到 `kidault520-4018s-projects/project` 或同类项目）。

在 Vercel：**Project → Settings → Environment Variables**，按环境勾选 **Production / Preview / Development**。

---

## P0（不配则无法正常用 App）

| 变量名 | 说明 | 示例 / 注意 |
|--------|------|----------------|
| **`VITE_SUPABASE_URL`** | Supabase 项目 URL | `https://xxxx.supabase.co` |
| **`VITE_SUPABASE_ANON_KEY`** | Supabase `anon` `public` key | 从 Supabase Dashboard → API 复制 |

改完后需 **重新部署**（环境变量在构建期注入 Vite）。

---

## P0′（API 不在同一域名时必配）

当前 Vercel 上若 **只部署了静态前端**，没有在同域提供 `/api`，则必须让浏览器直连你的 **Express 服务**：

| 变量名 | 说明 |
|--------|------|
| **`VITE_API_URL`** | 后端 API 根路径，**必须包含 `/api` 后缀**（与本地 `vite` 代理一致）。 |

**正确示例：**

- `https://你的-node-服务域名/api`

**错误示例：**

- `https://你的-node-服务域名`（缺 `/api` 时，请求会变成 `https://.../auth/...`，与后端 `app.use('/api/auth', ...)` 不一致）

代码里多处为：`import.meta.env.VITE_API_URL || '/api'`（见 `src/services/api.ts`、`paymentService.ts`、`orderService.ts`）。

---

## P1（建议）

| 变量名 | 说明 | 默认 / 建议 |
|--------|------|-------------|
| **`VITE_SUPABASE_CLIENT_TIMEOUT_MS`** | 浏览器访问 Supabase 超时（毫秒） | `60000`（弱网可保留） |

---

## P2（按需）

| 变量名 | 用途 |
|--------|------|
| **`VITE_AMAP_KEY`** | 收货地址「地图选点」高德 Web Key |
| **`VITE_AMAP_SECURITY_JS_CODE`** | 高德 JS API 安全密钥（与 Key 配套） |
| **`VITE_DEVICE_SYNC_PROVIDER`** | 设备同步提供方标识（`MyDevicesScreen`） |
| **`VITE_ENABLE_CLIENT_LOGS`** | 设为 `1` 时非 DEV 也可打客户端日志（排障用） |
| **`VITE_LOG_LEVEL`** | 客户端日志级别（见 `utils/logger.ts`） |
| **`VITE_ONBOARDING_DIAG`** | 引导诊断开关（见 `App.tsx`） |

---

## 不要配在用户端 Vercel 的变量

以下属于 **Node 服务端** 或 **机密**，勿进 Vite 前端环境（会打进浏览器包）：

- `SUPABASE_SERVICE_ROLE_KEY`、`JWT_SECRET`、各 `*_WEBHOOK_*`、`DEEPSEEK_API_KEY` 等  

---

## 管理后台（`admin/`）另项目

管理端使用 **`VITE_API_BASE_URL`**（见 `admin/src/config/api.ts`）：

- 未设置且生产构建：默认 **`/api`**（需同域反代）。  
- API 独立域名：设为 **`https://你的-api域名/api`**（同样要带 `/api`，与 `apiClient` 拼接路径一致）。

---

## 版本记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0 | 2026-04-01 | 初版，与当前 `src` 引用一致 |
| v1.1 | 2026-04-01 | 移除固定验证码相关说明 |
