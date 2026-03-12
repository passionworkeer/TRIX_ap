import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GlassPanel from './GlassPanel';
import { getErrorMessage } from '../utils/errorHandler';
import { FRIEND_VALIDATION, validateString, getValidationErrorMessage, sanitizeString } from '../lib/validation';
import { iosBackdropMotion, iosSheetMotion } from '../utils/iosMotion';

interface AddFriendModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (account: string) => Promise<void>;
}

const AddFriendModal: React.FC<AddFriendModalProps> = ({ isOpen, onClose, onSend }) => {
  const [account, setAccount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSend = async () => {
    setError('');
    setSuccess('');

    // Validate account
    const validationError = validateString(account, FRIEND_VALIDATION.account, 'account');
    if (validationError) {
      setError(getValidationErrorMessage(validationError));
      return;
    }

    setLoading(true);
    try {
      await onSend(sanitizeString(account, FRIEND_VALIDATION.account.max));
      setSuccess('好友请求已发送！');
      setAccount('');
    } catch (e: unknown) {
      setError(getErrorMessage(e, '发送失败'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          {...iosBackdropMotion}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 px-4 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            {...iosSheetMotion}
            className="w-full max-w-[340px] relative mx-4"
            onClick={(event) => event.stopPropagation()}
          >
            <GlassPanel className="w-full p-6 flex flex-col items-center">
        <button
          type="button"
          className="ios-pressable ios-icon-button ios-surface-button absolute right-3 top-3 flex items-center justify-center text-gray-400 hover:text-gray-600"
          onClick={onClose}
          aria-label="关闭对话框"
        >
          ×
        </button>
        <h2 id="modal-title" className="text-lg font-bold mb-4">添加好友</h2>
        <label htmlFor="friend-account" className="sr-only">
          对方账号
        </label>
        <input
          id="friend-account"
          className="w-full rounded-2xl border border-white/50 bg-white/75 px-4 py-3 text-slate-900 placeholder:text-slate-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="输入对方账号（邮箱或用户名）"
          value={account}
          onChange={e => setAccount(e.target.value)}
          disabled={loading}
          maxLength={FRIEND_VALIDATION.account.max}
          aria-label="对方账号"
        />
        {error && (
          <div role="alert" aria-live="assertive" className="text-red-500 text-sm mb-2">
            {error}
          </div>
        )}
        {success && (
          <div role="status" aria-live="polite" className="text-green-500 text-sm mb-2">
            {success}
          </div>
        )}
        <button
          type="button"
          className="ios-pressable ios-primary-button mt-2 w-full rounded-2xl py-3 font-bold text-white disabled:opacity-60"
          onClick={handleSend}
          disabled={loading}
        >
          {loading ? '发送中...' : '发送请求'}
        </button>
            </GlassPanel>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AddFriendModal;
