import PropTypes from 'prop-types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, FolderKanban, Images, LogOut, MessageSquare, Plus, Tags, Trash2 } from 'lucide-react';
import { adminAuthApi, contentApi } from '../api';
import { createContentPayload, moveTopicEpisode } from '../content/payload';
import { collectCursorPages } from '../content/pagination';
import { Button } from './ui/button';
import { Input } from './ui/input';
import Dialog from './Dialog';
import ImageUploader from './ImageUploader';
import Toast from './Toast';

const NAVIGATION = [
  { key: 'tags', label: '主题标签', icon: Tags },
  { key: 'series', label: '漫画系列', icon: BookOpen },
  { key: 'episodes', label: '漫画单话', icon: Images },
  { key: 'topics', label: '运营专题', icon: FolderKanban },
  { key: 'comments', label: '评论处置', icon: MessageSquare },
];

const EMPTY_ITEMS = { tags: [], series: [], episodes: [], topics: [], comments: [] };

function getEmptyForm(resource) {
  if (resource === 'tags') return { name: '', sortOrder: 0 };
  if (resource === 'series') return { name: '', summary: '', authorByline: '' };
  if (resource === 'topics') return { title: '', summary: '', coverImageUrl: '', episodeIds: [] };
  return {
    seriesId: '',
    title: '',
    summary: '',
    themeTagId: '',
    panels: [1, 2, 3, 4].map((position) => ({ position, imageUrl: '', altText: '' })),
  };
}

function getResourceLabel(resource) {
  return NAVIGATION.find((item) => item.key === resource)?.label || '内容';
}

function getErrorMessage(error) {
  return error?.message || '操作失败，请稍后重试。';
}

function formatStatus(status) {
  return { draft: '草稿', published: '已发布', unpublished: '已下架' }[status] || status;
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
}

