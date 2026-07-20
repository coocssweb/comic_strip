import { Comment } from '../models/comment.model.js';
import { EpisodeFavorite } from '../models/episode-favorite.model.js';
import { EpisodeLike } from '../models/episode-like.model.js';
import { EpisodeShare } from '../models/episode-share.model.js';

function createCountMap(rows) {
  return new Map(rows.map(({ _id, count }) => [String(_id), count]));
}

export async function getEpisodeCounts(episodeIds) {
  if (episodeIds.length === 0) {
    return new Map();
  }

  const countPipeline = [
    { $match: { episodeId: { $in: episodeIds } } },
    { $group: { _id: '$episodeId', count: { $sum: 1 } } },
  ];
  const [likes, favorites, comments, shares] = await Promise.all([
    EpisodeLike.aggregate(countPipeline),
    EpisodeFavorite.aggregate(countPipeline),
    Comment.aggregate([
      { $match: { episodeId: { $in: episodeIds }, deletedAt: null } },
      { $group: { _id: '$episodeId', count: { $sum: 1 } } },
    ]),
    EpisodeShare.aggregate(countPipeline),
  ]);
  const likeCounts = createCountMap(likes);
  const favoriteCounts = createCountMap(favorites);
  const commentCounts = createCountMap(comments);
  const shareCounts = createCountMap(shares);

  return new Map(
    episodeIds.map((episodeId) => [
      String(episodeId),
      {
        likeCount: likeCounts.get(String(episodeId)) || 0,
        favoriteCount: favoriteCounts.get(String(episodeId)) || 0,
        commentCount: commentCounts.get(String(episodeId)) || 0,
        shareCount: shareCounts.get(String(episodeId)) || 0,
      },
    ]),
  );
}

export async function getViewerStates(episodeIds, readerId) {
  const defaultStates = new Map(
    episodeIds.map((episodeId) => [String(episodeId), { isLiked: false, isFavorited: false }]),
  );

  if (!readerId || episodeIds.length === 0) {
    return defaultStates;
  }

  const [likes, favorites] = await Promise.all([
    EpisodeLike.find({ readerId, episodeId: { $in: episodeIds } })
      .select('episodeId')
      .lean(),
    EpisodeFavorite.find({ readerId, episodeId: { $in: episodeIds } })
      .select('episodeId')
      .lean(),
  ]);

  for (const { episodeId } of likes) {
    defaultStates.get(String(episodeId)).isLiked = true;
  }
  for (const { episodeId } of favorites) {
    defaultStates.get(String(episodeId)).isFavorited = true;
  }

  return defaultStates;
}

function toSeriesResponse(series) {
  return {
    id: String(series._id),
    name: series.name,
    authorByline: series.authorByline,
  };
}

function toThemeTagResponse(tag) {
  return { id: String(tag._id), name: tag.name };
}

export function toEpisodeSummary(episode, counts) {
  return {
    id: String(episode._id),
    series: toSeriesResponse(episode.seriesId),
    title: episode.title,
    themeTag: toThemeTagResponse(episode.themeTagId),
    thumbnailUrl: episode.panels[0].imageUrl,
    publishedAt: episode.publishedAt.toISOString(),
    counts,
  };
}

export function toAdminEpisode(episode, counts) {
  return {
    id: String(episode._id),
    seriesId: String(episode.seriesId._id || episode.seriesId),
    title: episode.title,
    summary: episode.summary,
    themeTagId: String(episode.themeTagId._id || episode.themeTagId),
    panels: episode.panels,
    status: episode.status,
    publishedAt: episode.publishedAt ? episode.publishedAt.toISOString() : null,
    counts,
    createdAt: episode.createdAt.toISOString(),
    updatedAt: episode.updatedAt.toISOString(),
  };
}
