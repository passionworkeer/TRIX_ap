# TRIX 3D Companion - 测试指南

> **最后更新**: 2026-03-16
> **测试框架**: Vitest + Node.js Test Runner

---

## 测试结构

```
trix-3d-companion/
├── src/
│   ├── utils/
│   │   ├── dateFormat.test.ts      # 日期格式化工具测试
│   │   └── env.test.ts             # 环境变量工具测试
│   ├── services/
│   │   ├── ttsService.test.ts      # TTS 服务测试
│   │   ├── voicePlaybackService.test.ts  # 语音播放服务测试
│   │   └── ClawbotChannelBridge.test.ts  # Bot 连接桥测试
│   ├── components/
│   │   └── HomeBotBubble.test.tsx  # 组件测试
│   └── features/chat/utils/
│       └── aiPrompt.test.ts        # AI 提示词工具测试
│
├── tests/
│   └── smoke/
│       └── mvp-smoke.test.mjs      # MVP 冒烟测试
│
└── packages/trix-openclaw-native/test/
    ├── pairing.test.ts              # 配对服务测试
    └── server.test.ts               # 服务器测试
```

---

## 快速开始

### 安装依赖

```bash
npm install
cd packages/trix-openclaw-native && npm install
```

### 运行所有测试

```bash
npm test
```

### 运行前端单元测试

```bash
# 运行一次
npm run test:unit

# 监听模式
npm run test:unit:watch

# 带覆盖率报告
npm run test:unit:coverage
```

### 运行 TRIX Native Server 测试

```bash
cd packages/trix-openclaw-native
npm test
```

### 运行 E2E 测试

```bash
# 运行 E2E 测试
npm run test:e2e

# UI 模式
npm run test:e2e:ui
```

---

## 测试覆盖范围

### 前端单元测试

| 模块 | 文件 | 覆盖内容 |
|------|------|---------|
| **工具函数** | `dateFormat.test.ts` | 时间格式化、相对时间，智能日期显示 |
| | `env.test.ts` | 环境变量验证，回环地址检测 |
| **服务** | `ttsService.test.ts` | TTS API 调用、故障转移、错误处理 |
| | `voicePlaybackService.test.ts` | 音频播放、解锁、回调处理 |
| **组件** | `HomeBotBubble.test.tsx` | 渲染、交互、状态管理 |

### TRIX Native Server 测试

| 模块 | 文件 | 覆盖内容 |
|------|------|---------|
| **配对服务** | `pairing.test.ts` | 配对码生成、认领、状态管理 |
| **服务器** | `server.test.ts` | API 端点、健康检查 |

---

## 测试命令

| 命令 | 描述 |
|------|------|
| `npm run test` | 运行所有测试 |
| `npm run test:unit` | 前端单元测试 |
| `npm run test:unit:watch` | 前端单元测试（监听模式） |
| `npm run test:unit:coverage` | 前端单元测试 + 覆盖率 |
| `npm run test:smoke` | 冒烟测试 |
| `npm run test:e2e` | E2E 测试 |
| `npm run test:e2e:ui` | E2E 测试（UI 模式） |
| `npm run test:all` | 运行全部测试 |

---

## CI/CD 集成

测试在 CI/CD 中自动运行：

```yaml
# .github/workflows/test.yml
- name: Run tests
  run: npm test

- name: Run E2E
  run: npm run test:e2e
```

---

## 调试技巧

### 查看测试覆盖率

```bash
npm run test:unit:coverage
# 打开 coverage/icov-report/index.html 查看报告
```

### 运行单个测试文件

```bash
npm run test:unit -- src/utils/dateFormat.test.ts
```

### 调试模式

```bash
npm run test:e2e:debug
```
