// 为所有 HTTP 响应统一设置安全相关响应头（基于 koa-helmet）

import helmet from "koa-helmet";

/**
 * koa-helmet 负责标准安全头（X-Content-Type-Options、Referrer-Policy、CSP 等），
 * Permissions-Policy 由自定义中间件单独追加（helmet 对该头的支持因版本而异）。
 */
const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'none'"],
    },
  },
  referrerPolicy: { policy: "no-referrer" },
});

/**
 * 组合 koa-helmet 与自定义 Permissions-Policy 的中间件。
 * 禁用：摄像头、麦克风、地理位置、支付、自动播放等不必要浏览器能力。
 */
export default async function securityHeadersMiddleware(ctx, next) {
  // 先执行 helmet 设置标准安全头
  await helmetMiddleware(ctx, async () => {
    // 在 helmet 之后、业务路由之前追加 Permissions-Policy
    ctx.set(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), payment=(), autoplay=()",
    );
    await next();
  });
}