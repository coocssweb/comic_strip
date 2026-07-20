import Joi from 'joi';
import Router from 'koa-router';
import {
  createEpisode,
  deleteEpisode,
  getAdminEpisode,
  listAdminEpisodes,
  publishEpisode,
  unpublishEpisode,
  updateEpisode,
} from '../controllers/episode.controller.js';
import {
  createSeries,
  deleteSeries,
  getAdminSeries,
  listAdminSeries,
  updateSeries,
} from '../controllers/series.controller.js';
import { createTag, deleteTag, listTags, updateTag } from '../controllers/tag.controller.js';
import {
  createTopic,
  deleteTopic,
  getAdminTopic,
  listAdminTopics,
  updateTopic,
} from '../controllers/topic.controller.js';
import { requireAdminAuth } from '../middlewares/auth.middleware.js';
import { validate, validateBody, validateQuery } from '../middlewares/validate.middleware.js';

const objectIdSchema = Joi.string().hex().length(24);
const paginationSchema = Joi.object({
  cursor: Joi.string()
    .pattern(/^[A-Za-z0-9_-]+$/)
    .max(256)
    .optional(),
  limit: Joi.number().integer().min(1).max(50).default(20),
});
const seriesPayloadSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
  summary: Joi.string().trim().min(1).max(1000).required(),
  authorByline: Joi.string().trim().min(1).max(100).required(),
});
const seriesUpdateSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100),
  summary: Joi.string().trim().min(1).max(1000),
  authorByline: Joi.string().trim().min(1).max(100),
}).min(1);
const tagPayloadSchema = Joi.object({
  name: Joi.string().trim().min(1).max(50).required(),
  sortOrder: Joi.number().integer().min(0).required(),
});
const tagUpdateSchema = Joi.object({
  name: Joi.string().trim().min(1).max(50),
  sortOrder: Joi.number().integer().min(0),
}).min(1);
const panelSchema = Joi.object({
  position: Joi.number().integer().min(1).max(4).required(),
  imageUrl: Joi.string()
    .uri({ scheme: ['https'] })
    .required(),
  altText: Joi.string().allow(null, '').max(300).optional(),
});
const episodePayloadSchema = Joi.object({
  seriesId: objectIdSchema.required(),
  title: Joi.string().trim().min(1).max(200).required(),
  summary: Joi.string().allow(null, '').max(2000).optional(),
  themeTagId: objectIdSchema.required(),
  panels: Joi.array().items(panelSchema).length(4).required(),
});
const episodeUpdateSchema = Joi.object({
  seriesId: objectIdSchema,
  title: Joi.string().trim().min(1).max(200),
  summary: Joi.string().allow(null, '').max(2000),
  themeTagId: objectIdSchema,
  panels: Joi.array().items(panelSchema).length(4),
}).min(1);
const topicPayloadSchema = Joi.object({
  title: Joi.string().trim().min(1).max(200).required(),
  summary: Joi.string().allow(null, '').max(2000).optional(),
  coverImageUrl: Joi.string()
    .uri({ scheme: ['https'] })
    .required(),
  episodeIds: Joi.array().items(objectIdSchema).unique().required(),
});
const topicUpdateSchema = Joi.object({
  title: Joi.string().trim().min(1).max(200),
  summary: Joi.string().allow(null, '').max(2000),
  coverImageUrl: Joi.string().uri({ scheme: ['https'] }),
  episodeIds: Joi.array().items(objectIdSchema).unique(),
}).min(1);
const paramsSchema = (name) =>
  Joi.object({ params: Joi.object({ [name]: objectIdSchema.required() }).required() });

const contentRouter = new Router({ prefix: '/api/v1/admin' });

contentRouter.use(requireAdminAuth);

contentRouter.get('/tags', listTags);
contentRouter.post('/tags', validateBody(tagPayloadSchema), createTag);
contentRouter.patch(
  '/tags/:tagId',
  validate(paramsSchema('tagId')),
  validateBody(tagUpdateSchema),
  updateTag,
);
contentRouter.delete('/tags/:tagId', validate(paramsSchema('tagId')), deleteTag);

contentRouter.get('/series', validateQuery(paginationSchema), listAdminSeries);
contentRouter.post('/series', validateBody(seriesPayloadSchema), createSeries);
contentRouter.get('/series/:seriesId', validate(paramsSchema('seriesId')), getAdminSeries);
contentRouter.patch(
  '/series/:seriesId',
  validate(paramsSchema('seriesId')),
  validateBody(seriesUpdateSchema),
  updateSeries,
);
contentRouter.delete('/series/:seriesId', validate(paramsSchema('seriesId')), deleteSeries);

contentRouter.get(
  '/episodes',
  validateQuery(
    paginationSchema.keys({
      status: Joi.string().valid('draft', 'published', 'unpublished'),
      seriesId: objectIdSchema,
    }),
  ),
  listAdminEpisodes,
);
contentRouter.post('/episodes', validateBody(episodePayloadSchema), createEpisode);
contentRouter.get('/episodes/:episodeId', validate(paramsSchema('episodeId')), getAdminEpisode);
contentRouter.patch(
  '/episodes/:episodeId',
  validate(paramsSchema('episodeId')),
  validateBody(episodeUpdateSchema),
  updateEpisode,
);
contentRouter.post(
  '/episodes/:episodeId/publish',
  validate(paramsSchema('episodeId')),
  publishEpisode,
);
contentRouter.post(
  '/episodes/:episodeId/unpublish',
  validate(paramsSchema('episodeId')),
  unpublishEpisode,
);
contentRouter.delete('/episodes/:episodeId', validate(paramsSchema('episodeId')), deleteEpisode);

contentRouter.get('/topics', validateQuery(paginationSchema), listAdminTopics);
contentRouter.post('/topics', validateBody(topicPayloadSchema), createTopic);
contentRouter.get('/topics/:topicId', validate(paramsSchema('topicId')), getAdminTopic);
contentRouter.patch(
  '/topics/:topicId',
  validate(paramsSchema('topicId')),
  validateBody(topicUpdateSchema),
  updateTopic,
);
contentRouter.delete('/topics/:topicId', validate(paramsSchema('topicId')), deleteTopic);

export { contentRouter };
