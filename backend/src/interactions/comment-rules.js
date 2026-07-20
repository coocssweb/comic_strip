const COMMENT_MAX_LENGTH = 200;
const LINK_PATTERN = /(?:https?:\/\/|www\.)/i;

export function normalizeCommentContent(content) {
  if (typeof content !== 'string') {
    return null;
  }

  const normalizedContent = content.trim();

  if (
    !normalizedContent ||
    Array.from(normalizedContent).length > COMMENT_MAX_LENGTH ||
    LINK_PATTERN.test(normalizedContent) ||
    normalizedContent.includes('@')
  ) {
    return null;
  }

  return normalizedContent;
}
