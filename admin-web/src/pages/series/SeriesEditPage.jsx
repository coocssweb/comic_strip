import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, GripVertical, X, Search, Plus } from 'lucide-react';
import {
  useGetSeriesByIdQuery,
  useUpdateSeriesMutation,
  usePublishSeriesMutation,
  useUnpublishSeriesMutation,
  useDeleteSeriesMutation,
  useRestoreSeriesMutation,
} from '@/store/api/seriesApi';
import { comicsAPI } from '@/api';
import SeriesStatusBadge from './SeriesStatusBadge';
import FocusInput, { Field } from '@/components/FocusInput';
import Dialog from '@/components/Dialog';
import Toast from '@/components/Toast';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

// 状态 → 可用操作按钮配置
function getActionsByStatus(status, handlers) {
  const actions = [];
  if (status === 'draft') {
    actions.push({ key: 'publish', label: '发布', variant: 'default', handler: handlers.publish });
    actions.push({ key: 'delete', label: '删除', variant: 'destructive', handler: handlers.delete });
  } else if (status === 'published') {
    actions.push({ key: 'unpublish', label: '下架', variant: 'outline', handler: handlers.unpublish });
  } else if (status === 'unpublished') {
    actions.push({ key: 'publish', label: '发布', variant: 'default', handler: handlers.publish });
    actions.push({ key: 'delete', label: '删除', variant: 'destructive', handler: handlers.delete });
  } else if (status === 'deleted') {
    actions.push({ key: 'restore', label: '恢复', variant: 'default', handler: handlers.restore });
  }
  return actions;
}

/**
 * 连载编辑页
 * 元信息编辑 + 完结状态 + 成员漫画管理 + 生命周期操作
 */
