# Web 架构文档

> 📚 Web 前端技术架构详解
> 🎯 基于 React 19 + TypeScript + Vite

---

## 🏗️ 架构概览

```
┌──────────────────────────────────────────────────────────────┐
│                     Web Architecture                          │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│  │   Browser   │───▶│    React    │───▶│  Services   │      │
│  │   (DOM)     │◀───│   (View)    │◀───│   (API)     │      │
│  └─────────────┘    └─────────────┘    └─────────────┘      │
│         │                  │                  │              │
│         ▼                  ▼                  ▼              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│  │   CSS/TW    │    │  Contexts   │    │  Supabase   │      │
│  │  (Styling)  │    │   (State)   │    │  (Backend)  │      │
│  └─────────────┘    └─────────────┘    └─────────────┘      │
│                               │                              │
│                               ▼                              │
│                        ┌─────────────┐                      │
│                        │   Hooks     │                      │
│                        │  (Logic)    │                      │
│                        └─────────────┘                      │
└──────────────────────────────────────────────────────────────┘
```

---

## 📁 目录结构详解

### 1. 组件层 (`src/components/`)

```
components/
├── ui/                      # 基础 UI 组件
│   ├── ConfirmModal.tsx     # 确认弹窗
│   └── ...
│
├── map/                     # 地图相关组件
│   ├── FriendPopupContent.tsx  # 好友弹窗
│   └── PlacePopupContent.tsx   # 地点弹窗
│
├── AIActionModal.tsx        # AI 操作弹窗
├── Avatar.tsx               # 头像组件
├── ErrorBoundary.tsx        # 错误边界
├── GlassPanel.tsx           # 毛玻璃面板
├── HeroBackground.tsx       # 英雄背景
├── HomeBotBubble.tsx        # 首页机器人气泡
├── LoadingSpinner.tsx       # 加载动画
├── MailPanel.tsx            # 邮件面板
├── MediaMessage.tsx         # 媒体消息
├── NotificationPanel.tsx    # 通知面板
├── QRScanner.tsx            # 二维码扫描
├── SnapshotModal.tsx        # 快照弹窗
├── StatsDetailDialog.tsx    # 统计详情
├── StudyBuddiesList.tsx     # 学习伙伴列表
├── WorkbenchCard.tsx        # 工作台卡片
└── WorkbenchModal.tsx       # 工作台弹窗
```

### 2. 页面层 (`src/screens/`)

| 页面 | 文件 | 功能 |
|------|------|------|
| 认证 | `Auth.tsx` | 登录/注册 |
| 首页 | `Home.tsx` | 主界面 + 工作台 |
| 聊天列表 | `Chat.tsx` | 好友列表 |
| 聊天详情 | `ChatDetail.tsx` | 单聊/群聊 |
| 学习室 | `Study.tsx` | 专注计时 |
| 地图 | `Map.tsx` / `SnapMapScreen.tsx` | 位置地图 |
| 积分商城 | `PointsMall.tsx` | 商品兑换 |
| 个人资料 | `Profile.tsx` | 用户信息 |
| 服装 | `Wardrobe.tsx` | 换装系统 |
| 配对 | `Pairing.tsx` / `QRCodePairing.tsx` | 设备配对 |
| 快照 | `Snapshot.tsx` | 相机拍照 |
| 诊断 | `Diagnostic.tsx` | 调试工具 |

### 3. 功能模块 (`src/features/`)

#### 聊天模块 (`features/chat/`)
```
chat/
├── components/
│   ├── MediaPreview.tsx     # 媒体预览
│   ├── MessageInput.tsx     # 消息输入
│   └── MessageList.tsx      # 消息列表
├── hooks/
│   └── useChatMessages.ts   # 聊天消息 Hook
└── utils/
    └── aiPrompt.ts          # AI 提示词工具
```

#### 学习模块 (`features/study/`)
```
study/
├── components/
│   ├── FocusStartAnimation.tsx  # 专注动画
│   ├── MusicSelector.tsx        # 音乐选择
│   ├── PointsModal.tsx          # 积分弹窗
│   ├── StudyHeader.tsx          # 学习头部
│   ├── StudyStats.tsx           # 学习统计
│   ├── SummaryModal.tsx         # 总结弹窗
│   └── TimerView.tsx            # 计时器视图
```

#### 待办事项 (`features/todo/`)
```
todo/
├── components/
│   ├── TodoForm.tsx         # 待办表单
│   └── TodoList.tsx         # 待办列表
├── store/
│   └── todoStore.tsx        # 状态管理
└── index.ts                 # 导出
```

#### 日程管理 (`features/schedule/`)
```
schedule/
├── components/
│   ├── ScheduleForm.tsx     # 日程表单
│   └── ScheduleList.tsx     # 日程列表
├── store/
│   └── scheduleStore.tsx    # 状态管理
└── index.ts                 # 导出
```

### 4. 服务层 (`src/services/`)

