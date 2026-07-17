import cors from '@koa/cors';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import logger from 'koa-logger';
import { errorMiddleware } from './middlewares/error.middleware.js';
import { responseMiddleware } from './middlewares/response.middleware.js';
import { router } from './routes/index.route.js';

const app = new Koa();

app.use(errorMiddleware);
app.use(cors());
app.use(logger());
app.use(bodyParser());
app.use(responseMiddleware);
app.use(router.routes());
app.use(router.allowedMethods());

export { app };
