# TRIX 3D Companion

TRIX 3D Companion 是一个专注于与 Bot 进行稳定连接的 React 可视化伴侣应用。

## 项目结构

- `src/` - 源代码目录
  - `components/` - UI 组件
  - `screens/` - 页面组件
  - `contexts/` - React Context (Auth, WebSocket)
  - `services/` - 业务逻辑服务 (Database, Bot)
  - `config/` - 项目配置 (Supabase, Metadata)
  - `database/` - 数据库初始化及迁移脚本
- `public/` - 静态资源
- `index.html` - 入口 HTML
- `vite.config.ts` - Vite 配置

## 核心特性

- **稳定 Bot 连接**: 专注于与 Clawbot Gateway 的稳定 WebSocket 通讯。
- **单用户模式**: 当前版本已优化为单用户模式，确保本地连接的可靠性。
- **3D 伴侣交互**: 支持 3D 模型的可视化及交互。

## 快速开始

1. **安装依赖**:

   ```bash
   npm install
   ```

2. **配置环境**:

   复制 `.env.example` 为 `.env` 并填写相关配置。

3. **启动开发服务器**:

   ```bash
   npm run dev
   ```

## 注意事项

- 直连模式下请确保本地 Gateway 已启动（默认端口 18789）。
- 若需通过手机访问，请在网页中手动填入电脑的局域网 IP。
