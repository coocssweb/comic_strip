import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, X } from 'lucide-react';
import { useGetComicByIdQuery, useUpdateComicMutation, usePublishComicMutation, useUnpublishComicMutation, useDeleteComicMutation, useRestoreComicMutation } from '@/store/api/comicsApi';
import { seriesAPI, imageAPI } from '@/api';
import { useComicForm } from '@/hooks/useComicForm';
import ComicStatusBadge from './ComicStatusBadge';
import { CoverUploader, BodyImagesUploader } from '@/components/ImageUploader';
import FocusInput from '@/components/FocusInput';
import { Field } from '@/components/FocusInput';
import FormSelect from '@/components/FormSelect';
import Dialog from '@/components/Dialog';
import Toast from '@/components/Toast';
import { Button } from '@/components/ui/button';

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
 * 漫画编辑页
 * 元信息编辑 + 封面上传 + 正文图片管理 + 生命周期操作
 */
export default function ComicEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  // 查询漫画详情
  const { data: comic, isLoading, isError } = useGetComicByIdQuery(id);

  // 表单状态
  const form = useComicForm(comic);

  // 连载下拉选项
  const [seriesOptions, setSeriesOptions] = useState([]);

  // 封面 URL
  const [coverPreviewUrl, setCoverPreviewUrl] = useState(null);

  // 正文图片（key + 预览 URL）
  const [bodyImageItems, setBodyImageItems] = useState([]);

  // 确认框状态
  const [confirmAction, setConfirmAction] = useState(null);

  // 保存状态
  const [isSaving, setIsSaving] = useState(false);

  // Mutations
  const [updateComic] = useUpdateComicMutation();
  const [publishComic] = usePublishComicMutation();
  const [unpublishComic] = useUnpublishComicMutation();
  const [deleteComic] = useDeleteComicMutation();
  const [restoreComic] = useRestoreComicMutation();

  // 加载连载列表（供 FormSelect 使用）
  useEffect(() => {
    seriesAPI.list().then((data) => {
      const items = data?.items || [];
      setSeriesOptions(
        items.map((s) => ({ label: s.name, value: s._id })),
      );
    }).catch(() => {
      // 连载列表加载失败不阻塞编辑页
    });
  }, []);

  // 同步封面预览 URL（comic.cover 是 COS key）
  useEffect(() => {
    if (comic?.cover) {
      setCoverPreviewUrl(comic.cover); // COS key 可能直接是可访问 URL
    }
  }, [comic?.cover]);

  // 同步正文图片预览
  useEffect(() => {
    if (comic?.bodyImages) {
      setBodyImageItems(
        comic.bodyImages.map((key) => ({ key, url: key })),
      );
    }
  }, [comic?.bodyImages]);

  // 未保存离开确认：路由守卫 + beforeunload
  const warnIfDirty = useCallback(() => {
    if (form.isDirty() || form.hasImageChanges()) {
      return true;
    }
    return false;
  }, [form]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (warnIfDirty()) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [warnIfDirty]);

  // 状态操作 handlers
  const handlePublish = async () => {
    try {
      await publishComic(id).unwrap();
      Toast.Success('漫画已发布');
    } catch (err) {
      Toast.Error(err.message || '发布失败');
    }
    setConfirmAction(null);
  };

  const handleUnpublish = async () => {
    try {
      await unpublishComic(id).unwrap();
      Toast.Success('漫画已下架');
    } catch (err) {
      Toast.Error(err.message || '下架失败');
    }
    setConfirmAction(null);
  };

  const handleDelete = async () => {
    try {
      await deleteComic(id).unwrap();
      Toast.Success('漫画已删除');
      navigate('/comics', { replace: true });
    } catch (err) {
      Toast.Error(err.message || '删除失败');
    }
    setConfirmAction(null);
  };

  const handleRestore = async () => {
    try {
      await restoreComic(id).unwrap();
      Toast.Success('漫画已恢复为草稿');
    } catch (err) {
      Toast.Error(err.message || '恢复失败');
    }
    setConfirmAction(null);
  };

  // 保存修改
  const handleSave = async () => {
    setIsSaving(true);
    try {
      // 阶段一：保存元信息
      const payload = form.getPayload();
      if (Object.keys(payload).length > 0) {
        await updateComic({ id, ...payload }).unwrap();
      }

      // 阶段二：如有图片变更，绑定图片
      if (form.hasImageChanges()) {
        await imageAPI.bindImages(id, {
          cover: form.coverKey,
          bodyImages: form.bodyImageKeys,
        });
      }

      Toast.Success('修改已保存');
    } catch (err) {
      Toast.Error(err.message || '保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  // 确认框操作映射
  const confirmMap = {
    publish: { title: '确认发布', content: '发布后漫画将对读者可见，确定要发布吗？', onOk: handlePublish },
    unpublish: { title: '确认下架', content: '下架后漫画将不再对读者可见，确定要下架吗？', onOk: handleUnpublish },
    delete: { title: '确认删除', content: '删除后漫画将移至回收站，确定要删除吗？', onOk: handleDelete, okType: 'destructive' },
    restore: { title: '确认恢复', content: '恢复后漫画将变为草稿状态，确定要恢复吗？', onOk: handleRestore },
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
  if (isError || !comic) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p className="text-sm font-medium">漫画不存在或加载失败</p>
        <Button variant="outline" size="sm" onClick={() => navigate('/comics')} className="mt-3 rounded-lg">
          返回列表
        </Button>
      </div>
    );
  }

  const actions = getActionsByStatus(comic.status, {
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
            onClick={() => {
              if (warnIfDirty()) {
                if (window.confirm('你有未保存的修改，确定要离开吗？')) {
                  navigate('/comics');
                }
              } else {
                navigate('/comics');
              }
            }}
            className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            返回列表
          </button>
          <h2 className="text-lg font-extrabold text-foreground">{comic.title}</h2>
        </div>
        <div className="flex items-center gap-3">
          <ComicStatusBadge status={comic.status} />
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

      {/* 主内容区：左侧表单 + 右侧封面 */}
      <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
        {/* 左侧表单 */}
        <div className="space-y-5 rounded-xl border border-border bg-card p-6">
          {/* 标题 */}
          <Field label="标题">
            <FocusInput
              value={form.title}
              onChange={(e) => form.setTitle(e.target.value)}
              placeholder="请输入漫画标题（1-100 字）"
              maxLength={100}
              required
            />
          </Field>

          {/* 连载 */}
          <Field label="连载">
            <FormSelect
              value={form.seriesId}
              onChange={(val) => form.setSeriesId(val || '')}
              options={[
                { label: '无（独立漫画）', value: '' },
                ...seriesOptions,
              ]}
              placeholder="选择连载系列"
            />
          </Field>

          {/* 标签 */}
          <Field label="标签">
            <div className="space-y-2">
              {/* 已选标签 */}
              {form.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {form.tags.map((tag, index) => (
                    <span
                      key={`${tag}-${index}`}
                      className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => form.removeTag(index)}
                        className="ml-0.5 rounded-full p-0.5 hover:bg-muted"
                        title="移除标签"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {/* 标签输入 */}
              <FocusInput
                value={form.tagInput}
                onChange={(e) => form.setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    form.addTag(form.tagInput);
                  }
                }}
                placeholder="输入标签后按回车添加"
              />
            </div>
          </Field>
        </div>

        {/* 右侧封面 */}
        <div className="rounded-xl border border-border bg-card p-6">
          <p className="mb-3 text-sm font-semibold text-foreground">封面</p>
          <CoverUploader
            comicId={id}
            coverKey={form.coverKey}
            coverUrl={coverPreviewUrl}
            onUploadStart={() => {}}
            onUploadSuccess={(key) => {
              form.setCoverKey(key);
              setCoverPreviewUrl(key);
            }}
            onUploadError={(msg) => Toast.Error(msg)}
          />
        </div>
      </div>

      {/* 正文图片区 */}
      <div className="mt-6 rounded-xl border border-border bg-card p-6">
        <h3 className="mb-4 text-sm font-semibold text-foreground">正文图片</h3>
        <BodyImagesUploader
          comicId={id}
          images={bodyImageItems}
          onAddImage={(key) => {
            const newItems = [...bodyImageItems, { key, url: key }];
            setBodyImageItems(newItems);
            form.setBodyImageKeys(newItems.map((item) => item.key));
          }}
          onRemoveImage={(index) => {
            const newItems = bodyImageItems.filter((_, i) => i !== index);
            setBodyImageItems(newItems);
            form.setBodyImageKeys(newItems.map((item) => item.key));
          }}
          onReorder={(reordered) => {
            setBodyImageItems(reordered);
            form.setBodyImageKeys(reordered.map((item) => item.key));
          }}
          onUploadError={(msg) => Toast.Error(msg)}
        />
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
          onClick={() => {
            if (warnIfDirty()) {
              if (window.confirm('你有未保存的修改，确定要离开吗？')) {
                navigate('/comics');
              }
            } else {
              navigate('/comics');
            }
          }}
          className="text-sm font-medium text-muted-foreground"
        >
          ← 返回列表
        </Button>
      </div>

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
