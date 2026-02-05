# ✅ TRIX 安装检查清单

按照此清单确保所有步骤都已正确完成。

---

## 📋 第一阶段: 环境准备

### 系统要求
- [ ] Node.js 18+ 已安装 (`node --version`)
- [ ] npm 已安装 (`npm --version`)
- [ ] Python 3.7+ 已安装 (`python --version`)
- [ ] pip 已安装 (`pip --version`)

### 工具
- [ ] VS Code 或其他代码编辑器
- [ ] PowerShell (Windows) 或 Terminal (Mac/Linux)
- [ ] 网络浏览器 (Chrome/Edge/Firefox)

---

## 📋 第二阶段: 前端设置

### 依赖安装
- [ ] 运行 `npm install`
- [ ] 运行 `npm install @supabase/supabase-js`
- [ ] 检查 `node_modules` 文件夹已创建

### 环境配置
- [ ] `.env.example` 文件存在
- [ ] 复制为 `.env` (`copy .env.example .env`)
- [ ] `.env` 包含 `VITE_SUPABASE_URL`
- [ ] `.env` 包含 `VITE_SUPABASE_ANON_KEY`

---

## 📋 第三阶段: Supabase 设置

### 项目创建
- [ ] 访问 https://app.supabase.com
- [ ] 创建新项目
- [ ] 记录数据库密码
- [ ] 项目状态为 "Active"

### API 密钥
- [ ] 进入 Settings → API
- [ ] 复制 Project URL
- [ ] 复制 anon/public key
- [ ] 粘贴到 `.env` 文件

### 数据库设置
- [ ] 进入 SQL Editor
- [ ] 创建新查询
- [ ] 粘贴完整 SQL 代码 (见 IMPLEMENTATION_GUIDE.md)
- [ ] 成功执行 (无错误)
- [ ] 在 Table Editor 中看到 `profiles` 表
- [ ] 在 Table Editor 中看到 `task_history` 表

### 认证配置
- [ ] 进入 Authentication → Settings
- [ ] 检查 Email Auth 已启用
- [ ] (可选) 配置邮箱确认设置

---

## 📋 第四阶段: Python 后端设置

### 依赖安装
- [ ] `requirements.txt` 文件存在
- [ ] 运行 `pip install -r requirements.txt`
- [ ] `websockets` 包已安装 (`pip list | findstr websockets`)

### 服务器测试
- [ ] `server.py` 文件存在
- [ ] 运行 `python server.py`
- [ ] 看到 "Starting TRIX WebSocket Server on 0.0.0.0:8080"
- [ ] 看到 "Waiting for connections..."
- [ ] 无错误消息

### 网络配置
- [ ] 查找本地 IP (`ipconfig` on Windows)
- [ ] 记录 IPv4 地址
- [ ] 检查防火墙未阻止端口 8080

---

## 📋 第五阶段: 前端启动

### 开发服务器
- [ ] 运行 `npm run dev`
- [ ] 看到 "VITE v... ready in ...ms"
- [ ] 看到本地 URL (通常是 http://localhost:5173)
- [ ] 浏览器自动打开 (或手动打开)

### 页面加载
- [ ] 应用正常加载
- [ ] 无控制台错误
- [ ] 看到登录/注册页面

---

## 📋 第六阶段: 功能测试

### 认证测试
- [ ] 点击"注册"
- [ ] 填写:
  - 用户名: `testuser`
  - 邮箱: `test@example.com`
  - 密码: `password123`
- [ ] 成功注册 (看到"注册成功"消息)
- [ ] 自动跳转到主页
- [ ] 在 Supabase Dashboard → Authentication → Users 看到新用户

### 用户资料检查
- [ ] 在 Supabase Dashboard → Table Editor → profiles
- [ ] 看到新创建的用户资料
- [ ] `username` = testuser
- [ ] `points` = 0
- [ ] `avatar_config` 有默认值

### WebSocket 连接测试
- [ ] 确保 `server.py` 正在运行
- [ ] 刷新前端页面
- [ ] 主页右上角状态显示 "🟢 在线"
- [ ] 在 Python 终端看到 "Client connected: ..."

### 命令执行测试
- [ ] 进入聊天页面
- [ ] 点击 "TRIX 机器人"
- [ ] 输入: `整理文件`
- [ ] 看到任务卡片出现
- [ ] 进度条从 0% → 100%
- [ ] 看到成功消息: "Successfully organized 42 files..."
- [ ] Python 终端显示命令日志

---

## 📋 第七阶段: 文档检查

### 文档完整性
- [ ] `README.md` 已更新
- [ ] `IMPLEMENTATION_GUIDE.md` 存在
- [ ] `INTEGRATION_SUMMARY.md` 存在
- [ ] `QUICK_REFERENCE.md` 存在
- [ ] `SERVER_SETUP.md` 存在
- [ ] `ARCHITECTURE.md` 存在

### 脚本文件
- [ ] `setup.ps1` 存在
- [ ] `.env.example` 存在
- [ ] `requirements.txt` 存在

---

## 📋 第八阶段: 代码检查

### 新文件确认
- [ ] `src/lib/supabase.ts` 存在
- [ ] `src/contexts/AuthContext.tsx` 存在
- [ ] `src/hooks/usePCConnection.ts` 存在
- [ ] `src/screens/ChatDetail.new.tsx` 存在

### 更新文件确认
- [ ] `App.tsx` 包含 `<AuthProvider>`
- [ ] `screens/Auth.tsx` 使用 `useAuth()`
- [ ] `screens/Home.tsx` 使用 `usePCConnection()`

---

## 📋 故障排除检查

### 如果 TypeScript 报错
- [ ] 确认已运行 `npm install`
- [ ] 尝试重启 VS Code
- [ ] 检查 `tsconfig.json` 存在

### 如果 WebSocket 连接失败
- [ ] 检查 `server.py` 是否在运行
- [ ] 检查端口 8080 未被占用 (`netstat -an | findstr 8080`)
- [ ] 检查防火墙设置

### 如果 Supabase 认证失败
- [ ] 检查 `.env` 文件存在
- [ ] 检查环境变量拼写正确
- [ ] 重启开发服务器 (`npm run dev`)
- [ ] 清除浏览器缓存和 localStorage

---

## 🎉 完成确认

### 最终测试
- [ ] 用户可以注册新账号
- [ ] 用户可以登录
- [ ] 主页显示 "在线" 状态
- [ ] 可以发送命令并看到进度
- [ ] 任务完成后显示成功消息
- [ ] 可以登出并重新登录

### 性能检查
- [ ] 页面加载快速 (< 3秒)
- [ ] WebSocket 连接稳定
- [ ] 无内存泄漏 (Chrome DevTools)
- [ ] 无控制台错误

---

## 📊 成功标准

✅ **基础功能 (必须)**
- 用户认证系统工作正常
- WebSocket 连接成功
- 可以发送并执行命令
- 数据正确保存到 Supabase

✅ **高级功能 (推荐)**
- 实时进度更新
- 错误处理正常
- 自动重连工作
- UI 响应流畅

---

## 🚀 下一步

完成所有检查后:

1. ✅ 阅读 `INTEGRATION_SUMMARY.md` 了解架构
2. ✅ 查看 `QUICK_REFERENCE.md` 作为速查手册
3. ✅ 开始开发新功能!

---

**祝贺! 你已成功完成 TRIX 生产模式集成!** 🎊

如有问题,请查看:
- 📖 IMPLEMENTATION_GUIDE.md - 详细指南
- 📖 QUICK_REFERENCE.md - 常见问题
- 📖 ARCHITECTURE.md - 架构说明
