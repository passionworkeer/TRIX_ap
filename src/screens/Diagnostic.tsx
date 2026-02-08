import React, { useEffect, useState } from 'react';

// ============================================
// 🔧 环境变量和连接诊断页面
// ============================================

interface DiagnosticResult {
  wsUrl?: string;
  authToken?: string;
  supabaseUrl?: string;
  connectionTest?: {
    success: boolean;
    message: string;
    error?: string;
  };
}

const Diagnostic: React.FC = () => {
  const [results, setResults] = useState<DiagnosticResult>({});
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    // 读取环境变量
    const wsUrl = import.meta.env.VITE_PC_WEBSOCKET_URL as string;
    const authToken = import.meta.env.VITE_PC_AUTH_TOKEN as string;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;

    setResults({
      wsUrl,
      authToken,
      supabaseUrl
    });

    console.log('🔍 环境变量诊断:');
    console.log('VITE_PC_WEBSOCKET_URL:', wsUrl);
    console.log('VITE_PC_AUTH_TOKEN:', authToken);
    console.log('VITE_SUPABASE_URL:', supabaseUrl);
  }, []);

  const testConnection = async () => {
    setTesting(true);
    const { wsUrl, authToken } = results;

    if (!wsUrl || !authToken) {
      setResults({
        ...results,
        connectionTest: {
          success: false,
          message: '环境变量缺失',
          error: 'VITE_PC_WEBSOCKET_URL 或 VITE_PC_AUTH_TOKEN 未定义'
        }
      });
      setTesting(false);
      return;
    }

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('✅ WebSocket 连接成功');
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('📨 收到消息:', data);

        if (data.event === 'connect.challenge') {
          const response = {
            type: 'req',
            id: data.payload?.nonce || data.id,
            method: 'connect',
            params: {
              minProtocol: 3,
              maxProtocol: 3,
              role: 'operator',
              client: {
                id: 'clawdbot-ios',
                mode: 'webchat',
                platform: 'ios',
                displayName: 'TRIX Diagnostic',
                version: '1.0.0',
                instanceId: Math.random().toString(36).substring(7)
              },
              caps: [],
              auth: { token: authToken }
            }
          };
          ws.send(JSON.stringify(response));
        }

        if (data.type === 'res' && data.payload?.type === 'hello-ok') {
          console.log('🟢 认证成功');
          setResults({
            ...results,
            connectionTest: {
              success: true,
              message: '连接和认证都成功！'
            }
          });
          setTesting(false);
          ws.close();
        }

        if (data.type === 'res' && data.error) {
          console.error('❌ 认证失败:', data.error);
          setResults({
            ...results,
            connectionTest: {
              success: false,
              message: '认证失败',
              error: `${data.error.code}: ${data.error.message}`
            }
          });
          setTesting(false);
          ws.close();
        }
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket 错误:', error);
        setResults({
          ...results,
          connectionTest: {
            success: false,
            message: '连接失败',
            error: '无法连接到 WebSocket 服务器'
          }
        });
        setTesting(false);
      };

    } catch (error: any) {
      console.error('❌ 连接错误:', error);
      setResults({
        ...results,
        connectionTest: {
          success: false,
          message: '连接错误',
          error: error.message
        }
      });
      setTesting(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
        background: 'white',
        borderRadius: '15px',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          padding: '30px',
          textAlign: 'center'
        }}>
          <h1 style={{ fontSize: '28px', marginBottom: '10px' }}>🔧 TRIX App 配置诊断</h1>
          <p style={{ opacity: 0.9 }}>检查环境变量和 WebSocket 连接</p>
        </div>

        <div style={{ padding: '30px' }}>
          {/* 环境变量 */}
          <div style={{
            marginBottom: '30px',
            padding: '20px',
            background: '#f8f9fa',
            borderRadius: '10px',
            borderLeft: '4px solid #667eea'
          }}>
            <h2 style={{ marginBottom: '15px', color: '#333' }}>📋 环境变量</h2>
            
            <ConfigItem 
              label="VITE_PC_WEBSOCKET_URL" 
              value={results.wsUrl} 
            />
            <ConfigItem 
              label="VITE_PC_AUTH_TOKEN" 
              value={results.authToken} 
            />
            <ConfigItem 
              label="VITE_SUPABASE_URL" 
              value={results.supabaseUrl} 
            />
          </div>

          {/* 页面信息 */}
          <div style={{
            marginBottom: '30px',
            padding: '20px',
            background: '#f8f9fa',
            borderRadius: '10px',
            borderLeft: '4px solid #667eea'
          }}>
            <h2 style={{ marginBottom: '15px', color: '#333' }}>🌐 当前页面</h2>
            
            <ConfigItem 
              label="页面 URL" 
              value={window.location.href} 
            />
            <ConfigItem 
              label="协议" 
              value={window.location.protocol} 
            />
            <ConfigItem 
              label="主机名" 
              value={window.location.hostname} 
            />
            <ConfigItem 
              label="端口" 
              value={window.location.port || '默认'} 
            />
          </div>

          {/* 连接测试 */}
          <div style={{
            marginBottom: '30px',
            padding: '20px',
            background: '#f8f9fa',
            borderRadius: '10px',
            borderLeft: '4px solid #667eea'
          }}>
            <h2 style={{ marginBottom: '15px', color: '#333' }}>🔌 连接测试</h2>
            
            <button
              onClick={testConnection}
              disabled={testing}
              style={{
                padding: '10px 20px',
                border: 'none',
                borderRadius: '5px',
                background: testing ? '#ccc' : '#667eea',
                color: 'white',
                fontSize: '14px',
                fontWeight: 600,
                cursor: testing ? 'not-allowed' : 'pointer',
                marginBottom: '15px'
              }}
            >
              {testing ? '测试中...' : '开始测试连接'}
            </button>

            {results.connectionTest && (
              <div style={{
                padding: '15px',
                borderRadius: '8px',
                background: results.connectionTest.success ? '#d1fae5' : '#fee2e2',
                border: `1px solid ${results.connectionTest.success ? '#059669' : '#dc2626'}`,
                marginTop: '15px'
              }}>
                <strong style={{ 
                  color: results.connectionTest.success ? '#059669' : '#dc2626' 
                }}>
                  {results.connectionTest.success ? '✅' : '❌'} {results.connectionTest.message}
                </strong>
                {results.connectionTest.error && (
                  <p style={{ 
                    marginTop: '10px', 
                    color: '#dc2626',
                    fontSize: '14px' 
                  }}>
                    {results.connectionTest.error}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 诊断建议 */}
          <div style={{
            padding: '20px',
            background: '#f8f9fa',
            borderRadius: '10px',
            borderLeft: '4px solid #667eea'
          }}>
            <h2 style={{ marginBottom: '15px', color: '#333' }}>💡 诊断建议</h2>
            
            {!results.wsUrl || !results.authToken ? (
              <div style={{
                padding: '15px',
                borderRadius: '8px',
                background: '#fef3c7',
                border: '1px solid #f59e0b'
              }}>
                <h3 style={{ marginBottom: '10px', color: '#333' }}>⚠️ 环境变量缺失</h3>
                <p style={{ marginBottom: '10px', color: '#555' }}>
                  <strong>问题</strong>: .env 文件配置不正确或未加载
                </p>
                <p style={{ marginBottom: '10px', color: '#555' }}>
                  <strong>解决方法</strong>:
                </p>
                <ol style={{ marginLeft: '20px', color: '#555' }}>
                  <li>检查 .env 文件是否存在</li>
                  <li>确认包含以下配置:
                    <pre style={{
                      background: '#f0f0f0',
                      padding: '10px',
                      borderRadius: '5px',
                      marginTop: '10px',
                      fontSize: '13px'
                    }}>
{`VITE_PC_WEBSOCKET_URL=ws://192.168.101.4:18789
VITE_PC_AUTH_TOKEN=REDACTED_CLAWBOT_GATEWAY_TOKEN`}
                    </pre>
                  </li>
                  <li>重启开发服务器: Ctrl+C 然后 npm run dev</li>
                </ol>
              </div>
            ) : results.connectionTest?.success ? (
              <div style={{
                padding: '15px',
                borderRadius: '8px',
                background: '#d1fae5',
                border: '1px solid #059669'
              }}>
                <h3 style={{ marginBottom: '10px', color: '#333' }}>✅ 配置正确</h3>
                <p style={{ color: '#555' }}>
                  环境变量加载正常，连接和认证都成功！
                </p>
              </div>
            ) : (
              <div style={{
                padding: '15px',
                borderRadius: '8px',
                background: '#e0f2fe',
                border: '1px solid #0284c7'
              }}>
                <p style={{ color: '#555' }}>
                  点击"开始测试连接"按钮检查 WebSocket 连接状态
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// 配置项组件
const ConfigItem: React.FC<{ label: string; value?: string }> = ({ label, value }) => {
  const hasValue = value && value !== 'undefined';
  
  return (
    <div style={{
      background: 'white',
      padding: '15px',
      marginBottom: '10px',
      borderRadius: '8px',
      border: '1px solid #e0e0e0'
    }}>
      <div style={{
        fontWeight: 600,
        color: '#555',
        marginBottom: '8px'
      }}>
        {label}:
      </div>
      <div style={{
        fontFamily: 'monospace',
        background: '#f0f0f0',
        padding: '10px',
        borderRadius: '5px',
        fontSize: '14px',
        wordBreak: 'break-all',
        color: hasValue ? '#333' : '#ef4444'
      }}>
        {hasValue ? value : '❌ 未定义'}
      </div>
    </div>
  );
};

export default Diagnostic;
