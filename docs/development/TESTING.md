# TRIX 3D Companion - 测试指南

> **最后更新**: 2026-02-22
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
└── server/clawbot-channel/tests/
    ├── pairing-message.test.js      # 配对消息测试
    ├── tts-sanitizer.test.js        # TTS 文本清理测试
    ├── tts-cache-policy.test.js     # TTS 缓存策略测试
    ├── tts-sanitizer-extended.test.js  # 扩展 TTS 文本测试
    ├── message-service-extended.test.js # 扩展消息服务测试
    ├── pairing-service-extended.test.js # 扩展配对服务测试
    └── api-integration.test.js      # API 集成测试
```

---

## 快速开始

### 安装依赖

```bash
npm install
cd server/clawbot-channel && npm install
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

### 运行后端测试

```bash
# 基础测试
npm run test:server

# 扩展测试
npm run test:server:extended
```

### 运行 API 集成测试

```bash
# 需要先启动服务器
cd server/clawbot-channel && npm run dev &

# 运行集成测试
npm run test:api
```

---

## 测试覆盖范围

### 前端单元测试

| 模块 | 文件 | 覆盖内容 |
|------|------|---------|
| **工具函数** | `dateFormat.test.ts` | 时间格式化、相对时间、智能日期显示 |
| | `env.test.ts` | 环境变量验证、回环地址检测 |
| **服务** | `ttsService.test.ts` | TTS API 调用、故障转移、错误处理 |
| | `voicePlaybackService.test.ts` | 音频播放、解锁、回调处理 |
| | `ClawbotChannelBridge.test.ts` | WebSocket 连接、配对流程、消息收发 |
| **组件** | `HomeBotBubble.test.tsx` | 渲染、点击事件、状态显示 |
| **功能** | `aiPrompt.test.ts` | AI 动作前缀检测、替换、清理 |

### 后端测试

| 模块 | 文件 | 覆盖内容 |
|------|------|---------|
| **配对服务** | `pairing-service-extended.test.js` | 配对码生成、验证、生命周期 |
| **消息服务** | `message-service-extended.test.js` | 消息存储、投递、清理 |
| **TTS** | `tts-sanitizer-extended.test.js` | 文本清理、Markdown 处理 |
| | `tts-cache-policy.test.js` | 缓存策略、场景区分 |
| **API** | `api-integration.test.js` | HTTP 端点、错误处理、CORS |

### MVP 冒烟测试

| 测试 | 验证内容 |
|------|---------|
| 路由配置 | Token Monitor 入口已移除 |
| 懒加载 | 路由使用 Suspense + lazy |
| 部署脚本 | 仅保留 Clawbot 流程 |
| 国际化 | 无乱码占位符 |
| 地图功能 | Leaflet CSS 和 Mock 数据 |
| 快照功能 | 配对验证和统一头像 |
| 输入样式 | 深色文本在浅色背景 |
| HTML 配置 | 无 Tailwind CDN |
| 环境验证 | 生产环境禁止回环地址 |
| 原生对话框 | 禁用 alert/confirm |
| 主题系统 | .dark 类切换 |
| 聊天功能 | AI 前缀替换、IME 安全 |
| Bot 状态机 | IDLE/THINKING/SPEAKING 状态 |

---

## 测试命令汇总

```bash
# 完整测试套件
npm test

# 前端测试
npm run test:unit           # 单元测试
npm run test:unit:watch     # 监听模式
npm run test:unit:coverage  # 覆盖率报告
npm run test:smoke          # MVP 冒烟测试

# 后端测试
npm run test:server         # 基础测试
npm run test:server:extended # 扩展测试
npm run test:api            # API 集成测试
```

---

## 编写测试指南

### 前端单元测试 (Vitest)

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

describe('MyComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeDefined();
  });
});
```

### 后端测试 (Node.js Test Runner)

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');

test('my test', async () => {
  const result = await myFunction();
  assert.equal(result, expected);
});
```

---

## 持续集成

测试可在 CI/CD 管道中运行：

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm test
```

---

## 故障排除

### 常见问题

1. **Vitest 找不到模块**
   - 检查 `vitest.config.ts` 中的路径别名配置

2. **后端测试数据库错误**
   - 测试使用临时 SQLite 数据库
   - 确保没有其他进程占用测试数据库

3. **API 集成测试超时**
   - 确保服务器正在运行
   - 检查 `TEST_SERVER_URL` 环境变量

4. **Mock 不生效**
   - 确保在导入被测模块之前调用 `vi.mock()`
   - 使用 `vi.resetModules()` 重置模块缓存

---

**最后更新**: 2026-02-22
**维护者**: TRIX 3D Companion 开发团队
