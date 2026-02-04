# 🎯 TRIX 快速参考

## 🚀 启动命令

### 前端开发服务器
```bash
npm run dev
```

### Python WebSocket 服务器
```bash
python server.py
```

### 一键安装
```bash
.\setup.ps1
```

---

## 🔑 环境变量 (.env)

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

获取方式: Supabase Dashboard → Settings → API

---

## 📡 WebSocket 命令

### 发送命令
```typescript
sendCommand('organize_files');
sendCommand('clean_downloads');
sendCommand('take_screenshot');
sendCommand('ping');
```

### 消息格式
```json
// 发送
{
  "type": "command",
  "command": "organize_files"
}

// 接收 - 进度
{
  "type": "progress",
  "progress": 60,
  "output": "Moving files..."
}

// 接收 - 成功
{
  "type": "success",
  "message": "Task completed!"
}

// 接收 - 错误
{
  "type": "error",
  "message": "Failed to execute"
}
```

---

## 🗄️ Supabase 操作

### 认证
```typescript
// 注册
const { error } = await signUp(email, password, username);

// 登录
const { error } = await signIn(email, password);

// 登出
await signOut();
```

### 数据库
```typescript
// 读取
const { data } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', userId)
  .single();

// 更新
const { error } = await supabase
  .from('profiles')
  .update({ points: newPoints })
  .eq('id', userId);

// 插入
const { error } = await supabase
  .from('task_history')
  .insert({ user_id: userId, task_type: 'organize_files' });
```

---

## 🎨 React Hooks

### useAuth()
```typescript
const { 
  user,          // 当前用户对象
  profile,       // 用户资料 { username, points, avatar_config }
  session,       // 会话信息
  loading,       // 加载状态
  signIn,        // (email, password) => Promise
  signUp,        // (email, password, username) => Promise
  signOut,       // () => Promise
  updateProfile, // (updates) => Promise
  refreshProfile // () => Promise
} = useAuth();
```

### usePCConnection()
```typescript
const { 
  status,       // 'online' | 'offline' | 'connecting'
  sendCommand,  // (command, data?) => void
  lastMessage,  // PCMessage | null
  connect,      // () => void
  disconnect    // () => void
} = usePCConnection('ws://localhost:8080');
```

---

## 🔧 故障排除

### WebSocket 连接失败
```bash
# 检查服务器是否运行
netstat -an | findstr 8080

# 检查防火墙
# Windows Defender → 允许应用通过防火墙 → Python

# 查看服务器日志
python server.py
```

### Supabase 认证失败
```bash
# 重启开发服务器
npm run dev

# 检查环境变量
Get-Content .env

# 清除浏览器缓存和 localStorage
```

### TypeScript 错误
```bash
# 重新安装依赖
rm -rf node_modules package-lock.json
npm install
```

---

## 📁 关键文件

| 文件 | 作用 |
|------|------|
| `src/lib/supabase.ts` | Supabase 客户端 |
| `src/contexts/AuthContext.tsx` | 认证状态管理 |
| `src/hooks/usePCConnection.ts` | WebSocket 连接 |
| `server.py` | Python WebSocket 服务器 |
| `.env` | 环境变量配置 |

---

## 🌐 端口使用

| 端口 | 服务 |
|------|------|
| 5173 | Vite 开发服务器 (默认) |
| 8080 | WebSocket 服务器 |

---

## 📚 文档索引

- **IMPLEMENTATION_GUIDE.md** - 完整实施指南
- **INTEGRATION_SUMMARY.md** - 集成总结
- **SERVER_SETUP.md** - 服务器安装指南
- **README.md** - 项目介绍

---

## 🎯 测试清单

- [ ] 用户可以注册新账号
- [ ] 用户可以登录
- [ ] 主页显示 PC 连接状态
- [ ] WebSocket 服务器正常运行
- [ ] 可以发送命令并收到响应
- [ ] 进度条实时更新
- [ ] 任务完成后显示成功消息

---

## 🔗 有用的链接

- Supabase Dashboard: https://app.supabase.com
- Supabase 文档: https://supabase.com/docs
- WebSocket 文档: https://websockets.readthedocs.io/
- React 文档: https://react.dev

---

**💡 提示:** 将此文件加入书签,随时查阅!
