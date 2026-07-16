import React from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from "@/components/ui/button";

/**
 * PageHeader 通用高阶页头组件 (Option A / Material 3 Style)
 * 
 * @param {string} title 页面大标题
 * @param {string} [description] 页面描述说明文案
 * @param {function} [onRefresh] 刷新列表的回调函数，若提供则渲染刷新按钮
 * @param {boolean} [refreshLoading=false] 刷新操作的加载状态，控制动画自旋与按钮锁定
 * @param {React.ReactNode} [extraActions] 右侧的其它业务操作按钮插槽
 */
const PageHeader = ({
  title,
  description,
  onRefresh,
  refreshLoading = false,
  extraActions
}) => {
  return (
    <div className="page-header-container bg-transparent pb-5">
      <div>
        <h1 className="page-header-title">{title}</h1>
        {description && <p className="page-header-desc">{description}</p>}
      </div>

      <div className="flex items-center gap-2">
        {onRefresh && (
          <Button
            type="button"
            variant="outline"
            onClick={onRefresh}
            loading={refreshLoading}
            leftIcon={<RefreshCw className="btn-refresh-icon" />}
            className="btn-refresh-unified"
          >
            {refreshLoading ? '正在载入...' : '刷新'}
          </Button>
        )}

        {extraActions}
      </div>
    </div>
  );
};

export default PageHeader;
