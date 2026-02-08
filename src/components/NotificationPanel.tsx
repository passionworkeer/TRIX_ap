import React, { useState, useEffect } from 'react';
import { X, Bell, MessageCircle, UserPlus, AlertCircle, Check } from 'lucide-react';
import { getNotifications, markNotificationAsRead } from '../services/databaseService';
import type { Notification } from '../config/supabase';
import Avatar from './Avatar';

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const NotificationPanel: React.FC<NotificationPanelProps> = ({ isOpen, onClose }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen]);

  const loadNotifications = async () => {
    setLoading(true);
    const data = await getNotifications();
    setNotifications(data);
    setLoading(false);
  };

  const handleMarkAsRead = async (notificationId: string) => {
    await markNotificationAsRead(notificationId);
    const updated = notifications.map(n => 
      n.id === notificationId ? { ...n, is_read: true } : n
    );
    setNotifications(updated);
  };

  const handleMarkAllAsRead = async () => {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    await Promise.all(unreadIds.map(id => markNotificationAsRead(id)));
    const updated = notifications.map(n => ({ ...n, is_read: true }));
    setNotifications(updated);
  };

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'message': return <MessageCircle size={20} />;
      case 'friend_request': return <UserPlus size={20} />;
      case 'system': return <AlertCircle size={20} />;
      default: return <Bell size={20} />;
    }
  };

  const getIconColor = (type: Notification['type']) => {
    switch (type) {
      case 'message': return 'bg-cyan-500';
      case 'friend_request': return 'bg-green-500';
      case 'system': return 'bg-orange-500';
      default: return 'bg-slate-500';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;
    return date.toLocaleDateString('zh-CN');
  };

  if (!isOpen) return null;

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-end p-4">
      <div className="w-full max-w-md bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl mt-16 mr-4 max-h-[80vh] flex flex-col animate-slideIn">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center">
              <Bell className="text-white" size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">通知</h2>
              <p className="text-xs text-slate-500">{unreadCount} 条未读</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-700 transition-colors flex items-center gap-1"
              >
                <Check size={14} />
                全部已读
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
            >
              <X size={18} className="text-slate-600" />
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <Bell size={48} className="mb-2 opacity-50" />
              <p>没有通知</p>
            </div>
          ) : (
            notifications.map(notification => (
              <div
                key={notification.id}
                onClick={() => !notification.is_read && handleMarkAsRead(notification.id)}
                className={`p-4 border-b border-slate-100 cursor-pointer transition-colors ${
                  notification.is_read 
                    ? 'bg-white hover:bg-slate-50' 
                    : 'bg-orange-50/50 hover:bg-orange-50 border-l-4 border-l-orange-500'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-full ${getIconColor(notification.type)} flex items-center justify-center shrink-0 text-white`}>
                    {getIcon(notification.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className={`text-sm ${notification.is_read ? 'text-slate-700' : 'text-slate-900 font-semibold'}`}>
                        {notification.title}
                      </h3>
                      {!notification.is_read && (
                        <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 mb-2 line-clamp-2">
                      {notification.content}
                    </p>
                    <span className="text-xs text-slate-400">
                      {formatTimestamp(notification.created_at)}
                    </span>
                  </div>

                  {/* Avatar (if exists) */}
                  {notification.avatar_url && (
                    <Avatar name={notification.content.split(' ')[0] || 'User'} avatar={notification.avatar_url} size="md" className="border-2 border-white" />
                  )}
                </div>

                {/* Action buttons for friend requests */}
                {notification.type === 'friend_request' && !notification.is_read && (
                  <div className="flex gap-2 mt-3 ml-13">
                    <button className="flex-1 px-3 py-1.5 rounded-lg bg-green-500 hover:bg-green-600 text-white text-xs font-medium transition-colors">
                      接受
                    </button>
                    <button className="flex-1 px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-medium transition-colors">
                      拒绝
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationPanel;
