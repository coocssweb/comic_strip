export function createContentPayload(resource, form) {
  if (resource === 'tags') {
    return { name: form.name, sortOrder: Number(form.sortOrder) };
  }

  if (resource === 'series') {
    return { name: form.name, summary: form.summary, authorByline: form.authorByline };
  }

  if (resource === 'topics') {
    return {
      title: form.title,
      summary: form.summary || null,
      coverImageUrl: form.coverImageUrl,
      episodeIds: form.episodeIds,
    };
  }

  return {
    seriesId: form.seriesId,
    title: form.title,
    summary: form.summary || null,
    themeTagId: form.themeTagId,
    panels: form.panels.map(({ position, imageUrl, altText }) => ({ position, imageUrl, altText })),
  };
}

export function moveTopicEpisode(episodeIds, episodeId, offset) {
  const currentIndex = episodeIds.indexOf(episodeId);
  const nextIndex = currentIndex + offset;

  if (currentIndex === -1 || nextIndex < 0 || nextIndex >= episodeIds.length) {
    return episodeIds;
  }

  const reorderedEpisodeIds = [...episodeIds];
  [reorderedEpisodeIds[currentIndex], reorderedEpisodeIds[nextIndex]] = [
    reorderedEpisodeIds[nextIndex],
    reorderedEpisodeIds[currentIndex],
  ];
  return reorderedEpisodeIds;
}
