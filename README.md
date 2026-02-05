<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# TRIX - 3D Companion App

**混合架构的智能 PC 控制伴侣**

TRIX 是一个创新的移动应用,通过混合架构实现云端数据存储和本地 PC 实时控制。

## ✨ 新功能 (2026.02 更新)

### 🎉 6 大核心功能全部实现！

1. **💬 聊天历史记录持久化**
   - 所有对话自动保存到本地
   - 刷新页面后历史记录完整保留
   - 支持 Clawbot AI 和好友聊天

2. **📊 项目进度管理系统**
   - 真实的任务列表和完成度统计
   - 任务优先级和到期提醒
   - 动态进度条 + 流光动画效果
   - 点击任务即可切换完成状态

3. **🏫 好友自习室功能**
   - 实时显示正在学习的好友
   - 学习等级系统 (加油💪/努力📚/学霸🔥)
   - 学习时长统计和排行
   - 一键发送消息互动

4. **👥 好友列表与在线状态**
   - 实时在线状态 (在线🟢/忙碌🔴/离开🟡/离线⚫)
   - 未读消息红点提醒
   - 学习中状态标签
   - 动态好友数据加载

5. **📧 完整邮件系统**
   - 双栏布局邮件面板
   - 未读邮件高亮显示
   - 点击自动标记已读
   - 邮件删除和管理

6. **🔔 智能通知中心**
   - 通知类型分类 (消息/好友请求/系统)
   - 单个/批量标记已读
   - 好友请求交互按钮
   - 实时未读数量徽章

📖 **详细使用指南**: [QUICK_START_GUIDE.md](./docs/QUICK_START_GUIDE.md)  
📋 **功能实现文档**: [FEATURES_IMPLEMENTATION.md](./docs/FEATURES_IMPLEMENTATION.md)

---

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

### 存储层 (本地) - localStorage
- 💾 聊天历史持久化
- 👥 好友列表数据
- 📧 邮件和通知
- 📊 项目进度数据

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
| [IMPLEMENTATION_GUIDE.md](./docs/IMPLEMENTATION_GUIDE.md) | 📖 完整实施指南 |
| [INTEGRATION_SUMMARY.md](./docs/INTEGRATION_SUMMARY.md) | 📝 集成总结与架构说明 |
| [QUICK_REFERENCE.md](./docs/QUICK_REFERENCE.md) | ⚡ 快速参考卡片 |
| [SERVER_SETUP.md](./docs/SERVER_SETUP.md) | 🐍 Python 服务器设置 |

---

## 🧹 项目整理（docs / tests）

我为你准备了两段辅助脚本，帮助把零散的文档和测试资源集中到标准目录：

- `scripts/organize_docs.ps1` — 将项目根目录下的顶层 `.md`（除 `README.md`）复制到 `docs/` 目录（安全复制，保留原文件）。
- `scripts/collect_tests.ps1` — 在仓库中查找文件名包含 `test` 或 `spec` 的文件并复制到 `tests/` 目录。

使用方法（Windows PowerShell）：

```powershell
npm run organize:docs
npm run collect:tests
```

脚本采用复制而非移动策略以便你先审阅变动；确认无误后可手动替换为移动（或我也可以帮你把脚本改为移动并执行）。


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

更多问题请查看 [QUICK_REFERENCE.md](./docs/QUICK_REFERENCE.md)

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
