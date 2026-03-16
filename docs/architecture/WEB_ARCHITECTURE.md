# Web 前端架构文档

> 📚 TRIX 3D Companion Web 端技术架构
> 🎯 基于 React 19 + TypeScript + Vite
> **最后更新**: 2026-03-04

---

## 1. 架构概览

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Web Architecture                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐              │
│  │   Browser   │───▶│    React    │───▶│  Services   │              │
│  │   (DOM)     │◀───│   (View)    │◀───│   (API)     │              │
│  └─────────────┘    └─────────────┘    └─────────────┘              │
│        │                  │                  │                          │
│        ▼                  ▼                  ▼                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐              │
│  │   CSS/TW    │    │  Contexts   │    │  Supabase   │              │
│  │  (Styling)  │    │   (State)   │    │  (Backend)  │              │
│  └─────────────┘    └─────────────┘    └─────────────┘              │
│                               │                                        │
│                               ▼                                        │
│                        ┌─────────────┐                                │
│                        │   Hooks     │                                │
│                        │  (Logic)    │                                │
│                        └─────────────┘                                │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                    External Services                             │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │  │
│  │  │   Clawbot   │  │    OpenClaw  │  │    Aliyun   │            │  │
│  │  │  Channel    │  │   Gateway   │  │     OSS     │            │  │
│  │  │  (Socket)   │  │    (WS)     │  │   (Upload)  │            │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘            │  │
│  └─────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 技术栈

| 类别 | 技术 | 版本 |
|-----|------|-----|
| 语言 | TypeScript | 5.8+ |
| 框架 | React | 19.2+ |
| 构建工具 | Vite | 6.2+ |
| 路由 | React Router | 7.x |
| 状态管理 | React Context | - |
| HTTP 客户端 | @supabase/supabase-js | 2.94+ |
| WebSocket | socket.io-client | 4.8+ |
| 地图 | Leaflet + react-leaflet | 5.0+ |
| 样式 | Tailwind CSS | 4.2+ |
| 动画 | Framer Motion | 12.33+ |
| 国际化 | i18next | 25.8+ |
| 测试 | Vitest + Playwright | - |

---

## 3. 目录结构

