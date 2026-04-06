/**
 * 将 project/.env 中的 VITE_SUPABASE_URL、VITE_SUPABASE_ANON_KEY 写入 server/.env（覆盖同名键，其它行不动）。
 * 用于修复「前端能 setSession、getUser 403」等前后端 Supabase 不一致问题。
 */
const fs = require('fs');
const path = require('path');

function parseEnv(raw) {
  const vars = {};
  const lines = raw.split(/\n/);
  for (const line of lines) {
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
  return vars;
}

const root = path.join(__dirname, '..');
const frontPath = path.join(root, '.env');
const serverPath = path.join(root, 'server', '.env');

if (!fs.existsSync(frontPath)) {
  console.error('缺少 project/.env');
  process.exit(1);
}
if (!fs.existsSync(serverPath)) {
  console.error('缺少 server/.env，请先复制 server/.env.example');
  process.exit(1);
}

const frontVars = parseEnv(fs.readFileSync(frontPath, 'utf8'));
const url = frontVars.VITE_SUPABASE_URL;
const anon = frontVars.VITE_SUPABASE_ANON_KEY;
if (!url || !anon) {
  console.error('project/.env 中缺少 VITE_SUPABASE_URL 或 VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

let serverRaw = fs.readFileSync(serverPath, 'utf8');
const keysToSync = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];

function upsertLine(content, key, value) {
  const escaped = String(value).replace(/\\/g, '\\\\').replace(/\n/g, '');
  const newLine = `${key}=${escaped}`;
  const lines = content.split(/\n/);
  let found = false;
  const out = lines.map((line) => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return line;
    const eq = t.indexOf('=');
    if (eq === -1) return line;
    const k = t.slice(0, eq).trim();
    if (k === key) {
      found = true;
      return newLine;
    }
    return line;
  });
  if (!found) {
    out.push(newLine);
  }
  return out.join('\n');
}

let next = serverRaw;
for (const k of keysToSync) {
  next = upsertLine(next, k, k === 'VITE_SUPABASE_URL' ? url : anon);
}

fs.writeFileSync(serverPath, next, 'utf8');
console.log('✅ 已从 project/.env 同步 VITE_SUPABASE_URL、VITE_SUPABASE_ANON_KEY → server/.env');
console.log('   请重启后端：npm run server 或 npm run server:dev\n');
