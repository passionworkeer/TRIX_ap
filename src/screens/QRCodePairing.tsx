import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Scan, Wifi, WifiOff, CheckCircle, XCircle, AlertCircle, ArrowLeft, Loader } from 'lucide-react';
import { useQRCodePairing } from '../contexts/QRCodePairingContext';
import { AppRoutes } from '../types';
import QRScanner from '../components/QRScanner';

/**
 * 二维码配对页面
 * 
 * 功能：
 * 1. 扫描电脑端 Clawbot Gateway 生成的二维码
 * 2. 或手动输入配对码
 * 3. 发送配对请求
 * 4. 等待电脑端审批
 * 5. 配对成功后自动跳转
 */

const QRCodePairing: React.FC = () => {
  const navigate = useNavigate();
  const {
    isPairing,
    pairingStatus,
    deviceToken,
    errorMessage,
    startPairing,
    cancelPairing,
    resetPairing
  } = useQRCodePairing();

  const [manualCode, setManualCode] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [showManualInput, setShowManualInput] = useState(true); // 默认展开手动输入
  const [showScanner, setShowScanner] = useState(false);

  // 配对成功后自动跳转
  useEffect(() => {
    if (pairingStatus === 'approved' && deviceToken) {
      setTimeout(() => {
        navigate(AppRoutes.HOME);
      }, 2000);
    }
  }, [pairingStatus, deviceToken, navigate]);

  /**
   * 处理手动输入配对码
   */
  const handleManualPairing = async () => {
    try {
      console.log('[QRCodePairing] 使用手动配对码');
      
      // 解析配对码
      const qrData = JSON.parse(manualCode.trim());
      console.log('[QRCodePairing] 解析后的数据:', qrData);
      
      // 验证必要字段
      if (!qrData.gatewayUrl || !qrData.pairingToken) {
        throw new Error('配对码格式错误，缺少必要字段');
      }
      
      // 保存配对信息到 localStorage
      if (qrData.gatewayUrl) {
        localStorage.setItem('clawbot_gateway_url', qrData.gatewayUrl);
      }
      if (qrData.pairingToken) {
        localStorage.setItem('clawbot_pairing_token', qrData.pairingToken);
      }
      
      // 开始配对流程
      const name = deviceName.trim() || `TRIX-${navigator.platform}`;
      await startPairing(name);
      
      setManualCode('');
      setShowManualInput(false);
    } catch (error) {
      console.error('[QRCodePairing] 处理配对码失败:', error);
      alert(error instanceof Error ? error.message : '配对码格式错误，请检查后重试');
    }
  };

  /**
   * 处理开始配对
   */
  const handleStartPairing = async () => {
    const name = deviceName.trim() || `TRIX-${navigator.platform}`;
    await startPairing(name);
  };

  /**
   * 处理扫描成功
   */
  const handleScanSuccess = async (decodedText: string) => {
    try {
      console.log('[QRCodePairing] 扫描到二维码:', decodedText);
      
      // 解析二维码内容
      const qrData = JSON.parse(decodedText);
      console.log('[QRCodePairing] 解析后的数据:', qrData);
      
      // 保存配对信息到环境变量或 localStorage
      if (qrData.gatewayUrl) {
        localStorage.setItem('clawbot_gateway_url', qrData.gatewayUrl);
      }
      if (qrData.pairingToken) {
        localStorage.setItem('clawbot_pairing_token', qrData.pairingToken);
      }
      
      // 开始配对流程
      const name = deviceName.trim() || `TRIX-${navigator.platform}`;
      await startPairing(name);
      
      setShowScanner(false);
    } catch (error) {
      console.error('[QRCodePairing] 处理扫描结果失败:', error);
      alert('二维码格式错误，请重新扫描');
    }
  };

  /**
   * 处理取消配对
   */
  const handleCancelPairing = async () => {
    await cancelPairing();
    resetPairing();
  };

  /**
   * 返回上一页
   */
  const handleGoBack = () => {
    if (isPairing) {
      handleCancelPairing();
    }
    navigate(-1);
  };

  /**
   * 渲染状态图标
   */
  const renderStatusIcon = () => {
    switch (pairingStatus) {
      case 'approved':
        return <CheckCircle className="w-20 h-20 text-green-500" />;
      case 'denied':
      case 'cancelled':
        return <XCircle className="w-20 h-20 text-red-500" />;
      case 'expired':
        return <AlertCircle className="w-20 h-20 text-orange-500" />;
      case 'pending':
        return <Loader className="w-20 h-20 text-blue-500 animate-spin" />;
      default:
        return <Wifi className="w-20 h-20 text-indigo-500" />;
    }
  };

  /**
   * 渲染状态消息
   */
  const renderStatusMessage = () => {
    switch (pairingStatus) {
      case 'approved':
        return {
          title: '配对成功！',
          message: '正在连接到 Clawbot Gateway...',
          color: 'text-green-600'
        };
      case 'denied':
        return {
          title: '配对被拒绝',
          message: errorMessage || '电脑端拒绝了配对请求',
          color: 'text-red-600'
        };
      case 'cancelled':
        return {
          title: '配对已取消',
          message: '配对流程已中断',
          color: 'text-gray-600'
        };
      case 'expired':
        return {
          title: '配对超时',
          message: errorMessage || '配对请求已过期，请重试',
          color: 'text-orange-600'
        };
      case 'pending':
        return {
          title: '等待电脑端审批...',
          message: '请在电脑端点击"允许"按钮',
          color: 'text-blue-600'
        };
      default:
        return {
          title: '连接到 Clawbot',
          message: '扫描二维码或手动输入配对码',
          color: 'text-indigo-600'
        };
    }
  };

  const statusInfo = renderStatusMessage();

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 pb-20">
      {/* 顶部导航 */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={handleGoBack}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-gray-700" />
          </button>
          <h1 className="text-lg font-semibold text-gray-800">Clawbot 配对</h1>
          <div className="w-10" /> {/* 占位符保持居中 */}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* 状态卡片 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-lg p-8 mb-6"
        >
          <div className="flex flex-col items-center text-center space-y-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={pairingStatus || 'idle'}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                {renderStatusIcon()}
              </motion.div>
            </AnimatePresence>

            <div>
              <h2 className={`text-2xl font-bold ${statusInfo.color} mb-2`}>
                {statusInfo.title}
              </h2>
              <p className="text-gray-600">{statusInfo.message}</p>
            </div>

            {/* Token 显示 (配对成功后) */}
            {deviceToken && (
              <div className="w-full mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
                <p className="text-sm text-green-700 font-mono break-all">
                  Token: {deviceToken.substring(0, 20)}...
                </p>
              </div>
            )}
          </div>
        </motion.div>

        {/* 配对说明 */}
        {!isPairing && pairingStatus !== 'approved' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-blue-50 rounded-xl p-6 mb-6 border border-blue-200"
          >
            <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              配对步骤
            </h3>
            <ol className="space-y-2 text-sm text-blue-800">
              <li className="flex items-start gap-2">
                <span className="font-bold">1.</span>
                <span>在电脑上打开 Clawbot Gateway，启动配对模式</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold">2.</span>
                <span>电脑会显示一个二维码和配对码</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold">3.</span>
                <span>使用下方的扫描功能，或手动输入配对码</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold">4.</span>
                <span>在电脑端点击"允许"完成配对</span>
              </li>
            </ol>
          </motion.div>
        )}

        {/* 配对表单 */}
        {!isPairing && pairingStatus !== 'approved' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl shadow-lg p-6 space-y-4"
          >
            {/* 设备名称输入 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                设备名称（可选）
              </label>
              <input
                type="text"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="留空将自动生成"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {/* 扫描二维码按钮 */}
            <button
              onClick={() => setShowScanner(true)}
              className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg flex items-center justify-center gap-2"
            >
              <Scan className="w-5 h-5" />
              扫描二维码配对
            </button>

            {/* 分隔线 */}
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-gray-300"></div>
              <span className="text-sm text-gray-500 font-medium">或</span>
              <div className="flex-1 h-px bg-gray-300"></div>
            </div>

            {/* 手动输入按钮 - 改为直接展开 */}
            <button
              onClick={() => setShowManualInput(!showManualInput)}
              className={`w-full py-3 font-medium rounded-lg transition-all flex items-center justify-center gap-2 ${
                showManualInput 
                  ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-300' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-2 border-gray-300'
              }`}
            >
              <Wifi className="w-4 h-4" />
              {showManualInput ? '收起手动输入' : '手动输入配对码（推荐）'}
            </button>

            {/* 手动输入配对码 */}
            <AnimatePresence>
              {showManualInput && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pt-4 border-t border-gray-200 space-y-3">
                    <label className="block text-sm font-medium text-gray-700">
                      配对码（从电脑端复制）
                    </label>
                    
                    {/* 示例说明 */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs">
                      <p className="font-medium text-blue-900 mb-1">📋 示例格式：</p>
                      <code className="text-blue-800 block bg-blue-100 p-2 rounded overflow-x-auto">
                        {`{"gatewayUrl":"ws://192.168.1.100:18789","pairingToken":"abc123..."}`}
                      </code>
                    </div>
                    
                    {/* 输入框 */}
                    <textarea
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      placeholder='粘贴配对码...'
                      rows={4}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm resize-none"
                    />
                    
                    {/* 验证提示 */}
                    {manualCode.trim() && (
                      <div className="text-xs">
                        {(() => {
                          try {
                            const data = JSON.parse(manualCode.trim());
                            if (data.gatewayUrl && data.pairingToken) {
                              return (
                                <div className="flex items-center gap-1 text-green-600">
                                  <CheckCircle className="w-4 h-4" />
                                  <span>配对码格式正确 ✓</span>
                                </div>
                              );
                            } else {
                              return (
                                <div className="flex items-center gap-1 text-orange-600">
                                  <AlertCircle className="w-4 h-4" />
                                  <span>缺少必要字段（gatewayUrl 或 pairingToken）</span>
                                </div>
                              );
                            }
                          } catch {
                            return (
                              <div className="flex items-center gap-1 text-red-600">
                                <XCircle className="w-4 h-4" />
                                <span>JSON 格式错误</span>
                              </div>
                            );
                          }
                        })()}
                      </div>
                    )}
                    
                    {/* 连接按钮 */}
                    <button
                      onClick={handleManualPairing}
                      disabled={!manualCode.trim()}
                      className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <Wifi className="w-4 h-4" />
                      使用配对码连接
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* 配对中 - 取消按钮 */}
        {isPairing && pairingStatus === 'pending' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-6"
          >
            <button
              onClick={handleCancelPairing}
              className="w-full py-4 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 transition-colors shadow-lg"
            >
              取消配对
            </button>
          </motion.div>
        )}

        {/* 配对失败 - 重试按钮 */}
        {(pairingStatus === 'denied' || pairingStatus === 'expired') && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-6"
          >
            <button
              onClick={() => {
                resetPairing();
                handleStartPairing();
              }}
              className="w-full py-4 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors shadow-lg"
            >
              重新配对
            </button>
          </motion.div>
        )}
      </div>

      {/* 二维码扫描器 */}
      <QRScanner
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onScanSuccess={handleScanSuccess}
        onScanError={(error) => {
          console.error('[QRCodePairing] 扫描错误:', error);
        }}
      />
    </div>
  );
};

export default QRCodePairing;
