export async function collectCursorPages(loadPage) {
  const collectedItems = [];
  let cursor;

  do {
    const page = await loadPage(cursor ? { cursor } : undefined);
    collectedItems.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);

  return collectedItems;
}
