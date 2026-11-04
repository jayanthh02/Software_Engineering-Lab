const crypto = require('crypto');

function getSecret() {
  const secret = process.env.QR_HMAC_SECRET;

  if (!secret) {
    throw new Error('QR_HMAC_SECRET is not configured');
  }

  return secret;
}

function createTicket(registrationId) {
  const ticketCode = crypto.randomUUID();

  const signature = crypto
    .createHmac('sha256', getSecret())
    .update(`${ticketCode}.${registrationId}`)
    .digest('hex');

  return {
    ticketCode,
    signature,
    qrPayload: `${ticketCode}.${registrationId}.${signature}`,
  };
}

function verifyTicket(qrPayload) {
  try {
    if (typeof qrPayload !== 'string') return false;

    const parts = qrPayload.split('.');
    if (parts.length !== 3) return false;

    const [ticketCode, registrationId, receivedSignature] = parts;

    if (
      !/^\d+$/.test(registrationId) ||
      !/^[a-f0-9-]{36}$/i.test(ticketCode) ||
      !/^[a-f0-9]{64}$/i.test(receivedSignature)
    ) {
      return false;
    }

    const expectedSignature = crypto
      .createHmac('sha256', getSecret())
      .update(`${ticketCode}.${registrationId}`)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(receivedSignature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch {
    return false;
  }
}

module.exports = {
  createTicket,
  verifyTicket,
};