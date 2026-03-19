import React, { useCallback, useMemo, useState } from 'react';
import { Copy, Database, Info, Loader2, RefreshCw, Server, ShieldCheck, Unlink, Wifi, WifiOff, X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useClawbotChannel } from '../contexts/ClawbotChannelContext';
import { getClawbotEndpoints } from '../config/clawbotEndpoints';
import { useConfirmModal } from '../hooks/useConfirmModal';

interface OpenClawControlPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const statPillClass = (active: boolean, isDark: boolean): string =>
  active
    ? isDark
      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/25'
      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : isDark
      ? 'bg-slate-700/60 text-slate-300 border-slate-600/60'
      : 'bg-slate-100 text-slate-700 border-slate-200';

export const OpenClawControlPanel: React.FC<OpenClawControlPanelProps> = ({ isOpen, onClose }) => {
  const { isDark } = useTheme();
  const { requestConfirm, ConfirmModalRenderer } = useConfirmModal();
  const { status, isConnected, isPaired, botOnline, pairingStatus, pairingCode, deviceId, messages, connect, disconnect, unpair, lastError } = useClawbotChannel();
  const [isBusy, setIsBusy] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'done'>('idle');

  const endpoints = getClawbotEndpoints();
  const nativeBaseUrl = endpoints.nativePublicUrl || endpoints.nativeServerUrl || '';

  const summaryItems = useMemo(() => ([
    { label: '服务地址', value: nativeBaseUrl || '未配置', active: Boolean(nativeBaseUrl), icon: Server },
    { label: '连接状态', value: status, active: isConnected, icon: isConnected ? Wifi : WifiOff },
    { label: '配对状态', value: isPaired ? '已配对' : pairingStatus, active: isPaired, icon: ShieldCheck },
    { label: '设备 ID', value: deviceId || '未生成', active: Boolean(deviceId), icon: Database },
  ]), [deviceId, isConnected, isPaired, nativeBaseUrl, pairingStatus, status]);

  const handleReconnect = useCallback(async () => {
    setIsBusy(true);
    try {
      await connect();
    } finally {
      setIsBusy(false);
    }
  }, [connect]);

  const handleDisconnect = useCallback(() => {
    disconnect();
  }, [disconnect]);

  const handleUnpair = useCallback(async () => {
    const confirmed = await requestConfirm({
      title: '确认解绑',
      message: '这会清除当前设备的本地会话并解除服务端配对。',
      confirmText: '解绑',
      cancelText: '取消',
    });
    if (!confirmed) {
      return;
    }

    setIsBusy(true);
    try {
      unpair();
    } finally {
      setIsBusy(false);
    }
  }, [requestConfirm, unpair]);

  const copyServiceUrl = useCallback(async () => {
    if (!nativeBaseUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(nativeBaseUrl);
      setCopyState('done');
      window.setTimeout(() => setCopyState('idle'), 1500);
    } catch {
      setCopyState('idle');
    }
  }, [nativeBaseUrl]);

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
        <div
          className={`ios-glass-surface w-full max-w-lg rounded-t-3xl px-6 pt-6 pb-28 max-h-[85vh] overflow-auto ${
            isDark ? 'bg-gray-900 border-t border-gray-700' : 'bg-white border-t border-gray-200'
          }`}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>Trix Native 状态面板</h2>
              <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                仅保留 Trix Service 和 native channel，不再暴露 Gateway / Relay / Socket.IO 入口。
              </p>
            </div>
            <button
              onClick={onClose}
              className={`ios-pressable ios-surface-button flex h-10 w-10 items-center justify-center rounded-full ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}
            >
              <X size={24} className={isDark ? 'text-gray-400' : 'text-gray-600'} />
            </button>
          </div>

          <div className={`ios-glass-surface rounded-xl p-4 mb-4 ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
            <div className="flex items-center gap-2 mb-4">
              {isConnected ? <Wifi size={16} className="text-emerald-400" /> : <WifiOff size={16} className="text-gray-400" />}
              <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-800'}`}>原生连接状态</span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {summaryItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className={`rounded-xl border px-3 py-3 ${statPillClass(item.active, isDark)}`}
                  >
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] opacity-75">
                      <Icon size={14} />
                      <span>{item.label}</span>
                    </div>
                    <div className="mt-2 text-sm font-semibold break-all">{item.value}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className={`ios-glass-surface rounded-xl p-4 mb-4 ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Info size={16} className={isDark ? 'text-sky-400' : 'text-sky-600'} />
                <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-800'}`}>迁移说明</span>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full border ${statPillClass(botOnline, isDark)}`}>bot {botOnline ? 'online' : 'offline'}</span>
            </div>
            <div className={`space-y-2 text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
              <p>正式通道只保留 <code>Trix Service</code> {`->`} <code>trix-native plugin</code> {`->`} <code>OpenClaw Gateway</code> 这条链路。</p>
              <p>Web 端不再直接连 Gateway / Relay / Socket.IO，也不再在这里做旧 admin 直连操作。</p>
              <p>如果你要恢复配对，只需确认服务端地址和 `serviceToken`，然后走 native pairing 页面。</p>
            </div>
          </div>

          <div className={`ios-glass-surface rounded-xl p-4 mb-4 ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
            <div className="flex items-center justify-between mb-3">
              <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-800'}`}>会话概览</span>
              <span className={`text-xs px-2 py-1 rounded-full border ${statPillClass(isPaired, isDark)}`}>
                {messages.length} 条消息
              </span>
            </div>
            <div className={`space-y-2 text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
              <p>配对码：{pairingCode || '未生成'}</p>
              <p>最近错误：{lastError || '无'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleReconnect}
              disabled={isBusy}
              className={`ios-pressable inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium ${
                isDark ? 'bg-rose-600 text-white hover:bg-rose-700' : 'bg-rose-500 text-white hover:bg-rose-600'
              } ${isBusy ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              {isBusy ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              重新连接
            </button>
            <button
              onClick={handleDisconnect}
              className={`ios-pressable inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium ${
                isDark ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
              }`}
            >
              <WifiOff size={16} />
              断开
            </button>
            <button
              onClick={copyServiceUrl}
              disabled={!nativeBaseUrl}
              className={`ios-pressable inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium ${
                isDark ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
              } ${!nativeBaseUrl ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Copy size={16} />
              {copyState === 'done' ? '已复制' : '复制服务地址'}
            </button>
            <button
              onClick={handleUnpair}
              disabled={isBusy || !isPaired}
              className={`ios-pressable inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium ${
                isDark ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-red-500 text-white hover:bg-red-600'
              } ${isBusy || !isPaired ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Unlink size={16} />
              解绑设备
            </button>
          </div>
        </div>
      </div>

      <ConfirmModalRenderer />
    </>
  );
};
