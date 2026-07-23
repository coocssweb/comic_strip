import React from 'react';
import PropTypes from 'prop-types';
import Dialog from './Dialog';

export default function SessionExpiryWarningModal({
  isOpen,
  remainingSeconds,
  onContinue,
  onLogout,
  isLoading,
  errorMsg,
}) {
  const formatTime = (seconds) => {
    if (seconds == null || seconds < 0) return '0分0秒';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}分${secs}秒`;
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={() => {}} // Non-closable by clicking mask or X
      closable={false}
      maskClosable={false}
      title="管理会话即将到期"
      onOk={onContinue}
      okText="继续使用"
      okLoading={isLoading}
      onCancel={onLogout}
      cancelText="重新登录"
    >
      <div className="py-2 space-y-4">
        {errorMsg && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {errorMsg}
          </div>
        )}

        <p className="text-sm text-slate-300">
          为了保障账户安全，系统检测到您的管理会话即将在{' '}
          <span className="font-semibold text-amber-400 font-mono">
            {formatTime(remainingSeconds)}
          </span>{' '}
          后到期。
        </p>
        <p className="text-xs text-slate-400">
          点击“继续使用”将向服务器确认并延长空闲会话期限。
        </p>
      </div>
    </Dialog>
  );
}

SessionExpiryWarningModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  remainingSeconds: PropTypes.number,
  onContinue: PropTypes.func.isRequired,
  onLogout: PropTypes.func.isRequired,
  isLoading: PropTypes.bool,
  errorMsg: PropTypes.string,
};
