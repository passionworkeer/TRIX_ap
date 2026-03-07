import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail as MailIcon, Trash2 } from 'lucide-react';
import { getMails, markMailAsRead, deleteMail } from '../services/databaseService';
import type { Mail } from '../config/supabase';
import Avatar from './Avatar';

interface MailPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const MailPanel: React.FC<MailPanelProps> = ({ isOpen, onClose }) => {
  const [mails, setMails] = useState<Mail[]>([]);
  const [selectedMail, setSelectedMail] = useState<Mail | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadMails();
    }
  }, [isOpen]);

  const loadMails = async () => {
    const data = await getMails();
    setMails(data);
  };

  const handleMailClick = async (mail: Mail) => {
    setSelectedMail(mail);
    if (!mail.is_read) {
      await markMailAsRead(mail.id);
      // 更新本地状态
      const updated = mails.map(m => 
        m.id === mail.id ? { ...m, is_read: true } : m
      );
      setMails(updated);
    }
  };

  const handleDelete = async (mailId: string) => {
    await deleteMail(mailId);
    const updated = mails.filter(m => m.id !== mailId);
    setMails(updated);
    if (selectedMail?.id === mailId) {
      setSelectedMail(null);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins} 分钟前`;
    if (diffHours < 24) return `${diffHours} 小时前`;
    if (diffDays < 7) return `${diffDays} 天前`;
    return date.toLocaleDateString('zh-CN');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="mail-panel-title"
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-end p-4"
        >
          <motion.div 
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="w-full max-w-2xl bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl mt-16 mr-4 max-h-[80vh] flex flex-col"
          >
            {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center">
              <MailIcon className="text-white" size={20} />
            </div>
            <div>
              <h2 id="mail-panel-title" className="text-xl font-bold text-slate-800">邮件</h2>
              <p className="text-xs text-slate-500">{mails.filter(m => !m.is_read).length} 封未读</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
            aria-label="关闭邮件面板"
          >
            <X size={18} className="text-slate-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Mail List */}
          <div className="w-1/2 border-r border-slate-200 overflow-y-auto">
            {mails.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <MailIcon size={48} className="mb-2 opacity-50" />
                <p>没有邮件</p>
              </div>
            ) : (
              mails.map(mail => (
                <div
                  key={mail.id}
                  onClick={() => handleMailClick(mail)}
                  className={`p-4 border-b border-slate-100 cursor-pointer transition-colors ${
                    selectedMail?.id === mail.id 
                      ? 'bg-cyan-50 border-l-4 border-l-cyan-500' 
                      : mail.is_read 
                        ? 'hover:bg-slate-50' 
                        : 'bg-blue-50/50 hover:bg-blue-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Avatar name={mail.from_name} avatar={mail.from_avatar || ''} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-sm ${mail.is_read ? 'text-slate-600' : 'text-slate-800 font-semibold'}`}>
                          {mail.from_name}
                        </span>
                        {!mail.is_read && (
                          <span className="w-2 h-2 bg-cyan-500 rounded-full"></span>
                        )}
                      </div>
                      <h3 className={`text-sm mb-1 truncate ${mail.is_read ? 'text-slate-700' : 'text-slate-900 font-medium'}`}>
                        {mail.subject}
                      </h3>
                      <p className="text-xs text-slate-500 truncate">{mail.preview}</p>
                      <span className="text-xs text-slate-400 mt-1 inline-block">
                        {formatTimestamp(mail.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Mail Detail */}
          <div className="w-1/2 overflow-y-auto p-6 bg-slate-50/50">
            {selectedMail ? (
              <div>
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">
                      {selectedMail.subject}
                    </h2>
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Avatar name={selectedMail.from_name} avatar={selectedMail.from_avatar || ''} size="sm" />
                      <span>{selectedMail.from_name}</span>
                      <span className="text-slate-400">  </span>
                      <span className="text-slate-400">{formatTimestamp(selectedMail.created_at)}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(selectedMail.id)}
                    className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>

                <div className="prose prose-slate max-w-none">
                  <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {selectedMail.preview}
                    {'\n\n'}
                    这是一封示例邮件。在实际应用中，这里会显示完整的邮件内容，包括正文、附件等。
                    {'\n\n'}
                    您可以使用这个邮件系统来接收重要的通知、消息和文件。
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <MailIcon size={64} className="mb-3 opacity-30" />
                <p>选择一封邮件查看详情</p>
              </div>
            )}
          </div>
        </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default MailPanel;
