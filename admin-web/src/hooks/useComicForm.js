import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * 漫画编辑表单状态管理
 * 管理标题、连载ID、标签、封面key、正文图片keys等字段，以及脏检测
 * @param {object} initial - 初始值，通常来自 getComicById 的 data
 */
export function useComicForm(initial) {
  const [title, setTitle] = useState(initial?.title || '');
  const [seriesId, setSeriesId] = useState(initial?.seriesId || '');
  const [tags, setTags] = useState(initial?.tags || []);
  const [coverKey, setCoverKey] = useState(initial?.cover || null);
  const [bodyImageKeys, setBodyImageKeys] = useState(initial?.bodyImages || []);
  const [tagInput, setTagInput] = useState('');

  // 标记是否已完成初始值同步（避免首次渲染就认为脏）
  const initializedRef = useRef(false);

  // 当 initial 变化时同步表单值（编辑页首次加载数据）
  useEffect(() => {
    setTitle(initial?.title || '');
    setSeriesId(initial?.seriesId || '');
    setTags(initial?.tags || []);
    setCoverKey(initial?.cover || null);
    setBodyImageKeys(initial?.bodyImages || []);
    initializedRef.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial?._id]); // 仅当漫画 ID 变化时重置

  // 脏检测：比较当前值与初始值
  const isDirty = useCallback(() => {
    if (!initializedRef.current) return false;

    const current = {
      title: title || '',
      seriesId: seriesId || '',
      tags,
      cover: coverKey,
      bodyImages: bodyImageKeys,
    };

    const original = {
      title: initial?.title || '',
      seriesId: initial?.seriesId || '',
      tags: initial?.tags || [],
      cover: initial?.cover || null,
      bodyImages: initial?.bodyImages || [],
    };

    return JSON.stringify(current) !== JSON.stringify(original);
  }, [title, seriesId, tags, coverKey, bodyImageKeys, initial]);

  // 获取变更后的 payload
  const getPayload = useCallback(() => {
    const payload = {};

    if (title !== (initial?.title || '')) payload.title = title;
    if (seriesId !== (initial?.seriesId || '')) payload.seriesId = seriesId || null;
    if (JSON.stringify(tags) !== JSON.stringify(initial?.tags || [])) payload.tags = tags;

    return payload;
  }, [title, seriesId, tags, initial]);

  // 是否有图片变更
  const hasImageChanges = useCallback(() => {
    const coverChanged = coverKey !== (initial?.cover || null);
    const bodyChanged = JSON.stringify(bodyImageKeys) !== JSON.stringify(initial?.bodyImages || []);
    return coverChanged || bodyChanged;
  }, [coverKey, bodyImageKeys, initial]);

  // 添加标签
  const addTag = useCallback((tag) => {
    const trimmed = tag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags((prev) => [...prev, trimmed]);
    }
    setTagInput('');
  }, [tags]);

  // 删除标签
  const removeTag = useCallback((index) => {
    setTags((prev) => prev.filter((_, i) => i !== index));
  }, []);

  return {
    // 表单值
    title,
    setTitle,
    seriesId,
    setSeriesId,
    tags,
    tagInput,
    setTagInput,
    addTag,
    removeTag,
    coverKey,
    setCoverKey,
    bodyImageKeys,
    setBodyImageKeys,

    // 脏检测
    isDirty,
    getPayload,
    hasImageChanges,
  };
}
