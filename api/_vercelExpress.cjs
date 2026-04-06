/**
 * Vercel Serverless：整棵 Express 树（CommonJS，避免被根目录 "type":"module" 误判为 ESM）。
 */
const serverless = require('serverless-http');

let cachedHandler;

async function getHandler() {
  if (!cachedHandler) {
    const { ensureOtpStoreReady } = require('../server/services/otpStore');
    await ensureOtpStoreReady();
    const app = require('../server/index.js');
    cachedHandler = serverless(app, {
      binary: ['application/octet-stream', 'image/*', 'application/pdf'],
    });
  }
  return cachedHandler;
}

module.exports = async (req, res) => {
  const handler = await getHandler();
  return handler(req, res);
};
