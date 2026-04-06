#!/usr/bin/env node
 
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const rootDir = path.resolve(__dirname, '..');
const serverDir = path.join(rootDir, 'server');

dotenv.config({ path: path.join(rootDir, '.env') });
dotenv.config({ path: path.join(serverDir, '.env') });

const { getRuntimePolicy } = require(path.join(serverDir, 'config', 'runtimeMode'));

const args = new Set(process.argv.slice(2));
const envFileArg = [...args].find((a) => a.startsWith('--env-file='));
const customEnvPath = envFileArg ? envFileArg.slice('--env-file='.length).trim() : '';
if (customEnvPath) {
  const resolvedEnvPath = path.isAbsolute(customEnvPath)
    ? customEnvPath
    : path.join(rootDir, customEnvPath);
  if (!fs.existsSync(resolvedEnvPath)) {
    console.error(`[preflight] --env-file not found: ${resolvedEnvPath}`);
    process.exit(1);
  }
  dotenv.config({ path: resolvedEnvPath, override: true });
}
const forceStrict = args.has('--strict');
const outputJson = args.has('--json');
const runtime = getRuntimePolicy();
const strict = forceStrict || runtime.strict;

const checks = [];

function addCheck(level, id, message, suggestion) {
  checks.push({ level, id, message, suggestion: suggestion || '' });
}

function isPlaceholderValue(raw) {
  const v = String(raw || '').trim();
  if (!v) return true;
  const lv = v.toLowerCase();
  if (
    /^your[_-]/.test(lv) ||
    lv.includes('changeme') ||
    lv.includes('placeholder') ||
    /^<[^>]+>$/.test(v) ||
    /^__[^_]+__$/.test(v)
  ) {
    return true;
  }
  return false;
}

function hasValue(key) {
  return !isPlaceholderValue(process.env[key]);
}

function isProviderMockLike(key) {
  const v = String(process.env[key] || 'mock').trim().toLowerCase();
  return ['mock', ''].includes(v);
}

function isProviderAllowed(key, allowed) {
  const v = String(process.env[key] || '').trim().toLowerCase();
  return allowed.includes(v);
}

function routeContains(relFile, token) {
  const full = path.join(serverDir, relFile);
  if (!fs.existsSync(full)) return false;
  const text = fs.readFileSync(full, 'utf8');
  return text.includes(token);
}

function readServerFile(relFile) {
  const full = path.join(serverDir, relFile);
  if (!fs.existsSync(full)) return '';
  return fs.readFileSync(full, 'utf8');
}

function textContainsAll(text, tokens) {
  return tokens.every((t) => text.includes(t));
}

// --- Runtime mode checks ---
if (!['dev_simulation', 'production_strict'].includes(runtime.mode)) {
  addCheck(
    'red',
    'runtime.mode.invalid',
    `APP_RUNTIME_MODE=${runtime.mode} 非法`,
    '使用 APP_RUNTIME_MODE=dev_simulation|production_strict',
  );
} else {
  addCheck('green', 'runtime.mode.ok', `运行模式：${runtime.mode}`);
}

if (strict && runtime.allowSimulatedPayment) {
  addCheck(
    'red',
    'runtime.simulated.payment.enabled',
    '严格模式下 ALLOW_SIMULATED_PAYMENT=true',
    '设置 ALLOW_SIMULATED_PAYMENT=false',
  );
}
if (strict && runtime.allowSimulatedDelivery) {
  addCheck(
    'red',
    'runtime.simulated.delivery.enabled',
    '严格模式下 ALLOW_SIMULATED_DELIVERY=true',
    '设置 ALLOW_SIMULATED_DELIVERY=false',
  );
}
if (strict && runtime.allowSimulatedSms) {
  addCheck(
    'red',
    'runtime.simulated.sms.enabled',
    '严格模式下 ALLOW_SIMULATED_SMS=true',
    '设置 ALLOW_SIMULATED_SMS=false',
  );
}

// --- SMS checks ---
if (strict && isProviderMockLike('SMS_PROVIDER')) {
  addCheck(
    'red',
    'sms.provider.mock',
    '严格模式下 SMS_PROVIDER 仍为 mock/空',
    '设置 SMS_PROVIDER=webhook 并配置 SMS_WEBHOOK_URL',
  );
}
if (isProviderAllowed('SMS_PROVIDER', ['webhook']) && !hasValue('SMS_WEBHOOK_URL')) {
  addCheck(
    strict ? 'red' : 'yellow',
    'sms.webhook.url.missing',
    'SMS_PROVIDER=webhook 但 SMS_WEBHOOK_URL 缺失',
    '补齐 SMS_WEBHOOK_URL（可选 SMS_WEBHOOK_TOKEN）',
  );
}

