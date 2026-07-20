export const EPISODE_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  UNPUBLISHED: 'unpublished',
};

export function hasCompleteOrderedPanels(panels) {
  return (
    Array.isArray(panels) &&
    panels.length === 4 &&
    panels.every(
      (panel, index) =>
        panel &&
        panel.position === index + 1 &&
        typeof panel.imageUrl === 'string' &&
        panel.imageUrl,
    )
  );
}

export function canTransitionEpisodeStatus(currentStatus, nextStatus) {
  return (
    (currentStatus === EPISODE_STATUS.DRAFT && nextStatus === EPISODE_STATUS.PUBLISHED) ||
    (currentStatus === EPISODE_STATUS.UNPUBLISHED && nextStatus === EPISODE_STATUS.PUBLISHED) ||
    (currentStatus === EPISODE_STATUS.PUBLISHED && nextStatus === EPISODE_STATUS.UNPUBLISHED)
  );
}
