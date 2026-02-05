# 🚀 Clawdbot Gateway 快速开始指南

## 概述

TRIX 前端已成功集成 Clawdbot Gateway 协议,支持实时 AI 对话功能。

---

## ✅ 已完成的工作

### 1. 核心 Hook 实现
- ✅ `src/hooks/usePCConnection.ts` - WebSocket 连接管理
  - 自动认证流程
  - 自动重连机制
  - 连接状态追踪
  - RPC 消息格式

### 2. UI 组件更新
- ✅ `screens/Chat.tsx` - 聊天列表
  - 实时连接状态显示
  - 状态指示器 (🟢🟡🔴)
  
- ✅ `screens/ChatDetail.tsx` - 聊天界面
  - 实时消息收发
  - 连接状态横幅
  - 智能输入禁用

### 3. 协议实现
- ✅ 认证握手 (`action: "auth"`)
- ✅ 消息发送 (`action: "message.send"`)
- ✅ 消息接收 (支持 `result`/`text`/`message` 字段)
- ✅ 错误处理

---

## 📋 使用步骤

### 步骤 1: 配置环境变量

编辑 `.env` 文件:

```env
VITE_PC_WEBSOCKET_URL=ws://YOUR_PC_IP:18789
VITE_PC_AUTH_TOKEN=YOUR_AUTH_TOKEN
```

**如何获取:**
- 从 Clawdbot Gateway 管理界面获取 Token
- IP 地址为运行 Gateway 的电脑地址

---

### 步骤 2: 启动应用

```bash
npm run dev
```

---

### 步骤 3: 检查连接

1. 打开应用 → 进入"聊天"页面
2. 查看 "Clawdbot Gateway" 卡片
3. 确认状态显示: **🟢 已连接**

---

### 步骤 4: 开始对话

1. 点击 "Clawdbot Gateway" 进入聊天
2. 输入任意消息
3. 查看 AI 回复

---

## 🔍 连接状态说明

| 图标 | 状态 | 说明 |
|------|------|------|
| 🟢 | 已连接 | Gateway 连接成功,可以发送消息 |
| 🟡 | 连接中/认证中 | 正在建立连接或进行认证 |
| 🔴 | 认证失败/错误 | Token 无效或连接失败 |
| ⚪ | 离线 | 未连接到 Gateway |

---

## 🧪 测试清单

### 连接测试
- [ ] 状态显示 "🟢 已连接"
- [ ] 控制台显示 "✅ Authentication successful"
- [ ] 无错误日志

### 消息测试
- [ ] 可以发送消息
- [ ] 收到 AI 回复
- [ ] 消息正确显示在界面

### 断线测试
- [ ] 关闭 Gateway → 状态变为 "⚪ 离线"
- [ ] 输入框禁用
- [ ] 显示警告横幅

### 重连测试
- [ ] 重启 Gateway → 自动重连
- [ ] 状态恢复为 "🟢 已连接"
- [ ] 可以继续对话

---

## 🎯 代码使用示例

### 在任何组件中使用

```typescript
import { usePCConnection } from '../hooks/usePCConnection';

function MyComponent() {
  const { 
    status,        // 连接状态
    sendMessage,   // 发送消息函数
    lastMessage,   // 最新收到的消息
    isConnected    // 是否已连接
  } = usePCConnection();

  // 发送消息
  const handleSend = () => {
    if (isConnected) {
      sendMessage('你好,AI!');
    }
  };

  // 监听新消息
  useEffect(() => {
    if (lastMessage) {
      console.log('AI 回复:', lastMessage);
    }
  }, [lastMessage]);

  return (
    <div>
      <p>状态: {status}</p>
      <button onClick={handleSend} disabled={!isConnected}>
        发送消息
      </button>
    </div>
  );
}
```

---

## 📡 协议快速参考

### 认证 (自动执行)

```json
// 发送
{
  "action": "auth",
  "token": "YOUR_TOKEN"
}

// 接收
{
  "action": "auth",
  "status": "ok"
}
```

### 发送消息

```json
{
  "action": "message.send",
  "params": {
    "message": "用户输入的文本"
  }
}
```

### 接收回复

```json
{
  "result": "AI 的回复内容"
}
```

---

## 🐛 常见问题

### Q: 一直显示 "🟡 连接中"

**A:** 检查:
1. Gateway 是否正在运行?
2. IP 地址和端口是否正确?
3. 防火墙是否阻止?

```bash
# 测试连接
Test-NetConnection -ComputerName 192.168.101.4 -Port 18789
```

---

### Q: 显示 "🔴 认证失败"

**A:** Token 无效或过期
1. 检查 `.env` 文件中的 `VITE_PC_AUTH_TOKEN`
2. 从 Gateway 获取新 Token
3. 重启前端: `npm run dev`

---

### Q: 发送消息无响应

**A:** 确保:
1. 状态为 "🟢 已连接"
2. Gateway 正常运行
3. 查看浏览器控制台是否有错误

---

### Q: 如何查看详细日志?

**A:** 打开浏览器控制台 (F12),查看:
- `✅ 绿色勾` = 成功
- `📤 发送箭头` = 发送消息
- `📥 接收箭头` = 接收消息
- `❌ 红色叉` = 错误

---

## 📚 相关文档

- 📖 **CLAWDBOT_INTEGRATION.md** - 完整集成文档
- 📖 **QUICK_REFERENCE.md** - 快速参考
- 📖 **README.md** - 项目说明

---

## 🎉 成功标志

当你看到以下内容时,说明集成成功:

✅ 聊天列表中显示 "Clawdbot Gateway" (带 🟢)
✅ 控制台显示 "✅ Authentication successful - Gateway ready"
✅ 可以发送消息并收到 AI 回复
✅ 连接稳定,无频繁断线

---

## 🚀 开始使用

```bash
# 1. 确保 .env 已配置
# 2. 启动前端
npm run dev

# 3. 打开浏览器访问
http://localhost:5173

# 4. 进入聊天 → 点击 Clawdbot Gateway
# 5. 开始对话!
```

---

**祝你使用愉快! 🎊**

如有问题,请查看 **CLAWDBOT_INTEGRATION.md** 获取详细信息。
