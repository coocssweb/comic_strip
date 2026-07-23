import React, { useState } from 'react';
import PropTypes from 'prop-types';
import Dialog from './Dialog';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

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

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    if (!currentPassword) {
      const err = new Error('请输入当前密码');
      setErrorMsg(err.message);
      throw err;
    }
    if (!newPassword) {
      const err = new Error('请输入新密码');
      setErrorMsg(err.message);
      throw err;
    }
    if (newPassword.length < 15 || newPassword.length > 128) {
      const err = new Error('新密码长度必须在 15 至 128 个字符之间');
      setErrorMsg(err.message);
      throw err;
    }
    if (newPassword !== confirmPassword) {
      const err = new Error('两次输入的新密码不一致');
      setErrorMsg(err.message);
      throw err;
    }

    setErrorMsg('');
    setIsLoading(true);

    try {
      await changePassword({ currentPassword, newPassword });
      resetForm();
      onClose();
      navigate('/login', {
        replace: true,
        state: { notice: '密码修改成功，请使用新密码重新登录' },
      });
    } catch (err) {
      setErrorMsg(err.message || '修改密码失败，请检查输入');
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
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {errorMsg}
          </div>
        )}

        <div>
          <label
            htmlFor="modal-current-password"
            className="block text-sm font-medium text-slate-300 mb-1"
          >
            当前密码
          </label>
          <input
            id="modal-current-password"
            type="password"
            name="currentPassword"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full px-3.5 py-2 rounded-xl bg-slate-950/60 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            placeholder="请输入当前密码"
          />
        </div>

        <div>
          <label
            htmlFor="modal-new-password"
            className="block text-sm font-medium text-slate-300 mb-1"
          >
            新密码
          </label>
          <input
            id="modal-new-password"
            type="password"
            name="newPassword"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full px-3.5 py-2 rounded-xl bg-slate-950/60 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            placeholder="15-128个字符"
          />
        </div>

        <div>
          <label
            htmlFor="modal-confirm-password"
            className="block text-sm font-medium text-slate-300 mb-1"
          >
            确认新密码
          </label>
          <input
            id="modal-confirm-password"
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-3.5 py-2 rounded-xl bg-slate-950/60 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            placeholder="再次输入新密码"
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