// --- Payment checks ---
if (strict && isProviderMockLike('PAYMENT_PROVIDER')) {
  addCheck(
    'red',
    'payment.provider.mock',
    '严格模式下 PAYMENT_PROVIDER 仍为 mock/空',
    '建议 PAYMENT_PROVIDER=webhook|aggregator',
  );
}
if (isProviderAllowed('PAYMENT_PROVIDER', ['webhook', 'aggregator', 'aggregate', 'aggregation', 'platform'])
    && !hasValue('PAYMENT_CREATE_WEBHOOK_URL')) {
  addCheck(
    strict ? 'red' : 'yellow',
    'payment.webhook.create_url.missing',
    'PAYMENT_PROVIDER=webhook/aggregator 但 PAYMENT_CREATE_WEBHOOK_URL 缺失',
    '补齐 PAYMENT_CREATE_WEBHOOK_URL（可选 PAYMENT_WEBHOOK_TOKEN）',
  );
}
if (!hasValue('PAYMENT_CALLBACK_TOKEN')) {
  addCheck(
    strict ? 'red' : 'yellow',
    'payment.callback.token.missing',
    'PAYMENT_CALLBACK_TOKEN 缺失，支付回调不可用',
    '配置 PAYMENT_CALLBACK_TOKEN',
  );
}

// --- Delivery checks ---
if (strict && isProviderMockLike('DELIVERY_PROVIDER')) {
  addCheck(
    'red',
    'delivery.provider.mock',
    '严格模式下 DELIVERY_PROVIDER 仍为 mock/空',
    '建议 DELIVERY_PROVIDER=webhook|aggregator',
  );
}
if (isProviderAllowed('DELIVERY_PROVIDER', ['webhook', 'aggregator', 'aggregate', 'aggregation', 'platform'])
    && !hasValue('DELIVERY_CREATE_WEBHOOK_URL')) {
  addCheck(
    strict ? 'red' : 'yellow',
    'delivery.webhook.create_url.missing',
    'DELIVERY_PROVIDER=webhook/aggregator 但 DELIVERY_CREATE_WEBHOOK_URL 缺失',
    '补齐 DELIVERY_CREATE_WEBHOOK_URL（可选 DELIVERY_WEBHOOK_TOKEN）',
  );
}
if (!hasValue('DELIVERY_CALLBACK_TOKEN')) {
  addCheck(
    strict ? 'red' : 'yellow',
    'delivery.callback.token.missing',
    'DELIVERY_CALLBACK_TOKEN 缺失，配送回调不可用',
    '配置 DELIVERY_CALLBACK_TOKEN',
  );
}

// --- Dangerous route checks ---
const hasConfirmPaymentRoute = routeContains(path.join('routes', 'orders.js'), "/:id/confirm-payment");
if (hasConfirmPaymentRoute) {
  const userOrdersRouteText = readServerFile(path.join('routes', 'orders.js'));
  const hasStrictConfirmPaymentGuard =
    userOrdersRouteText.includes('SIMULATED_PAYMENT_DISABLED') ||
    textContainsAll(userOrdersRouteText, ['runtimePolicy.strict', 'allowSimulatedPayment']);
  if (strict) {
    if (!hasStrictConfirmPaymentGuard) {
      addCheck(
        'red',
        'route.confirm_payment.exposed',
        '严格模式检测到模拟确认支付路由存在',
        '在路由中增加 runtime 严格模式禁用保护',
      );
    } else {
      addCheck('green', 'route.confirm_payment.guarded', '模拟确认支付路由已增加严格模式保护');
    }
  } else {
    addCheck('yellow', 'route.confirm_payment.exists', '检测到模拟确认支付路由（开发模式可用）');
  }
}

// --- Main-chain integration checks (phase-2) ---
const ordersRouteText = readServerFile(path.join('routes', 'orders.js'));
const adminOrdersRouteText = readServerFile(path.join('routes', 'admin', 'orders.js'));
const orderChainText = `${ordersRouteText}\n${adminOrdersRouteText}`;
const hasPaymentProviderImport =
  orderChainText.includes("paymentProviderService") ||
  orderChainText.includes("createPaymentOrder");
const hasDeliveryProviderImport =
  orderChainText.includes("deliveryProviderService") ||
  orderChainText.includes("createDeliveryOrder");
const hasPaymentOutboundCall = orderChainText.includes("createPaymentOrder(");
const hasDeliveryOutboundCall = orderChainText.includes("createDeliveryOrder(");

if (!hasPaymentProviderImport || !hasPaymentOutboundCall) {
  addCheck(
    strict ? 'red' : 'yellow',
    'chain.payment.outbound.not_wired',
    '订单主链路未检测到 createPaymentOrder 调用',
    '在主订单流程中接入支付创建 outbound，并记录外部单号',
  );
}
if (!hasDeliveryProviderImport || !hasDeliveryOutboundCall) {
  addCheck(
    strict ? 'red' : 'yellow',
    'chain.delivery.outbound.not_wired',
    '订单主链路未检测到 createDeliveryOrder 调用',
    '在订单履约流程中接入配送下发 outbound，并记录运单号',
  );
}

