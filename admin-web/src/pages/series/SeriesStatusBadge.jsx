import React from 'react';
import PropTypes from 'prop-types';
import { cn } from '@/utils/cn';

// 状态 → 标签文案与样式映射（与漫画状态标签保持一致风格）
const STATUS_MAP = {
  draft: {
    label: '草稿',
    className: 'bg-muted text-muted-foreground',
  },
  published: {
    label: '已发布',
    className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400',
  },
  unpublished: {
    label: '已下架',
    className: 'bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400',
  },
  deleted: {
    label: '已删除',
    className: 'bg-red-100/60 text-red-600/80 dark:bg-red-950/40 dark:text-red-400/70',
  },
};

/**
 * 连载状态标签
 * 草稿=默认灰、已发布=绿色、已下架=橙色、已删除=红色半透明
 */
const SeriesStatusBadge = ({ status, className }) => {
  const config = STATUS_MAP[status] || STATUS_MAP.draft;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        config.className,
        className,
      )}
    >
      {config.label}
    </span>
  );
};

SeriesStatusBadge.propTypes = {
  status: PropTypes.oneOf(['draft', 'published', 'unpublished', 'deleted']).isRequired,
  className: PropTypes.string,
};

export default SeriesStatusBadge;
