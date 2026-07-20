jest.mock('../src/api', () => ({
  adminAuthApi: { login: jest.fn(), logout: jest.fn() },
  contentApi: {
    listTags: jest.fn().mockResolvedValue({ items: [] }),
    listSeries: jest.fn().mockResolvedValue({ items: [] }),
    listEpisodes: jest.fn().mockResolvedValue({ items: [] }),
    listTopics: jest.fn().mockResolvedValue({ items: [] }),
    listComments: jest.fn().mockResolvedValue({ items: [], nextCursor: null }),
    deleteComment: jest.fn().mockResolvedValue({ deleted: true }),
  },
  imageUploadApi: { upload: jest.fn() },
}));

jest.mock('../src/components/Dialog', () => ({
  __esModule: true,
  default: Object.assign(() => null, { alert: jest.fn() }),
}));

jest.mock('../src/components/Toast', () => ({
  __esModule: true,
  default: { Error: jest.fn(), Success: jest.fn(), Warning: jest.fn() },
}));

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { contentApi } from '../src/api';
import Dialog from '../src/components/Dialog';
import Toast from '../src/components/Toast';
import App from '../src/App';

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

async function waitForInitialContentLoad() {
  await waitFor(() => expect(screen.getByText('暂无漫画单话，可从右上角新增。')).toBeInTheDocument());
}

test('未登录时显示管理员登录入口', () => {
  render(<App />);

  expect(screen.getByRole('heading', { name: '四格漫画编辑台' })).toBeInTheDocument();
  expect(screen.getByLabelText('账号')).toBeInTheDocument();
  expect(screen.getByLabelText('密码')).toBeInTheDocument();
});