| 服务 | 文件 | 功能 |
|------|------|------|
| 聊天桥接 | `ClawbotChannelBridge.ts` | WebSocket 通信 |
| 配对服务 | `clawbotPairingService.ts` | 设备配对 |
| 聊天服务 | `chatService.ts` | 消息存储 |
| 好友服务 | `friendService.ts` | 好友管理 |
| 通知服务 | `notificationService.ts` | 通知推送 |
| 学习会话 | `studySessionService.ts` | 学习记录 |
| 积分服务 | `pointsService.ts` | 积分管理 |
| 商城服务 | `mallService.ts` | 商品管理 |
| 地点服务 | `placeService.ts` | 地点数据 |
| 位置服务 | `locationService.ts` | 位置共享 |
| 服装服务 | `wardrobeService.ts` | 换装系统 |
| 上传服务 | `uploadService.ts` | 文件上传 |
| OSS 服务 | `serverOssUploadService.ts` | 阿里云 OSS |
| TTS 服务 | `ttsService.ts` | 语音合成 |
| 语音播放 | `voicePlaybackService.ts` | 语音播放 |
| 待办服务 | `todoService.ts` | 待办事项 |
| 日程服务 | `scheduleService.ts` | 日程管理 |
| 用户统计 | `userStatsService.ts` | 用户数据 |
| 项目服务 | `projectService.ts` | 项目管理 |
| 成就服务 | `achievementService.ts` | 成就系统 |
| 存储服务 | `StorageService.ts` | 本地存储 |
| 数据库服务 | `databaseService.ts` | 数据库操作 |

### 5. 状态管理 (`src/contexts/`)

| Context | 文件 | 功能 |
|---------|------|------|
| 认证 | `AuthContext.tsx` | 用户登录状态 |
| 主题 | `ThemeContext.tsx` | 明暗主题 |
| 语音设置 | `VoiceSettingsContext.tsx` | TTS 设置 |
| 聊天桥接 | `ClawbotChannelContext.tsx` | WebSocket 连接 |
| 二维码配对 | `QRCodePairingContext.tsx` | QR 配对状态 |

---

## 🔧 核心技术

### React 19 + TypeScript

```typescript
// 严格模式配置 (tsconfig.json)
{
  "compilerOptions": {
    "strict": true,
    "noEmit": true,
    "jsx": "react-jsx"
  }
}
```

### 状态管理方案

1. **React Context** - 全局状态
   - 用户认证
   - 主题设置
   - WebSocket 连接

2. **React State** - 局部状态
   - 表单数据
   - UI 状态

3. **URL State** - 路由状态
   - 页面导航
   - 查询参数

### 样式方案

```typescript
// Tailwind CSS 4.0
import '@tailwindcss/vite';

// 毛玻璃效果
<div className="bg-white/10 backdrop-blur-xl border border-white/20">
  {/* Content */}
</div>
```

### 动画方案

```typescript
// Framer Motion
import { motion } from 'framer-motion';

<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -20 }}
>
  {/* Content */}
</motion.div>
```

---

## 📡 网络通信

### Supabase 集成

```typescript
// src/config/supabase.ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

### WebSocket 通信

```typescript
// ClawbotChannelBridge.ts
class ClawbotChannelBridge {
  private socket: Socket;

  connect(url: string) {
    this.socket = io(url, {
      transports: ['websocket'],
      auth: { token }
    });
  }

  emit(event: string, data: any) {
    this.socket.emit(event, data);
  }

  on(event: string, callback: Function) {
    this.socket.on(event, callback);
  }
}
```

---

## 🎨 UI 组件库

### 基础组件

- **Avatar** - 头像
- **Button** - 按钮
- **Modal** - 弹窗
- **Card** - 卡片
- **Input** - 输入框
- **List** - 列表
- **LoadingSpinner** - 加载

### 特色组件

- **GlassPanel** - 毛玻璃面板
- **HeroBackground** - 3D 背景
- **WorkbenchModal** - 工作台
- **QRScanner** - 二维码扫描

---

## 🧪 测试策略

### 单元测试

```typescript
// Vitest
import { describe, it, expect } from 'vitest';

describe('MyComponent', () => {
  it('should render correctly', () => {
    // Test code
  });
});
```

### E2E 测试

```typescript
// Playwright
test('user can login', async ({ page }) => {
  await page.goto('/auth');
  await page.fill('[name="email"]', 'test@example.com');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/');
});
```

---

## 📦 依赖管理

### 核心依赖

```json
{
  "dependencies": {
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "react-router-dom": "^7.13.0",
    "@supabase/supabase-js": "^2.94.0",
    "framer-motion": "^12.33.0",
    "lucide-react": "^0.563.0",
    "socket.io-client": "^4.8.3",
    "leaflet": "^1.9.4",
    "react-leaflet": "^5.0.0",
    "i18next": "^25.8.9"
  }
}
```

### 开发依赖

```json
{
  "devDependencies": {
    "typescript": "~5.8.2",
    "vite": "^6.2.0",
    "vitest": "^1.3.1",
    "@testing-library/react": "^16.0.0",
    "tailwindcss": "^4.2.0",
    "@playwright/test": "^1.58.2"
  }
}
```

---

## 🚀 构建优化

### Vite 配置

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    compression() // Gzip 压缩
  ],
  build: {
    target: 'esnext',
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js']
        }
      }
    }
  }
});
```

### 性能优化

1. **代码分割** - 路由级别
2. **懒加载** - React.lazy()
3. **Tree Shaking** - 自动移除未使用代码
4. **图片优化** - 压缩 + WebP
5. **缓存策略** - Service Worker

---

## 🌐 国际化

### i18next 配置

```typescript
// src/i18n/index.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: require('./locales/en.json') },
    zh: { translation: require('./locales/zh.json') },
    ja: { translation: require('./locales/ja.json') }
  },
  lng: 'zh',
  fallbackLng: 'en'
});
```

---

## 🔐 安全措施

1. **XSS 防护** - React 自动转义
2. **CSRF 保护** - Token 验证
3. **输入验证** - 类型检查
4. **敏感数据** - 环境变量
5. **HTTPS** - 强制加密

---

**最后更新**: 2026-03-01
**版本**: 2.0
