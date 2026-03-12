/**
 * OpenClaw 控制面板组件
 *
 * 提供远程控制 OpenClaw 的功能：
 * - Gateway 直连
 * - Relay 中继连接 (扫码/输入配对码)
 * - 模型状态查看
 * - 技能列表查看
 * - 定时任务管理
 * - Doctor 自修复
 * - 日志查看
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  X, Bot, Wrench, List, Clock, Activity, FileText, RotateCcw,
  RefreshCw, CheckCircle, XCircle, Loader2, Save, Wifi, WifiOff,
  ChevronDown, ChevronUp, Plug, QrCode, Keyboard
} from 'lucide-react';
import GlassPanel from './GlassPanel';
import { useTheme } from '../contexts/ThemeContext';
import { clawbotChannelBridge } from '../services/ClawbotChannelBridge';
import gatewayClient from '../services/GatewayClient';
import relayClient from '../services/RelayClient';
import { getClawbotEndpoints } from '../config/clawbotEndpoints';
import { useConfirmModal } from '../hooks/useConfirmModal';
import { logger } from '../utils/logger';

// 连接模式
type ConnectionMode = 'socketio' | 'gateway' | 'relay';

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
    className={`ios-pressable p-4 !rounded-xl flex flex-col items-center gap-2 cursor-pointer group border ${
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
  <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
    <div
      className={`ios-glass-surface w-full max-w-lg max-h-[80vh] rounded-2xl p-6 overflow-auto ${
        isDark ? 'bg-gray-900 border border-gray-700' : 'bg-white border border-gray-200'
      }`}
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>{title}</h3>
        <button onClick={onClose} className={`ios-pressable ios-surface-button flex h-10 w-10 items-center justify-center rounded-full ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}>
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
        className={`ios-pressable mt-4 w-full py-3 rounded-xl font-bold ${
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

  // 连接状态
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('relay');
  const [socketConnected, setSocketConnected] = useState(false);
  const [gatewayConnected, setGatewayConnected] = useState(false);
  const [relayConnected, setRelayConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Relay 连接输入
  const [relayServer, setRelayServer] = useState('');
  const [gatewayId, setGatewayId] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [showInput, setShowInput] = useState(false);

  // 获取端点配置
  const endpoints = getClawbotEndpoints();

  // 检查连接状态
  useEffect(() => {
    if (!isOpen) return;

    // 检查 Socket.IO 连接状态
    const checkSocketStatus = () => {
      setSocketConnected(clawbotChannelBridge.isPaired());
    };

    // 检查 Gateway 连接状态
    const checkGatewayStatus = () => {
      setGatewayConnected(gatewayClient.isConnected());
    };

    // 检查 Relay 连接状态
    const checkRelayStatus = () => {
      setRelayConnected(relayClient.isConnected());
    };

    checkSocketStatus();
    checkGatewayStatus();
    checkRelayStatus();

    // 设置定时检查
    const interval = setInterval(() => {
      checkSocketStatus();
      checkGatewayStatus();
      checkRelayStatus();
    }, 3000);

    // 监听 Gateway 事件
    gatewayClient.on('connect', () => setGatewayConnected(true));
    gatewayClient.on('disconnect', () => setGatewayConnected(false));

    // 监听 Relay 事件
    relayClient.on('connect', () => setRelayConnected(true));
    relayClient.on('disconnect', () => setRelayConnected(false));

    return () => {
      clearInterval(interval);
    };
  }, [isOpen]);

  // 连接 Relay
  const connectRelay = useCallback(async () => {
    if (!relayServer || !gatewayId || !accessCode) {
      setResultDialog({ title: '连接失败', content: '请填写完整的连接信息' });
      return;
    }

    setIsConnecting(true);
    try {
      await relayClient.connect({
        server: relayServer,
        gatewayId,
        accessCode,
      });
      setResultDialog({ title: '连接成功', content: `已通过中继服务器连接到 ${gatewayId}` });
    } catch (error) {
      logger.relay.error('[OpenClawControlPanel] Relay connection failed:', error);
      setResultDialog({
        title: '连接失败',
        content: error instanceof Error ? error.message : '未知错误'
      });
    } finally {
      setIsConnecting(false);
    }
  }, [relayServer, gatewayId, accessCode]);

  // 断开 Relay 连接
  const disconnectRelay = useCallback(() => {
    relayClient.disconnect();
    setResultDialog({ title: '已断开', content: '中继连接已断开' });
  }, []);

  // 连接 Gateway
  const connectGateway = useCallback(async () => {
    if (!endpoints.gatewayUrl) {
      setResultDialog({ title: '连接失败', content: '未配置 Gateway URL' });
      return;
    }

    setIsConnecting(true);
    try {
      await gatewayClient.connect({
        url: endpoints.gatewayUrl,
        token: endpoints.gatewayToken || undefined,
      });
      setResultDialog({ title: '连接成功', content: `已连接到 Gateway: ${endpoints.gatewayUrl}` });
    } catch (error) {
      logger.gateway.error('[OpenClawControlPanel] Gateway connection failed:', error);
      setResultDialog({
        title: '连接失败',
        content: error instanceof Error ? error.message : '未知错误'
      });
    } finally {
      setIsConnecting(false);
    }
  }, [endpoints]);

  // 断开 Gateway 连接
  const disconnectGateway = useCallback(() => {
    gatewayClient.disconnect();
    setResultDialog({ title: '已断开', content: 'Gateway 连接已断开' });
  }, []);

  // 执行控制命令
  const executeCommand = async (command: CommandType, params?: Record<string, unknown>, needsConfirm = false) => {
    const isConnected = connectionMode === 'gateway' ? gatewayConnected :
                       connectionMode === 'relay' ? relayConnected :
                       socketConnected;

    if (!isConnected) {
      setResultDialog({
        title: '未连接',
        content: connectionMode === 'relay'
          ? '请先通过配对码连接'
          : connectionMode === 'gateway'
            ? '请先连接 Gateway'
            : '请先配对 OpenClaw 设备'
      });
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
      let result: { success: boolean; data?: unknown; error?: string };

      if (connectionMode === 'gateway') {
        result = await executeGatewayCommand(command, params);
      } else if (connectionMode === 'relay') {
        result = await executeRelayCommand(command, params);
      } else {
        result = await clawbotChannelBridge.sendControlCommand(command, params);
      }

      if (result.success) {
        const content = typeof result.data === 'string'
          ? result.data
          : JSON.stringify(result.data, null, 2);
        setResultDialog({ title: getCommandTitle(command), content: content || '操作成功' });
      } else {
        setResultDialog({ title: '执行失败', content: result.error || '未知错误' });
      }
    } catch (error) {
      setResultDialog({
        title: '执行失败',
        content: error instanceof Error ? error.message : '未知错误'
      });
    } finally {
      setLoadingCommand(null);
    }
  };

  // 执行 Gateway 命令
  const executeGatewayCommand = async (command: CommandType, params?: Record<string, unknown>) => {
    try {
      switch (command) {
        case 'models_status': {
          const models = await gatewayClient.request<{ models: unknown[] }>('control.modelsStatus');
          return { success: true, data: models?.models || [] };
        }
        case 'skills_list': {
          const skills = await gatewayClient.request<{ skills: unknown[] }>('skills.list');
          return { success: true, data: skills?.skills || [] };
        }
        case 'skills_check': {
          const results = await gatewayClient.request<{ results: unknown[] }>('control.skillsCheck');
          return { success: true, data: results?.results || [] };
        }
        case 'cron_list': {
          const jobs = await gatewayClient.request<{ jobs: unknown[] }>('crons.list');
          return { success: true, data: jobs?.jobs || [] };
        }
        case 'status':
        case 'health': {
          const status = await gatewayClient.request<unknown>('control.status');
          return { success: true, data: status };
        }
        case 'doctor': {
          const result = await gatewayClient.request<unknown>('control.doctor');
          return { success: true, data: result };
        }
        case 'doctor_repair': {
          await gatewayClient.request('control.doctorRepair');
          return { success: true, data: { message: '修复完成' } };
        }
        case 'logs': {
          const logs = await gatewayClient.request<{ logs: string }>('control.logs', params);
          return { success: true, data: { logs: logs?.logs || '' } };
        }
        case 'config_backup': {
          await gatewayClient.request('control.configBackup');
          return { success: true, data: { message: '配置已备份' } };
        }
        case 'config_rollback': {
          await gatewayClient.request('control.configRollback');
          return { success: true, data: { message: '配置已回滚' } };
        }
        default:
          return { success: false, error: `Unknown command: ${command}` };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  };

  // 执行 Relay 命令
  const executeRelayCommand = async (command: CommandType, params?: Record<string, unknown>) => {
    try {
      // 将命令映射到 Gateway 方法
      const methodMap: Record<CommandType, string> = {
        models_status: 'control.modelsStatus',
        skills_list: 'skills.list',
        skills_check: 'control.skillsCheck',
        cron_list: 'crons.list',
        status: 'control.status',
        health: 'control.status',
        doctor: 'control.doctor',
        doctor_repair: 'control.doctorRepair',
        logs: 'control.logs',
        config_backup: 'control.configBackup',
        config_rollback: 'control.configRollback',
      };

      const method = methodMap[command];
      await relayClient.sendToDevice(method, params);
      return { success: true, data: { message: '命令已发送' } };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
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

  const isConnected = connectionMode === 'gateway' ? gatewayConnected :
                     connectionMode === 'relay' ? relayConnected :
                     socketConnected;

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

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
        <div
          className={`ios-glass-surface w-full max-w-lg rounded-t-3xl px-6 pt-6 pb-28 max-h-[85vh] overflow-auto ${
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
              className={`ios-pressable ios-surface-button flex h-10 w-10 items-center justify-center rounded-full ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}
            >
              <X size={24} className={isDark ? 'text-gray-400' : 'text-gray-600'} />
            </button>
          </div>

          {/* 连接管理 */}
          <div className={`ios-glass-surface rounded-xl p-4 mb-4 ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
            <div className="flex items-center justify-between mb-3">
              <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-800'}`}>
                连接管理
              </span>
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className={`ios-pressable ios-icon-button-compact flex items-center justify-center rounded-full ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}
              >
                {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            </div>

            {/* 连接模式选择 */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setConnectionMode('relay')}
                className={`ios-pressable flex-1 py-2 px-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 ${
                  connectionMode === 'relay'
                    ? 'bg-rose-500 text-white'
                    : isDark ? 'bg-gray-600 text-gray-300' : 'bg-gray-200 text-gray-600'
                }`}
              >
                <Plug size={14} /> 中继
              </button>
              <button
                onClick={() => setConnectionMode('gateway')}
                className={`ios-pressable flex-1 py-2 px-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 ${
                  connectionMode === 'gateway'
                    ? 'bg-rose-500 text-white'
                    : isDark ? 'bg-gray-600 text-gray-300' : 'bg-gray-200 text-gray-600'
                }`}
              >
                <Wifi size={14} /> 直连
              </button>
              <button
                onClick={() => setConnectionMode('socketio')}
                className={`ios-pressable flex-1 py-2 px-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 ${
                  connectionMode === 'socketio'
                    ? 'bg-rose-500 text-white'
                    : isDark ? 'bg-gray-600 text-gray-300' : 'bg-gray-200 text-gray-600'
                }`}
              >
                <Bot size={14} /> 配对
              </button>
            </div>

            {/* Relay 连接输入 */}
            {connectionMode === 'relay' && (
              <div className={`mb-4 p-3 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                <div className="flex gap-2 mb-2">
                  <button
                    onClick={() => setShowInput(false)}
                    className={`flex-1 py-1 px-2 rounded text-xs font-medium ${
                      !showInput
                        ? 'bg-rose-500 text-white'
                        : isDark ? 'bg-gray-600 text-gray-300' : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    <QrCode size={12} className="inline mr-1" /> 扫码
                  </button>
                  <button
                    onClick={() => setShowInput(true)}
                    className={`flex-1 py-1 px-2 rounded text-xs font-medium ${
                      showInput
                        ? 'bg-rose-500 text-white'
                        : isDark ? 'bg-gray-600 text-gray-300' : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    <Keyboard size={12} className="inline mr-1" /> 输入
                  </button>
                </div>

                {showInput && (
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="服务器地址 (如 https://your-server.com)"
                      value={relayServer}
                      onChange={(e) => setRelayServer(e.target.value)}
                      className={`w-full px-3 py-2 rounded-lg text-sm ${
                        isDark ? 'bg-gray-600 text-white placeholder-gray-400' : 'bg-white text-gray-800 placeholder-gray-500'
                      }`}
                    />
                    <input
                      type="text"
                      placeholder="Gateway ID"
                      value={gatewayId}
                      onChange={(e) => setGatewayId(e.target.value)}
                      className={`w-full px-3 py-2 rounded-lg text-sm ${
                        isDark ? 'bg-gray-600 text-white placeholder-gray-400' : 'bg-white text-gray-800 placeholder-gray-500'
                      }`}
                    />
                    <input
                      type="text"
                      placeholder="配对码 (6位)"
                      value={accessCode}
                      onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                      maxLength={6}
                      className={`w-full px-3 py-2 rounded-lg text-sm ${
                        isDark ? 'bg-gray-600 text-white placeholder-gray-400' : 'bg-white text-gray-800 placeholder-gray-500'
                      }`}
                    />
                  </div>
                )}

                {!showInput && (
                  <div className={`text-center py-4 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    在 OpenClaw 设备上运行 <code className="px-1 py-0.5 rounded bg-gray-600">openclaw pair</code> 获取配对码
                  </div>
                )}
              </div>
            )}

            {/* 连接状态 */}
            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-2 flex-1 p-2 rounded-lg ${
                connectionMode === 'relay' ? (relayConnected
                  ? isDark ? 'bg-green-900/30' : 'bg-green-50'
                  : isDark ? 'bg-gray-700' : 'bg-gray-100') :
                connectionMode === 'gateway' ? (gatewayConnected
                  ? isDark ? 'bg-green-900/30' : 'bg-green-50'
                  : isDark ? 'bg-gray-700' : 'bg-gray-100') :
                socketConnected
                  ? isDark ? 'bg-green-900/30' : 'bg-green-50'
                  : isDark ? 'bg-gray-700' : 'bg-gray-100'
              }`}>
                {connectionMode === 'relay' ? (relayConnected ? <Wifi size={16} className="text-green-500" /> : <WifiOff size={16} className={isDark ? 'text-gray-500' : 'text-gray-400'} />) :
                 connectionMode === 'gateway' ? (gatewayConnected ? <Wifi size={16} className="text-green-500" /> : <WifiOff size={16} className={isDark ? 'text-gray-500' : 'text-gray-400'} />) :
                 socketConnected ? <Wifi size={16} className="text-green-500" /> : <WifiOff size={16} className={isDark ? 'text-gray-500' : 'text-gray-400'} />}
                <div className="flex-1 min-w-0">
                  <div className={`text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    {connectionMode === 'relay' ? '中继' : connectionMode === 'gateway' ? '直连' : '配对'}
                  </div>
                  <div className={`text-xs ${
                    connectionMode === 'relay' ? (relayConnected ? 'text-green-500' : isDark ? 'text-gray-500' : 'text-gray-400') :
                    connectionMode === 'gateway' ? (gatewayConnected ? 'text-green-500' : isDark ? 'text-gray-500' : 'text-gray-400') :
                    socketConnected ? 'text-green-500' : isDark ? 'text-gray-500' : 'text-gray-400'
                  }`}>
                    {connectionMode === 'relay' ? (relayConnected ? '已连接' : isConnecting ? '连接中...' : '未连接') :
                     connectionMode === 'gateway' ? (gatewayConnected ? '已连接' : isConnecting ? '连接中...' : '未连接') :
                     socketConnected ? '已配对' : '未配对'}
                  </div>
                </div>
              </div>
            </div>

            {/* 连接按钮 */}
            <div className="flex gap-2 mt-3">
              {connectionMode === 'relay' ? (
                relayConnected ? (
                  <button
                    onClick={disconnectRelay}
                    className={`ios-pressable flex-1 py-2 rounded-lg text-sm font-medium ${
                      isDark ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-red-500 hover:bg-red-600 text-white'
                    }`}
                  >
                    断开
                  </button>
                ) : (
                  <button
                    onClick={connectRelay}
                    disabled={isConnecting || (!relayServer || !gatewayId || !accessCode)}
                    className={`ios-pressable flex-1 py-2 rounded-lg text-sm font-medium ${
                      isDark ? 'bg-rose-600 hover:bg-rose-700 text-white' : 'bg-rose-500 hover:bg-rose-600 text-white'
                    } ${isConnecting || (!relayServer || !gatewayId || !accessCode) ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {isConnecting ? '连接中...' : '连接'}
                  </button>
                )
              ) : connectionMode === 'gateway' ? (
                gatewayConnected ? (
                  <button
                    onClick={disconnectGateway}
                    className={`ios-pressable flex-1 py-2 rounded-lg text-sm font-medium ${
                      isDark ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-red-500 hover:bg-red-600 text-white'
                    }`}
                  >
                    断开
                  </button>
                ) : (
                  <button
                    onClick={connectGateway}
                    disabled={isConnecting}
                    className={`ios-pressable flex-1 py-2 rounded-lg text-sm font-medium ${
                      isDark ? 'bg-rose-600 hover:bg-rose-700 text-white' : 'bg-rose-500 hover:bg-rose-600 text-white'
                    } ${isConnecting ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {isConnecting ? '连接中...' : '连接'}
                  </button>
                )
              ) : (
                <button
                  onClick={() => {
                    if (!socketConnected) {
                      setResultDialog({
                        title: '配对说明',
                        content: '请在 OpenClaw 设备上扫描二维码进行配对'
                      });
                    }
                  }}
                  className={`ios-pressable flex-1 py-2 rounded-lg text-sm font-medium ${
                    socketConnected
                      ? isDark ? 'bg-green-600 text-white' : 'bg-green-500 text-white'
                      : isDark ? 'bg-rose-600 hover:bg-rose-700 text-white' : 'bg-rose-500 hover:bg-rose-600 text-white'
                  }`}
                >
                  {socketConnected ? '已配对' : '配对设备'}
                </button>
              )}
            </div>
          </div>

          {/* 当前状态 */}
          <div className={`flex items-center gap-2 mb-4 p-3 rounded-xl ${
            isConnected
              ? isDark ? 'bg-green-900/30 text-green-400' : 'bg-green-50 text-green-600'
              : isDark ? 'bg-red-900/30 text-red-400' : 'bg-red-50 text-red-600'
          }`}>
            {isConnected ? <CheckCircle size={16} /> : <XCircle size={16} />}
            <span className="text-sm font-medium">
              {isConnected
                ? `已通过 ${connectionMode === 'relay' ? '中继' : connectionMode === 'gateway' ? '直连' : 'Socket.IO'} 连接`
                : '未连接，请先建立连接'}
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
                disabled={!isConnected || loadingCommand !== null}
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