// --- Edge auth consistency checks ---
const analyzeDietText = fs.readFileSync(path.join(rootDir, 'supabase', 'functions', 'analyze-diet', 'index.ts'), 'utf8');
const analyzeHrvText = fs.readFileSync(path.join(rootDir, 'supabase', 'functions', 'analyze-hrv', 'index.ts'), 'utf8');
const suspiciousDietClient = textContainsAll(analyzeDietText, [
  "authHeader.replace(\"Bearer \", \"\")",
  "createClient(supabaseUrl, supabaseKey)",
]);
const suspiciousHrvClient = textContainsAll(analyzeHrvText, [
  "authHeader.replace(\"Bearer \", \"\")",
  "createClient(supabaseUrl, supabaseKey)",
]);
if (suspiciousDietClient || suspiciousHrvClient) {
  addCheck(
    strict ? 'red' : 'yellow',
    'edge.auth.client_inconsistent',
    '检测到 analyze-diet/analyze-hrv 使用非常规 Supabase 客户端初始化',
    '统一为 anon key + Authorization header 的初始化方式',
  );
}

// --- Backend test readiness checks ---
const serverPkgPath = path.join(serverDir, 'package.json');
const serverPkgRaw = fs.existsSync(serverPkgPath) ? fs.readFileSync(serverPkgPath, 'utf8') : '{}';
let serverPkg = {};
try {
  serverPkg = JSON.parse(serverPkgRaw);
} catch {
  serverPkg = {};
}
const serverTestScript = String(serverPkg?.scripts?.test || '').trim();
if (!serverTestScript || serverTestScript.includes('no test specified')) {
  addCheck(
    strict ? 'red' : 'yellow',
    'server.test.script.placeholder',
    'server/package.json 的 test 脚本仍是占位',
    '补齐可执行后端测试命令（至少关键路由 smoke）',
  );
}
const hasSupertestDep = Boolean(serverPkg?.dependencies?.supertest || serverPkg?.devDependencies?.supertest);
const serverTestsDir = path.join(serverDir, 'tests');
let testFilesUseSupertest = false;
if (fs.existsSync(serverTestsDir)) {
  const collectTestFiles = (dir) => {
    const out = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules') continue;
      const absPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        out.push(...collectTestFiles(absPath));
        continue;
      }
      if (/\.(js|cjs|mjs|ts|tsx)$/i.test(entry.name)) {
        out.push(absPath);
      }
    }
    return out;
  };
  const testFiles = collectTestFiles(serverTestsDir);
  testFilesUseSupertest = testFiles.some((filePath) => {
    const content = fs.readFileSync(filePath, 'utf8');
    return content.includes('supertest');
  });
}
if (testFilesUseSupertest && !hasSupertestDep) {
  addCheck(
    'yellow',
    'server.test.dependency.supertest.missing',
    '后端测试目录存在 supertest 用法，但 package.json 未声明 supertest',
    '补齐 supertest 依赖或替换测试实现',
  );
}

// --- Adapter readiness hints ---
if (!hasValue('DEVICE_SYNC_PROVIDER')) {
  addCheck('yellow', 'device.provider.missing', 'DEVICE_SYNC_PROVIDER 未配置（设备同步仍为占位）');
}
if (!hasValue('WECHAT_APP_ID') || !hasValue('WECHAT_APP_SECRET')) {
  addCheck('yellow', 'wechat.auth.missing', '微信登录参数未完整配置');
}

const redCount = checks.filter((c) => c.level === 'red').length;
const yellowCount = checks.filter((c) => c.level === 'yellow').length;
const greenCount = checks.filter((c) => c.level === 'green').length;

const summary = {
  mode: runtime.mode,
  strict,
  totals: {
    red: redCount,
    yellow: yellowCount,
    green: greenCount,
    all: checks.length,
  },
  checks,
};

if (outputJson) {
  console.log(JSON.stringify(summary, null, 2));
} else {
  console.log('=== Preflight Readiness ===');
  console.log(`mode=${runtime.mode} strict=${strict}`);
  if (customEnvPath) {
    console.log(`env_file=${customEnvPath}`);
  }
  for (const c of checks) {
    const icon = c.level === 'red' ? '🔴' : c.level === 'yellow' ? '🟡' : '🟢';
    console.log(`${icon} [${c.id}] ${c.message}`);
    if (c.suggestion) console.log(`   ↳ ${c.suggestion}`);
  }
  console.log('---');
  console.log(`Totals: red=${redCount}, yellow=${yellowCount}, green=${greenCount}`);
}

if (strict && redCount > 0) {
  process.exit(1);
}
