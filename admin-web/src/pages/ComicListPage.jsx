import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Edit, ImageOff } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useGetComicsListQuery, useCreateComicMutation } from '@/store/api/comicsApi';
import ComicStatusBadge from '@/components/ComicStatusBadge';
import Pagination from '@/components/Pagination';
import Toast from '@/components/Toast';
import { Button } from '@/components/ui/button';

// 状态 Tab 配置
const STATUS_TABS = [
  { key: '', label: '全部' },
  { key: 'draft', label: '草稿' },
  { key: 'published', label: '已发布' },
  { key: 'unpublished', label: '已下架' },
  { key: 'deleted', label: '已删除' },
];

// 封面过期时的占位显示
function CoverThumb({ coverUrl }) {
  const [hasError, setHasError] = React.useState(false);

  if (hasError || !coverUrl) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded bg-muted">
        <ImageOff className="h-5 w-5 text-muted-foreground/50" />
      </div>
    );
  }

  return (
    <img
      src={coverUrl}
      alt="封面"
      className="h-10 w-10 rounded object-cover"
      onError={() => setHasError(true)}
    />
  );
}

// 相对时间格式化
function relativeTime(isoString) {
  if (!isoString) return '-';
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 60) return '刚刚';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} 分钟前`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} 小时前`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)} 天前`;
  return new Date(isoString).toLocaleDateString('zh-CN');
}

/**
 * 漫画列表页
 * 状态 Tab 筛选 + 分页表格 + 新建漫画入口
 */
export default function ComicListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // 从 URL 读取筛选与分页状态
  const status = searchParams.get('status') || '';
  const page = parseInt(searchParams.get('page'), 10) || 1;
  const pageSize = 20;

  // 查询列表
  const { data, isLoading, isError, error } = useGetComicsListQuery(
    { status: status || undefined, page, pageSize },
    { refetchOnMountOrArgChange: true },
  );

  // 创建漫画 mutation
  const [createComic, { isLoading: isCreating }] = useCreateComicMutation();

  // 更新 URL 参数（筛选 + 分页）
  const updateParams = (updates) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value === '' || value === undefined || value === null) {
        next.delete(key);
      } else {
        next.set(key, String(value));
      }
    });
    setSearchParams(next, { replace: true });
  };

  const handleStatusChange = (newStatus) => {
    updateParams({ status: newStatus, page: '' }); // 切换状态时重置页码
  };

  const handlePageChange = (nextPage) => {
    updateParams({ page: nextPage });
  };

  const handleCreateComic = async () => {
    try {
      const comic = await createComic({ title: '未命名漫画' }).unwrap();
      Toast.Success('漫画创建成功');
      navigate(`/comics/${comic._id}`);
    } catch (err) {
      Toast.Error(err.message || '创建失败，请重试');
    }
  };

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;

  return (
    <div className="animate-fade-in-up">
      {/* 顶部：标题 + 新建按钮 */}
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-foreground">漫画管理</h2>
        <Button
          loading={isCreating}
          onClick={handleCreateComic}
          className="rounded-xl font-bold shadow-md"
        >
          <Plus className="h-4 w-4" />
          新建漫画
        </Button>
      </div>

      {/* 状态 Tab */}
      <div className="mb-4 flex gap-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => handleStatusChange(tab.key)}
            className={cn(
              'pill-filter',
              status === tab.key && 'pill-filter-active',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 表格区域 */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {/* 加载中 */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}

        {/* 加载失败 */}
        {isError && !isLoading && (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <p className="text-sm font-medium">加载失败</p>
            <p className="mt-1 text-xs">{error?.message || '请检查网络后重试'}</p>
          </div>
        )}

        {/* 空状态 */}
        {!isLoading && !isError && data?.items?.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <p className="text-sm font-medium text-muted-foreground">暂无漫画</p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCreateComic}
              className="mt-3 rounded-lg"
            >
              新建漫画
            </Button>
          </div>
        )}

        {/* 数据表格 */}
        {!isLoading && !isError && data?.items?.length > 0 && (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-left">
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">封面</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">标题</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">连载</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">状态</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">更新时间</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">操作</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((comic) => (
                <tr
                  key={comic._id}
                  className={cn(
                    'border-b border-border transition-colors hover:bg-muted/30',
                    comic.status === 'deleted' && 'opacity-60',
                  )}
                >
                  <td className="px-4 py-3">
                    <CoverThumb coverUrl={comic.cover} />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className="text-sm font-semibold text-foreground hover:text-primary hover:underline"
                      onClick={() => navigate(`/comics/${comic._id}`)}
                    >
                      {comic.title}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {comic.seriesName || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <ComicStatusBadge status={comic.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {relativeTime(comic.updatedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/comics/${comic._id}`)}
                      className="h-8 rounded-lg text-xs font-medium"
                    >
                      <Edit className="h-3.5 w-3.5" />
                      编辑
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* 分页 */}
        {!isLoading && !isError && data && data.total > 0 && (
          <Pagination
            page={data.page}
            limit={data.pageSize}
            total={data.total}
            totalPages={totalPages}
            onChange={(nextPage) => handlePageChange(nextPage)}
          />
        )}
      </div>
    </div>
  );
}