```
src/
├── components/                    # 通用 UI 组件
│   ├── ui/                       # 基础 UI 组件
│   │   ├── ConfirmModal.tsx      # 确认弹窗
│   │   └── ...
│   ├── map/                      # 地图相关组件
│   │   ├── FriendPopupContent.tsx  # 好友弹窗
│   │   └── PlacePopupContent.tsx   # 地点弹窗
│   ├── AIActionModal.tsx         # AI 操作弹窗
│   ├── Avatar.tsx                # 头像组件
│   ├── ErrorBoundary.tsx         # 错误边界
│   ├── GlassPanel.tsx            # 毛玻璃面板
│   ├── HeroBackground.tsx         # 英雄背景
│   ├── HomeBotBubble.tsx         # 首页机器人气泡
│   ├── LoadingSpinner.tsx         # 加载动画
│   ├── MailPanel.tsx             # 邮件面板
│   ├── MediaMessage.tsx           # 媒体消息
│   ├── NotificationPanel.tsx      # 通知面板
│   ├── QRScanner.tsx             # 二维码扫描
│   ├── SnapshotModal.tsx         # 快照弹窗
│   ├── StatsDetailDialog.tsx     # 统计详情
│   ├── StudyBuddiesList.tsx     # 学习伙伴列表
│   ├── WorkbenchCard.tsx         # 工作台卡片
│   └── WorkbenchModal.tsx        # 工作台弹窗
│
├── screens/                       # 页面组件
│   ├── Auth.tsx                  # 登录/注册
│   ├── Home.tsx                  # 主界面
│   ├── Chat.tsx                  # 聊天列表
│   ├── ChatDetail.tsx            # 聊天详情
│   ├── Study.tsx                 # 学习计时
│   ├── SnapMapScreen.tsx         # 地图
│   ├── PointsMall.tsx            # 积分商城
│   ├── Profile.tsx               # 个人资料
│   ├── Wardrobe.tsx              # 换装系统
│   ├── Pairing.tsx               # 配对
│   ├── QRCodePairing.tsx         # QR 配对
│   ├── Snapshot.tsx              # 拍照
│   └── Diagnostic.tsx            # 调试工具
│
├── features/                      # 功能模块
│   ├── chat/                      # 聊天模块
│   │   ├── components/
│   │   │   ├── MediaPreview.tsx
│   │   │   ├── MessageInput.tsx
│   │   │   └── MessageList.tsx
│   │   ├── hooks/
│   │   │   └── useChatMessages.ts
│   │   └── utils/
│   │       └── aiPrompt.ts
│   │
│   ├── study/                     # 学习模块
│   │   ├── components/
│   │   │   ├── FocusStartAnimation.tsx
│   │   │   ├── MusicSelector.tsx
│   │   │   ├── PointsModal.tsx
│   │   │   ├── StudyHeader.tsx
│   │   │   ├── StudyStats.tsx
│   │   │   ├── SummaryModal.tsx
│   │   │   └── TimerView.tsx
│   │   └── hooks/
│   │       ├── useCompanionSync.ts
│   │       └── useStudySession.ts
│   │
│   ├── todo/                      # 待办模块
│   │   ├── components/
│   │   │   ├── TodoForm.tsx
│   │   │   └── TodoList.tsx
│   │   └── store/
│   │       └── todoStore.ts
│   │
│   ├── schedule/                  # 日程模块
│   │   ├── components/
│   │   │   ├── ScheduleForm.tsx
│   │   │   └── ScheduleList.tsx
│   │   └── store/
│   │       └── scheduleStore.ts
│   │
│   ├── location/                  # 位置模块
│   │   └── components/
│   │       └── LocationPicker.tsx
│   │
│   └── wardrobe/                  # 衣柜模块
│
├── services/                       # 业务服务层
│   ├── ClawbotChannelBridge.ts   # WebSocket 通信
│   ├── clawbotPairingService.ts  # 设备配对
│   ├── chatService.ts            # 聊天服务
│   ├── friendService.ts           # 好友服务
│   ├── notificationService.ts    # 通知服务
│   ├── studySessionService.ts    # 学习会话
│   ├── pointsService.ts          # 积分服务
│   ├── mallService.ts            # 商城服务
│   ├── placeService.ts           # 地点服务
│   ├── locationService.ts        # 位置服务
│   ├── wardrobeService.ts        # 换装服务
│   ├── uploadService.ts          # 文件上传
│   ├── OSSService.ts            # 阿里云 OSS
│   ├── ttsService.ts            # 语音合成
│   ├── voicePlaybackService.ts   # 语音播放
│   ├── todoService.ts           # 待办服务
│   ├── scheduleService.ts       # 日程服务
│   ├── userStatsService.ts      # 用户统计
│   ├── achievementService.ts    # 成就服务
│   ├── StorageService.ts        # 本地存储
│   └── databaseService.ts       # 数据库操作
│
├── contexts/                      # 全局状态
│   ├── AuthContext.tsx          # 认证状态
│   ├── ThemeContext.tsx          # 主题状态
│   ├── VoiceSettingsContext.tsx  # TTS 设置
│   ├── ClawbotChannelContext.tsx # WebSocket 连接
│   └── QRCodePairingContext.tsx  # QR 配对状态
│
├── hooks/                         # 自定义 Hooks
│   ├── useTouchGestures.ts
│   └── ...
│
├── config/                        # 配置文件
│   ├── supabase.ts              # Supabase 配置
│   └── clawbotEndpoints.ts       # 端点配置
│
├── types/                         # 类型定义
│   └── ...
│
├── i18n/                          # 国际化
│   ├── index.ts
│   └── locales/
│       ├── en.json
│       ├── zh.json
│       ├── zh-TW.json
│       └── ja.json
│
├── utils/                         # 工具函数
│   ├── logger.ts                 # 日志
│   ├── env.ts                    # 环境变量
│   ├── dateFormat.ts             # 日期格式化
│   └── performance.ts             # 性能监控
│
├── App.tsx                        # 应用入口
└── main.tsx                       # 入口文件
```

