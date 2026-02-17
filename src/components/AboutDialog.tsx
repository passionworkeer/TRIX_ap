/**
 * 关于对话框组件 - About Dialog
 * 显示应用版本信息、开发团队和版权信息
 */

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Github, Mail, Heart } from 'lucide-react';

interface AboutDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const APP_VERSION = '1.2.0';
const DEVELOPER = 'TRIX Studio';
const YEAR = new Date().getFullYear();

export const AboutDialog: React.FC<AboutDialogProps> = ({ isOpen, onClose }) => {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

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
              {/* 顶部渐变背景 */}
              <div className="bg-gradient-to-br from-amber-400 to-yellow-500 p-6 text-white">
                {/* 关闭按钮 */}
                <div className="flex justify-end mb-2">
                  <button
                    ref={closeButtonRef}
                    onClick={onClose}
                    className="text-white/80 hover:text-white transition-colors"
                    aria-label="关闭"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Logo 和标题 */}
                <div className="text-center">
                  <h2 className="text-2xl font-bold mb-1">TRIX 3D Companion</h2>
                  <p className="text-white/90 text-sm font-medium">版本 {APP_VERSION}</p>
                </div>
              </div>

              {/* 内容区域 */}
              <div className="p-6">
                {/* 开发团队 */}
                <div className="mb-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center">
                      <Heart size={16} className="text-white" />
                    </div>
                    <h3 className="font-bold text-slate-800 dark:text-slate-200">开发团队</h3>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 text-sm pl-11">
                    {DEVELOPER}
                  </p>
                </div>

                {/* 项目信息 */}
                <div className="space-y-3 mb-6">
                  <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700">
                    <span className="text-sm text-slate-600 dark:text-slate-400">版本号</span>
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                      v{APP_VERSION}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700">
                    <span className="text-sm text-slate-600 dark:text-slate-400">发布日期</span>
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                      2026年2月
                    </span>
                  </div>
                </div>

                {/* 功能特性 */}
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">
                    主要功能
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {['3D 虚拟陪伴', '智能聊天', '专注学习', '社交互动'].map((feature) => (
                      <div
                        key={feature}
                        className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400"
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        {feature}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 版权信息 */}
                <div className="text-center py-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    © {YEAR} {DEVELOPER}. All Rights Reserved.
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    Made with ❤️ for better learning experience
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};

export default AboutDialog;
