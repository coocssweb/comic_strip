import Joi from 'joi';
import Router from 'koa-router';
import {
  createComment,
  createCommentLike,
  createEpisodeFavorite,
  createEpisodeLike,
  createEpisodeShare,
  deleteComment,
  deleteCommentLike,
  deleteEpisodeFavorite,
  deleteEpisodeLike,
  getCurrentReader,
  listEpisodeComments,
  listMyComments,
  listMyEpisodeLikes,
  listMyFavorites,
} from '../controllers/interaction.controller.js';
import {
  optionalReaderAuth,
  requireAuthenticated,
  requireReaderAuth,
} from '../middlewares/auth.middleware.js';
import { validate, validateBody, validateQuery } from '../middlewares/validate.middleware.js';

const objectIdSchema = Joi.string().hex().length(24);
const paginationSchema = Joi.object({
  cursor: Joi.string()
    .pattern(/^[A-Za-z0-9_-]+$/)
    .max(256)
    .optional(),
  limit: Joi.number().integer().min(1).max(50).default(20),
});
const paramsSchema = (name) =>
  Joi.object({ params: Joi.object({ [name]: objectIdSchema.required() }).required() });
const commentPayloadSchema = Joi.object({ content: Joi.string().required() });

const interactionRouter = new Router({ prefix: '/api/v1' });

interactionRouter.get(
  '/episodes/:episodeId/comments',
  optionalReaderAuth,
  validate(paramsSchema('episodeId')),
  validateQuery(paginationSchema),
  listEpisodeComments,
);
interactionRouter.post(
  '/episodes/:episodeId/likes',
  requireReaderAuth,
  validate(paramsSchema('episodeId')),
  createEpisodeLike,
);
interactionRouter.delete(
  '/episodes/:episodeId/likes',
  requireReaderAuth,
  validate(paramsSchema('episodeId')),
  deleteEpisodeLike,
);
interactionRouter.post(
  '/episodes/:episodeId/favorites',
  requireReaderAuth,
  validate(paramsSchema('episodeId')),
  createEpisodeFavorite,
);
interactionRouter.delete(
  '/episodes/:episodeId/favorites',
  requireReaderAuth,
  validate(paramsSchema('episodeId')),
  deleteEpisodeFavorite,
);
interactionRouter.post(
  '/episodes/:episodeId/shares',
  optionalReaderAuth,
  validate(paramsSchema('episodeId')),
  createEpisodeShare,
);
interactionRouter.post(
  '/episodes/:episodeId/comments',
  requireReaderAuth,
  validate(paramsSchema('episodeId')),
  validateBody(commentPayloadSchema),
  createComment,
);
interactionRouter.delete(
  '/comments/:commentId',
  requireAuthenticated,
  validate(paramsSchema('commentId')),
  deleteComment,
);
interactionRouter.post(
  '/comments/:commentId/likes',
  requireReaderAuth,
  validate(paramsSchema('commentId')),
  createCommentLike,
);
interactionRouter.delete(
  '/comments/:commentId/likes',
  requireReaderAuth,
  validate(paramsSchema('commentId')),
  deleteCommentLike,
);
interactionRouter.get('/me', requireReaderAuth, getCurrentReader);
interactionRouter.get('/me/favorites', requireReaderAuth, validateQuery(paginationSchema), listMyFavorites);
interactionRouter.get(
  '/me/episode-likes',
  requireReaderAuth,
  validateQuery(paginationSchema),
  listMyEpisodeLikes,
);
interactionRouter.get('/me/comments', requireReaderAuth, validateQuery(paginationSchema), listMyComments);

export { interactionRouter };
