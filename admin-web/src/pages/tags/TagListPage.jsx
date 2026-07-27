import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Edit, Trash2, RotateCcw, Star, Play, Pause, Check, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import {
  useGetTagsListQuery,
  useCreateTagMutation,
  useUpdateTagMutation,
  useDeleteTagMutation,
  useRestoreTagMutation,
} from '@/store/api/tagsApi';
import Pagination from '@/components/Pagination';
import Toast from '@/components/Toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const STATUS_TABS = [
  { key: '', label: '全部' },
  { key: 'enabled', label: '启用' },
  { key: 'disabled', label: '停用' },
  { key: 'deleted', label: '已删除' },
];

const STATUS_LABELS = {
  enabled: '启用',
  disabled: '停用',
  deleted: '已删除',
};

function relativeTime(isoString) {
  if (!isoString) return '-';
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return '刚刚';
  if (diffSec < 3600) return Math.floor(diffSec / 60) + ' 分钟前';
  if (diffSec < 86400) return Math.floor(diffSec / 3600) + ' 小时前';
  if (diffSec < 604800) return Math.floor(diffSec / 86400) + ' 天前';
  return new Date(isoString).toLocaleDateString('zh-CN');
}

/**
 * 标签管理列表页
 * 状态筛选 + 推荐筛选 + 创建/编辑/启用停用/软删除/恢复
 */
