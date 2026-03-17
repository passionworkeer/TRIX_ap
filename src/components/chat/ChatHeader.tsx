import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, MoreVertical, X } from 'lucide-react';
import botAvatarImg from '../../assets/roles/role1/AvatarHead.png';
import Avatar from '../Avatar';
import {
  iosIconButtonMotion,
  iosBackdropMotion,
  iosQuickSpring,
} from '../../utils/iosMotion';
import { UserOnlineStatus, calculateOnlineStatus } from '../../config/supabase';

interface ChatHeaderProps {
  name: string;
  avatar: string;
  isBot: boolean;
  isBotConversation: boolean;
  isPaired: boolean;
  botOnline: boolean;
  status: string;
  botState: string;
  friendLastActive: string | null | undefined;
  onNavigateBack: () => void;
  onToggleMenu: () => void;
  showMenu: boolean;
  onUnpair: () => void;
  onRequestConfirm: (options: {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info';
  }) => Promise<boolean>;
  onShowSuccess: (message: string) => void;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({
  name,
  avatar,
  isBot,
  isBotConversation,
  isPaired,
  botOnline,
  status,
  friendLastActive,
  onNavigateBack,
  onToggleMenu,
  showMenu,
  onUnpair,
  onRequestConfirm,
  onShowSuccess,
}) => {
  const getStatusColor = () => {
    if (!isBotConversation) {
      const activeStatus = calculateOnlineStatus(friendLastActive ?? null);
      if (activeStatus === UserOnlineStatus.ONLINE) return 'bg-green-500';
      if (activeStatus === UserOnlineStatus.AWAY) return 'bg-yellow-500';
      return 'bg-gray-400';
    }

    if (isBotConversation) {
      if (isPaired && !botOnline) {
        return 'bg-red-500';
      }
      if (isPaired && botOnline) {
        return 'bg-green-500';
      }
      if (isPaired && (status === 'CONNECTING' || status === 'RECONNECTING')) {
        return 'bg-yellow-500 animate-pulse';
      }
      if (!isPaired) {
        return 'bg-gray-400';
      }
    }

    switch (status) {
      case 'CONNECTED': return 'bg-green-500';
      case 'CONNECTING':
      case 'RECONNECTING': return 'bg-yellow-500 animate-pulse';
      case 'ERROR': return 'bg-red-500';
      case 'DISCONNECTED':
      default: return 'bg-gray-400';
    }
  };

  const getStatusText = () => {
    if (!isBotConversation) {
      if (!friendLastActive) return 'Offline';
      const activeStatus = calculateOnlineStatus(friendLastActive);
      if (activeStatus === UserOnlineStatus.ONLINE) return 'Online';
      if (activeStatus === UserOnlineStatus.AWAY) return 'Away';
      return 'Offline';
    }

    if (isBotConversation) {
      if (isPaired && !botOnline) {
        return 'Bot Offline';
      }
      if (isPaired && botOnline) {
        return 'Online';
      }
      if (isPaired && (status === 'CONNECTING' || status === 'RECONNECTING')) {
        return 'Connecting...';
      }
      if (!isPaired) {
        return 'Not Paired';
      }
    }

    switch (status) {
      case 'CONNECTED': return 'Online';
      case 'CONNECTING':
      case 'RECONNECTING': return 'Connecting...';
      case 'ERROR': return 'Error';
      case 'DISCONNECTED':
      default: return 'Offline';
    }
  };

  const handleUnpair = async () => {
    const accepted = await onRequestConfirm({
      title: '解除 Clawbot 配对',
      message: '确定要取消与 Clawbot 的配对吗？\n\n取消后需要重新配对才能继续使用。',
      confirmText: '解除配对',
      cancelText: '保留配对',
      variant: 'danger',
    });
    if (!accepted) return;

    onUnpair();
    onShowSuccess('配对已取消，你可以重新进入配对页连接新的 Clawbot');
  };

  return (
    <header className="z-40 flex shrink-0 items-center justify-between border-b border-slate-200 bg-white/90 px-4 pb-4 pt-12 shadow-sm backdrop-blur-xl transition-all duration-300 dark:border-slate-700 dark:bg-slate-900/90">
      <div className="flex items-center gap-3">
        <motion.button
          type="button"
          onClick={onNavigateBack}
          {...iosIconButtonMotion}
          className="ios-pressable ios-icon-button ios-surface-button flex h-10 w-10 items-center justify-center border border-slate-200 dark:border-slate-700"
          aria-label="返回"
        >
          <ArrowLeft size={20} className="text-slate-700 dark:text-slate-200" />
        </motion.button>

        <div className="flex items-center gap-3">
          <div className="relative">
            {isBot ? (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white shadow-md dark:border-slate-700 dark:bg-slate-800">
                <img src={botAvatarImg} alt="Bot" className="h-full w-full object-cover" />
              </div>
            ) : (
              <div className="relative">
                <Avatar name={name} avatar={avatar} size="md" />
              </div>
            )}
            <div
              className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white dark:border-slate-900 ${getStatusColor()}`}
            />
          </div>

          <div className="flex flex-col">
            <h1 className="text-sm font-bold text-slate-800 dark:text-slate-100">{name}</h1>
            <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
              {getStatusText()}
            </p>
          </div>
        </div>
      </div>

      <div className="relative flex items-center gap-2">
        <motion.button
          type="button"
          onClick={onToggleMenu}
          {...iosIconButtonMotion}
          className="ios-pressable ios-icon-button ios-surface-button flex h-10 w-10 items-center justify-center border border-slate-200 dark:border-slate-700"
          aria-label="更多选项"
          aria-expanded={showMenu}
          aria-haspopup="true"
        >
          <MoreVertical size={20} className="text-slate-700 dark:text-slate-200" />
        </motion.button>

        <AnimatePresence>
          {showMenu && (
            <>
              <motion.div
                {...iosBackdropMotion}
                onClick={onToggleMenu}
                className="fixed inset-0 z-40"
              />

              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0, transition: iosQuickSpring }}
                exit={{ opacity: 0, scale: 0.98, y: -4, transition: { duration: 0.14 } }}
                className="ios-glass-surface absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-[1.25rem] border border-slate-200/80 shadow-xl dark:border-slate-700"
              >
                {isBotConversation && isPaired && (
                  <>
                    <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                      <p className="text-xs text-slate-500 dark:text-slate-400">Clawbot 配对管理</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleUnpair}
                      className="ios-list-row flex w-full items-center gap-3 px-4 py-3 text-left text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                    >
                      <X size={18} />
                      <span className="font-medium">解除配对</span>
                    </button>
                  </>
                )}

                {!isBot && (
                  <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                    聊天设置
                  </div>
                )}

                {isBotConversation && !isPaired && (
                  <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                    <p className="text-xs">当前未配对</p>
                    <p className="mt-1 text-xs">请在 Clawbot 端发起配对</p>
                  </div>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
};

export default ChatHeader;
