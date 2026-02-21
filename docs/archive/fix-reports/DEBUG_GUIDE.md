# TRIX App — Debug 指南

> 基于完整源码分析（2026-02-19）  
> 覆盖范围：`trix-3d-companion`（前端主应用）+ `nanobot`（AI Agent 后端）  
> 优先级定义：**P0** 崩溃/阻断 | **P1** 核心功能损坏 | **P2** 功能不完整/降级 | **P3** 体验缺陷/待办

---

## 目录

- [P0 — 崩溃/阻断级](#p0--崩溃阻断级)
- [P1 — 核心功能损坏](#p1--核心功能损坏)
- [P2 — 功能不完整/降级](#p2--功能不完整降级)
- [P3 — 体验缺陷/待办](#p3--体验缺陷待办)
- [附录：快速排查指令](#附录快速排查指令)

---

## P0 — 崩溃/阻断级

### P0-1 · OpenClaw Gateway 认证逻辑存在竞态条件

**文件：** `src/services/GatewayAPI.ts`（L59–L160）

**问题描述：**  
`connect()` 方法在 `connectionManager.connect()` 后用 `connectionManager.on('message', authHandler)` 注册了一个临时监听器处理认证挑战。  
但 `onConnected` 回调和 `authHandler` **在同一帧里触发**：如果服务器非常快地先发 `connect.challenge` 再发 `hello-ok`，此时 `authHandler` 还未注册（被 `setTimeout` 排在微任务队列后），就会**丢失 challenge 事件，导致永远卡在 `CONNECTED` 状态，认证超时报错**。

```
连接成功 → onConnected() 触发 → 随后注册 authHandler
                               ↑ 窗口期：challenge 消息可能在此期间到达
```

**复现方式：** 网络延迟低（局域网/本机）时最容易触发。

**修复方向：**  
在调用 `connectionManager.connect()` **之前**先注册 `authHandler`，或使用消息缓冲队列（先存后处理）。

---

### P0-2 · `NanobotContext` 和 `ClawbotChannelBridge` 同时启动导致双重连接

**文件：** `src/contexts/ClawbotChannelContext.tsx`（L64–L131）、`src/contexts/NanobotContext.tsx`（L50–L65）

**问题描述：**  
- `ClawbotChannelProvider` 在 `App.tsx` 顶层挂载，用户登录后**立即连接** `wss://m.jmtrick.com:socket.io`。  
- `NanobotContext` 在 `NanobotPairing` 页面使用，若用户之前保存了配对码，也会**自动重连** `ws://47.243.55.130:8766`。  
- 两个 Bridge 都有重试机制（最大 10 次），但 **`NanobotProvider` 从未在 `App.tsx` 的 Provider 树中挂载**。这意味着 `useNanobot()` 会在 `NanobotPairing.tsx` 中调用 `useContext` 并得到 `undefined`，**抛出运行时崩溃**。

```tsx
// App.tsx — NanobotProvider 缺失！
<AuthProvider>
  <ClawbotChannelProvider>    // ✅ 存在
    <HashRouter>
      ...  // NanobotPairing 页面里调用 useNanobot() → Context 是 undefined → 崩溃
    </HashRouter>
  </ClawbotChannelProvider>
</AuthProvider>
```

**修复方向：** 在 `App.tsx` 的 Provider 链中加入 `<NanobotProvider>`，或在 `NanobotPairing` 页面路由包裹处单独挂。

---

### P0-3 · `TokenMonitorContext` Provider 从未挂载，`TokenMonitor` 页面必崩

**文件：** `src/contexts/TokenMonitorContext.tsx`、`src/App.tsx`（L177）

**问题描述：**  
`TokenMonitor` 页面调用 `useTokenMonitor()`，但 `TokenMonitorProvider` **不在 `App.tsx` 的 Provider 树里**。`useTokenMonitor` 内部有守卫：

```ts
if (context === undefined) {
  throw new Error('useTokenMonitor must be used within TokenMonitorProvider');
}
```

访问 `/token-monitor` 路由时必然抛出 Error，触发 `ErrorBoundary`，**页面白屏**。

**修复方向：** 在 `App.tsx` 的路由包裹处为 `TokenMonitor` 添加 `<TokenMonitorProvider>`（类似 `QRCodePairing` 的处理方式）：

```tsx
<Route path={AppRoutes.TOKEN_MONITOR} element={
  <ProtectedRoute>
    <TokenMonitorProvider>
      <TokenMonitor />
    </TokenMonitorProvider>
  </ProtectedRoute>
} />
```

---

## P1 — 核心功能损坏

### P1-1 · Nanobot 配对成功后跳转目标使用 `nanobot` friendId，但 ChatDetail 只识别 `clawbot`

**文件：** `src/screens/NanobotPairing.tsx`（L35–L45）、`src/screens/ChatDetail.tsx`（L175–L195）

**问题描述：**  
`NanobotPairing` 配对成功后导航：
```ts
navigate(AppRoutes.CHAT_DETAIL, {
  state: { friendId: 'nanobot', isBot: true, ... }
});
```
但 `ChatDetail` 里只有两个判断条件：
```ts
if (friendId === 'clawbot' || friendId === 'clawbot_channel') { ... }
```
`nanobot` 不在识别列表中，会走**普通好友数据库流程**，尝试从 Supabase 加载不存在的 `friendId = 'nanobot'`，必然返回 null 并报错。  
**Nanobot 消息也不会显示。**

**修复方向：** 在 `ChatDetail` 中补充 `friendId === 'nanobot'` 的处理分支，监听 `NanobotBridge` 的消息而非 `ClawbotChannel`。

---

### P1-2 · OpenClaw Gateway 连接 URL 来源不一致，`Diagnostic` 和 `GatewayAPI` 读不同的环境变量

**文件：** `src/screens/Diagnostic.tsx`（L22）、`src/screens/DiagnosticAdvanced.tsx`（L18）、`src/contexts/TokenMonitorContext.tsx`（L67）

**问题描述：**

| 位置 | 读取的环境变量 |
|------|--------------|
| `Diagnostic.tsx` | `VITE_PC_WEBSOCKET_URL` |
| `DiagnosticAdvanced.tsx` | `VITE_PC_WEBSOCKET_URL` |
| `TokenMonitorContext` (GatewayAPI) | `VITE_GATEWAY_WS_URL` |

`.env.example` 中只定义了 `VITE_PC_WEBSOCKET_URL`，**`VITE_GATEWAY_WS_URL` 未定义**，导致 `TokenMonitorContext` 默认回退到 `ws://127.0.0.1:18789`（本机地址），在生产环境永远连不上。

**修复方向：** 统一使用同一个环境变量（推荐 `VITE_GATEWAY_WS_URL`），并在 `.env.example` 中补全。

---

### P1-3 · `ClawbotChannelBridge.pairWithQR()` 返回类型与 `Pairing.tsx` 期望不符

**文件：** `src/services/ClawbotChannelBridge.ts`、`src/screens/Pairing.tsx`（L106）  
**文件：** `src/contexts/ClawbotChannelContext.tsx`（L41）

**问题描述：**  
`ClawbotChannelContext` 声明：
```ts
pairWithQR: (token: string) => Promise<boolean>
```
但 `ClawbotChannelBridge.pairWithQR()` 实际返回 `Promise<{ success: boolean; ... }>`。  
Context 层的 `pairWithQR` 包装函数需要将对象转换为 `boolean`，如果逻辑有误，`Pairing.tsx` 中 `if (success)` 判断会得到 `undefined`（falsy），**扫码配对永远失败**。

**修复方向：** 对齐类型，确保 Context 层正确返回 `response.success`。

---

### P1-4 · `web_interface_final.py` 中 Nanobot 核心 API 调用依赖不存在的模块

**文件：** `nanobot/nanobot/web_interface_final.py`（L163–L200）

**问题描述：**  
`call_nanobot_api()` 函数中导入：
```python
from nanobot.agent.loop import AgentLoop
from nanobot.bus.queue import MessageBus
from nanobot.config.settings import Settings
from nanobot.providers.zhipu import ZhipuProvider
from nanobot.session.manager import SessionManager
```
但 `nanobot/` 目录中**没有任何 `agent/`、`bus/`、`config/`、`providers/`、`session/` 子包**，这些是对外部 nanobot 包（`1.py` 中的独立实现）的错误引用。  
每次 `/chat` 接口被调用都会抛出 `ImportError`，**聊天功能完全无法使用**。

**修复方向：** `web_interface_final.py` 应改为直接调用 `1.py` 中的接口逻辑（subprocess 或 import 同级文件），或将 `1.py` 重构为可导入模块。

---

### P1-5 · `nanobot/web_interface_final.py` 云端 WebSocket 端口与 App 端不匹配

**文件：** `nanobot/nanobot/web_interface_final.py`（L20）、`src/services/NanobotBridge.ts`（L47）

**问题描述：**

| 端 | URL |
|----|-----|
| Python 后端（`web_interface_final.py`） | `ws://47.243.55.130:8765` |
| 前端 App（`NanobotBridge.ts` 默认值） | `ws://47.243.55.130:8766` |

App 前端连的是 `8766`，Python 后端连的是 `8765`。若部署的是同一台服务器，**两端永远不在同一 channel，配对消息无法互通**。

**修复方向：** 统一端口，或通过 `VITE_NANOBOT_SERVER_URL` 环境变量明确配置。

---

### P1-6 · `Chat.tsx` 查询 `users` 表而不是 `profiles` 表，可能因 RLS 策略报权限错误

**文件：** `src/screens/Chat.tsx`（L70–L75）

**问题描述：**
```ts
const { data: allUsers, error: usersError } = await supabase
  .from('users')          // ← 直接查 users 表
  .select('id, username, display_name, email, bio')
```
但整个项目其他地方（`databaseService.ts`、`AuthContext` 等）统一使用 `profiles` 表。`users` 表若没有 RLS 策略或根本不存在，这里会返回空数据或权限错误，导致**推荐用户列表始终为空**。

**修复方向：** 将 `from('users')` 改为 `from('profiles')`，字段名对齐（`display_name` → 看 profiles 表实际字段）。

---

## P2 — 功能不完整/降级

### P2-1 · `SnapMapScreen` 好友位置全部是 Mock 数据，真实位置功能未实现

**文件：** `src/screens/SnapMapScreen.tsx`（L38–L105）

**问题描述：**  
页面调用了 `getFriends()` 从数据库获取好友列表，但好友的**地理坐标是通过硬编码偏移量**基于上海陆家嘴坐标计算的。  
`friends` 数据库表中没有 `location` 或 `latitude/longitude` 字段（`config/supabase.ts` 中 `FriendLatestMessage` 无位置字段）。  
**地图上显示的全是假的虚拟位置，不是真实好友位置。**

`mockPlaces`（虚拟地标数据：星巴克/海底捞等）也是写死的，与数据库无任何关联。

**修复方向：** 需要在 Supabase 中添加用户位置表，实现位置上报和查询逻辑。

---

### P2-2 · `Snapshot` 拍照结果页功能未对接，分析结果是静态假数据

**文件：** `src/screens/Snapshot.tsx`（L84–L150）

**问题描述：**  
拍照后跳转到 result 页面，但 result 页面展示的是**写死的图片和硬编码的商品信息**（显示某张 Mug 图片）。  
没有任何 AI 分析 API 调用，`handleScan()` 仅等待 2 秒后导航，没有上传照片也没有返回分析结果。  
`isScanning` 状态用了但没有实际意义。

**修复方向：** 接入 Vision API（如 OpenAI Vision 或 Clawbot 的 AI 能力），将 `capturedPhoto` 上传并解析结果。

---

### P2-3 · `Profile` 的装备系统（Outfit）是 UI 壳，无实际逻辑

**文件：** `src/screens/Profile.tsx`（L51–L60）

**问题描述：**
```ts
const handleGetMoreOutfits = () => {
  toast('完成任务和活动即可解锁新装备！', { icon: '🎁' });  // 仅 Toast
};
const handleOutfitChange = (outfitName: string) => {
  toast.success(t('profile.outfitEquipped', { name: outfitName }));  // 仅 Toast
};
```
装备获取和更换均只弹 Toast，**没有实际的解锁条件检查、数据库写入、或角色外观变化**。

---

### P2-4 · `Diagnostic` 页面读取 `VITE_PC_WEBSOCKET_URL`，该变量在生产 `.env.production` 中未配置

**文件：** `src/screens/Diagnostic.tsx`、`.env.production`

**问题描述：**  
`.env.production` 可能只配置了 Supabase 和 Clawbot Channel URL，`VITE_PC_WEBSOCKET_URL` 缺失。  
诊断页面在生产环境下显示的 URL 为 `NONE`，测试按钮无法工作，**生产环境无法自助排查连接问题**。

---

### P2-5 · `NanobotPairing.tsx` 存在路由注册问题

**文件：** `src/App.tsx`、`src/types.ts`

**问题描述：**  
`AppRoutes` 枚举中**没有** `NANOBOT_PAIRING` 路由，`NanobotPairing.tsx` 组件虽然已实现，但**从未被注册到路由表中**，用户无法通过任何导航到达该页面。

```ts
// types.ts — 缺少 NANOBOT_PAIRING
export enum AppRoutes {
  PAIRING = '/pairing',        // ClawbotChannel 配对
  QR_PAIRING = '/qr-pairing',  // 二维码配对
  // NANOBOT_PAIRING 根本不存在
}
```

**修复方向：** 在 `AppRoutes` 加入 `NANOBOT_PAIRING = '/nanobot-pairing'`，在 `App.tsx` 注册路由。

---

### P2-6 · `nanobot/frontend` 的 `ChatScreen` 没有实现流式响应

**文件：** `nanobot/frontend/src/screens/ChatScreen.tsx`、`nanobot/frontend/src/services/api.ts`

**问题描述：**  
`api.ts` 已实现 `streamLogs()` 异步生成器（SSE），但 `ChatScreen` 中发送消息后调用的是 `sendMessage()` 普通 REST 接口，**等待完整响应后一次性渲染**。  
`1.py`（后端）使用 `subprocess` 调用 Nanobot，响应可能需要数十秒，UI 期间无任何进度反馈。

---

### P2-7 · `addFriend()` 直接插入双向好友关系，绕过好友请求审批流程

**文件：** `src/services/databaseService.ts`（L15–L73）

**问题描述：**  
`addFriend()` 立即将两条 `status: 'accepted'` 记录写入 `friends` 表，完全跳过了 `sendFriendRequest()` / 审批流程（`sendFriendRequest` 函数也存在但**没有被任何 UI 调用**）。  
用户可以单方面将任意人添加为好友。

---

## P3 — 体验缺陷/待办

### P3-1 · `GlassDock` 导航没有 Nanobot 入口

**文件：** `src/components/GlassDock.tsx`（L8–L16）

**问题描述：**  
底部导航栏只有 5 个标签：Map / Study / Camera(Home) / Chat / Profile。  
Nanobot 配对、Token Monitor、Diagnostic 等功能**没有入口**，只能通过开发者手动输入 URL 访问。

---

### P3-2 · `ClawbotChannelContext` 的 `isPaired` 状态计算不准确

**文件：** `src/contexts/ClawbotChannelContext.tsx`（L23–L26）

**问题描述：**  
`isPaired` 来自 `pairingStatus === 'paired'`，但 `pairingStatus` 初始化时**只读 `localStorage.getItem('clawbot_paired')`，不通过 WebSocket 验证**。  
如果 Bot 已解绑但 localStorage 未清理，`isPaired` 仍为 `true`，UI 显示"已配对"但实际无法收发消息。

---

### P3-3 · `SnapMapScreen` 和 `Map` 是两个独立的地图页面，功能重叠

**文件：** `src/screens/SnapMapScreen.tsx`、`src/screens/Map.tsx`

**问题描述：**  
两个地图页面同时存在：
- `Map.tsx`：仅显示用户自身位置，无好友信息，无交互
- `SnapMapScreen.tsx`：有好友位置（Mock）、有地标（Mock）、功能更丰富

`GlassDock` 的 Map 图标指向 `/snapmap`（`SnapMapScreen`），`AppRoutes.MAP` 路由（`/map`）指向 `Map.tsx` 且**无入口可达**。  
`Map.tsx` 是废弃界面，应考虑删除或合并。

---

### P3-4 · `Study.tsx` 中 `/study/timer` 路由复用了同一组件，状态共享存在隐患

**文件：** `src/App.tsx`（L163–L165）、`src/screens/Study.tsx`（L26）

**问题描述：**
```tsx
<Route path={AppRoutes.STUDY} element={<ProtectedRoute><Study /></ProtectedRoute>} />
<Route path="/study/timer" element={<ProtectedRoute><Study /></ProtectedRoute>} />
```
两个路由渲染同一组件，通过 `location.pathname.includes('/timer')` 区分。  
在 `isTimer` 为 `true` 时组件**不重置 state**，如果用户从计时器页面直接 Back 到 Study 选择页，已有的 `isActive / timeLeft` 状态可能残留，造成"计时器幽灵运行"。

---

### P3-5 · `nanobot/nanobot/1.py` 文件名不规范，无法被 import

**文件：** `nanobot/nanobot/1.py`

**问题描述：**  
`1.py` 是数字开头文件名，Python 规范不允许 `import 1`，**无法被任何其他模块导入**。  
`web_interface_final.py` 需要调用 Nanobot 核心逻辑时只能用 subprocess，增加了进程管理复杂度。

**修复方向：** 将 `1.py` 重命名为 `nanobot_core.py` 或 `agent.py`，并更新所有引用。

---

### P3-6 · `nanobot/frontend` 主题默认值硬编码为 `'light'`，未读取系统偏好

**文件：** `nanobot/frontend/src/stores/chatStore.ts`（L39）

**问题描述：**
```ts
theme: 'light',  // 硬编码，未检测 prefers-color-scheme
```
应在初始化时读取 `window.matchMedia('(prefers-color-scheme: dark)')` 决定默认主题。

---

### P3-7 · `Snapshot` 相机错误回退逻辑会导致无限 re-render

**文件：** `src/screens/Snapshot.tsx`（L32–L50）

**问题描述：**
```ts
onError: (err) => {
  setUseMockCamera(true);  // ← 触发 state 更新
}
```
`useEffect` 的依赖数组包含 `useMockCamera`，`setUseMockCamera(true)` 会触发 Effect 重跑，重跑后 `isCameraSupported && !useMockCamera` 为 false 不再 `startCamera()`，**但 Effect 仍会执行一次 `stopCamera()` 和其他副作用**，在低性能设备上可能造成明显卡顿。

---

## 附录：快速排查指令

### 检查环境变量是否齐全

```bash
# trix-3d-companion 根目录
cat .env | grep -E "VITE_GATEWAY_WS_URL|VITE_NANOBOT_SERVER_URL|VITE_CLAWBOT_CHANNEL_URL"
```

### 验证 Clawbot Channel 服务器连通性

```bash
# 需要 wscat：npm i -g wscat
wscat -c wss://m.jmtrick.com
```

### 验证 Nanobot WebSocket 服务连通性

```bash
wscat -c ws://47.243.55.130:8766
```

### 验证 OpenClaw Gateway 认证流程

```bash
# 诊断页面路由（需已登录）
# 浏览器访问：http://localhost:5173/#/diagnostic-advanced
```

### 检查 nanobot 后端是否正常启动

```bash
# 进入 nanobot/nanobot 目录
cd nanobot/nanobot
python web_interface_final.py
# 正常应监听 5000 端口，观察有无 ImportError
```

### 检查 nanobot frontend 是否能连通后端

```bash
cd nanobot/frontend
# 确认 .env 中 VITE_API_URL=http://localhost:5000
cat .env
```

---

*本文档由自动源码分析生成，如有遗漏请补充。*
