/**
 * 隐私设置组件 - Privacy Settings
 * 管理用户的隐私与安全设置
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock, Eye, UserCheck, AlertCircle } from 'lucide-react';
import { supabase } from '../config/supabase';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../utils/errorHandler';

interface PrivacySettingsState {
  allow_stranger_search: boolean;
  show_online_status: boolean;
  allow_study_invites: boolean;
}

interface PrivacySettingsProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

const DEFAULT_SETTINGS: PrivacySettingsState = {
  allow_stranger_search: true,
  show_online_status: true,
  allow_study_invites: true,
};

export const PrivacySettings: React.FC<PrivacySettingsProps> = ({
  isOpen,
  onClose,
  userId
}) => {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<PrivacySettingsState>(DEFAULT_SETTINGS);

  const settingItems = useMemo(() => ([
    {
      key: 'allow_stranger_search' as const,
      title: '允许陌生人搜索',
      description: '其他人可通过邮箱或用户名找到你',
      icon: UserCheck,
      activeClass: 'bg-cyan-500',
      iconBgClass: 'bg-cyan-500'
    },
    {
      key: 'show_online_status' as const,
      title: '显示在线状态',
      description: '好友可以看到你是否在线',
      icon: Eye,
      activeClass: 'bg-emerald-500',
      iconBgClass: 'bg-emerald-500'
    },
    {
      key: 'allow_study_invites' as const,
      title: '允许学习邀请',
      description: '好友可以邀请你一起学习',
      icon: AlertCircle,
      activeClass: 'bg-indigo-500',
      iconBgClass: 'bg-indigo-500'
    }
  ]), []);

  useEffect(() => {
    if (!isOpen || !userId) {
      return;
    }

    const loadSettings = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', userId)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            await createDefaultSettings();
            setSettings(DEFAULT_SETTINGS);
            return;
          }
          throw error;
        }

        if (data) {
          setSettings({
            allow_stranger_search: Boolean(data.allow_stranger_search),
            show_online_status: Boolean(data.show_online_status),
            allow_study_invites: Boolean(data.allow_study_invites)
          });
        }
      } catch (error: unknown) {
        console.error('加载设置失败:', error);
        toast.error('加载设置失败，请重试');
      } finally {
        setLoading(false);
      }
    };

    void loadSettings();
  }, [isOpen, userId]);

  useEffect(() => {
    if (isOpen && closeButtonRef.current) {
      closeButtonRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const createDefaultSettings = async () => {
    try {
      const { error } = await supabase
        .from('user_settings')
        .insert({
          user_id: userId,
          ...DEFAULT_SETTINGS
        });

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('创建默认设置失败:', error);
    }
  };

  const handleToggle = (key: keyof PrivacySettingsState) => {
    setSettings(previous => ({
      ...previous,
      [key]: !previous[key],
    }));
  };

  const handleSave = async () => {
    if (!userId) {
      toast.error('用户信息无效，请重新登录');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: userId,
          ...settings
        });

      if (error) {
        throw error;
      }

      toast.success('设置已保存');
      onClose();
    } catch (error: unknown) {
      console.error('保存设置失败:', error);
      toast.error('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', duration: 0.3 }}
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="bg-gradient-to-r from-slate-700 via-slate-800 to-slate-900 px-6 py-5 text-white dark:from-slate-800 dark:via-slate-900 dark:to-black">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                      <Lock size={20} />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold">隐私与安全</h2>
                      <p className="text-sm text-white/80">管理你的隐私设置</p>
                    </div>
                  </div>

                  <button
                    ref={closeButtonRef}
                    type="button"
                    onClick={onClose}
                    className="rounded-lg p-1 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                    aria-label="关闭"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="p-6">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700 dark:border-slate-700 dark:border-t-slate-200" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {settingItems.map((item) => {
                      const Icon = item.icon;
                      const enabled = settings[item.key];

                      return (
                        <div
                          key={item.key}
                          className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/70"
                        >
                          <div className="flex flex-1 items-center gap-3">
                            <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-white ${item.iconBgClass}`}>
                              <Icon size={18} />
                            </div>
                            <div>
                              <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{item.title}</h4>
                              <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">{item.description}</p>
                            </div>
                          </div>

                          <button
                            type="button"
                            aria-label={item.title}
                            onClick={() => handleToggle(item.key)}
                            className={`relative h-7 w-12 rounded-full p-1 transition-colors ${enabled ? item.activeClass : 'bg-slate-300 dark:bg-slate-600'}`}
                          >
                            <div
                              className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0'}`}
                            />
                          </button>
                        </div>
                      );
                    })}

                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="flex-1 rounded-2xl bg-slate-200 px-5 py-3 font-semibold text-slate-700 transition-colors hover:bg-slate-300 disabled:opacity-50 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-1 rounded-2xl bg-gradient-to-r from-cyan-500 to-indigo-500 px-5 py-3 font-semibold text-white shadow-lg shadow-cyan-500/25 transition-colors hover:from-cyan-600 hover:to-indigo-600 disabled:opacity-50"
                      >
                        {saving ? '保存中...' : '保存'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};

export default PrivacySettings;
