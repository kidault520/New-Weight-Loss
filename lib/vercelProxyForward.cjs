/**
 * Vercel Serverless 转发到 Node（勿放在 /api 下，以免被当成独立路由）。
 */

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const HOP = new Set([
  'connection',
  'content-length',
  'host',
  'keep-alive',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

async function proxyApiRequest(req, res, pathAfterApi) {
  const origin = String(process.env.API_PROXY_ORIGIN || '').replace(/\/$/, '');
  if (!origin) {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(
      JSON.stringify({
        success: false,
        error:
          'Vercel 未配置 API_PROXY_ORIGIN：在环境变量中设置 Node 根地址（不含 /api），例如 https://xxx.up.railway.app',
        code: 'API_PROXY_NOT_CONFIGURED',
      })
    );
    return;
  }

  const qIndex = req.url ? req.url.indexOf('?') : -1;
  const qs = qIndex >= 0 ? req.url.slice(qIndex) : '';
  const targetUrl = `${origin}/api/${pathAfterApi}${qs}`;

  /** @type {Record<string, string>} */
  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (v == null || HOP.has(k.toLowerCase())) continue;
    headers[k] = Array.isArray(v) ? v.join(', ') : String(v);
  }
  delete headers['content-length'];

  let body;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    body = await readRequestBody(req);
    if (body.length === 0) body = undefined;
  }

  let upstream;
  try {
    upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
      redirect: 'manual',
    });
  } catch {
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(
      JSON.stringify({
        success: false,
        error: '无法连接后端，请检查 API_PROXY_ORIGIN 与 Node 是否在线',
        code: 'API_PROXY_UPSTREAM_UNREACHABLE',
      })
    );
    return;
  }

  res.statusCode = upstream.status;
  upstream.headers.forEach((value, key) => {
    const lk = key.toLowerCase();
    if (lk === 'transfer-encoding' || lk === 'connection') return;
    try {
      res.setHeader(key, value);
    } catch {
      // ignore
    }
  });

  const buf = Buffer.from(await upstream.arrayBuffer());
  res.end(buf);
}

module.exports = { proxyApiRequest };
