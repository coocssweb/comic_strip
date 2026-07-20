import crypto from 'node:crypto';

function encodePayload(payload) {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function createSignature(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

function secureCompare(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function createSessionToken({ subjectId, role, expiresAt, secret }) {
  const payload = encodePayload({
    sessionId: crypto.randomUUID(),
    subjectId,
    role,
    expiresAt: expiresAt.toISOString(),
  });

  return `${payload}.${createSignature(payload, secret)}`;
}

export function hashSessionToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function verifySessionToken({ token, expectedRole, secret, now }) {
  const [payload, signature, ...extraParts] = token.split('.');

  if (
    !payload ||
    !signature ||
    extraParts.length > 0 ||
    !secureCompare(signature, createSignature(payload, secret))
  ) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const expiresAt = new Date(decoded.expiresAt);

    if (
      (expectedRole !== undefined && decoded.role !== expectedRole) ||
      !['reader', 'admin'].includes(decoded.role) ||
      typeof decoded.sessionId !== 'string' ||
      typeof decoded.subjectId !== 'string' ||
      Number.isNaN(expiresAt.getTime()) ||
      expiresAt <= now
    ) {
      return null;
    }

    return {
      subjectId: decoded.subjectId,
      role: decoded.role,
      expiresAt: expiresAt.toISOString(),
    };
  } catch {
    return null;
  }
}