export default function ContentConsole({ onLogout }) {
  const [activeResource, setActiveResource] = useState('episodes');
  const [items, setItems] = useState(EMPTY_ITEMS);
  const [isLoading, setIsLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState(null);
  const [dialogState, setDialogState] = useState(null);
  const [commentView, setCommentView] = useState('active');
  const requestGenerationRef = useRef(0);
  const currentQueryRef = useRef({ resource: 'episodes', commentView: 'active' });

  const loadResources = useCallback(async (query = currentQueryRef.current) => {
    const resource = query.resource;
    const view = query.commentView;
    const requestGeneration = requestGenerationRef.current + 1;
    requestGenerationRef.current = requestGeneration;
    setIsLoading(true);
    try {
      if (resource === 'tags') {
        const tags = await contentApi.listTags();
        if (requestGeneration !== requestGenerationRef.current) return;
        setItems((current) => ({ ...current, tags: tags.items }));
        setNextCursor(null);
      } else if (resource === 'series') {
        const series = await contentApi.listSeries();
        if (requestGeneration !== requestGenerationRef.current) return;
        setItems((current) => ({ ...current, series: series.items }));
        setNextCursor(series.nextCursor);
      } else if (resource === 'episodes') {
        const [episodes, series, tags] = await Promise.all([
          contentApi.listEpisodes(), collectCursorPages(contentApi.listSeries.bind(contentApi)), contentApi.listTags(),
        ]);
        if (requestGeneration !== requestGenerationRef.current) return;
        setItems((current) => ({ ...current, episodes: episodes.items, series, tags: tags.items }));
        setNextCursor(episodes.nextCursor);
      } else if (resource === 'comments') {
        const comments = await contentApi.listComments({ view });
        if (requestGeneration !== requestGenerationRef.current) return;
        setItems((current) => ({ ...current, comments: comments.items }));
        setNextCursor(comments.nextCursor);
      } else {
        const [topics, episodes] = await Promise.all([
          contentApi.listTopics(),
          collectCursorPages((params) => contentApi.listEpisodes({ ...params, status: 'published' })),
        ]);
        if (requestGeneration !== requestGenerationRef.current) return;
        setItems((current) => ({ ...current, topics: topics.items, episodes }));
        setNextCursor(topics.nextCursor);
      }
    } catch (error) {
      if (requestGeneration === requestGenerationRef.current) Toast.Error(getErrorMessage(error));
    } finally {
      if (requestGeneration === requestGenerationRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadResources({ resource: activeResource, commentView });
  }, [activeResource, commentView, loadResources]);

  async function loadNextPage() {
    if (!nextCursor) return;
    const query = currentQueryRef.current;

    const requestGeneration = requestGenerationRef.current + 1;
    requestGenerationRef.current = requestGeneration;
    setIsLoading(true);
    try {
      const response = query.resource === 'series'
        ? await contentApi.listSeries({ cursor: nextCursor })
        : query.resource === 'episodes'
        ? await contentApi.listEpisodes({ cursor: nextCursor })
        : query.resource === 'comments'
          ? await contentApi.listComments({ view: query.commentView, cursor: nextCursor })
          : await contentApi.listTopics({ cursor: nextCursor });
      if (requestGeneration !== requestGenerationRef.current) return;
      setItems((current) => ({
        ...current,
        [activeResource]: [...current[activeResource], ...response.items],
      }));
      setNextCursor(response.nextCursor);
    } catch (error) {
      if (requestGeneration === requestGenerationRef.current) Toast.Error(getErrorMessage(error));
    } finally {
      if (requestGeneration === requestGenerationRef.current) setIsLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await adminAuthApi.logout();
    } catch (error) {
      Toast.Warning('服务端会话退出失败，本地登录状态已清除。');
    } finally {
      localStorage.removeItem('admin-session-token');
      localStorage.removeItem('admin-username');
      onLogout();
    }
  }

  function handleResourceChange(resource) {
    if (resource === activeResource) return;
    requestGenerationRef.current += 1;
    currentQueryRef.current = { resource, commentView };
    setActiveResource(resource);
    setDialogState(null);
    setNextCursor(null);
  }

  function handleCommentViewChange(view) {
    if (view === commentView) return;
    requestGenerationRef.current += 1;
    currentQueryRef.current = { resource: activeResource, commentView: view };
    setItems((current) => ({ ...current, comments: [] }));
    setNextCursor(null);
    setCommentView(view);
  }

  async function handleEdit(item) {
    if (activeResource !== 'topics') {
      setDialogState({ resource: activeResource, item });
      return;
    }

    try {
      const { topic } = await contentApi.getTopic(item.id);
      setDialogState({ resource: activeResource, item: topic });
    } catch (error) {
      Toast.Error(getErrorMessage(error));
    }
  }

  async function handleDelete(resource, item) {
    await Dialog.alert({
      title: `删除${getResourceLabel(resource)}`,
      description: '删除后无法恢复，请确认当前内容不再需要。',
      okText: '确认删除',
      okType: 'danger',
      showIcon: true,
      onOk: async () => {
        try {
          await contentApi[`delete${resource === 'series' ? 'Series' : resource === 'tags' ? 'Tag' : resource === 'episodes' ? 'Episode' : 'Topic'}`](item.id);
          Toast.Success('已删除。');
          await loadResources();
        } catch (error) {
          Toast.Error(getErrorMessage(error));
          throw error;
        }
      },
    });
  }

  async function handleDeleteComment(comment) {
    await Dialog.alert({
      title: '删除评论',
      description: '该操作会软删除评论，读者端后续请求将不可见，审计记录会保留。',
      okText: '确认删除',
      okType: 'danger',
      showIcon: true,
      onOk: async () => {
        try {
          await contentApi.deleteComment(comment.id);
          Toast.Success('评论已软删除。');
          await loadResources(currentQueryRef.current);
        } catch (error) {
          Toast.Error(getErrorMessage(error));
          throw error;
        }
      },
    });
  }

  async function handleEpisodeTransition(episode) {
    const shouldUnpublish = episode.status === 'published';
    await Dialog.alert({
      title: shouldUnpublish ? '下架单话' : '发布单话',
      description: shouldUnpublish ? '下架后读者端将不可访问，历史互动会被保留。' : '发布后单话将立即对读者端可见。',
      okText: shouldUnpublish ? '确认下架' : '确认发布',
      okType: shouldUnpublish ? 'danger' : 'default',
      showIcon: true,
      onOk: async () => {
        try {
          if (shouldUnpublish) await contentApi.unpublishEpisode(episode.id);
          else await contentApi.publishEpisode(episode.id);
          Toast.Success(shouldUnpublish ? '单话已下架。' : '单话已发布。');
          await loadResources();
        } catch (error) {
          Toast.Error(getErrorMessage(error));
          throw error;
        }
      },
    });
  }

  const headerTitle = useMemo(() => getResourceLabel(activeResource), [activeResource]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-[1440px]">
        <aside className="hidden w-60 shrink-0 border-r border-border bg-primary p-5 text-primary-foreground lg:block">
          <div className="border-b border-white/15 pb-6">
            <p className="text-[11px] font-bold tracking-[0.28em] text-primary-foreground/65">FOUR PANEL</p>
            <h1 className="mt-2 text-xl font-black tracking-tight">漫画编辑台</h1>
          </div>
          <nav className="mt-6 space-y-2" aria-label="内容运营导航">
            {NAVIGATION.map(({ key, label, icon: Icon }) => (
              <button key={key} type="button" onClick={() => handleResourceChange(key)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${activeResource === key ? 'bg-secondary text-primary' : 'text-primary-foreground/85 hover:bg-primary-foreground/10'}`}>
                <Icon className="h-4 w-4" />{label}
              </button>
            ))}
          </nav>
          <button type="button" onClick={handleLogout} className="mt-auto flex w-full translate-y-[calc(100vh-370px)] items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-primary-foreground/85 hover:bg-primary-foreground/10">
            <LogOut className="h-4 w-4" />退出登录
          </button>
        </aside>
        <section className="min-w-0 flex-1 p-5 sm:p-8">
          <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
            <div>
              <p className="text-xs font-bold tracking-[0.18em] text-muted-foreground">内容与图片运营</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-primary">{headerTitle}</h2>
              <p className="mt-2 text-sm text-muted-foreground">维护作品信息、画格图片及读者端可见状态。</p>
            </div>
            {activeResource !== 'comments' && <Button onClick={() => setDialogState({ resource: activeResource, item: null })} leftIcon={<Plus />}>新增{headerTitle}</Button>}
          </header>
          <div className="mt-6 lg:hidden"><select value={activeResource} onChange={(event) => handleResourceChange(event.target.value)} className="h-10 rounded-lg border border-border bg-white px-3 text-sm">{NAVIGATION.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></div>
          {activeResource === 'comments' && <div className="mt-6 flex gap-2" role="group" aria-label="评论视图"><Button size="sm" variant={commentView === 'active' ? 'default' : 'outline'} aria-pressed={commentView === 'active'} onClick={() => handleCommentViewChange('active')}>有效评论</Button><Button size="sm" variant={commentView === 'deleted' ? 'default' : 'outline'} aria-pressed={commentView === 'deleted'} onClick={() => handleCommentViewChange('deleted')}>已删除评论</Button></div>}
          <ResourceTable resource={activeResource} items={items[activeResource]} isLoading={isLoading} commentView={commentView} onEdit={handleEdit} onDelete={handleDelete} onDeleteComment={handleDeleteComment} onTransition={handleEpisodeTransition} />
          {nextCursor && <div className="mt-5 text-center"><Button variant="outline" loading={isLoading} onClick={loadNextPage}>加载更多</Button></div>}
        </section>
      </div>
      {dialogState && <ContentEditor resource={dialogState.resource} item={dialogState.item} tags={items.tags} series={items.series} episodes={items.episodes} onClose={() => setDialogState(null)} onSaved={async () => { setDialogState(null); await loadResources(); }} />}
    </main>
  );
}

function ResourceTable({ resource, items, isLoading, commentView, onEdit, onDelete, onDeleteComment, onTransition }) {
  if (isLoading) return <p className="mt-10 text-sm text-muted-foreground">正在加载内容…</p>;
  if (!items.length) return <p className="mt-10 rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">{resource === 'comments' ? `暂无${commentView === 'deleted' ? '已删除' : '有效'}评论。` : `暂无${getResourceLabel(resource)}，可从右上角新增。`}</p>;
  if (resource === 'comments') {
    return <div className="mt-6 overflow-x-auto rounded-2xl border border-border bg-card shadow-sm"><table className="w-full min-w-[820px] text-left text-sm"><thead className="border-b border-border bg-muted text-xs font-bold text-muted-foreground"><tr><th className="px-5 py-4">评论正文</th><th className="px-5 py-4">读者</th><th className="px-5 py-4">所属单话</th><th className="px-5 py-4">创建时间</th>{commentView === 'deleted' && <><th className="px-5 py-4">删除时间</th><th className="px-5 py-4">删除角色</th><th className="px-5 py-4">操作主体 ID</th></>}{commentView === 'active' && <th className="px-5 py-4 text-right">操作</th>}</tr></thead><tbody>{items.map((comment) => <tr key={comment.id} className="border-b border-border/60 last:border-0"><td className="max-w-md break-words px-5 py-4 font-medium text-foreground">{comment.content || '—'}</td><td className="px-5 py-4 text-muted-foreground">{comment.author?.displayName || comment.author?.id || '读者信息不可用'}</td><td className="px-5 py-4 text-muted-foreground">{comment.episode?.title || comment.episode?.id || '单话信息不可用'}</td><td className="whitespace-nowrap px-5 py-4 text-muted-foreground">{formatDateTime(comment.createdAt)}</td>{commentView === 'deleted' && <><td className="whitespace-nowrap px-5 py-4 text-muted-foreground">{formatDateTime(comment.audit?.deletedAt)}</td><td className="px-5 py-4 text-muted-foreground">{comment.audit?.deletedBy?.role === 'admin' ? '管理员' : comment.audit?.deletedBy?.role === 'reader' ? '读者' : comment.audit?.deletedBy?.role || '—'}</td><td className="px-5 py-4 font-mono text-xs text-muted-foreground">{comment.audit?.deletedBy?.id || '—'}</td></>}{commentView === 'active' && <td className="px-5 py-4 text-right"><Button size="sm" variant="ghost" className="text-destructive" aria-label="删除评论" onClick={() => onDeleteComment(comment)}><Trash2 /></Button></td>}</tr>)}</tbody></table></div>;
  }

  return <div className="mt-6 overflow-x-auto rounded-2xl border border-border bg-card shadow-sm"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-b border-border bg-muted text-xs font-bold text-muted-foreground"><tr><th className="px-5 py-4">名称</th><th className="px-5 py-4">说明</th><th className="px-5 py-4">状态</th><th className="px-5 py-4 text-right">操作</th></tr></thead><tbody>{items.map((item) => <tr key={item.id} className="border-b border-border/60 last:border-0"><td className="px-5 py-4 font-bold text-primary">{item.name || item.title}</td><td className="max-w-md px-5 py-4 text-muted-foreground">{resource === 'tags' ? `排序 ${item.sortOrder}` : resource === 'series' ? `${item.authorByline} · ${item.episodeCount || 0} 话` : resource === 'episodes' ? item.summary || '未填写简介' : `${item.episodeCount || 0} 话 · ${item.summary || '未填写简介'}`}</td><td className="px-5 py-4">{resource === 'episodes' ? <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-primary">{formatStatus(item.status)}</span> : '—'}</td><td className="px-5 py-4 text-right"><div className="flex justify-end gap-2">{resource === 'episodes' && <Button size="sm" variant="outline" onClick={() => onTransition(item)}>{item.status === 'published' ? '下架' : '发布'}</Button>}{!(resource === 'episodes' && item.status === 'published') && <Button size="sm" variant="ghost" onClick={() => onEdit(item)}>编辑</Button>}{resource === 'episodes' && item.status === 'published' && <span className="self-center text-xs text-muted-foreground">先下架后编辑</span>}{(resource !== 'episodes' || item.status === 'draft') && <Button size="sm" variant="ghost" className="text-destructive" aria-label={`删除${item.name || item.title}`} onClick={() => onDelete(resource, item)}><Trash2 /></Button>}</div></td></tr>)}</tbody></table></div>;
}

function ContentEditor({ resource, item, tags, series, episodes, onClose, onSaved }) {
  const [form, setForm] = useState(item ? { ...item, panels: item.panels?.map((panel) => ({ ...panel })), episodeIds: item.episodeIds || [] } : getEmptyForm(resource));

  function updateForm(name, value) { setForm((current) => ({ ...current, [name]: value })); }
  function updatePanel(index, key, value) { setForm((current) => ({ ...current, panels: current.panels.map((panel, panelIndex) => panelIndex === index ? { ...panel, [key]: value } : panel) })); }

  async function saveResource() {
    try {
      if (resource === 'episodes' && form.panels.some((panel) => !panel.imageUrl)) throw new Error('请先上传完整的四张画格图片。');
      if (resource === 'topics' && !form.coverImageUrl) throw new Error('请先上传专题封面。');
      const payload = createContentPayload(resource, form);
      const methodName = item ? `update${resource === 'series' ? 'Series' : resource === 'tags' ? 'Tag' : resource === 'episodes' ? 'Episode' : 'Topic'}` : `create${resource === 'series' ? 'Series' : resource === 'tags' ? 'Tag' : resource === 'episodes' ? 'Episode' : 'Topic'}`;
      if (item) await contentApi[methodName](item.id, payload);
      else await contentApi[methodName](payload);
      Toast.Success(item ? '修改已保存。' : '已保存为草稿或内容记录。');
      await onSaved();
    } catch (error) {
      Toast.Error(getErrorMessage(error));
      throw error;
    }
  }

  return <Dialog isOpen onClose={onClose} title={`${item ? '编辑' : '新增'}${getResourceLabel(resource)}`} widthClass="max-w-4xl" onOk={saveResource} okText="保存" cancelText="取消"><div className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">{resource === 'tags' && <><Field label="标签名称"><Input value={form.name} onChange={(event) => updateForm('name', event.target.value)} required /></Field><Field label="排序"><Input type="number" min="0" value={form.sortOrder} onChange={(event) => updateForm('sortOrder', Number(event.target.value))} required /></Field></>}{resource === 'series' && <><Field label="系列名称"><Input value={form.name} onChange={(event) => updateForm('name', event.target.value)} required /></Field><Field label="作者署名"><Input value={form.authorByline} onChange={(event) => updateForm('authorByline', event.target.value)} required /></Field><Field label="系列简介"><textarea className="min-h-28 w-full rounded-xl border border-border bg-card p-3 text-sm" value={form.summary} onChange={(event) => updateForm('summary', event.target.value)} required /></Field></>}{resource === 'episodes' && <EpisodeFields form={form} series={series} tags={tags} onChange={updateForm} onPanelChange={updatePanel} />}{resource === 'topics' && <TopicFields form={form} episodes={episodes} onChange={updateForm} />}</div></Dialog>;
}

function EpisodeFields({ form, series, tags, onChange, onPanelChange }) {
  return <><div className="grid gap-4 sm:grid-cols-2"><Field label="漫画系列"><select className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm" value={form.seriesId} onChange={(event) => onChange('seriesId', event.target.value)} required><option value="">请选择</option>{series.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="主题标签"><select className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm" value={form.themeTagId} onChange={(event) => onChange('themeTagId', event.target.value)} required><option value="">请选择</option>{tags.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field></div><Field label="单话标题"><Input value={form.title} onChange={(event) => onChange('title', event.target.value)} required /></Field><Field label="单话简介"><textarea className="min-h-24 w-full rounded-xl border border-border bg-card p-3 text-sm" value={form.summary || ''} onChange={(event) => onChange('summary', event.target.value)} /></Field><div><p className="text-xs font-semibold text-foreground">四格画面</p><p className="mt-1 text-xs text-muted-foreground">四张图片按顺序保存；未完整上传时无法发布。</p><div className="mt-3 grid gap-4 sm:grid-cols-2">{form.panels.map((panel, index) => <div key={panel.position} className="rounded-xl border border-border p-3"><ImageUploader label={`第 ${panel.position} 格`} value={panel.imageUrl} onChange={(url) => onPanelChange(index, 'imageUrl', url)} /><Input className="mt-3" placeholder="图片替代文字（可选）" value={panel.altText || ''} onChange={(event) => onPanelChange(index, 'altText', event.target.value)} /></div>)}</div></div></>;
}

function TopicFields({ form, episodes, onChange }) {
  function toggleEpisode(episodeId) { onChange('episodeIds', form.episodeIds.includes(episodeId) ? form.episodeIds.filter((id) => id !== episodeId) : [...form.episodeIds, episodeId]); }
  function reorderEpisode(episodeId, offset) { onChange('episodeIds', moveTopicEpisode(form.episodeIds, episodeId, offset)); }
  const selectedEpisodes = form.episodeIds.map((episodeId) => episodes.find((episode) => episode.id === episodeId)).filter(Boolean);
  return <><Field label="专题标题"><Input value={form.title} onChange={(event) => onChange('title', event.target.value)} required /></Field><Field label="专题简介"><textarea className="min-h-24 w-full rounded-xl border border-border bg-card p-3 text-sm" value={form.summary || ''} onChange={(event) => onChange('summary', event.target.value)} /></Field><ImageUploader label="专题独立封面" value={form.coverImageUrl} onChange={(url) => onChange('coverImageUrl', url)} /><fieldset><legend className="text-xs font-semibold text-foreground">收录已发布单话</legend><div className="mt-2 max-h-52 space-y-2 overflow-y-auto rounded-xl border border-border p-3">{episodes.length ? episodes.map((episode) => <label key={episode.id} className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={form.episodeIds.includes(episode.id)} onChange={() => toggleEpisode(episode.id)} />{episode.title}</label>) : <p className="text-sm text-muted-foreground">暂无可收录的已发布单话。</p>}</div></fieldset>{selectedEpisodes.length > 0 && <section><p className="text-xs font-semibold text-foreground">专题内展示顺序</p><div className="mt-2 space-y-2">{selectedEpisodes.map((episode, index) => <div key={episode.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"><span>{index + 1}. {episode.title}</span><span className="flex gap-1"><Button size="sm" variant="ghost" disabled={index === 0} onClick={() => reorderEpisode(episode.id, -1)}>上移</Button><Button size="sm" variant="ghost" disabled={index === selectedEpisodes.length - 1} onClick={() => reorderEpisode(episode.id, 1)}>下移</Button></span></div>)}</div></section>}</>;
}

function Field({ label, children }) { return <label className="block space-y-2"><span className="text-xs font-semibold text-foreground">{label}</span>{children}</label>; }

ContentConsole.propTypes = { onLogout: PropTypes.func.isRequired };
ResourceTable.propTypes = { resource: PropTypes.string.isRequired, items: PropTypes.array.isRequired, isLoading: PropTypes.bool.isRequired, commentView: PropTypes.string.isRequired, onEdit: PropTypes.func.isRequired, onDelete: PropTypes.func.isRequired, onDeleteComment: PropTypes.func.isRequired, onTransition: PropTypes.func.isRequired };
ContentEditor.propTypes = { resource: PropTypes.string.isRequired, item: PropTypes.object, tags: PropTypes.array.isRequired, series: PropTypes.array.isRequired, episodes: PropTypes.array.isRequired, onClose: PropTypes.func.isRequired, onSaved: PropTypes.func.isRequired };
EpisodeFields.propTypes = { form: PropTypes.object.isRequired, series: PropTypes.array.isRequired, tags: PropTypes.array.isRequired, onChange: PropTypes.func.isRequired, onPanelChange: PropTypes.func.isRequired };
TopicFields.propTypes = { form: PropTypes.object.isRequired, episodes: PropTypes.array.isRequired, onChange: PropTypes.func.isRequired };
Field.propTypes = { label: PropTypes.string.isRequired, children: PropTypes.node.isRequired };
