const crypto = require('crypto');
const fs = require('fs');

/**
 * 微信支付 APIv3 请求签名（商户私钥 RSA-SHA256）
 * 文档：https://pay.weixin.qq.com/doc/v3/merchant/4012716430
 */

function loadPrivateKeyPem() {
  const path = String(process.env.WECHAT_PAY_PRIVATE_KEY_PATH || '').trim();
  if (path) {
    return fs.readFileSync(path, 'utf8');
  }
  const inline = String(process.env.WECHAT_PAY_PRIVATE_KEY || '').trim();
  if (!inline) return '';
  return inline.replace(/\\n/g, '\n');
}

function buildAuthorization({
  mchid,
  serialNo,
  method,
  urlPath,
  body,
  privateKeyPem,
}) {
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomBytes(16).toString('hex');
  const bodyStr = typeof body === 'string' ? body : JSON.stringify(body || {});
  const message = `${method.toUpperCase()}\n${urlPath}\n${timestamp}\n${nonce}\n${bodyStr}\n`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(message);
  sign.end();
  const signature = sign.sign(privateKeyPem, 'base64');
  const token = [
    `mchid="${mchid}"`,
    `nonce_str="${nonce}"`,
    `timestamp="${timestamp}"`,
    `serial_no="${serialNo}"`,
    `signature="${signature}"`,
  ].join(',');
  return `WECHATPAY2-SHA256-RSA2048 ${token}`;
}

module.exports = {
  loadPrivateKeyPem,
  buildAuthorization,
};
