import { useState, useEffect } from 'react';

export default function DiagnosticAdvanced() {
  const [logs, setLogs] = useState<string[]>([]);
  const [testResult, setTestResult] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');

  const log = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
    console.log(message);
  };

  const testDirectConnection = () => {
    setLogs([]);
    setTestResult('testing');
    log('🔍 开始直接 WebSocket 测试...');
    
    const wsUrl = 'ws://192.168.101.4:18789';
    const authToken = 'REDACTED_CLAWBOT_GATEWAY_TOKEN';
    
    log(`📍 目标: ${wsUrl}`);
    log(`📍 当前页面: ${window.location.href}`);
    log(`📍 Origin: ${window.location.origin}`);
    log(`📍 Protocol: ${window.location.protocol}`);
    log('');
    
    try {
      log('🔧 创建 WebSocket 实例...');
      const ws = new WebSocket(wsUrl);
      log(`✅ WebSocket 创建成功 (readyState: ${ws.readyState})`);
      
      const timeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          log('⏰ 连接超时 (10秒)');
          ws.close();
          setTestResult('failed');
        }
      }, 10000);
      
      ws.onopen = () => {
        clearTimeout(timeout);
        log('✅ WebSocket 连接已打开!');
        log(`   readyState: ${ws.readyState} (OPEN)`);
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          log(`📥 收到: ${data.event || data.type}`);
          
          if (data.event === 'connect.challenge') {
            const nonce = data.payload.nonce;
            log(`🔑 Challenge nonce: ${nonce}`);
            
            const response = {
              type: 'req',
              id: nonce,
              method: 'connect',
              params: {
                minProtocol: 3,
                maxProtocol: 3,
                role: 'operator',
                client: {
                  id: 'clawdbot-ios',
                  mode: 'webchat',
                  platform: 'web',
                  displayName: 'TRIX Diagnostic',
                  version: '1.0.0',
                  instanceId: Math.random().toString(36).substring(2, 15)
                },
                caps: [],
                auth: { token: authToken }
              }
            };
            
            log('📤 发送认证请求...');
            ws.send(JSON.stringify(response));
          }
          
          if (data.type === 'res' && data.payload?.type === 'hello-ok') {
            log('🎉 认证成功!');
            setTestResult('success');
            setTimeout(() => ws.close(), 1000);
          }
          
          if (data.type === 'res' && data.error) {
            log(`❌ 认证失败: ${data.error.code} - ${data.error.message}`);
            setTestResult('failed');
          }
        } catch (e: any) {
          log(`⚠️ 消息解析失败: ${e.message}`);
        }
      };
      
      ws.onerror = (error) => {
        clearTimeout(timeout);
        log('❌ WebSocket 错误!');
        log(`   readyState: ${ws.readyState}`);
        log(`   URL: ${ws.url}`);
        console.error('详细错误:', error);
        setTestResult('failed');
      };
      
      ws.onclose = (event) => {
        clearTimeout(timeout);
        log(`🔌 连接关闭: code=${event.code}, reason=${event.reason || '(空)'}`);
        log(`   wasClean: ${event.wasClean}`);
        
        if (testResult === 'testing' && event.code !== 1000) {
          setTestResult('failed');
        }
      };
      
    } catch (e: any) {
      log(`❌ 创建 WebSocket 失败: ${e.message}`);
      console.error('创建失败:', e);
      setTestResult('failed');
    }
  };

  const testFromEnv = () => {
    setLogs([]);
    setTestResult('testing');
    log('🔍 测试从环境变量读取配置...');
    
    const wsUrl = import.meta.env.VITE_PC_WEBSOCKET_URL as string;
    const authToken = import.meta.env.VITE_PC_AUTH_TOKEN as string;
    
    log(`📍 VITE_PC_WEBSOCKET_URL: ${wsUrl || '(未设置)'}`);
    log(`📍 VITE_PC_AUTH_TOKEN: ${authToken ? '已设置' : '(未设置)'}`);
    log('');
    
    if (!wsUrl || !authToken) {
      log('❌ 环境变量未正确设置!');
      setTestResult('failed');
      return;
    }
    
    // 使用相同的测试逻辑
    try {
      const ws = new WebSocket(wsUrl);
      log(`✅ WebSocket 创建成功 (readyState: ${ws.readyState})`);
      
      ws.onopen = () => log('✅ 连接已打开');
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        log(`📥 收到: ${data.event || data.type}`);
        
        if (data.event === 'connect.challenge') {
          const response = {
            type: 'req',
            id: data.payload.nonce,
            method: 'connect',
            params: {
              minProtocol: 3,
              maxProtocol: 3,
              role: 'operator',
              client: {
                id: 'clawdbot-ios',
                mode: 'webchat',
                platform: 'web',
                displayName: 'TRIX Env Test',
                version: '1.0.0',
                instanceId: Math.random().toString(36).substring(2, 15)
              },
              caps: [],
              auth: { token: authToken }
            }
          };
          ws.send(JSON.stringify(response));
          log('📤 发送认证请求');
        }
        
        if (data.payload?.type === 'hello-ok') {
          log('🎉 认证成功!');
          setTestResult('success');
          setTimeout(() => ws.close(), 1000);
        }
      };
      
      ws.onerror = (error) => {
        log('❌ WebSocket 错误!');
        console.error(error);
        setTestResult('failed');
      };
      
      ws.onclose = (event) => {
        log(`🔌 关闭: code=${event.code}`);
      };
      
    } catch (e: any) {
      log(`❌ 失败: ${e.message}`);
      setTestResult('failed');
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace', background: '#1e1e1e', color: '#d4d4d4', minHeight: '100vh' }}>
      <h2 style={{ color: '#007acc' }}>🔍 高级 WebSocket 诊断</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={testDirectConnection}
          style={{
            padding: '10px 20px',
            margin: '5px',
            background: '#007acc',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer'
          }}
        >
          测试直接连接 (硬编码)
        </button>
        
        <button
          onClick={testFromEnv}
          style={{
            padding: '10px 20px',
            margin: '5px',
            background: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer'
          }}
        >
          测试环境变量
        </button>
        
        <button
          onClick={() => setLogs([])}
          style={{
            padding: '10px 20px',
            margin: '5px',
            background: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer'
          }}
        >
          清空日志
        </button>
      </div>
      
      {testResult !== 'idle' && (
        <div style={{
          padding: '10px',
          marginBottom: '20px',
          background: testResult === 'success' ? '#28a745' : testResult === 'failed' ? '#dc3545' : '#ffc107',
          color: 'white',
          borderRadius: '3px'
        }}>
          {testResult === 'testing' && '⏳ 测试中...'}
          {testResult === 'success' && '✅ 测试成功!'}
          {testResult === 'failed' && '❌ 测试失败'}
        </div>
      )}
      
      <div style={{
        background: '#2d2d2d',
        padding: '15px',
        borderRadius: '5px',
        maxHeight: '600px',
        overflowY: 'auto'
      }}>
        <h3 style={{ marginTop: 0, color: '#007acc' }}>📋 日志</h3>
        {logs.length === 0 ? (
          <div style={{ color: '#888' }}>点击按钮开始测试...</div>
        ) : (
          logs.map((log, index) => (
            <div key={index} style={{ marginBottom: '5px', fontSize: '12px' }}>
              {log}
            </div>
          ))
        )}
      </div>
      
      <div style={{ marginTop: '20px', padding: '15px', background: '#2d2d2d', borderRadius: '5px' }}>
        <h3 style={{ marginTop: 0, color: '#007acc' }}>💡 诊断提示</h3>
        <ul style={{ lineHeight: '1.8' }}>
          <li>如果 "直接连接" 成功,说明 WebSocket 本身没问题</li>
          <li>如果 "环境变量" 失败,检查 .env 文件是否正确</li>
          <li>如果两者都失败,可能是浏览器安全策略问题</li>
          <li>对比 localhost 和 IP 地址的测试结果</li>
        </ul>
      </div>
    </div>
  );
}
