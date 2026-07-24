// CDN 鉴权 URL 集成测试 — 验证公开接口返回 CDN 签名 URL，管理端接口保持原始 key
// 使用 node:test 原生测试框架，fake COS 凭据生成签名 URL

process.env.TEST_MONGODB_URI = process.env.TEST_MONGODB_URI || "mongodb://root:bestwish_123456@110.42.210.230:40123/comic-strip-test?authSource=admin"
process.env.MONGODB_URI = "mongodb://root:bestwish_123456@110.42.210.230:40123/comic-strip-dev?authSource=admin"
process.env.NODE_ENV = "test"
process.env.PORT = "0"
process.env.ADMIN_JWT_SECRET = "test-jwt-secret-at-least-16-chars"
process.env.SECURITY_HMAC_SECRET = "test-hmac-secret-at-least-16-chars"
process.env.ADMIN_WEB_ORIGIN = "http://localhost:5173"
process.env.LOG_LEVEL = "fatal"
// 设置 fake COS 凭据，使 getObjectUrl 能本地签名生成 URL
process.env.COS_SECRET_ID = "AKID-test-cdn-1234567890"
process.env.COS_SECRET_KEY = "test-cdn-secret-key-abcdef"
process.env.COS_BUCKET = "comic-strip-1250000000"
process.env.COS_REGION = "ap-guangzhou"
process.env.COS_CDN_DOMAIN = "https://cdn.comic-strip.example.com"

import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import argon2 from "argon2";
import { connectTestDb, dropTestDb } from "./helpers/test-db.js";
import Admin from "../src/models/admin.model.js";
import Comic, { COMIC_STATUS } from "../src/models/comic.model.js";
import Series, { SERIES_STATUS } from "../src/models/series.model.js";
import { createApp } from "../src/app.js";

const TEST_PASSWORD = "TestPassword123!";
const TEST_USERNAME = "cdn-integration-test";

let dbName;
let baseUrl;
let server;
let adminCookie;

async function loginAsAdmin() {
  const res = await fetch(baseUrl + "/admin/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: TEST_USERNAME, password: TEST_PASSWORD }),
  });
  return res.headers.getSetCookie().join("; ");
}

/** 验证 URL 包含 COS 签名参数（确实是 CDN 签发的） */
function assertIsSignedCdnUrl(actual, key) {
  assert.ok(actual, "URL 不应为空: " + key);
  // COS SDK 签发的 URL 包含 q-sign-algorithm 参数
  assert.ok(
    actual.includes("q-sign-algorithm=") || actual.includes("sign="),
    "URL 应包含签名参数: " + key + " -> " + actual?.substring?.(0, 80),
  );
}

/** 验证响应中字段值为原始 COS key（未替换为 CDN URL） */
function assertIsRawKey(actual, expectedKey) {
  assert.equal(actual, expectedKey, "管理端响应应为原始 key");
}

before(async () => {
  dbName = await connectTestDb();

  const passwordHash = await argon2.hash(TEST_PASSWORD);
  await Admin.create({ username: TEST_USERNAME, passwordHash });

  const created = createApp();
  await new Promise((resolve) => {
    server = created.app.listen(0, () => {
      baseUrl = "http://127.0.0.1:" + server.address().port;
      resolve();
    });
  });

  adminCookie = await loginAsAdmin();
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await dropTestDb(dbName);
});

beforeEach(async () => {
  await Comic.deleteMany({});
  await Series.deleteMany({});
});

describe("GET /api/v1/comics — 公开列表 CDN URL", () => {
  beforeEach(async () => {
    await Comic.create([
      { title: "Pub With Cover", status: COMIC_STATUS.PUBLISHED, cover: "comics/pub-1/cover.jpg", publishedAt: new Date() },
      { title: "Pub No Cover", status: COMIC_STATUS.PUBLISHED, cover: null, publishedAt: new Date() },
    ]);
  });

  it("公开列表的封面返回 CDN 签名 URL", async () => {
    const res = await fetch(baseUrl + "/api/v1/comics");
    const body = await res.json();

    const withCover = body.items.find((c) => c.title === "Pub With Cover");
    assert.ok(withCover, "应有带封面的漫画");
    assertIsSignedCdnUrl(withCover.cover, "cover");

    const noCover = body.items.find((c) => c.title === "Pub No Cover");
    assert.equal(noCover.cover, null, "无封面应保持 null");
  });

  it("管理端列表返回原始 key，不替换为 CDN URL", async () => {
    const res = await fetch(baseUrl + "/api/v1/comics", {
      headers: { Cookie: adminCookie },
    });
    const body = await res.json();

    const withCover = body.items.find((c) => c.title === "Pub With Cover");
    assertIsRawKey(withCover.cover, "comics/pub-1/cover.jpg");
  });
});

