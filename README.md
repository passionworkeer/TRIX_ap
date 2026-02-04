<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# TRIX - 3D Companion App

**混合架构的智能 PC 控制伴侣**

TRIX 是一个创新的移动应用,通过混合架构实现云端数据存储和本地 PC 实时控制。

## 🏗️ 架构

### 数据层 (云端) - Supabase
- 🔐 用户认证与会话管理
- 👤 用户资料 (积分、衣柜配置)
- 📜 任务历史记录
- ☁️ 跨设备数据同步

### 操作层 (本地) - WebSocket
- 🔌 实时双向通信
- 💻 本地 PC 控制
- 📊 实时进度反馈
- 🤖 OpenClaw 集成准备

---

## 🚀 快速开始

### 自动安装 (推荐)
```bash
.\setup.ps1
```

### 手动安装

#### 1. 前端依赖
```bash
npm install
npm install @supabase/supabase-js
```

#### 2. 配置环境变量
```bash
copy .env.example .env
# 编辑 .env 填入 Supabase 凭据
```

#### 3. Python 后端
```bash
pip install -r requirements.txt
```

#### 4. 启动服务

**终端 1 - Python 服务器:**
```bash
python server.py
```

**终端 2 - 前端开发服务器:**
```bash
npm run dev
```

---

## 📋 前置条件

- **Node.js** 18+
- **Python** 3.7+
- **Supabase 账号** (免费)

---

## 📚 文档

| 文档 | 描述 |
|------|------|
| [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md) | 📖 完整实施指南 |
| [INTEGRATION_SUMMARY.md](INTEGRATION_SUMMARY.md) | 📝 集成总结与架构说明 |
| [QUICK_REFERENCE.md](QUICK_REFERENCE.md) | ⚡ 快速参考卡片 |
| [SERVER_SETUP.md](SERVER_SETUP.md) | 🐍 Python 服务器设置 |

---

## 🎯 核心功能

### 已实现 ✅
- ✅ 用户注册/登录 (Supabase Auth)
- ✅ 实时 PC 连接状态显示
- ✅ WebSocket 双向通信
- ✅ 命令发送与执行
- ✅ 实时进度反馈
- ✅ 任务状态追踪

### 开发中 🚧
- 🚧 用户资料管理
- 🚧 积分系统
- 🚧 任务历史记录
- 🚧 OpenClaw 真实集成

---

## 🛠️ 技术栈

### 前端
- **React** 18 + TypeScript
- **Vite** - 构建工具
- **TailwindCSS** - 样式
- **React Router** - 路由
- **Supabase Client** - 数据库客户端

### 后端
- **Python** 3.x
- **WebSockets** - 实时通信
- **Supabase** - 数据库 & 认证

---

## 📡 WebSocket 命令

```typescript
// 发送命令
sendCommand('organize_files');    // 整理文件
sendCommand('clean_downloads');    // 清理下载
sendCommand('take_screenshot');    // 截图
sendCommand('ping');               // 测试连接
```

---

## 🗄️ 数据库架构

### profiles 表
```sql
- id (UUID, 主键)
- username (TEXT)
- points (INTEGER)
- avatar_config (JSONB)
```

### task_history 表
```sql
- id (UUID, 主键)
- user_id (UUID, 外键)
- task_type (TEXT)
- points_earned (INTEGER)
- status (TEXT)
```

---

## 🔐 安全特性

- ✅ Row Level Security (RLS)
- ✅ 用户数据隔离
- ✅ 环境变量保护
- ✅ 安全的 API 密钥管理

---

## 🐛 故障排除

### WebSocket 连接失败
```bash
# 检查端口
netstat -an | findstr 8080

# 查看服务器日志
python server.py
```

### Supabase 认证问题
```bash
# 检查环境变量
Get-Content .env

# 重启开发服务器
npm run dev
```

更多问题请查看 [QUICK_REFERENCE.md](QUICK_REFERENCE.md)

---

## 📞 联系与支持

- 📖 查看文档获取详细信息
- 🐛 遇到问题? 检查 [故障排除](#-故障排除)
- 💡 建议? 欢迎提 Issue

---

## 📄 许可证

MIT License

---

**Made with ❤️ by TRIX Team**
