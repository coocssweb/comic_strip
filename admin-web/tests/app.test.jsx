jest.mock('../src/api', () => ({
  adminAuthApi: { login: jest.fn(), logout: jest.fn() },
  contentApi: {
    listTags: jest.fn().mockResolvedValue({ items: [] }),
    listSeries: jest.fn().mockResolvedValue({ items: [] }),
    listEpisodes: jest.fn().mockResolvedValue({ items: [] }),
    listTopics: jest.fn().mockResolvedValue({ items: [] }),
  },
  imageUploadApi: { upload: jest.fn() },
}));

import { render, screen } from '@testing-library/react';
import App from '../src/App';

test('未登录时显示管理员登录入口', () => {
  render(<App />);

  expect(screen.getByRole('heading', { name: '四格漫画编辑台' })).toBeInTheDocument();
  expect(screen.getByLabelText('账号')).toBeInTheDocument();
  expect(screen.getByLabelText('密码')).toBeInTheDocument();
});
