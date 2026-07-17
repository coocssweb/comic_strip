export async function responseMiddleware(ctx, next) {
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
