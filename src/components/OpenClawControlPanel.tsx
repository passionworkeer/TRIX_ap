/**
 * OpenClaw 控制面板组件
 *
 * 提供远程控制 OpenClaw 的功能：
 * - 模型状态查看
 * - 技能列表查看
 * - 定时任务管理
 * - 运行状态查看
 * - Doctor 自修复
 * - 日志查看
 * - 配置回滚
 */

import React, { useState, useEffect } from 'react';
import { X, Bot, Wrench, List, Clock, Activity, FileText, RotateCcw, RefreshCw, CheckCircle, XCircle, Loader2, Save } from 'lucide-react';
import GlassPanel from './GlassPanel';
import { useTheme } from '../contexts/ThemeContext';
import { clawbotChannelBridge } from '../services/ClawbotChannelBridge';
import { useConfirmModal } from '../hooks/useConfirmModal';

// 功能卡片类型
interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  isLoading?: boolean;
  isDark: boolean;
  disabled?: boolean;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ icon, title, description, onClick, isLoading, isDark, disabled }) => (
  <GlassPanel
    onClick={disabled ? undefined : onClick}
    className={`p-4 !rounded-xl flex flex-col items-center gap-2 cursor-pointer group transition-all duration-300 active:scale-95 border ${
      disabled ? 'opacity-50 cursor-not-allowed' : ''
    } ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}
  >
    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transform group-hover:scale-105 transition-transform duration-300 ${
      isDark ? 'bg-gradient-to-br from-rose-500/20 to-orange-500/20 text-rose-400' : 'bg-gradient-to-br from-rose-100 to-orange-100 text-rose-600'
    }`}>
      {isLoading ? <Loader2 size={24} className="animate-spin" /> : icon}
    </div>
    <span className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-800'}`}>{title}</span>
    <span className={`text-xs text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{description}</span>
  </GlassPanel>
);

interface OpenClawControlPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type CommandType =
  | 'models_status'
  | 'skills_list'
  | 'skills_check'
  | 'cron_list'
  | 'status'
  | 'health'
  | 'doctor'
  | 'doctor_repair'
  | 'logs'
  | 'config_backup'
  | 'config_rollback';

interface ResultDialogProps {
  title: string;
  content: string;
  isDark: boolean;
  onClose: () => void;
  isLoading?: boolean;
}

const ResultDialog: React.FC<ResultDialogProps> = ({ title, content, isDark, onClose, isLoading }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
    <div
      className={`w-full max-w-lg max-h-[80vh] rounded-2xl p-6 overflow-auto ${
        isDark ? 'bg-gray-900 border border-gray-700' : 'bg-white border border-gray-200'
      }`}
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>{title}</h3>
        <button onClick={onClose} className={`p-2 rounded-full ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}>
          <X size={20} className={isDark ? 'text-gray-400' : 'text-gray-600'} />
        </button>
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={32} className="animate-spin text-rose-500" />
        </div>
      ) : (
        <pre className={`text-sm whitespace-pre-wrap font-mono p-4 rounded-lg overflow-auto max-h-96 ${
          isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-50 text-gray-700'
        }`}>
          {content}
        </pre>
      )}
      <button
        onClick={onClose}
        className={`mt-4 w-full py-3 rounded-xl font-bold transition-colors ${
          isDark ? 'bg-rose-600 hover:bg-rose-700 text-white' : 'bg-rose-500 hover:bg-rose-600 text-white'
        }`}
      >
        关闭
      </button>
    </div>
  </div>
);

