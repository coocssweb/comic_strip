export async function responseMiddleware(ctx, next) {
  ctx.ok = (data, message = '') => {
    ctx.status = 200;
    ctx.body = { code: 'OK', message, data };
  };

  ctx.success = (status, message, data) => {
    ctx.status = status;
    ctx.body = { code: 0, message, data };
  };

  ctx.fail = (status, code, message) => {
    ctx.status = status;
    ctx.body = { code, message, data: null };
  };

  await next();
}
