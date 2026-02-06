# 🔍 浏览器控制台测试指南

## 问题分析

网络层诊断显示**一切正常**:
- ✅ TCP 连接: localhost 和 IP 都成功
- ✅ WebSocket 连接: PowerShell 测试都成功
- ✅ 防火墙: 规则已添加
- ✅ Gateway: 正常监听

**但是 React 应用可能还是连接失败!**

所以问题很可能在**应用层**:
- CORS/Origin 检查?
- WebSocket 协议参数?
- 浏览器安全策略?
- React 代码逻辑?

---

## 立即测试 (3 分钟)

### 步骤 1: 打开 React 应用

在浏览器中打开 **任意一个**:

```
电脑: http://localhost:5173/#/chat
手机: http://192.168.101.4:5173/#/chat
```

### 步骤 2: 打开开发者工具

按 **F12** 或右键 → 检查

### 步骤 3: 粘贴测试代码

切换到 **Console** 标签,粘贴并运行:

```javascript
// ========================================
// 🧪 应用层 WebSocket 测试
// ========================================

(function() {
  const authToken = '8743d26357758f202c9bb5a21db706185d66f9c98f9c3ff1';
  
  // 智能选择 URL (和 React 应用一样的逻辑)
  const isLocalhost = window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1';
  
  const wsUrl = isLocalhost 
    ? 'ws://localhost:18789' 
    : `ws://${window.location.hostname}:18789`;
  
  console.log('%c========================================', 'color: cyan; font-weight: bold');
  console.log('%c🧪 WebSocket 测试', 'color: cyan; font-weight: bold');
  console.log('%c========================================', 'color: cyan; font-weight: bold');
  console.log('');
  console.log('%c📍 检测到:', 'color: yellow; font-weight: bold');
  console.log('   Hostname:', window.location.hostname);
  console.log('   Origin:', window.location.origin);
  console.log('   Protocol:', window.location.protocol);
  console.log('');
  console.log('%c🔌 WebSocket URL:', 'color: yellow; font-weight: bold', wsUrl);
  console.log('');
  
  try {
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('%c✅ WebSocket 连接成功!', 'color: green; font-weight: bold');
      console.log('   readyState:', ws.readyState, '(OPEN)');
      console.log('   URL:', ws.url);
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('%c📥 收到消息:', 'color: blue; font-weight: bold', data.event || data.type);
        
        if (data.event === 'connect.challenge') {
          const nonce = data.payload.nonce;
          console.log('%c🔐 收到认证挑战:', 'color: yellow', nonce);
          
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
                displayName: 'Console Test',
                version: '1.0.0',
                instanceId: Math.random().toString(36).substring(2, 15)
              },
              caps: [],
              auth: { token: authToken }
            }
          };
          
          console.log('%c📤 发送认证:', 'color: yellow', response);
          ws.send(JSON.stringify(response));
        }
        
        if (data.type === 'res' && data.payload?.type === 'hello-ok') {
          console.log('%c🎉 认证成功!', 'color: green; font-weight: bold; font-size: 16px');
          console.log('%c', 'font-size: 1px'); // 换行
          console.log('%c✅ 结论: WebSocket 连接完全正常!', 'color: green; font-weight: bold');
          console.log('%c   问题不在网络层或 Gateway 层', 'color: gray');
          console.log('%c   请检查 React 应用的代码逻辑', 'color: gray');
          
          setTimeout(() => ws.close(), 1000);
        }
        
        if (data.type === 'res' && data.error) {
          console.log('%c❌ 认证失败:', 'color: red; font-weight: bold', data.error.code);
          console.log('   消息:', data.error.message);
        }
      } catch (e) {
        console.log('%c⚠️ 消息解析失败:', 'color: orange', e.message);
        console.log('   原始数据:', event.data);
      }
    };
    
    ws.onerror = (error) => {
      console.log('%c❌ WebSocket 错误', 'color: red; font-weight: bold');
      console.log('   readyState:', ws.readyState);
      console.log('   URL:', ws.url);
      console.error('   详细错误:', error);
      console.log('%c', 'font-size: 1px'); // 换行
      console.log('%c⚠️ 问题可能在:', 'color: orange; font-weight: bold');
      console.log('%c   1. Gateway 不接受来自此 Origin 的连接', 'color: gray');
      console.log('%c   2. 浏览器安全策略阻止连接', 'color: gray');
      console.log('%c   3. 网络配置问题 (但网络层测试通过了)', 'color: gray');
    };
    
    ws.onclose = (event) => {
      if (event.code !== 1000) {
        console.log('%c🔌 连接关闭:', 'color: red; font-weight: bold', `code=${event.code}`);
        console.log('   reason:', event.reason || '(无)');
        console.log('   wasClean:', event.wasClean);
        console.log('%c', 'font-size: 1px'); // 换行
        console.log('%c📋 常见错误码:', 'color: yellow; font-weight: bold');
        console.log('%c   1006 = 异常关闭 (连接失败)', 'color: gray');
        console.log('%c   1000 = 正常关闭', 'color: gray');
        console.log('%c   1002 = 协议错误', 'color: gray');
        console.log('%c   1003 = 数据类型错误', 'color: gray');
      } else {
        console.log('%c🔌 正常关闭', 'color: green');
      }
    };
    
    setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        console.log('%c⏰ 连接超时 (10秒)', 'color: red; font-weight: bold');
        console.log('   当前状态:', ws.readyState);
        console.log('%c', 'font-size: 1px'); // 换行
        console.log('%c💡 建议:', 'color: yellow; font-weight: bold');
        console.log('%c   1. 检查 Gateway 是否在运行', 'color: gray');
        console.log('%c   2. 检查防火墙设置', 'color: gray');
        console.log('%c   3. 查看上面的错误信息', 'color: gray');
        ws.close();
      }
    }, 10000);
    
  } catch (e) {
    console.log('%c❌ 创建 WebSocket 失败:', 'color: red; font-weight: bold', e.message);
    console.error('详细异常:', e);
  }
})();
```

### 步骤 4: 查看结果

等待 5-10 秒,查看输出:

#### ✅ 如果成功:
```
✅ WebSocket 连接成功!
🔐 收到认证挑战: xxxxx
📤 发送认证: {...}
🎉 认证成功!
✅ 结论: WebSocket 连接完全正常!
```

**说明**: 浏览器能连接,问题在 React 代码逻辑

#### ❌ 如果失败:
```
❌ WebSocket 错误
🔌 连接关闭: code=1006
```

**说明**: 浏览器环境下就是连不上,可能是:
- Gateway 的 Origin 检查
- CORS 策略
- 浏览器安全策略

---

## 步骤 5: 切换到 Network 标签

1. 点击 **Network** 标签
2. 筛选 **WS** (WebSocket)
3. 刷新页面或重新运行测试
4. 点击 WebSocket 连接
5. 查看:
   - **Headers** 标签: 查看请求/响应头
   - **Messages** 标签: 查看收发的消息
   - **Timing** 标签: 查看连接时间

---

## 步骤 6: 截图并反馈

请截图以下内容:

1. **Console 输出** (完整的测试结果)
2. **Network → WS** (WebSocket 连接详情)
3. **Headers** 部分 (特别是 Origin、Sec-WebSocket-*)

---

## 对比测试 (可选)

如果上面的测试**成功**,说明浏览器环境下能连接。

那么问题就是: **为什么 React 应用连接失败?**

请同时:
1. 保持控制台测试运行
2. 打开 React 应用的聊天页面
3. 尝试发送消息
4. 对比两者的 Network 标签

查看:
- 控制台测试的 WebSocket 连接成功了吗? ✅
- React 应用的 WebSocket 连接成功了吗? ❌
- 两者的 URL 一样吗?
- 两者的 Headers 有什么不同?

---

## 下一步

根据测试结果:

### 情况 A: 控制台测试成功 ✅,React 应用失败 ❌
→ **代码逻辑问题**,检查:
- `WebSocketContext.tsx` 的 URL 选择逻辑
- 环境变量配置
- 认证参数

### 情况 B: 控制台测试失败 ❌
→ **浏览器环境问题**,需要:
- 检查 Gateway 的 Origin 白名单
- 检查 CORS 设置
- 尝试不同的浏览器

### 情况 C: 两者都成功 ✅
→ **太好了!** 说明已经修复,可以:
- 在手机上测试
- 验证功能完整性
- 开始正常使用

---

## 快速命令参考

```powershell
# 检查 Gateway 运行状态
Get-NetTCPConnection -LocalPort 18789 -ErrorAction SilentlyContinue | Select-Object LocalAddress, LocalPort, State

# 检查 Vite 运行状态
Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue | Select-Object LocalAddress, LocalPort, State

# 启动 Vite
npm run dev

# 测试 WebSocket (PowerShell)
$ws = New-Object System.Net.WebSockets.ClientWebSocket
$uri = [System.Uri]::new('ws://localhost:18789')
$cts = [System.Threading.CancellationToken]::None
$task = $ws.ConnectAsync($uri, $cts)
$task.Wait(5000)
$ws.State  # 应该显示 Open
$ws.Dispose()
```
