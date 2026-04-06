const { proxyApiRequest } = require('../../lib/vercelProxyForward.cjs');

module.exports = async (req, res) => proxyApiRequest(req, res, 'auth/login-with-code');
