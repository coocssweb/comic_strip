export function rankMonthlySeries(seriesMetrics) {
  return seriesMetrics
    .map(({ series, likeCount, commentCount, commentLikeCount, shareCount }) => ({
      series,
      heat: likeCount + commentCount + commentLikeCount + shareCount,
      shareCount,
    }))
    .sort(
      (left, right) =>
        right.heat - left.heat ||
        right.shareCount - left.shareCount ||
        left.series.id.localeCompare(right.series.id),
    )
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export function getShanghaiMonth(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));

  return `${values.year}-${values.month}`;
}

export function getMonthRange(month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return null;
  }

  const [year, monthNumber] = month.split('-').map(Number);
  const start = new Date(Date.UTC(year, monthNumber - 1, 1, -8));
  const end = new Date(Date.UTC(year, monthNumber, 1, -8));

  return { start, end };
}