export default function SeriesEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  // 查询连载详情
  const { data: series, isLoading, isError } = useGetSeriesByIdQuery(id);

  // 表单状态
  const [title, setTitle] = useState('');
  const [isCompleted, setIsCompleted] = useState(false);
  const [memberComics, setMemberComics] = useState([]); // [{comicId, order, title?}]

  // 上次从 API 同步的初始值，用于对比脏状态
  const [initialTitle, setInitialTitle] = useState('');
  const [initialIsCompleted, setInitialIsCompleted] = useState(false);
  const [initialMemberIds, setInitialMemberIds] = useState('');

  // 确认框状态
  const [confirmAction, setConfirmAction] = useState(null);

  // 添加漫画弹窗
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // 保存状态
  const [isSaving, setIsSaving] = useState(false);

  // 拖拽状态
  const [dragIndex, setDragIndex] = useState(null);

  // Mutations
  const [updateSeries] = useUpdateSeriesMutation();
  const [publishSeries] = usePublishSeriesMutation();
  const [unpublishSeries] = useUnpublishSeriesMutation();
  const [deleteSeries] = useDeleteSeriesMutation();
  const [restoreSeries] = useRestoreSeriesMutation();

  // 同步 API 数据到表单
  useEffect(() => {
    if (series) {
      setTitle(series.title || '');
      setIsCompleted(series.isCompleted || false);
      const comics = (series.comics || []).map((entry) => ({
        comicId: entry.comicId || entry._id,
        order: entry.order,
        title: entry.comic?.title || entry.title || '未知漫画',
      }));
      setMemberComics(comics);
      setInitialTitle(series.title || '');
      setInitialIsCompleted(series.isCompleted || false);
      setInitialMemberIds(JSON.stringify(comics.map((c) => c.comicId).sort()));
    }
  }, [series]);

  // 未保存变更检测
  const hasUnsavedChanges = useMemo(() => {
    const titleChanged = title !== initialTitle;
    const completedChanged = isCompleted !== initialIsCompleted;
    const currentIds = JSON.stringify(memberComics.map((c) => c.comicId).sort());
    const membersChanged = currentIds !== initialMemberIds;
    return titleChanged || completedChanged || membersChanged;
  }, [title, isCompleted, memberComics, initialTitle, initialIsCompleted, initialMemberIds]);

  // 浏览器标签页关闭/刷新拦截
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // 搜索漫画（排除已归属其他连载的漫画）
  const handleSearchComics = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const result = await comicsAPI.list({ page: 1, pageSize: 50 });
      const allComics = result.items || [];
      // 过滤：排除已加入当前连载的漫画
      const currentIds = new Set(memberComics.map((c) => c.comicId));
      const filtered = allComics.filter(
        (comic) =>
          comic.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !currentIds.has(comic._id)
      );
      setSearchResults(filtered);
    } catch (err) {
      Toast.Error('搜索漫画失败');
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, memberComics]);

  // 添加漫画到成员列表
  const handleAddComic = (comic) => {
    const newMember = {
      comicId: comic._id,
      order: memberComics.length,
      title: comic.title,
    };
    setMemberComics((prev) => [...prev, newMember]);
    setAddDialogOpen(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  // 移除成员漫画
  const handleRemoveComic = (index) => {
    setMemberComics((prev) => {
      const next = prev.filter((_, i) => i !== index);
      // 重新分配 order
      return next.map((item, i) => ({ ...item, order: i }));
    });
  };

  // 拖拽排序
  const handleDragStart = (index) => {
    setDragIndex(index);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (dropIndex) => {
    if (dragIndex === null || dragIndex === dropIndex) return;
    setMemberComics((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(dropIndex, 0, moved);
      // 重新分配 order
      return next.map((item, i) => ({ ...item, order: i }));
    });
    setDragIndex(null);
  };

  // 状态操作 handlers
  const handlePublish = async () => {
    try {
      await publishSeries(id).unwrap();
      Toast.Success('连载已发布');
    } catch (err) {
      Toast.Error(err?.data?.message || err?.error || '发布失败');
    }
    setConfirmAction(null);
  };

  const handleUnpublish = async () => {
    try {
      await unpublishSeries(id).unwrap();
      Toast.Success('连载已下架');
    } catch (err) {
      Toast.Error(err?.data?.message || err?.error || '下架失败');
    }
    setConfirmAction(null);
  };

  const handleDelete = async () => {
    try {
      await deleteSeries(id).unwrap();
      Toast.Success('连载已删除');
      navigate('/series', { replace: true });
    } catch (err) {
      Toast.Error(err?.data?.message || err?.error || '删除失败');
    }
    setConfirmAction(null);
  };

  const handleRestore = async () => {
    try {
      await restoreSeries(id).unwrap();
      Toast.Success('连载已恢复为草稿');
    } catch (err) {
      Toast.Error(err?.data?.message || err?.error || '恢复失败');
    }
    setConfirmAction(null);
  };

  // 保存修改
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = {};
      if (title !== initialTitle) payload.title = title || '未命名连载';
      if (isCompleted !== initialIsCompleted) payload.isCompleted = isCompleted;

      // 成员漫画全量提交
      const currentIds = JSON.stringify(memberComics.map((c) => c.comicId).sort());
      if (currentIds !== initialMemberIds) {
        payload.comics = memberComics.map((c) => ({ comicId: c.comicId, order: c.order }));
      }

      if (Object.keys(payload).length > 0) {
        await updateSeries({ id, ...payload }).unwrap();
        // 更新初始值引用
        setInitialTitle(title || '未命名连载');
        setInitialIsCompleted(isCompleted);
        setInitialMemberIds(JSON.stringify(memberComics.map((c) => c.comicId).sort()));
      }

      Toast.Success('修改已保存');
    } catch (err) {
      Toast.Error(err?.data?.message || err?.error || '保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  // 确认框操作映射
  const confirmMap = {
    publish: { title: '确认发布', content: '发布后连载将对读者可见，确定要发布吗？', onOk: handlePublish },
    unpublish: { title: '确认下架', content: '下架后连载将不再对读者可见，确定要下架吗？', onOk: handleUnpublish },
    delete: { title: '确认删除', content: '删除后连载将移至回收站，确定要删除吗？', onOk: handleDelete, okType: 'destructive' },
    restore: { title: '确认恢复', content: '恢复后连载将变为草稿状态，确定要恢复吗？', onOk: handleRestore },
  };

  // 加载中
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // 加载失败
  if (isError || !series) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p className="text-sm font-medium">连载不存在或加载失败</p>
        <Button variant="outline" size="sm" onClick={() => navigate('/series')} className="mt-3 rounded-lg">
          返回列表
        </Button>
      </div>
    );
  }

  const actions = getActionsByStatus(series.status, {
    publish: () => setConfirmAction('publish'),
    unpublish: () => setConfirmAction('unpublish'),
    delete: () => setConfirmAction('delete'),
    restore: () => setConfirmAction('restore'),
  });

  return (
    <div className="animate-fade-in-up">
      {/* 顶部区域 */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate('/series')}
            className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            返回列表
          </button>
          <h2 className="text-lg font-extrabold text-foreground">{series.title}</h2>
        </div>
        <div className="flex items-center gap-3">
          <SeriesStatusBadge status={series.status} />
          {actions.map((action) => (
            <Button
              key={action.key}
              variant={action.variant}
              size="sm"
              onClick={action.handler}
              className="rounded-lg text-xs font-bold"
            >
              {action.label}
            </Button>
          ))}
        </div>
      </div>

      {/* 主内容区 */}
      <div className="space-y-6">
        {/* 基本信息 */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-4 text-sm font-semibold text-foreground">基本信息</h3>
          <div className="space-y-5">
            {/* 标题 */}
            <Field label="标题">
              <FocusInput
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="请输入连载标题（1-100 字）"
                maxLength={100}
                required
              />
            </Field>

            {/* 完结状态 */}
            <Field label="已完结">
              <div className="flex items-center gap-3">
                <Switch
                  checked={isCompleted}
                  onCheckedChange={setIsCompleted}
                />
                <span className="text-sm text-muted-foreground">
                  {isCompleted ? '连载已完结' : '连载中'}
                </span>
              </div>
            </Field>
          </div>
        </div>

        {/* 成员漫画管理 */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">
              成员漫画（{memberComics.length}）
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddDialogOpen(true)}
              className="rounded-lg text-xs font-bold"
            >
              <Plus className="h-3.5 w-3.5" />
              添加漫画
            </Button>
          </div>

          {/* 空状态 */}
          {memberComics.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <p className="text-sm font-medium">暂无成员漫画</p>
              <p className="mt-1 text-xs">点击"添加漫画"从已有漫画中选择</p>
            </div>
          )}

          {/* 成员列表 */}
          {memberComics.length > 0 && (
            <div className="space-y-1">
              {memberComics.map((comic, index) => (
                <div
                  key={comic.comicId}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(index)}
                  className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2.5"
                >
                  {/* 拖拽手柄 */}
                  <button
                    type="button"
                    className="cursor-grab text-muted-foreground/50 hover:text-muted-foreground active:cursor-grabbing"
                    title="拖拽排序"
                  >
                    <GripVertical className="h-4 w-4" />
                  </button>

                  {/* 序号 */}
                  <span className="w-6 text-center text-xs font-semibold text-muted-foreground">
                    {index + 1}
                  </span>

                  {/* 漫画标题 */}
                  <span className="flex-1 text-sm font-medium text-foreground truncate">
                    {comic.title}
                  </span>

                  {/* 移除按钮 */}
                  <button
                    type="button"
                    onClick={() => handleRemoveComic(index)}
                    className="rounded p-1 text-muted-foreground/50 hover:bg-muted hover:text-destructive"
                    title="移除"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 底部：保存 + 返回 */}
      <div className="mt-6 flex items-center justify-between">
        <Button
          loading={isSaving}
          onClick={handleSave}
          className="rounded-xl font-bold shadow-md"
        >
          保存修改
        </Button>
        <Button
          variant="ghost"
          onClick={() => navigate('/series')}
          className="text-sm font-medium text-muted-foreground"
        >
          ← 返回列表
        </Button>
      </div>

      {/* 添加漫画弹窗 */}
      {addDialogOpen && (
        <Dialog
          isOpen
          onClose={() => {
            setAddDialogOpen(false);
            setSearchQuery('');
            setSearchResults([]);
          }}
          title="添加漫画"
          widthClass="max-w-lg"
        >
          <div className="space-y-4">
            {/* 搜索栏 */}
            <div className="flex gap-2">
              <FocusInput
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSearchComics();
                  }
                }}
                placeholder="搜索漫画标题..."
              />
              <Button
                variant="outline"
                size="sm"
                loading={isSearching}
                onClick={handleSearchComics}
                className="rounded-lg shrink-0"
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>

            {/* 搜索结果 */}
            {searchResults.length > 0 && (
              <div className="max-h-64 space-y-1 overflow-y-auto">
                {searchResults.map((comic) => (
                  <button
                    key={comic._id}
                    type="button"
                    onClick={() => handleAddComic(comic)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-muted/50"
                  >
                    <span className="flex-1 text-sm font-medium text-foreground truncate">
                      {comic.title}
                    </span>
                    <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}

            {/* 搜索空状态 */}
            {!isSearching && searchQuery && searchResults.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                未找到匹配的漫画
              </p>
            )}
          </div>
        </Dialog>
      )}

      {/* 确认框 */}
      {confirmAction && (
        <Dialog
          isOpen
          onClose={() => setConfirmAction(null)}
          {...confirmMap[confirmAction]}
          cancelText="取消"
        />
      )}
    </div>
  );
}
