jest.mock('../src/utils/request', () => ({
  get: jest.fn(),
  post: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
}));

import request from '../src/utils/request';
import { adminAuthApi, contentApi, imageUploadApi } from '../src/api';
import { createContentPayload, moveTopicEpisode } from '../src/content/payload';
import { collectCursorPages } from '../src/content/pagination';

describe('管理后台 API 契约', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('管理员登录提交账号和密码', async () => {
    request.post.mockResolvedValue({ sessionToken: 'session-token' });

    await adminAuthApi.login({ username: 'admin', password: 'secret' });

    expect(request.post).toHaveBeenCalledWith('/admin/auth/login', {
      username: 'admin',
      password: 'secret',
    });
  });

  test('发布单话调用专用状态流转端点', async () => {
    request.post.mockResolvedValue({ episode: { id: 'episode-1', status: 'published' } });

    await contentApi.publishEpisode('episode-1');

    expect(request.post).toHaveBeenCalledWith('/admin/episodes/episode-1/publish');
  });

  test('编辑专题前读取详情以保留原有单话顺序', async () => {
    request.get.mockResolvedValue({ topic: { id: 'topic-1', episodeIds: ['episode-1'] } });

    await contentApi.getTopic('topic-1');

    expect(request.get).toHaveBeenCalledWith('/admin/topics/topic-1');
  });

  test('图片上传先获取签名再直传并返回 COS 公网地址', async () => {
    request.post.mockResolvedValue({
      uploadUrl: 'https://upload.example.com/panel.png',
      headers: { 'Content-Type': 'image/png' },
      publicUrl: 'https://cdn.example.com/panel.png',
    });
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
    const file = new File(['panel'], 'panel.png', { type: 'image/png' });

    const imageUrl = await imageUploadApi.upload(file);

    expect(request.post).toHaveBeenCalledWith('/admin/cos/presign', {
      fileName: 'panel.png',
      contentType: 'image/png',
      contentLength: file.size,
    });
    expect(global.fetch).toHaveBeenCalledWith('https://upload.example.com/panel.png', {
      method: 'PUT',
      headers: { 'Content-Type': 'image/png' },
      body: file,
    });
    expect(imageUrl).toBe('https://cdn.example.com/panel.png');
  });

  test('编辑单话只提交接口允许的字段', () => {
    const payload = createContentPayload('episodes', {
      id: 'episode-1', status: 'draft', publishedAt: null, counts: {},
      seriesId: 'series-1', title: '第一话', summary: '', themeTagId: 'tag-1',
      panels: [{ position: 1, imageUrl: 'https://cdn.example.com/1.png', altText: '' }],
    });

    expect(payload).toEqual({
      seriesId: 'series-1', title: '第一话', summary: null, themeTagId: 'tag-1',
      panels: [{ position: 1, imageUrl: 'https://cdn.example.com/1.png', altText: '' }],
    });
  });

  test('专题收录顺序可以上移或下移后按该顺序提交', () => {
    expect(moveTopicEpisode(['episode-1', 'episode-2', 'episode-3'], 'episode-2', -1)).toEqual([
      'episode-2', 'episode-1', 'episode-3',
    ]);
  });

  test('关联选择器会读取所有游标页，避免遗漏可选系列和已发布单话', async () => {
    const loadPage = jest.fn()
      .mockResolvedValueOnce({ items: [{ id: '1' }], nextCursor: 'next-page' })
      .mockResolvedValueOnce({ items: [{ id: '2' }], nextCursor: null });

    await expect(collectCursorPages(loadPage)).resolves.toEqual([{ id: '1' }, { id: '2' }]);
    expect(loadPage).toHaveBeenNthCalledWith(1, undefined);
    expect(loadPage).toHaveBeenNthCalledWith(2, { cursor: 'next-page' });
  });
});