export default function TagListPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const status = searchParams.get('status') || '';
  const page = parseInt(searchParams.get('page'), 10) || 1;
  const pageSize = 20;

  // 新建标签内联表单状态
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSortOrder, setNewSortOrder] = useState(0);

  // 编辑标签内联状态
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editSortOrder, setEditSortOrder] = useState(0);

  const { data, isLoading, isError, error } = useGetTagsListQuery(
    { status: status || undefined, page, pageSize },
    { refetchOnMountOrArgChange: true },
  );

  const [createTag, { isLoading: isCreatingTag }] = useCreateTagMutation();
  const [updateTag, { isLoading: isUpdating }] = useUpdateTagMutation();
  const [deleteTag, { isLoading: isDeleting }] = useDeleteTagMutation();
  const [restoreTag] = useRestoreTagMutation();

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
    updateParams({ status: newStatus, page: '' });
  };

  const handlePageChange = (nextPage) => {
    updateParams({ page: nextPage });
  };

  // 新建标签
  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await createTag({ name: newName.trim(), sortOrder: newSortOrder }).unwrap();
      Toast.Success('标签创建成功');
      setNewName('');
      setNewSortOrder(0);
      setIsCreating(false);
    } catch (err) {
      Toast.Error(err?.data?.message || '创建失败，请重试');
    }
  };

  // 开始编辑
  const startEdit = (tag) => {
    setEditingId(tag._id);
    setEditName(tag.name);
    setEditSortOrder(tag.sortOrder);
  };

  // 保存编辑
  const saveEdit = async (id) => {
    if (!editName.trim()) return;
    try {
      await updateTag({ id, name: editName.trim(), sortOrder: editSortOrder }).unwrap();
      Toast.Success('保存成功');
      setEditingId(null);
    } catch (err) {
      Toast.Error(err?.data?.message || '保存失败，请重试');
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  // 启用/停用切换
  const toggleStatus = async (tag) => {
    const targetStatus = tag.status === 'enabled' ? 'disabled' : 'enabled';
    const label = targetStatus === 'enabled' ? '启用' : '停用';
    try {
      await updateTag({ id: tag._id, status: targetStatus }).unwrap();
      Toast.Success(`标签已${label}`);
    } catch (err) {
      Toast.Error(err?.data?.message || `${label}失败`);
    }
  };

  // 推荐开关
  const toggleRecommend = async (tag) => {
    try {
      await updateTag({
        id: tag._id,
        isRecommended: !tag.isRecommended,
        recommendedOrder: tag.isRecommended ? 0 : (tag.recommendedOrder || 0),
      }).unwrap();
      Toast.Success(tag.isRecommended ? '已取消推荐' : '已设为推荐');
    } catch (err) {
      Toast.Error(err?.data?.message || '操作失败');
    }
  };

  // 软删除
  const handleDelete = async (id, name) => {
    try {
      await deleteTag(id).unwrap();
      Toast.Success(`标签「${name}」已删除`);
    } catch (err) {
      Toast.Error(err?.data?.message || '删除失败');
    }
  };

  // 恢复
  const handleRestore = async (id, name) => {
    try {
      await restoreTag(id).unwrap();
      Toast.Success(`标签「${name}」已恢复`);
    } catch (err) {
      Toast.Error(err?.data?.message || '恢复失败');
    }
  };

  const totalPages = data ? Math.ceil(data.data.total / data.data.pageSize) : 0;

  return (
    <div className="animate-fade-in-up">
      {/* 顶部：标题 + 新建按钮 */}
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-foreground">标签管理</h2>
        <Button
          onClick={() => setIsCreating(true)}
          disabled={isCreating}
          className="rounded-xl font-bold shadow-md"
        >
          <Plus className="h-4 w-4" />
          新建标签
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
        {!isLoading && !isError && data?.data?.items?.length === 0 && !isCreating && (
          <div className="flex flex-col items-center justify-center py-20">
            <p className="text-sm font-medium text-muted-foreground">暂无标签</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCreating(true)}
              className="mt-3 rounded-lg"
            >
              新建标签
            </Button>
          </div>
        )}

        {/* 数据表格 */}
        {!isLoading && !isError && (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-left">
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">名称</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">状态</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">排序</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">推荐</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">更新时间</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">操作</th>
              </tr>
            </thead>
            <tbody>
              {/* 内联新建行 */}
              {isCreating && (
                <tr className="border-b border-border bg-primary/5">
                  <td className="px-4 py-3">
                    <Input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="标签名称（1-30字）"
                      maxLength={30}
                      className="h-8 w-full rounded-lg text-sm"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreate();
                        if (e.key === 'Escape') { setIsCreating(false); setNewName(''); }
                      }}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      启用
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Input
                      type="number"
                      value={newSortOrder}
                      onChange={(e) => setNewSortOrder(parseInt(e.target.value, 10) || 0)}
                      className="h-8 w-20 rounded-lg text-sm"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-muted-foreground">-</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-muted-foreground">-</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        loading={isCreatingTag}
                        onClick={handleCreate}
                        className="h-8 rounded-lg text-xs font-medium"
                      >
                        <Check className="h-3.5 w-3.5" />
                        确定
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setIsCreating(false); setNewName(''); }}
                        className="h-8 rounded-lg text-xs"
                      >
                        <X className="h-3.5 w-3.5" />
                        取消
                      </Button>
                    </div>
                  </td>
                </tr>
              )}

              {/* 数据行 */}
              {data?.data?.items?.map((tag) => (
                <tr
                  key={tag._id}
                  className={cn(
                    'border-b border-border transition-colors hover:bg-muted/30',
                    tag.status === 'deleted' && 'opacity-60',
                  )}
                >
                  <td className="px-4 py-3">
                    {editingId === tag._id ? (
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        maxLength={30}
                        className="h-8 w-full rounded-lg text-sm"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEdit(tag._id);
                          if (e.key === 'Escape') cancelEdit();
                        }}
                      />
                    ) : (
                      <span className="text-sm font-semibold text-foreground">{tag.name}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                        tag.status === 'enabled' && 'bg-emerald-100 text-emerald-700',
                        tag.status === 'disabled' && 'bg-amber-100 text-amber-700',
                        tag.status === 'deleted' && 'bg-red-100 text-red-700',
                      )}
                    >
                      {STATUS_LABELS[tag.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {editingId === tag._id ? (
                      <Input
                        type="number"
                        value={editSortOrder}
                        onChange={(e) => setEditSortOrder(parseInt(e.target.value, 10) || 0)}
                        className="h-8 w-20 rounded-lg text-sm"
                      />
                    ) : (
                      <span className="text-sm text-muted-foreground">{tag.sortOrder}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {tag.isRecommended ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
                        <Star className="h-3 w-3 fill-current" />
                        推荐
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {relativeTime(tag.updatedAt)}
                  </td>
                  <td className="px-4 py-3">
                    {tag.status === 'deleted' ? (
                      /* 已删除：仅可恢复 */
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRestore(tag._id, tag.name)}
                        className="h-8 rounded-lg text-xs font-medium text-emerald-600 hover:text-emerald-700"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        恢复
                      </Button>
                    ) : editingId === tag._id ? (
                      /* 编辑模式 */
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          loading={isUpdating}
                          onClick={() => saveEdit(tag._id)}
                          className="h-8 rounded-lg text-xs font-medium"
                        >
                          <Check className="h-3.5 w-3.5" />
                          保存
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={cancelEdit}
                          className="h-8 rounded-lg text-xs"
                        >
                          <X className="h-3.5 w-3.5" />
                          取消
                        </Button>
                      </div>
                    ) : (
                      /* 正常模式 */
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEdit(tag)}
                          className="h-8 rounded-lg text-xs font-medium"
                        >
                          <Edit className="h-3.5 w-3.5" />
                          编辑
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleStatus(tag)}
                          className="h-8 rounded-lg text-xs font-medium"
                          title={tag.status === 'enabled' ? '停用' : '启用'}
                        >
                          {tag.status === 'enabled' ? (
                            <Pause className="h-3.5 w-3.5" />
                          ) : (
                            <Play className="h-3.5 w-3.5" />
                          )}
                          {tag.status === 'enabled' ? '停用' : '启用'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleRecommend(tag)}
                          className={cn(
                            'h-8 rounded-lg text-xs font-medium',
                            tag.isRecommended && 'text-violet-600',
                          )}
                          title={tag.isRecommended ? '取消推荐' : '设为推荐'}
                        >
                          <Star className={cn('h-3.5 w-3.5', tag.isRecommended && 'fill-current')} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          loading={isDeleting}
                          onClick={() => handleDelete(tag._id, tag.name)}
                          className="h-8 rounded-lg text-xs font-medium text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          删除
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* 分页 */}
        {!isLoading && !isError && data && data.data.total > 0 && (
          <Pagination
            page={data.data.page}
            limit={data.data.pageSize}
            total={data.data.total}
            totalPages={totalPages}
            onChange={(nextPage) => handlePageChange(nextPage)}
          />
        )}
      </div>
    </div>
  );
}