---

## 4. 核心服务

### 4.1 ClawbotChannelBridge (WebSocket 通信)

**功能**: 与 clawbot-channel 服务器建立 WebSocket 连接，实现实时消息收发。

```typescript
// 核心功能
class ClawbotChannelBridge {
  private socket: Socket;

  // 连接服务器
  connect(url: string): void;

  // 断开连接
  disconnect(): void;

  // 发送消息
  emit(event: string, data: any): void;

  // 接收消息
  on(event: string, callback: Function): void;

  // 生成配对码
  generatePairingCode(): Promise<PairingData>;

  // 配对
  pairWithCode(code: string): Promise<void>;
}
```

**事件类型**:
- `connect` / `disconnect`: 连接状态
- `message`: 新消息
- `typing`: 对方正在输入
- `bot_response`: AI 机器人响应
- `pairing_update`: 配对状态更新
- `study_room_update`: 学习室更新

---

### 4.2 Supabase 集成

```typescript
// src/config/supabase.ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);
```

**主要功能**:
- 用户认证 (JWT)
- 实时订阅 (Realtime)
- 数据存储 (PostgreSQL)
- 文件存储 (Storage)

---

## 5. 页面功能

### 5.1 页面清单

| 页面 | 路由 | 功能 |
|------|------|------|
| 认证 | `/auth` | 登录/注册 |
| 首页 | `/` | 主界面 + 工作台 |
| 聊天列表 | `/chat` | 好友列表 |
| 聊天详情 | `/chat/:friendId` | 单聊/群聊 |
| 学习 | `/study` | 专注计时 |
| 地图 | `/map` | 位置地图 |
| 积分商城 | `/mall` | 商品兑换 |
| 个人资料 | `/profile` | 用户信息 |
| 服装 | `/wardrobe` | 换装系统 |
| 配对 | `/pairing` | 设备配对 |
| QR配对 | `/pairing/qr` | QR 配对 |
| 快照 | `/snapshot` | 相机拍照 |
| 诊断 | `/diagnostic` | 调试工具 |

### 5.2 路由配置

```typescript
// App.tsx (路由级代码分割)
const Auth = lazy(() => import('./screens/Auth'));
const Home = lazy(() => import('./screens/Home'));
const Chat = lazy(() => import('./screens/Chat'));
const ChatDetail = lazy(() => import('./screens/ChatDetail'));
const Study = lazy(() => import('./screens/Study'));
// ... 其他页面
```

---

## 6. 状态管理

### 6.1 Context 方案

| Context | 用途 |
|---------|------|
| `AuthContext` | 用户登录状态、token 管理 |
| `ThemeContext` | 明暗主题切换 |
| `VoiceSettingsContext` | TTS 语音设置 |
| `ClawbotChannelContext` | WebSocket 连接状态 |
| `QRCodePairingContext` | QR 配对状态 |

### 6.2 状态流转

```
用户操作 (View)
       │
       ▼
Context / Hook (State)
       │
       ▼
Service (API Call)
       │
       ├──▶ Supabase (数据存储)
       │
       └──▶ WebSocket (实时通信)
```

---

## 7. UI 组件

### 7.1 基础组件

- **Avatar** - 头像
- **Button** - 按钮
- **Modal** - 弹窗
- **Card** - 卡片
- **Input** - 输入框
- **List** - 列表
- **LoadingSpinner** - 加载动画

### 7.2 特色组件

- **GlassPanel** - 毛玻璃面板
  ```tsx
  <div className="bg-white/10 backdrop-blur-xl border border-white/20">
    {/* Content */}
  </div>
  ```
- **HeroBackground** - 3D 背景
- **WorkbenchModal** - 工作台
- **QRScanner** - 二维码扫描

### 7.3 动画方案

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

## 8. 网络通信

### 8.1 HTTP 通信

