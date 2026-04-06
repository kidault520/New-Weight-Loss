/**
 * 对比前端 / 后端 / 管理端 .env 中的 Supabase 变量是否一致（不打印密钥内容）。
 * 用法：在项目根目录 npm run check:supabase-env
 */
const fs = require('fs');
const path = require('path');

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return { missing: true, vars: {} };
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  const vars = {};
  for (const line of raw.split(/\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    vars[k] = v;
  }
  return { missing: false, vars };
}

const root = path.join(__dirname, '..');
const paths = {
  前端_project根目录: path.join(root, '.env'),
  后端_server目录: path.join(root, 'server', '.env'),
  管理端_admin目录: path.join(root, 'admin', '.env'),
};

const loaded = {};
for (const [label, p] of Object.entries(paths)) {
  loaded[label] = parseEnvFile(p);
}

console.log('\n=== Supabase 环境变量对齐检查 ===\n');

for (const [label, { missing, vars }] of Object.entries(loaded)) {
  if (missing) {
    console.log(`${label}: 无此文件（按需创建）\n`);
    continue;
  }
  const url = vars.VITE_SUPABASE_URL || '';
  const anon = vars.VITE_SUPABASE_ANON_KEY || '';
  const svc = vars.SUPABASE_SERVICE_ROLE_KEY || '';
  console.log(`${label} (${path.relative(root, paths[label])}):`);
  console.log(
    `  VITE_SUPABASE_URL: ${url ? `${url.slice(0, 48)}${url.length > 48 ? '…' : ''}` : '（未设置）'}`
  );
  console.log(
    `  VITE_SUPABASE_ANON_KEY: ${anon ? `已设置，长度 ${anon.length}` : '（未设置）'}`
  );
  if (label === '后端_server目录') {
    console.log(
      `  SUPABASE_SERVICE_ROLE_KEY: ${svc ? `已设置，长度 ${svc.length}` : '（未设置 — 验码登录/Admin 写库会失败）'}`
    );
  }
  console.log('');
}

const front = loaded['前端_project根目录'];
if (front.missing) {
  console.log('❌ 缺少 project/.env：请复制 .env.example 为 .env 并填入 Dashboard 中的值。\n');
  process.exit(1);
}

const refUrl = front.vars.VITE_SUPABASE_URL || '';
const refAnon = front.vars.VITE_SUPABASE_ANON_KEY || '';
let ok = true;

if (!refUrl || !refAnon || refUrl.includes('your_supabase')) {
  console.log('⚠️ 前端 .env 中 VITE_SUPABASE_URL / ANON_KEY 仍为占位或未填。\n');
  ok = false;
}

for (const [label, data] of Object.entries(loaded)) {
  if (data.missing || label === '前端_project根目录') continue;
  const sameUrl = (data.vars.VITE_SUPABASE_URL || '') === refUrl;
  const sameAnon = (data.vars.VITE_SUPABASE_ANON_KEY || '') === refAnon;
  if (!sameUrl || !sameAnon) {
    console.log(`❌ 「${label}」与「前端_project根目录」不一致：`);
    if (!sameUrl) console.log('   · VITE_SUPABASE_URL 不同 → 请复制成与前端完全相同的一行');
    if (!sameAnon) console.log('   · VITE_SUPABASE_ANON_KEY 不同 → 请复制成与前端完全相同的一行');
    console.log('');
    ok = false;
  }
}

const serverData = loaded['后端_server目录'];
if (!serverData.missing && !serverData.vars.SUPABASE_SERVICE_ROLE_KEY) {
  console.log('⚠️ server/.env 缺少 SUPABASE_SERVICE_ROLE_KEY（仅存在于服务端，勿提交前端）。\n');
  ok = false;
}

if (ok && refUrl && refAnon) {
  console.log('✅ 已检测的文件之间：URL 与 ANON_KEY 一致（或仅有文件缺失）。\n');
  console.log('下一步：改完 .env 后务必重启「npm run dev」「npm run server」和 admin 的 dev。\n');
}

process.exit(ok ? 0 : 1);
