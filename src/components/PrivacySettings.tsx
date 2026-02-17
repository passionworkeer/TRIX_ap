/**
 * 隐私设置组件 - Privacy Settings
 * 管理用户的隐私和安全设置
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock, Eye, UserCheck, AlertCircle } from 'lucide-react';
import { supabase } from '../config/supabase';
import toast from 'react-hot-toast';

interface PrivacySettings {
  allow_stranger_search: boolean;
  show_online_status: boolean;
  allow_study_invites: boolean;
}

interface PrivacySettingsProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

export const PrivacySettings: React.FC<PrivacySettingsProps> = ({
  isOpen,
  onClose,
  userId
}) => {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<PrivacySettings>({
    allow_stranger_search: true,
    show_online_status: true,
    allow_study_invites: true
  });

  // 加载设置
  useEffect(() => {
    if (isOpen && userId) {
      loadSettings();
    }
  }, [isOpen, userId]);

  // 自动聚焦关闭按钮
  useEffect(() => {
    if (isOpen && closeButtonRef.current) {
      closeButtonRef.current.focus();
    }
  }, [isOpen]);

  // ESC 键关闭
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        // 如果记录不存在，创建默认设置
        if (error.code === 'PGRST116') {
          await createDefaultSettings();
        } else {
          throw error;
        }
      } else if (data) {
        setSettings({
          allow_stranger_search: data.allow_stranger_search,
          show_online_status: data.show_online_status,
          allow_study_invites: data.allow_study_invites
        });
      }
    } catch (error: any) {
      console.error('加载设置失败:', error);
      toast.error('加载设置失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const createDefaultSettings = async () => {
    try {
      const { error } = await supabase
        .from('user_settings')
        .insert({
          user_id: userId,
          allow_stranger_search: true,
          show_online_status: true,
          allow_study_invites: true
        });

      if (error) throw error;
    } catch (error: any) {
      console.error('创建默认设置失败:', error);
    }
  };

  const handleToggle = (key: keyof PrivacySettings) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: userId,
          ...settings
        });

      if (error) throw error;

      toast.success('设置已保存');
      onClose();
    } catch (error: any) {
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
          {/* 背景遮罩 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* 对话框 */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', duration: 0.3 }}
              className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-700 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 顶部标题栏 */}
              <div className="bg-gradient-to-br from-amber-400 to-yellow-500 p-6 text-white">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <Lock size={20} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">隐私与安全</h2>
                      <p className="text-white/90 text-sm">管理你的隐私设置</p>
                    </div>
                  </div>
                  <button
                    ref={closeButtonRef}
                    onClick={onClose}
                    className="text-white/80 hover:text-white transition-colors"
                    aria-label="关闭"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* 内容区域 */}
              <div className="p-6">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* 允许陌生人查找 */}
                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center flex-shrink-0">
                          <UserCheck size={18} className="text-white" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-200">
                            允许陌生人查找
                          </h4>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                            其他人可以通过邮箱或用户名找到你
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleToggle('allow_stranger_search')}
                        className={`relative w-12 h-7 rounded-full p-1 transition-colors ${
                          settings.allow_stranger_search ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${
                            settings.allow_stranger_search ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {/* 显示在线状态 */}
                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-10 h-10 rounded-lg bg-green-500 flex items-center justify-center flex-shrink-0">
                          <Eye size={18} className="text-white" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-200">
                            显示在线状态
                          </h4>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                            好友可以看到你是否在线
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleToggle('show_online_status')}
                        className={`relative w-12 h-7 rounded-full p-1 transition-colors ${
                          settings.show_online_status ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${
                            settings.show_online_status ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {/* 允许学习邀请 */}
                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-10 h-10 rounded-lg bg-purple-500 flex items-center justify-center flex-shrink-0">
                          <AlertCircle size={18} className="text-white" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-200">
                            允许学习邀请
                          </h4>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                            好友可以邀请你一起自习
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleToggle('allow_study_invites')}
                        className={`relative w-12 h-7 rounded-full p-1 transition-colors ${
                          settings.allow_study_invites ? 'bg-purple-500' : 'bg-slate-300 dark:bg-slate-600'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${
                            settings.allow_study_invites ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {/* 保存按钮 */}
                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={onClose}
                        className="flex-1 px-6 py-3 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-semibold rounded-2xl transition-colors disabled:opacity-50"
                        disabled={saving}
                      >
                        取消
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-1 px-6 py-3 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-500 hover:to-yellow-600 text-white font-semibold rounded-2xl transition-colors disabled:opacity-50 shadow-lg shadow-amber-500/30"
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
