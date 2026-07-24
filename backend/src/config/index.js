// 集中管理全部运行配置，启动时做全量校验

import "dotenv/config";
import { z } from "zod";

// 每个校验失败的错误都需要拼入汇总信息，所以用 safeParse 而非抛出
const nodeEnvSchema = z.enum(["development", "production", "test"], {
  errorMap: () => ({ message: "NODE_ENV 必须是 development / production / test 之一" }),
});

const portSchema = z
  .string()
  .transform((v) => Number(v))
  .pipe(
    z
      .number()
      .int("PORT 必须是整数")
      .min(0, "PORT 不能为负数")
      .max(65535, "PORT 超出有效范围 0-65535"),
  );

const mongoUriSchema = z.string().refine((v) => /^mongodb(\+srv)?:\/\/.+/.test(v), {
  message: "MONGODB_URI 必须以 mongodb:// 或 mongodb+srv:// 开头",
});

// 密钥最短长度防止使用弱密钥
const secretSchema = (name) =>
  z.string().min(16, `${name} 长度不足，至少需要 16 个字符`).refine(
    (v) => v !== "change-me-to-a-random-secret-at-least-32-chars",
    { message: `${name} 未修改，请替换为真实密钥` },
  );

const originSchema = z.string().refine(
  (v) => {
    try {
      const u = new URL(v);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  },
  { message: "ADMIN_WEB_ORIGIN 必须是合法的 HTTP/HTTPS URL" },
);

const logLevelSchema = z.enum(["fatal", "error", "warn", "info", "debug", "trace"], {
  errorMap: () => ({ message: "LOG_LEVEL 必须是 fatal / error / warn / info / debug / trace 之一" }),
});

/**
 * 校验全部运行配置并返回类型安全的配置对象。
 * 校验失败时打印错误明细并以非零退出码终止进程。
 */
export function loadConfig() {
  const errors = [];

  const nodeEnv = safeParse(nodeEnvSchema, "NODE_ENV", errors);
  const port = safeParse(portSchema, "PORT", errors);
  const mongodbUri = safeParse(mongoUriSchema, "MONGODB_URI", errors);
  // 仅非 test 环境要求密钥和来源必须真实可用
  if (nodeEnv !== "test") {
    safeParse(secretSchema("ADMIN_JWT_SECRET"), "ADMIN_JWT_SECRET", errors);
    safeParse(secretSchema("SECURITY_HMAC_SECRET"), "SECURITY_HMAC_SECRET", errors);
    safeParse(originSchema, "ADMIN_WEB_ORIGIN", errors);
    // COS 配置——非 test 环境必填
    safeParse(z.string().min(1, "COS_SECRET_ID 不能为空"), "COS_SECRET_ID", errors);
    safeParse(z.string().min(1, "COS_SECRET_KEY 不能为空"), "COS_SECRET_KEY", errors);
    safeParse(z.string().min(1, "COS_BUCKET 不能为空"), "COS_BUCKET", errors);
    safeParse(z.string().min(1, "COS_REGION 不能为空"), "COS_REGION", errors);
  }
  safeParse(logLevelSchema, "LOG_LEVEL", errors);

  if (errors.length > 0) {
    console.error("配置校验失败，拒绝启动：");
    for (const e of errors) {
      console.error(`  - ${e}`);
    }
    process.exit(1);
  }

  return {
    nodeEnv,
    port,
    mongodbUri,
    adminJwtSecret: process.env.ADMIN_JWT_SECRET ?? "",
    securityHmacSecret: process.env.SECURITY_HMAC_SECRET ?? "",
    adminWebOrigin: process.env.ADMIN_WEB_ORIGIN ?? "",
    logLevel: process.env.LOG_LEVEL ?? "info",
    cos: {
      secretId: process.env.COS_SECRET_ID ?? "",
      secretKey: process.env.COS_SECRET_KEY ?? "",
      bucket: process.env.COS_BUCKET ?? "",
      region: process.env.COS_REGION ?? "",
      cdnDomain: process.env.COS_CDN_DOMAIN ?? "",
    },
  };
}

/** 对单个环境变量执行校验，失败时收集错误信息 */
function safeParse(schema, name, errors) {
  const raw = process.env[name];
  const result = schema.safeParse(raw);
  if (!result.success) {
    const details = result.error.issues.map((i) => i.message).join("；");
    errors.push(`${name}: ${details}`);
    return undefined;
  }
  return result.data;
}

export default loadConfig;