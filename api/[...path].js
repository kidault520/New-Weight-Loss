/**
 * 兜底：/api/* 其余路径仍走转发（显式路由见 api/auth/*.js）。
 */
const { proxyApiRequest } = require('../lib/vercelProxyForward.cjs');

module.exports = async (req, res) => {
  let parts = [];
  const segments = req.query.path;
  if (Array.isArray(segments)) parts = segments;
  else if (segments) parts = [segments];
  if (parts.length === 0 && req.url) {
    const pathname = req.url.split('?')[0];
    const m = pathname.match(/^\/api\/(.*)$/);
    if (m && m[1]) parts = m[1].split('/').filter(Boolean);
  }
  const rest = parts.join('/');
  if (!rest) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ success: false, error: 'Not found', code: 'API_NOT_FOUND' }));
    return;
  }
  return proxyApiRequest(req, res, rest);
};
