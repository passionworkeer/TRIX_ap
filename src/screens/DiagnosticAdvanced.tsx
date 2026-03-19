import { useState } from 'react';
import { getClawbotEndpoints } from '../config/clawbotEndpoints';
import trixNativeChannelClient from '../services/TrixNativeChannelClient';
import { getErrorMessage } from '../utils/errorHandler';

export default function DiagnosticAdvanced() {
  const [logs, setLogs] = useState<string[]>([]);
  const [testResult, setTestResult] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');

  const log = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, `[${timestamp}] ${message}`]);
  };

  const testNativeConnection = async () => {
    setLogs([]);
    setTestResult('testing');

    const endpoints = getClawbotEndpoints();
    const serviceUrl = (endpoints.nativePublicUrl || endpoints.nativeServerUrl || '').replace(/\/$/, '');

    if (!serviceUrl) {
      log(' 缺少 Trix Service URL，请检查环境变量');
      setTestResult('failed');
      return;
    }

    log(` 服务地址: ${serviceUrl}`);

    try {
      const healthResponse = await fetch(`${serviceUrl}/health`);
      const healthPayload = await healthResponse.json().catch(() => ({})) as { ok?: boolean; agentOnline?: boolean };
      if (!healthResponse.ok || healthPayload.ok !== true) {
        log(` 服务探测失败: HTTP ${healthResponse.status}`);
        setTestResult('failed');
        return;
      }

      log(` 服务探测成功，OpenClaw 插件状态: ${healthPayload.agentOnline ? 'online' : 'offline'}`);

      const session = trixNativeChannelClient.getSession();
      if (!session) {
        log(' 未发现本地配对会话，跳过用户 WebSocket 检查');
        setTestResult('success');
        return;
      }

      log(` 会话房间: ${session.conversationId}`);
      log(` 用户 WS: ${session.websocketUrl}`);

      await new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(
          `${session.websocketUrl}?role=user&conversationId=${encodeURIComponent(session.conversationId)}&clientId=${encodeURIComponent(session.clientId)}&clientToken=${encodeURIComponent(session.clientToken)}`,
        );

        const timeout = window.setTimeout(() => {
          ws.close();
          reject(new Error('用户 WebSocket 连接超时'));
        }, 10000);

        const finish = (callback: () => void) => {
          window.clearTimeout(timeout);
          callback();
        };

        ws.onopen = () => {
          log(' 用户 WebSocket 已建立');
        };

        ws.onmessage = (event) => {
          try {
            const envelope = JSON.parse(event.data) as { type?: string };
            log(` 收到事件: ${envelope.type || 'unknown'}`);
          } catch {
            log(' 收到非 JSON 消息');
          }
          finish(() => {
            ws.close();
            resolve();
          });
        };

        ws.onerror = () => {
          finish(() => reject(new Error('用户 WebSocket 建立失败')));
        };

        ws.onclose = () => {
          log(' 用户 WebSocket 已关闭');
        };
      });

      setTestResult('success');
    } catch (error: unknown) {
      log(` 诊断失败: ${getErrorMessage(error, 'Error')}`);
      setTestResult('failed');
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace', background: '#1e1e1e', color: '#d4d4d4', minHeight: '100vh' }}>
      <h2 style={{ color: '#00bcd4' }}> 高级 Native 通道诊断</h2>
      <div style={{ marginBottom: '20px' }}>
        <button onClick={() => void testNativeConnection()} style={{ padding: '10px 20px', margin: '5px', background: '#0891b2', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>测试 Trix Service</button>
        <button onClick={() => setLogs([])} style={{ padding: '10px 20px', margin: '5px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>清空日志</button>
      </div>
      {testResult !== 'idle' && (
        <div style={{ padding: '10px', marginBottom: '20px', background: testResult === 'success' ? '#16a34a' : testResult === 'failed' ? '#dc2626' : '#d97706', color: 'white', borderRadius: '3px' }}>
          {testResult === 'testing' && ' 测试中...'}
          {testResult === 'success' && ' 测试成功!'}
          {testResult === 'failed' && ' 测试失败'}
        </div>
      )}
      <div style={{ background: '#2d2d2d', padding: '15px', borderRadius: '5px', maxHeight: '600px', overflowY: 'auto' }}>
        <h3 style={{ marginTop: 0, color: '#00bcd4' }}> 日志</h3>
        {logs.length === 0 ? <div style={{ color: '#888' }}>点击按钮开始测试...</div> : logs.map((item, index) => <div key={index} style={{ marginBottom: '5px', fontSize: '12px' }}>{item}</div>)}
      </div>
    </div>
  );
}
