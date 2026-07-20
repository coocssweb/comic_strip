import Joi from 'joi';
import Router from 'koa-router';
import {
  getMonthlySeriesRanking,
  getPublicSeries,
  getPublicTopic,
  getPublishedEpisode,
  listPublicSeries,
  listPublicTopics,
  listPublishedEpisodes,
} from '../controllers/discovery.controller.js';
import { optionalReaderAuth } from '../middlewares/auth.middleware.js';
import { validate, validateQuery } from '../middlewares/validate.middleware.js';

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

const discoveryRouter = new Router({ prefix: '/api/v1' });

discoveryRouter.get(
  '/episodes',
  optionalReaderAuth,
  validateQuery(paginationSchema),
  listPublishedEpisodes,
);
discoveryRouter.get(
  '/episodes/:episodeId',
  optionalReaderAuth,
  validate(paramsSchema('episodeId')),
  getPublishedEpisode,
);
discoveryRouter.get('/series', validateQuery(paginationSchema), listPublicSeries);
discoveryRouter.get(
  '/series/:seriesId',
  validate(paramsSchema('seriesId')),
  validateQuery(paginationSchema),
  getPublicSeries,
);
discoveryRouter.get('/topics', validateQuery(paginationSchema), listPublicTopics);
discoveryRouter.get('/topics/:topicId', validate(paramsSchema('topicId')), getPublicTopic);
discoveryRouter.get(
  '/rankings/monthly-series',
  validateQuery(
    Joi.object({
      month: Joi.string()
        .pattern(/^\d{4}-(0[1-9]|1[0-2])$/)
        .optional(),
    }),
  ),
  getMonthlySeriesRanking,
);

export { discoveryRouter };