describe('评论处置', () => {
  const activeComment = {
    id: 'comment-1',
    content: '这是一条有效评论',
    createdAt: '2026-07-20T00:00:00.000Z',
    author: { id: 'reader-1', displayName: '测试读者', avatarUrl: null },
    episode: { id: 'episode-1', title: '第一话', status: 'published' },
    audit: null,
  };

  beforeEach(() => {
    localStorage.setItem('admin-session-token', 'session-token');
    contentApi.listComments.mockReset();
    contentApi.deleteComment.mockReset();
    contentApi.deleteComment.mockResolvedValue({ deleted: true });
    Dialog.alert.mockReset();
    Toast.Error.mockReset();
    Toast.Success.mockReset();
  });

  afterEach(() => {
    localStorage.clear();
  });

  test('进入评论处置时默认请求有效评论，且不显示创建入口', async () => {
    contentApi.listComments.mockResolvedValue({ items: [activeComment], nextCursor: null });
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: '评论处置' }));

    await waitFor(() => expect(contentApi.listComments).toHaveBeenCalledWith({ view: 'active' }));
    expect(screen.getByText('这是一条有效评论')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '新增评论处置' })).not.toBeInTheDocument();
  });

  test('切换已删除评论会重新请求并展示软删除审计信息', async () => {
    contentApi.listComments.mockImplementation(async ({ view }) => ({
      items: view === 'deleted' ? [{
        ...activeComment,
        audit: {
          deletedAt: '2026-07-20T01:00:00.000Z',
          deletedBy: { role: 'admin', id: 'admin-1' },
        },
      }] : [activeComment],
      nextCursor: null,
    }));
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: '评论处置' }));
    await waitFor(() => expect(contentApi.listComments).toHaveBeenCalledWith({ view: 'active' }));
    fireEvent.click(screen.getByRole('button', { name: '已删除评论' }));

    await waitFor(() => expect(contentApi.listComments).toHaveBeenLastCalledWith({ view: 'deleted' }));
    expect(screen.getByText('删除时间')).toBeInTheDocument();
    expect(screen.getByText('管理员')).toBeInTheDocument();
    expect(screen.getByText('admin-1')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '删除评论' })).not.toBeInTheDocument();
  });

  test('确认软删除后刷新当前有效评论视图', async () => {
    contentApi.listComments.mockResolvedValue({ items: [activeComment], nextCursor: null });
    Dialog.alert.mockImplementation(async ({ onOk }) => onOk());
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: '评论处置' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '删除评论' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: '删除评论' }));

    await waitFor(() => expect(contentApi.deleteComment).toHaveBeenCalledWith('comment-1'));
    expect(Dialog.alert).toHaveBeenCalledWith(expect.objectContaining({
      title: '删除评论',
      description: expect.stringContaining('软删除'),
      okType: 'danger',
    }));
    await waitFor(() => expect(contentApi.listComments).toHaveBeenLastCalledWith({ view: 'active' }));
  });

  test('删除在途切换视图后只刷新当前已删除评论视图', async () => {
    const deleteRequest = createDeferred();
    const deletedComment = { ...activeComment, id: 'comment-deleted', content: '已删除评论' };
    contentApi.listComments.mockImplementation(({ view }) => Promise.resolve({
      items: view === 'deleted' ? [deletedComment] : [activeComment],
      nextCursor: null,
    }));
    contentApi.deleteComment.mockReturnValue(deleteRequest.promise);
    Dialog.alert.mockImplementation(({ onOk }) => onOk());
    render(<App />);
    await waitForInitialContentLoad();

    fireEvent.click(screen.getByRole('button', { name: '评论处置' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '删除评论' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: '删除评论' }));
    await waitFor(() => expect(contentApi.deleteComment).toHaveBeenCalledWith('comment-1'));
    fireEvent.click(screen.getByRole('button', { name: '已删除评论' }));
    await waitFor(() => expect(contentApi.listComments).toHaveBeenLastCalledWith({ view: 'deleted' }));

    await act(async () => {
      deleteRequest.resolve({ deleted: true });
    });

    await waitFor(() => expect(contentApi.listComments.mock.calls.filter(([params]) => params.view === 'deleted')).toHaveLength(2));
    expect(contentApi.listComments.mock.calls.filter(([params]) => params.view === 'active')).toHaveLength(1);
    expect(contentApi.listComments).toHaveBeenLastCalledWith({ view: 'deleted' });
  });

  test('视图切换已提交但 effect 尚未同步时不会刷新旧有效评论视图', async () => {
    const deleteRequest = createDeferred();
    const deletedComment = { ...activeComment, id: 'comment-deleted', content: '已删除评论' };
    contentApi.listComments.mockImplementation(({ view }) => Promise.resolve({
      items: view === 'deleted' ? [deletedComment] : [activeComment],
      nextCursor: null,
    }));
    contentApi.deleteComment.mockReturnValue(deleteRequest.promise);
    Dialog.alert.mockImplementation(({ onOk }) => onOk());
    render(<App />);
    await waitForInitialContentLoad();

    fireEvent.click(screen.getByRole('button', { name: '评论处置' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '删除评论' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: '删除评论' }));
    await waitFor(() => expect(contentApi.deleteComment).toHaveBeenCalledWith('comment-1'));

    await act(async () => {
      screen.getByRole('button', { name: '已删除评论' }).dispatchEvent(new MouseEvent('click', { bubbles: true }));
      deleteRequest.resolve({ deleted: true });
    });

    await waitFor(() => expect(contentApi.listComments.mock.calls.filter(([params]) => params.view === 'deleted')).toHaveLength(2));
    expect(contentApi.listComments.mock.calls.filter(([params]) => params.view === 'active')).toHaveLength(1);
  });

  test('有效评论首屏请求晚到时不会覆盖已删除评论视图', async () => {
    const activeRequest = createDeferred();
    const deletedRequest = createDeferred();
    const deletedComment = { ...activeComment, id: 'comment-deleted', content: '已删除评论' };
    contentApi.listComments.mockImplementation(({ view }) => (view === 'active' ? activeRequest.promise : deletedRequest.promise));
    render(<App />);
    await waitForInitialContentLoad();

    fireEvent.click(screen.getByRole('button', { name: '评论处置' }));
    await waitFor(() => expect(contentApi.listComments).toHaveBeenCalledWith({ view: 'active' }));
    fireEvent.click(screen.getByRole('button', { name: '已删除评论' }));
    await waitFor(() => expect(contentApi.listComments).toHaveBeenLastCalledWith({ view: 'deleted' }));

    await act(async () => {
      deletedRequest.resolve({ items: [deletedComment], nextCursor: 'deleted-cursor' });
    });
    await waitFor(() => expect(screen.getByText('已删除评论', { selector: 'td' })).toBeInTheDocument());
    await act(async () => {
      activeRequest.resolve({ items: [activeComment], nextCursor: 'active-cursor' });
    });

    expect(screen.getByText('已删除评论', { selector: 'td' })).toBeInTheDocument();
    expect(screen.queryByText('这是一条有效评论')).not.toBeInTheDocument();
  });

  test('切换视图后忽略旧分页响应，并仅使用新视图游标加载更多', async () => {
    const activePageRequest = createDeferred();
    const deletedRequest = createDeferred();
    const deletedComment = { ...activeComment, id: 'comment-deleted', content: '已删除评论' };
    contentApi.listComments.mockImplementation(({ view, cursor }) => {
      if (view === 'active' && !cursor) return Promise.resolve({ items: [activeComment], nextCursor: 'active-cursor' });
      if (view === 'active') return activePageRequest.promise;
      if (!cursor) return deletedRequest.promise;
      return Promise.resolve({ items: [], nextCursor: null });
    });
    render(<App />);
    await waitForInitialContentLoad();

    fireEvent.click(screen.getByRole('button', { name: '评论处置' }));
    await waitFor(() => expect(screen.getByText('这是一条有效评论', { selector: 'td' })).toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('button', { name: '加载更多' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: '加载更多' }));
    await waitFor(() => expect(contentApi.listComments).toHaveBeenLastCalledWith({ view: 'active', cursor: 'active-cursor' }));
    fireEvent.click(screen.getByRole('button', { name: '已删除评论' }));
    await waitFor(() => expect(contentApi.listComments).toHaveBeenLastCalledWith({ view: 'deleted' }));

    await act(async () => {
      deletedRequest.resolve({ items: [deletedComment], nextCursor: 'deleted-cursor' });
    });
    await act(async () => {
      activePageRequest.resolve({ items: [{ ...activeComment, id: 'comment-2', content: '旧分页评论' }], nextCursor: 'active-next-cursor' });
    });
    await waitFor(() => expect(screen.getByText('已删除评论', { selector: 'td' })).toBeInTheDocument());
    expect(screen.queryByText('旧分页评论')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '加载更多' }));
    await waitFor(() => expect(contentApi.listComments).toHaveBeenLastCalledWith({ view: 'deleted', cursor: 'deleted-cursor' }));
  });

  test('删除失败时提示错误且不刷新评论列表', async () => {
    contentApi.listComments.mockResolvedValue({ items: [activeComment], nextCursor: null });
    contentApi.deleteComment.mockRejectedValue(new Error('删除失败'));
    Dialog.alert.mockImplementation(({ onOk }) => onOk().catch(() => new Promise(() => {})));
    render(<App />);
    await waitForInitialContentLoad();

    fireEvent.click(screen.getByRole('button', { name: '评论处置' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '删除评论' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: '删除评论' }));

    await waitFor(() => expect(Toast.Error).toHaveBeenCalledWith('删除失败'));
    expect(contentApi.listComments).toHaveBeenCalledTimes(1);
  });
});