describe("GET /api/v1/comics/:id — 公开详情 CDN URL", () => {
  let comicId;

  beforeEach(async () => {
    const comic = await Comic.create({
      title: "Detail Test",
      status: COMIC_STATUS.PUBLISHED,
      cover: "comics/detail-1/cover.jpg",
      bodyImages: ["comics/detail-1/0.jpg", "comics/detail-1/1.jpg"],
      publishedAt: new Date(),
    });
    comicId = comic._id;
  });

  it("公开详情返回 CDN 签名 URL", async () => {
    const res = await fetch(baseUrl + "/api/v1/comics/" + comicId);
    const body = await res.json();

    assertIsSignedCdnUrl(body.cover, "cover");
    assert.equal(body.bodyImages.length, 2);
    assertIsSignedCdnUrl(body.bodyImages[0], "bodyImages[0]");
    assertIsSignedCdnUrl(body.bodyImages[1], "bodyImages[1]");
  });

  it("管理端详情返回原始 key", async () => {
    const res = await fetch(baseUrl + "/api/v1/comics/" + comicId, {
      headers: { Cookie: adminCookie },
    });
    const body = await res.json();

    assertIsRawKey(body.cover, "comics/detail-1/cover.jpg");
    assertIsRawKey(body.bodyImages[0], "comics/detail-1/0.jpg");
    assertIsRawKey(body.bodyImages[1], "comics/detail-1/1.jpg");
  });
});

describe("GET /api/v1/series/:id — 连载详情 CDN URL", () => {
  let seriesId;
  let comic1Id;
  let comic2Id;

  beforeEach(async () => {
    const c1 = await Comic.create({
      title: "Series Comic 1",
      status: COMIC_STATUS.PUBLISHED,
      cover: "comics/series-1/cover.jpg",
      bodyImages: ["comics/series-1/0.jpg"],
      publishedAt: new Date(),
    });
    const c2 = await Comic.create({
      title: "Series Comic 2",
      status: COMIC_STATUS.PUBLISHED,
      cover: null,
      bodyImages: [],
      publishedAt: new Date(),
    });
    comic1Id = c1._id;
    comic2Id = c2._id;

    const series = await Series.create({
      title: "CDN Series Test",
      status: SERIES_STATUS.PUBLISHED,
      publishedAt: new Date(),
      comics: [
        { comicId: comic1Id, order: 0 },
        { comicId: comic2Id, order: 1 },
      ],
    });
    seriesId = series._id;
  });

  it("公开连载详情的成员漫画图片返回 CDN 签名 URL", async () => {
    const res = await fetch(baseUrl + "/api/v1/series/" + seriesId);
    const body = await res.json();

    assert.equal(body.comics.length, 2);

    // 成员 1：有封面和正文
    const member1 = body.comics.find((c) => c.comicId === comic1Id);
    assert.ok(member1.comic, "应有展开的完整漫画信息");
    assertIsSignedCdnUrl(member1.comic.cover, "comic1 cover");
    assert.equal(member1.comic.bodyImages.length, 1);
    assertIsSignedCdnUrl(member1.comic.bodyImages[0], "comic1 bodyImages[0]");

    // 成员 2：无封面
    const member2 = body.comics.find((c) => c.comicId === comic2Id);
    assert.equal(member2.comic.cover, null);
  });

  it("管理端连载详情的成员漫画保持原始 key", async () => {
    const res = await fetch(baseUrl + "/api/v1/series/" + seriesId, {
      headers: { Cookie: adminCookie },
    });
    const body = await res.json();

    const member1 = body.comics.find((c) => c.comicId === comic1Id);
    assertIsRawKey(member1.comic.cover, "comics/series-1/cover.jpg");
    assertIsRawKey(member1.comic.bodyImages[0], "comics/series-1/0.jpg");
  });
});

describe("CDN URL 安全性", () => {
  let publishedId;
  let deletedId;

  beforeEach(async () => {
    const published = await Comic.create({
      title: "Safe Published",
      status: COMIC_STATUS.PUBLISHED,
      cover: "comics/safe/cover.jpg",
      publishedAt: new Date(),
    });
    const deleted = await Comic.create({
      title: "Safe Deleted",
      status: COMIC_STATUS.DELETED,
      cover: "comics/safe-deleted/cover.jpg",
    });
    publishedId = published._id;
    deletedId = deleted._id;
  });

  it("已删除漫画的公开请求返回 404，不签发 CDN URL", async () => {
    const res = await fetch(baseUrl + "/api/v1/comics/" + deletedId);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.code, "COMIC_NOT_FOUND");
  });

  it("已发布漫画正常返回 CDN URL", async () => {
    const res = await fetch(baseUrl + "/api/v1/comics/" + publishedId);
    assert.equal(res.status, 200);
    const body = await res.json();
    assertIsSignedCdnUrl(body.cover, "cover");
  });
});