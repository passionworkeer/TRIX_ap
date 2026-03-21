# iOS 测试与打包完整指南

> 本文档介绍在 Windows 环境下开发、测试 iOS 应用并打包上架的完整方案
> **最后更新**: 2026-03-21

---

## 📋 目录

1. [测试阶段（免费）](#1-测试阶段免费)
2. [打包阶段（免费）](#2-打包阶段免费)
3. [上架阶段（付费）](#3-上架阶段付费)
4. [所需账号与密钥清单](#4-所需账号与密钥清单)
5. [完整流程图](#5-完整流程图)

---

## 1. 测试阶段（免费）

### 1.1 浏览器测试（核心）

**地址**: Chrome (https://www.google.com/chrome/) 或 Firefox (https://www.mozilla.org/)

**用途**: 开发期间验证 90%+ 功能

**测试内容**:
- 页面渲染
- 按钮点击
- 表单输入
- WebSocket 通信
- 路由跳转
- 响应式布局

**启动方式**:
```bash
npm run dev
# 访问 http://localhost:5173
```

### 1.2 跨浏览器测试（免费额度）

#### BrowserStack

| 项目 | 内容 |
|------|------|
| **官网** | https://www.browserstack.com |
| **注册** | 免费注册账号 |
| **免费额度** | 100 分钟/月设备测试 |
| **用途** | 在云端 iOS Safari 上测试网页 |

**使用方法**:
1. 注册 BrowserStack 账号
2. 进入 Live 页面
3. 选择 iOS 设备（如 iPhone 15）
4. 在云端 Safari 中打开你的网站 URL
5. 测试交互和功能

#### LambdaTest

| 项目 | 内容 |
|------|------|
| **官网** | https://www.lambdatest.com |
| **注册** | 免费注册账号 |
| **免费额度** | 60 分钟/月 |
| **用途** | 跨浏览器兼容性测试 |

**使用方法**:
1. 注册 LambdaTest 账号
2. 选择 Real Time Testing
3. 输入测试 URL
4. 选择 iOS 设备
5. 开始测试

---

## 2. 打包阶段（免费）

### 2.1 GitHub Actions 自动打包

| 项目 | 内容 |
|------|------|
| **官网** | https://github.com |
| **要求** | 代码托管在 GitHub |
| **免费额度** | 2000 分钟/月（macOS runner） |
| **用途** | 自动构建 iOS .ipa 文件 |

**配置步骤**:

#### Step 1: 创建 GitHub 仓库（如果没有）

1. 访问 https://github.com/new
2. 创建新仓库（如 `trix-3d-companion`）
3. 推送本地代码

#### Step 2: 添加 Apple 签名密钥

需要在 GitHub Secrets 中配置：

| Secret 名称 | 说明 | 获取方式 |
|-------------|------|---------|
| `APPLE_TEAM_ID` | Apple Team ID | Apple Developer 账号 |
| `APPLE_SIGNING_IDENTITY` | 签名证书 | 钥匙串访问 |
| `MATCH_PASSWORD` | 证书匹配密码 | 自己设置 |
| `API_KEY_ID` | App Store Connect API Key ID | App Store Connect |
| `API_KEY_ISSUER_ID` | App Store Connect Issuer ID | App Store Connect |
| `API_KEY_PRIVATE_KEY` | App Store Connect 私钥 | 下载 .p8 文件 |

> ⚠️ 这些密钥需要购买 Apple Developer 账号（$99/年）后才能获取

#### Step 3: 创建 Workflow 文件

创建 `.github/workflows/ios.yml`:

```yaml
name: iOS Build

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  build:
    runs-on: macos-14
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build Web
        run: npm run build

      - name: Build iOS project
        run: |
          cd ios/TRIX3DCompanion
          xcodebuild -workspace TRIX3DCompanion.xcworkspace -scheme TRIX3DCompanion -configuration Debug -destination 'platform=iOS Simulator,name=iPhone 15' build

      - name: Upload IPA
        uses: actions/upload-artifact@v4
        with:
          name: ios-app
          path: ios/TRIX3DCompanion/build/App.ipa
```

#### Step 4: 触发构建

```bash
git add .
git commit -m "feat: add iOS build workflow"
git push origin main
```

构建完成后，在 GitHub Actions 页面下载 .ipa 文件。

---

## 3. 上架阶段（付费）

### 3.1 Apple Developer 账号

| 项目 | 内容 |
|------|------|
| **官网** | https://developer.apple.com |
| **费用** | $99/年（约 700 元人民币） |
| **用途** | 签名证书、App Store 上架、TestFlight |

**注册步骤**:
1. 访问 Apple Developer 网站
2. 注册个人或企业账号
3. 完成实名认证
4. 支付 $99/年

### 3.2 TestFlight 内测（免费）

**用途**: 上架前邀请用户测试

**流程**:
1. 购买 Apple Developer 账号
2. 用 Transporter（Mac App Store 免费下载）上传 .ipa
3. 在 App Store Connect 添加内测用户
4. 用户通过 TestFlight App 安装测试

### 3.3 App Store 上架（最终）

**流程**:
1. 准备 App Store 截图和描述
2. 提交审核（约 1-3 天）
3. 审核通过后发布

---

## 4. 所需账号与密钥清单

### 免费阶段需要

| 工具/服务 | 网址 | 需要配置的内容 |
|-----------|------|---------------|
| GitHub | https://github.com | 创建仓库，推送代码 |
| BrowserStack | https://www.browserstack.com | 注册账号（免费） |
| LambdaTest | https://www.lambdatest.com | 注册账号（免费） |

### 付费阶段需要

| 工具/服务 | 网址 | 需要配置的内容 |
|-----------|------|---------------|
| Apple Developer | https://developer.apple.com | 支付 $99/年 |
| App Store Connect | https://appstoreconnect.apple.com | 创建 App，生成 API Key |
| Xcode（借 Mac/云 Mac） | Mac App Store | 签名证书配置 |

### GitHub Secrets（付费后配置）

| Secret 名称 | 获取位置 |
|-------------|---------|
| `APPLE_TEAM_ID` | Apple Developer 账号设置 |
| `API_KEY_ID` | App Store Connect → 用户和访问 → 密钥 |
| `API_KEY_ISSUER_ID` | App Store Connect → 用户和访问 → 密钥 |
| `API_KEY_PRIVATE_KEY` | 下载的 .p8 私钥文件内容 |
| `MATCH_PASSWORD` | 自己设置（证书匹配密码） |

---

## 5. 完整流程图

```
┌─────────────────────────────────────────────────────────────────┐
│                        开发阶段                                  │
│                                                                  │
│  Windows + VS Code                                              │
│       ↓                                                         │
│  npm run dev → Chrome 测试                                      │
│       ↓                                                         │
│  功能验证 OK                                                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      云端真机测试                                │
│                                                                  │
│  BrowserStack / LambdaTest                                     │
│       ↓                                                         │
│  云端 iOS Safari 测试                                          │
│       ↓                                                         │
│  兼容性 OK                                                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      打包阶段（免费）                            │
│                                                                  │
│  git push → GitHub Actions (macOS runner)                       │
│       ↓                                                         │
│  自动构建 .ipa                                                 │
│       ↓                                                         │
│  下载 .ipa 文件                                                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      上架阶段（付费）                            │
│                                                                  │
│  购买 Apple Developer ($99/年)                                  │
│       ↓                                                         │
│  Transporter 上传 .ipa                                          │
│       ↓                                                         │
│  TestFlight 内测                                               │
│       ↓                                                         │
│  提交 App Store 审核                                           │
│       ↓                                                         │
│  上架成功！                                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📌 总结

| 阶段 | 成本 | 需要做的事情 |
|------|------|------------|
| 开发测试 | ✅ 免费 | 浏览器 + BrowserStack |
| 自动打包 | ✅ 免费 | GitHub Actions |
| 上架 | $99/年 | Apple Developer + Transporter |

---

**下一步**:
1. 先用浏览器开发测试功能
2. 功能稳定后，购买 Apple Developer
3. 配置 GitHub Actions 打包
4. TestFlight 内测后上架

---

> 最后更新: 2026-03-21
