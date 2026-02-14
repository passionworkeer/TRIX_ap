/**
 * Nanobot 配对页面
 *
 * 功能：
 * 1. 输入从 Nanobot 获取的配对码
 * 2. 连接到云端 Nanobot 服务
 * 3. 配对成功后跳转到首页
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { KeyRound, Loader2, CheckCircle, XCircle, ArrowLeft, Link as LinkIcon } from 'lucide-react';
import { useNanobot } from '../contexts/NanobotContext';
import nanobotBridge from '../services/NanobotBridge';
import { AppRoutes } from '../types';

const NanobotPairing: React.FC = () => {
  const navigate = useNavigate();
  const { status, connect, lastError } = useNanobot();

  const [pairingCode, setPairingCode] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  // 监听连接状态变化
  useEffect(() => {
    if (status === 'CONNECTED' && isConnecting) {
      console.log('[NanobotPairing] 配对成功，准备跳转到聊天界面');

      // 保存连接状态标记
      localStorage.setItem('clawbot_device_token', 'nanobot_connected');

      // 跳转到聊天详情页
      setTimeout(() => {
        navigate(AppRoutes.CHAT_DETAIL, {
          state: {
            name: 'Nanobot',
            avatar: undefined, // 使用默认头像
            isBot: true,
            friendId: 'nanobot'
          }
        });
      }, 500);
    }
  }, [status, isConnecting, navigate]);

  const handleBack = () => {
    navigate(-1);
  };

  const getStatusIcon = () => {
    if (status === 'CONNECTED') {
      return <CheckCircle className="w-6 h-6 text-green-500" />;
    }
    if (status === 'ERROR') {
      return <XCircle className="w-6 h-6 text-red-500" />;
    }
    if (status === 'CONNECTING' || status === 'RECONNECTING') {
      return <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />;
    }
    return <KeyRound className="w-6 h-6 text-gray-400" />;
  };

  const getStatusText = () => {
    switch (status) {
      case 'CONNECTED':
        return '已连接';
      case 'CONNECTING':
        return '连接中...';
      case 'RECONNECTING':
        return '重连中...';
      case 'ERROR':
        return '连接失败';
      default:
        return '未连接';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'CONNECTED':
        return 'text-green-600';
      case 'ERROR':
        return 'text-red-600';
      case 'CONNECTING':
      case 'RECONNECTING':
        return 'text-blue-600';
      default:
        return 'text-gray-600';
    }
  };

  const handleConnect = async () => {
    const code = pairingCode.trim().toUpperCase();

    if (!code) {
      alert('请输入配对码');
      return;
    }

    setIsConnecting(true);

    try {
      // 先绑定配对码
      const result = await nanobotBridge.bindPairingCode(code, 'TRIX User');

      if (result.success) {
        console.log('[NanobotPairing] 配对码绑定成功，开始连接...');

        // 连接到服务器
        connect(code);
      } else {
        alert(result.message || '配对失败');
        setIsConnecting(false);
      }
    } catch (error) {
      console.error('[NanobotPairing] 连接失败:', error);
      alert(error instanceof Error ? error.message : '连接失败，请重试');
      setIsConnecting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex flex-col">
      {/* Header */}
      <div className="px-4 py-4 flex items-center gap-4">
        <button
          onClick={handleBack}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowLeft className="w-6 h-6 text-gray-700" />
        </button>
        <h1 className="text-xl font-semibold text-gray-900">Nanobot 配对</h1>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 py-8 flex flex-col">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md mx-auto w-full space-y-6"
        >
          {/* 说明 */}
          <div className="text-center">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <LinkIcon className="w-8 h-8 text-indigo-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              连接到 Nanobot
            </h2>
            <p className="text-gray-600 text-sm">
              从电脑端 Nanobot 获取配对码，输入后即可连接
            </p>
          </div>

          {/* 连接状态 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getStatusIcon()}
              <span className={`font-medium ${getStatusColor()}`}>
                {getStatusText()}
              </span>
            </div>
            <div className="text-xs text-gray-400">
              设备 ID: {nanobotBridge.getDeviceId().slice(0, 8)}...
            </div>
          </div>

          {/* 配对码输入 */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              配对码
            </label>
            <input
              type="text"
              value={pairingCode}
              onChange={(e) => setPairingCode(e.target.value.toUpperCase())}
              placeholder="例如: A1B2C3D4"
              maxLength={8}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-indigo-500 text-center text-2xl font-mono tracking-widest uppercase"
            />
            <p className="text-xs text-gray-500 text-center">
              请输入 8 位配对码（不区分大小写）
            </p>
          </div>

          {/* 连接按钮 */}
          <button
            onClick={handleConnect}
            disabled={!pairingCode.trim() || isConnecting}
            className="w-full py-4 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isConnecting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                连接中...
              </>
            ) : (
              <>
                <LinkIcon className="w-5 h-5" />
                连接
              </>
            )}
          </button>

          {/* 错误提示 */}
          {lastError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm text-red-700">
                ❌ {lastError}
              </p>
            </div>
          )}

          {/* 帮助说明 */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">
              如何获取配对码？
            </h3>
            <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
              <li>在电脑上运行 Nanobot</li>
              <li>Nanobot 会自动生成配对码</li>
              <li>在终端查看显示的 8 位配对码</li>
              <li>将配对码输入到上方输入框</li>
            </ol>
          </div>

        </motion.div>
      </div>
    </div>
  );
};

export default NanobotPairing;
