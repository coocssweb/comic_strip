import React, { useState } from 'react';
import PropTypes from 'prop-types';
import Dialog from './Dialog';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Input } from './ui/input';

/**
 * 统计字符串的 Unicode 码点数量（非 UTF-16 码元长度）
 */
function codePointLength(str) {
  return [...str].length;
}

export default function ChangePasswordModal({ isOpen, onClose }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { changePassword } = useAuth();
  const navigate = useNavigate();

  const resetForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setErrorMsg('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (!currentPassword) {
      setErrorMsg('请输入当前密码');
      throw new Error('请输入当前密码');
    }
    if (!newPassword) {
      setErrorMsg('请输入新密码');
      throw new Error('请输入新密码');
    }
    const cpLen = codePointLength(newPassword);
    // 前端仅校验 5-28 Unicode 码点；不实现字符组合规则或强度评分
    if (cpLen < 5 || cpLen > 28) {
      setErrorMsg('新密码长度应为 5-28 个字符');
      throw new Error('新密码长度应为 5-28 个字符');
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('两次输入的新密码不一致');
      throw new Error('两次输入的新密码不一致');
    }

    setErrorMsg('');
    setIsLoading(true);

    try {
      await changePassword({ currentPassword, newPassword });
      // 修改成功：useAuth.changePassword 已清除 Redux 中管理员和 CSRF 状态
      resetForm();
      // 跳转 /login 并携带一次性提示，供 LoginPage 通过 location.state 显示
      navigate('/login', {
        replace: true,
        state: { notice: '密码已修改，请重新登录' },
      });
    } catch (err) {
      if (err.code === 'CURRENT_PASSWORD_INVALID') {
        // 当前密码错误：清空当前密码字段，保留新密码字段供用户修正
        setCurrentPassword('');
        setErrorMsg(err.message || '当前密码错误');
      } else if (err.code === 'NETWORK_ERROR') {
        // 网络/服务失败：保留表单供重试
        setErrorMsg(err.message || '网络连接失败，请检查网络后重试');
      } else {
        // 其他后端业务错误（ADMIN_CREDENTIAL_UNCHANGED、ADMIN_CREDENTIAL_CONFLICT 等）：保留表单
        setErrorMsg(err.message || '修改密码失败，请重试');
      }
      // 抛出异常阻止 Dialog 自动关闭，让用户重试
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      title="修改管理员密码"
      onOk={handleSubmit}
      okText="确认修改"
      okLoading={isLoading}
    >
      <form onSubmit={handleSubmit} className="space-y-4 py-2">
        {errorMsg && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
            {errorMsg}
          </div>
        )}

        <div>
          <label
            htmlFor="modal-current-password"
            className="mb-1 block text-sm font-medium text-foreground"
          >
            当前密码
          </label>
          <Input
            variant="form"
            id="modal-current-password"
            type="password"
            name="currentPassword"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="bg-background"
            placeholder="请输入当前密码"
            disabled={isLoading}
          />
        </div>

        <div>
          <label
            htmlFor="modal-new-password"
            className="mb-1 block text-sm font-medium text-foreground"
          >
            新密码
          </label>
          <Input
            variant="form"
            id="modal-new-password"
            type="password"
            name="newPassword"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="bg-background"
            placeholder="5-28 个字符"
            disabled={isLoading}
          />
        </div>

        <div>
          <label
            htmlFor="modal-confirm-password"
            className="mb-1 block text-sm font-medium text-foreground"
          >
            确认新密码
          </label>
          <Input
            variant="form"
            id="modal-confirm-password"
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="bg-background"
            placeholder="再次输入新密码"
            disabled={isLoading}
          />
        </div>
      </form>
    </Dialog>
  );
}

ChangePasswordModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};
