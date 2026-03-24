# 项目启动说明

> **最后更新**: 2026-03-23

---

## 1. 环境要求

| 依赖 | 版本 | 说明 |
|------|------|------|
| Node.js | 22+ | npm 10+ |
| pnpm | 8+ | 推荐包管理器 |
| Xcode | 15+ | iOS 18.0 部署 |
| XcodeGen | 最新 | 生成 Xcode 项目 |
| OpenClaw | 最新 | Desktop Gateway 控制 |

---

## 2. 安装

```bash
git clone https://github.com/your-org/trix-3d-companion.git
cd trix-3d-companion
npm install
```

---

## 3. Web 开发

```bash
# 开发模式（端口 5173）
npm run dev

# 生产构建
npm run build
```

**Web 连接到 TRIX Native Server**（由 `VITE_TRIX_NATIVE_SERVER_URL` 配置）。

**技术栈**：React 19.2.4 + TypeScript 5.8.2 + Vite 6.2.0 + Tailwind CSS 4.2.0

---

## 4. Desktop 开发

```bash
# 安装 OpenClaw（如果尚未安装）
npm install -g openclaw

# 开发模式（dev port 5174）
npm run dev:desktop

# 生产构建
npm run build:desktop
```

**Desktop 启动 OpenClaw Gateway**（本地子进程，端口 18789）。

**技术栈**：Electron 33.4 + React 19.2.4 + Tailwind CSS 4.2.0

---

## 5. iOS 开发

```bash
# 生成 Xcode 项目（首次）
cd ios/TRIX3DCompanion
xcodegen generate

# 打开 Xcode
open TRIX3DCompanion.xcworkspace

# 或直接编译
xcodebuild -workspace TRIX3DCompanion.xcworkspace \
  -scheme TRIX3DCompanion \
  -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 16' \
  build
```

**注意**：
- 使用 `TRIX3DCompanion.xcworkspace`（**不是** `.xcodeproj`）
- Podfile 为空（未使用 CocoaPods），完全依赖 **Swift Package Manager**

**技术栈**：Swift 5.9 + SwiftUI + iOS 18.0

---

## 6. 数据库

使用 **Supabase (PostgreSQL)**，无需本地安装：

1. 访问 [Supabase Dashboard](https://supabase.com/dashboard)
2. 创建项目或使用现有项目
3. 在 `.env.local` 中配置 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`

---

## 7. OpenClaw Gateway

Desktop 应用自带 OpenClaw Gateway 管理界面（`openclaw:install`、`gateway:start`）。

手动命令：

```bash
# 检查插件
openclaw plugins doctor

# 查看通道状态
openclaw channels status --probe

# 登录 TRIX Native Channel
openclaw channels login --channel trix-native --account default --verbose
```

---

## 8. 项目结构

```
trix-3d-companion/
├── src/                      # Web 端（React 19.2）
│   ├── services/             # 27 个服务文件
│   ├── contexts/             # 4 个 React Context
│   ├── components/          # 60+ 组件
│   └── screens/             # 17 个页面
│
├── desktop/                  # Desktop 端（Electron 33.4）
│   ├── src/main/             # 主进程
│   ├── src/renderer/        # 渲染进程（React）
│   └── src/preload/         # 预加载脚本
│
├── ios/TRIX3DCompanion/      # iOS 端（SwiftUI, 988 Swift 文件）
│   ├── Core/Services/       # 71 个服务文件
│   ├── Features/            # 14 个功能模块
│   └── project.yml          # XcodeGen 配置
│
└── packages/
    └── trix-openclaw-native/  # OpenClaw TRIX Native 插件
```

---

## 9. 关键端口

| 服务 | 端口 | 说明 |
|------|------|------|
| Web Dev Server | 5173 | Vite 开发服务器 |
| Desktop Dev Server | 5174 | Electron Vite |
| OpenClaw Gateway | 18789 | Desktop 内置 |
| TRIX Native Server | 8788 | 生产服务 |

---

**最后更新**: 2026-03-23