通过 Supabase 客户端进行 HTTP 请求：

```typescript
// 读取数据
const { data } = await supabase
  .from('messages')
  .select('*')
  .eq('sender_id', userId);

// 写入数据
const { error } = await supabase
  .from('messages')
  .insert({ sender_id: userId, content: 'Hello' });
```

### 8.2 WebSocket 通信

通过 Socket.IO 进行实时通信：

```typescript
const socket = io(CLAWBOT_SERVER_URL, {
  transports: ['websocket'],
  auth: { token }
});

socket.on('message', (msg) => {
  console.log('收到消息:', msg);
});

socket.emit('message', { content: 'Hello' });
```

---

## 9. 样式方案

### 9.1 Tailwind CSS 4.0

```typescript
// vite.config.ts
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
```

### 9.2 主题配置

```typescript
// 自定义颜色
colors: {
  primary: '#8B5CF6',    // 紫色
  secondary: '#EC4899',  // 粉色
  accent: '#F59E0B',    // 橙色
}
```

---

## 10. 国际化

### 10.1 i18next 配置

```typescript
// src/i18n/index.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: require('./locales/en.json') },
    zh: { translation: require('./locales/zh.json') },
    'zh-TW': { translation: require('./locales/zh-TW.json') },
    ja: { translation: require('./locales/ja.json') }
  },
  lng: 'zh',
  fallbackLng: 'en'
});
```

### 10.2 支持语言

| 语言 | 代码 | 状态 |
|------|------|------|
| 简体中文 | zh | ✅ |
| 繁体中文 | zh-TW | ✅ |
| English | en | ✅ |
| 日本語 | ja | ✅ |

---

## 11. 构建优化

### 11.1 Vite 配置

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    target: 'esnext',
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js'],
          leaflet: ['leaflet', 'react-leaflet'],
        }
      }
    }
  }
});
```

### 11.2 性能优化策略

1. **代码分割** - 路由级别懒加载
2. **Tree Shaking** - 自动移除未使用代码
3. **资源压缩** - Gzip + Brotli
4. **图片优化** - WebP 格式
5. **缓存策略** - Service Worker

---

## 12. 安全措施

| 安全措施 | 实现 |
|---------|------|
| XSS 防护 | React 自动转义 |
| CSRF 保护 | Token 验证 |
| 输入验证 | 类型检查 + 正则 |
| 敏感数据 | 环境变量管理 |
| HTTPS | 强制加密 |

---

## 13. 测试策略

### 13.1 单元测试 (Vitest)

```typescript
describe('chatService', () => {
  it('should send message', async () => {
    const result = await sendMessage('Hello');
    expect(result).toBeDefined();
  });
});
```

### 13.2 E2E 测试 (Playwright)

```typescript
test('user can login', async ({ page }) => {
  await page.goto('/auth');
  await page.fill('[name="email"]', 'test@example.com');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/');
});
```

---

## 14. 环境变量

```bash
# Supabase
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx

# Server
VITE_CLAWBOT_SERVER_URL=http://TRIX_SERVER_HOST:8765
VITE_GATEWAY_URL=ws://127.0.0.1:18789
```

---

## 15. 依赖清单

### 15.1 核心依赖

```json
{
  "dependencies": {
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "react-router-dom": "^7.13.0",
    "@supabase/supabase-js": "^2.94.0",
    "socket.io-client": "^4.8.3",
    "framer-motion": "^12.33.0",
    "lucide-react": "^0.563.0",
    "leaflet": "^1.9.4",
    "react-leaflet": "^5.0.0",
    "i18next": "^25.8.9"
  }
}
```

### 15.2 开发依赖

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

## 16. 性能指标

| 指标 | 目标值 | 当前状态 |
|------|--------|---------|
| 首屏加载 (FCP) | < 1.5s | ✅ |
| 交互延迟 (FID) | < 100ms | ✅ |
| 路由切换 | < 300ms | ✅ |
| API 响应 (p95) | < 500ms | ✅ |

---

**最后更新**: 2026-03-04
**版本**: 3.0
