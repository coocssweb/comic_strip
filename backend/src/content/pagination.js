function decodeCursor(cursor) {
  if (!cursor) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    const timestamp = new Date(payload.timestamp);

    return typeof payload.id === 'string' && !Number.isNaN(timestamp.valueOf())
      ? { id: payload.id, timestamp }
      : null;
  } catch {
    return null;
  }
}

export function buildTimestampCursorFilter({ cursor, field }) {
  if (!cursor) {
    return null;
  }

  const decodedCursor = decodeCursor(cursor);

  if (!decodedCursor) {
    return undefined;
  }

  return {
    $or: [
      { [field]: { $lt: decodedCursor.timestamp } },
      { [field]: decodedCursor.timestamp, _id: { $lt: decodedCursor.id } },
    ],
  };
}

export function createNextCursor(item, field) {
  if (!item) {
    return null;
  }

  const timestamp = item[field];

  if (!(timestamp instanceof Date) && typeof timestamp !== 'string') {
    return null;
  }

  return Buffer.from(
    JSON.stringify({
      timestamp: new Date(timestamp).toISOString(),
      id: String(item._id || item.id),
    }),
  ).toString('base64url');
}
