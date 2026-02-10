import React, { useState } from 'react';
import GlassPanel from './GlassPanel';

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

  if (!isOpen) return null;

  const handleSend = async () => {
    setError('');
    setSuccess('');
    if (!account.trim()) {
      setError('请输入对方账号（邮箱或用户名）');
      return;
    }
    setLoading(true);
    try {
      await onSend(account.trim());
      setSuccess('好友请求已发送！');
      setAccount('');
    } catch (e: any) {
      setError(e.message || '发送失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <GlassPanel className="w-[340px] p-6 flex flex-col items-center relative">
        <button className="absolute top-3 right-3 text-gray-400 hover:text-gray-600" onClick={onClose}>
          ×
        </button>
        <h2 className="text-lg font-bold mb-4">添加好友</h2>
        <input
          className="w-full px-3 py-2 rounded-lg border border-gray-200 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="输入对方账号（邮箱或用户名）"
          value={account}
          onChange={e => setAccount(e.target.value)}
          disabled={loading}
        />
        {error && <div className="text-red-500 text-sm mb-2">{error}</div>}
        {success && <div className="text-green-500 text-sm mb-2">{success}</div>}
        <button
          className="w-full py-2 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-lg mt-2 disabled:opacity-60"
          onClick={handleSend}
          disabled={loading}
        >
          {loading ? '发送中...' : '发送请求'}
        </button>
      </GlassPanel>
    </div>
  );
};

export default AddFriendModal;
