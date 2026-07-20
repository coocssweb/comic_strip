import crypto from 'node:crypto';

const MAX_CONTENT_LENGTH = 5 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = new Map([
  ['image/jpeg', new Set(['jpg', 'jpeg'])],
  ['image/png', new Set(['png'])],
  ['image/webp', new Set(['webp'])],
]);

function parseFileName(fileName) {
  if (typeof fileName !== 'string' || fileName.length === 0 || /[\\/]/.test(fileName)) {
    return null;
  }

  const match = /^(.*)\.([a-zA-Z0-9]+)$/.exec(fileName);

  if (!match || !match[1]) {
    return null;
  }

  return { baseName: match[1], extension: match[2].toLowerCase() };
}

export function validateCosUploadRequest({ fileName, contentType, contentLength }) {
  const parsedFileName = parseFileName(fileName);
  const allowedExtensions = ALLOWED_CONTENT_TYPES.get(contentType);

  if (
    !parsedFileName ||
    !allowedExtensions ||
    !allowedExtensions.has(parsedFileName.extension) ||
    !Number.isInteger(contentLength) ||
    contentLength <= 0 ||
    contentLength > MAX_CONTENT_LENGTH
  ) {
    return null;
  }

  return { fileName, contentType, contentLength };
}

export function buildCosObjectKey({ fileName, now }) {
  const parsedFileName = parseFileName(fileName);

  if (!parsedFileName) {
    return null;
  }

  const safeBaseName = parsedFileName.baseName
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

  if (!safeBaseName) {
    return null;
  }

  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');

  return `comic-images/${year}/${month}/${day}/${crypto.randomUUID()}-${safeBaseName}.${parsedFileName.extension}`;
}

export function isAllowedCosPublicUrl(imageUrl, publicBaseUrl) {
  try {
    const configuredUrl = new URL(publicBaseUrl);
    const candidateUrl = new URL(imageUrl);
    const configuredPath = configuredUrl.pathname.endsWith('/')
      ? configuredUrl.pathname
      : `${configuredUrl.pathname}/`;

    return (
      configuredUrl.protocol === 'https:' &&
      candidateUrl.protocol === 'https:' &&
      candidateUrl.origin === configuredUrl.origin &&
      candidateUrl.pathname.startsWith(configuredPath)
    );
  } catch {
    return false;
  }
}

export { MAX_CONTENT_LENGTH };
