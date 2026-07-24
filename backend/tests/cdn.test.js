// CDN 鉴权 URL 签发单元测试 — 验证签名逻辑、过期行为和图片字段替换
// 使用 node:test 原生测试框架，mock COS SDK

import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";

// 在导入 cdn.js 之前 mock cos.js 模块
const mockGetObjectUrl = mock.fn((params, callback) => {
  const domain = params.Domain || ("https://" + params.Bucket + ".cos." + params.Region + ".myqcloud.com");
  const signParam = params.Sign ? "?sign=mock_signature_" + params.Expires : "";
  const url = domain + "/" + params.Key + signParam;
  callback(null, { Url: url });
  return url;
});

// mock createCosClient 返回带 mock getObjectUrl 的对象
const mockCreateCosClient = mock.fn(() => ({
  getObjectUrl: mockGetObjectUrl,
}));

mock.module("../src/utils/cos.js", {
  namedExports: {
    createCosClient: mockCreateCosClient,
    generateStsCredentials: mock.fn(),
    headObject: mock.fn(),
    isKeyInComicNamespace: mock.fn(),
  },
});

// mock 完成后导入被测模块
const { signCdnUrl, signComicImages } = await import("../src/utils/cdn.js");

const testCosConfig = {
  secretId: "test-secret-id",
  secretKey: "test-secret-key",
  bucket: "test-bucket-1234567890",
  region: "ap-guangzhou",
  cdnDomain: "https://cdn.example.com",
};

describe("signCdnUrl", () => {
  it("为有效的 key 生成带签名的 CDN URL", async () => {
    const url = await signCdnUrl(testCosConfig, "comics/test-comic/cover.jpg");

    assert.ok(url.startsWith("https://cdn.example.com/"), "URL 应以 CDN 域名开头");
    assert.ok(url.includes("sign=mock_signature_"), "URL 应包含签名参数");
    assert.ok(url.includes("comics/test-comic/cover.jpg"), "URL 应包含 key 路径");
    assert.ok(url.includes("mock_signature_1800"), "默认过期时间为 1800 秒");
  });

  it("null key 返回 null", async () => {
    const url = await signCdnUrl(testCosConfig, null);
    assert.equal(url, null);
  });

  it("空字符串 key 返回 null", async () => {
    const url = await signCdnUrl(testCosConfig, "");
    assert.equal(url, null);
  });

  it("自定义过期时间", async () => {
    const url = await signCdnUrl(testCosConfig, "comics/test/cover.jpg", 3600);
    assert.ok(url.includes("mock_signature_3600"), "应使用自定义过期时间 3600 秒");
  });

  it("未配置 CDN 域名时回退到 COS 域名", async () => {
    const configNoCdn = { ...testCosConfig, cdnDomain: "" };
    const url = await signCdnUrl(configNoCdn, "comics/test/cover.jpg");

    assert.ok(url.startsWith("https://test-bucket-1234567890.cos.ap-guangzhou.myqcloud.com/"),
      "应回退到 COS 默认域名");
    assert.ok(url.includes("sign=mock_signature_"), "仍应包含签名");
  });
});

describe("signComicImages", () => {
  it("替换 cover 和 bodyImages 为签名 URL", async () => {
    const comic = {
      _id: "test-comic-1",
      title: "测试漫画",
      cover: "comics/test-comic-1/cover.jpg",
      bodyImages: ["comics/test-comic-1/0.jpg", "comics/test-comic-1/1.jpg"],
    };

    const result = await signComicImages(comic, testCosConfig);

    assert.ok(result.cover.startsWith("https://cdn.example.com/"), "封面应为 CDN URL");
    assert.ok(result.cover.includes("sign=mock_signature_"), "封面 URL 应包含签名");
    assert.equal(result.bodyImages.length, 2);
    assert.ok(result.bodyImages[0].startsWith("https://cdn.example.com/"), "正文图片 0 应为 CDN URL");
    assert.ok(result.bodyImages[1].startsWith("https://cdn.example.com/"), "正文图片 1 应为 CDN URL");
  });

  it("null cover 保持 null", async () => {
    const comic = {
      _id: "test-comic-2",
      title: "无封面漫画",
      cover: null,
      bodyImages: [],
    };

    const result = await signComicImages(comic, testCosConfig);

    assert.equal(result.cover, null);
    assert.deepStrictEqual(result.bodyImages, []);
  });

  it("null bodyImages 保持为空数组", async () => {
    const comic = {
      _id: "test-comic-3",
      title: "无正文漫画",
      cover: "comics/test/cover.jpg",
    };

    const result = await signComicImages(comic, testCosConfig);

    assert.ok(result.cover.startsWith("https://cdn.example.com/"));
    assert.deepStrictEqual(result.bodyImages, []);
  });

  it("null comic 对象原样返回", async () => {
    const result = await signComicImages(null, testCosConfig);
    assert.equal(result, null);
  });

  it("不修改原始对象的其他字段", async () => {
    const comic = {
      _id: "test-comic-4",
      title: "原样保留",
      status: "published",
      tags: ["test"],
      cover: "comics/test/cover.jpg",
      bodyImages: [],
    };

    const result = await signComicImages(comic, testCosConfig);

    assert.equal(result._id, "test-comic-4");
    assert.equal(result.title, "原样保留");
    assert.equal(result.status, "published");
    assert.deepStrictEqual(result.tags, ["test"]);
  });
});