export const OpenClawControlPanel: React.FC<OpenClawControlPanelProps> = ({ isOpen, onClose }) => {
  const { isDark } = useTheme();
  const { requestConfirm, ConfirmModalRenderer } = useConfirmModal();
  const [loadingCommand, setLoadingCommand] = useState<CommandType | null>(null);
  const [resultDialog, setResultDialog] = useState<{ title: string; content: string } | null>(null);
  const [isBotPaired, setIsBotPaired] = useState(false);

  useEffect(() => {
    // 检查配对状态
    setIsBotPaired(clawbotChannelBridge.isPaired());
  }, [isOpen]);

  if (!isOpen) return null;

  // 执行控制命令
  const executeCommand = async (command: CommandType, params?: Record<string, unknown>, needsConfirm = false) => {
    if (!isBotPaired) {
      setResultDialog({ title: '未配对', content: '请先配对 OpenClaw 设备' });
      return;
    }

    if (needsConfirm) {
      const confirmed = await requestConfirm({
        title: '确认操作',
        message: `确定要执行 "${command}" 吗？`,
        confirmText: '确定',
        cancelText: '取消'
      });
      if (!confirmed) return;
    }

    setLoadingCommand(command);
    try {
      const response = await clawbotChannelBridge.sendControlCommand(command, params);
      if (response.success) {
        const content = typeof response.data === 'string'
          ? response.data
          : JSON.stringify(response.data, null, 2);
        setResultDialog({ title: getCommandTitle(command), content: content || '操作成功' });
      } else {
        setResultDialog({ title: '执行失败', content: response.error || '未知错误' });
      }
    } catch (error) {
      setResultDialog({ title: '执行失败', content: error instanceof Error ? error.message : '未知错误' });
    } finally {
      setLoadingCommand(null);
    }
  };

  // 获取命令对应的标题
  const getCommandTitle = (command: CommandType): string => {
    const titles: Record<CommandType, string> = {
      models_status: '模型状态',
      skills_list: '技能列表',
      skills_check: '技能检查',
      cron_list: '定时任务',
      status: '运行状态',
      health: '健康检查',
      doctor: 'Doctor 诊断',
      doctor_repair: 'Doctor 修复',
      logs: '日志',
      config_backup: '配置备份',
      config_rollback: '配置回滚'
    };
    return titles[command] || command;
  };

  const features = [
    {
      icon: <Bot size={24} />,
      title: '模型状态',
      description: '查看当前模型',
      command: 'models_status' as CommandType
    },
    {
      icon: <List size={24} />,
      title: '技能列表',
      description: '查看已安装技能',
      command: 'skills_list' as CommandType
    },
    {
      icon: <Clock size={24} />,
      title: '定时任务',
      description: '管理定时任务',
      command: 'cron_list' as CommandType
    },
    {
      icon: <Activity size={24} />,
      title: '运行状态',
      description: '查看运行状态',
      command: 'status' as CommandType
    },
    {
      icon: <Wrench size={24} />,
      title: 'Doctor 诊断',
      description: '检查问题',
      command: 'doctor' as CommandType
    },
    {
      icon: <RefreshCw size={24} />,
      title: 'Doctor 修复',
      description: '自动修复问题',
      command: 'doctor_repair' as CommandType,
      needsConfirm: true
    },
    {
      icon: <FileText size={24} />,
      title: '查看日志',
      description: '查看最近日志',
      command: 'logs' as CommandType
    },
    {
      icon: <RotateCcw size={24} />,
      title: '配置回滚',
      description: '恢复到上一版本',
      command: 'config_rollback' as CommandType,
      needsConfirm: true
    },
    {
      icon: <Save size={24} />,
      title: '配置备份',
      description: '备份当前配置',
      command: 'config_backup' as CommandType
    }
  ];

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
        <div
          className={`w-full max-w-lg rounded-t-3xl p-6 max-h-[85vh] overflow-auto transition-transform duration-300 ${
            isDark ? 'bg-gray-900 border-t border-gray-700' : 'bg-white border-t border-gray-200'
          }`}
          onClick={e => e.stopPropagation()}
        >
          {/* 标题栏 */}
          <div className="flex items-center justify-between mb-6">
            <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>
              OpenClaw 控制面板
            </h2>
            <button
              onClick={onClose}
              className={`p-2 rounded-full ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}
            >
              <X size={24} className={isDark ? 'text-gray-400' : 'text-gray-600'} />
            </button>
          </div>

          {/* 配对状态 */}
          <div className={`flex items-center gap-2 mb-4 p-3 rounded-xl ${
            isBotPaired
              ? isDark ? 'bg-green-900/30 text-green-400' : 'bg-green-50 text-green-600'
              : isDark ? 'bg-red-900/30 text-red-400' : 'bg-red-50 text-red-600'
          }`}>
            {isBotPaired ? <CheckCircle size={16} /> : <XCircle size={16} />}
            <span className="text-sm font-medium">
              {isBotPaired ? '已连接 OpenClaw' : '未配对，请先配对设备'}
            </span>
          </div>

          {/* 功能网格 */}
          <div className="grid grid-cols-2 gap-3">
            {features.map((feature, index) => (
              <FeatureCard
                key={index}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
                isLoading={loadingCommand === feature.command}
                isDark={isDark}
                disabled={!isBotPaired || loadingCommand !== null}
                onClick={() => executeCommand(
                  feature.command,
                  feature.command === 'logs' ? { limit: 100 } : undefined,
                  feature.needsConfirm
                )}
              />
            ))}
          </div>

          {/* 加载指示器 */}
          {loadingCommand && (
            <div className="mt-4 flex items-center justify-center gap-2 text-rose-500">
              <Loader2 size={20} className="animate-spin" />
              <span className="text-sm font-medium">执行中...</span>
            </div>
          )}
        </div>
      </div>

      {/* 结果对话框 */}
      {resultDialog && (
        <ResultDialog
          title={resultDialog.title}
          content={resultDialog.content}
          isDark={isDark}
          onClose={() => setResultDialog(null)}
        />
      )}

      <ConfirmModalRenderer />
    </>
  );
};
