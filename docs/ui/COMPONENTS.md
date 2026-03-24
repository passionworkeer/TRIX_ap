# TRIX3D 组件文档

> 本文档列出所有前端 React 组件
> 版本: 1.4.0
> **最后更新**: 2026-03-24
> 组件总数: 64+（含 **OpenClawControlPanel / VoiceRecorder / VirtualizedList / LazyImage** v1.3）

---

## 目录

1. [核心组件](#核心组件)
2. [UI 组件](#ui-组件)
3. [地图组件](#地图组件)
4. [对话框组件](#对话框组件)

---

## 核心组件

### Avatar

用户头像组件，支持配置化头像。

```typescript
interface AvatarProps {
  src?: string;
  alt?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  status?: 'online' | 'offline' | 'away';
  className?: string;
}
```

**位置**: `src/components/Avatar.tsx`

---

### GlassPanel

玻璃拟态面板组件，提供半透明背景效果。

```typescript
interface GlassPanelProps {
  children: React.ReactNode;
  className?: string;
  blur?: boolean;
  gradient?: boolean;
}
```

**位置**: `src/components/GlassPanel.tsx`

---

### GlassDock

底部导航Dock栏，玻璃拟态设计。

```typescript
interface GlassDockProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}
```

**位置**: `src/components/GlassDock.tsx`

---

### AchievementsPanel ★ v1.3 新增

用户成就面板，展示已解锁/待解锁成就，含稀有度分级着色和动画进度条。

```typescript
interface AchievementsPanelProps {
  userId: string;
  onClose?: () => void;
}
```

**特性**：
- 调用 `achievementService.getUserAchievements(userId)` 获取成就列表
- 稀有度分级着色：Common（灰）/ Rare（蓝）/ Epic（紫）/ Legendary（金）
- 动画进度条：显示成就完成百分比
- 集成 Profile 页面（`src/screens/Profile.tsx`）

**位置**: `src/components/AchievementsPanel.tsx`（283 行）

---

### HeroBackground

动态背景组件，提供沉浸式视觉效果。

```typescript
interface HeroBackgroundProps {
  variant?: 'default' | 'dark' | 'gradient';
  children?: React.ReactNode;
}
```

**位置**: `src/components/HeroBackground.tsx`

---

### LoadingSpinner

加载动画组件。

```typescript
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
}
```

**位置**: `src/components/LoadingSpinner.tsx`

---

### DynamicBackground

动态渐变背景组件。

```typescript
interface DynamicBackgroundProps {
  variant?: 'aurora' | 'ocean' | 'sunset';
}
```

**位置**: `src/components/DynamicBackground.tsx`

---

## UI 组件

### Modal

通用模态框组件。

```typescript
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'full';
}
```

**位置**: `src/components/ui/Modal.tsx`

---

### ConfirmModal

确认对话框组件。

```typescript
interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  type?: 'info' | 'warning' | 'danger';
}
```

**位置**: `src/components/ui/ConfirmModal.tsx`

---

### ErrorBoundary

错误边界组件，捕获子组件错误。

```typescript
interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}
```

**位置**: `src/components/ErrorBoundary.tsx`

---

### FilePicker

文件选择器组件。

```typescript
interface FilePickerProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  multiple?: boolean;
}
```

**位置**: `src/components/FilePicker.tsx`

---

### QRScanner

二维码扫描组件。

```typescript
interface QRScannerProps {
  onScan: (result: string) => void;
  onError?: (error: Error) => void;
}
```

**位置**: `src/components/QRScanner.tsx`

---

## 地图组件

### FriendPopupContent

地图上好友位置的弹出内容。

```typescript
interface FriendPopupContentProps {
  friend: Friend;
  onMessage?: () => void;
  onInviteStudy?: () => void;
}
```

**位置**: `src/components/map/FriendPopupContent.tsx`

---

### PlacePopupContent

地图上地点的弹出内容。

```typescript
interface PlacePopupContentProps {
  place: Place;
  onNavigate?: () => void;
  onFavorite?: () => void;
}
```

**位置**: `src/components/map/PlacePopupContent.tsx`

---

## 对话框组件

### AboutDialog

关于对话框，显示应用信息。

```typescript
interface AboutDialogProps {
  isOpen: boolean;
  onClose: () => void;
}
```

**位置**: `src/components/AboutDialog.tsx`

---

### AddFriendModal

添加好友模态框。

```typescript
interface AddFriendModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd?: (userId: string) => void;
}
```

**位置**: `src/components/AddFriendModal.tsx`

---

### AIActionModal

AI 动作选择模态框。

```typescript
interface AIActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onActionSelect: (action: string) => void;
}
```

**位置**: `src/components/AIActionModal.tsx`

---

### AIActionSelector

AI 动作选择器。

```typescript
interface AIActionSelectorProps {
  onSelect: (action: string) => void;
}
```

**位置**: `src/components/AIActionSelector.tsx`

---

### ConfirmDialog

确认对话框组件。

```typescript
interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel?: () => void;
}
```

**位置**: `src/components/ConfirmDialog.tsx`

---

### NotificationPanel

通知面板组件。

```typescript
interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
}
```

**位置**: `src/components/NotificationPanel.tsx`

---

### PointsHistory

积分历史组件。

```typescript
interface PointsHistoryProps {
  isOpen: boolean;
  onClose: () => void;
}
```

**位置**: `src/components/PointsHistory.tsx`

---

### PrivacySettings

隐私设置组件。

```typescript
interface PrivacySettingsProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}
```

**位置**: `src/components/PrivacySettings.tsx`

---

### SnapshotModal

快照模态框。

```typescript
interface SnapshotModalProps {
  isOpen: boolean;
  onClose: () => void;
  snapshot?: Snapshot;
}
```

**位置**: `src/components/SnapshotModal.tsx`

---

### StatsDetailDialog

统计数据详情对话框。

```typescript
interface StatsDetailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  stats: UserStats;
}
```

**位置**: `src/components/StatsDetailDialog.tsx`

---

### WorkbenchModal

工作台模态框。

```typescript
interface WorkbenchModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature?: string;
}
```

**位置**: `src/components/WorkbenchModal.tsx`

---

## 功能组件

### HomeBotBubble

首页 AI 助手气泡组件。

```typescript
interface HomeBotBubbleProps {
  message: string;
  suggestions?: string[];
  onSuggestionClick?: (suggestion: string) => void;
}
```

**位置**: `src/components/HomeBotBubble.tsx`

---

### MailPanel

邮件/消息面板。

```typescript
interface MailPanelProps {
  type: 'inbox' | 'sent';
  onSelect?: (message: Message) => void;
}
```

**位置**: `src/components/MailPanel.tsx`

---

### MediaMessage

媒体消息组件。

```typescript
interface MediaMessageProps {
  type: 'image' | 'voice' | 'file';
  url: string;
  metadata?: MessageMetadata;
}
```

**位置**: `src/components/MediaMessage.tsx`

---

### OutfitCard

装扮卡片组件。

```typescript
interface OutfitCardProps {
  outfit: Outfit;
  owned: boolean;
  equipped: boolean;
  onEquip?: () => void;
  onPurchase?: () => void;
}
```

**位置**: `src/components/OutfitCard.tsx`

---

### OutfitPreview

装扮预览组件。

```typescript
interface OutfitPreviewProps {
  outfit: Outfit;
  visible: boolean;
}
```

**位置**: `src/components/OutfitPreview.tsx`

---

### ProjectProgress

项目进度组件。

```typescript
interface ProjectProgressProps {
  progress: number;
  label?: string;
}
```

**位置**: `src/components/ProjectProgress.tsx`

---

### StudyBuddiesList

学习伙伴列表组件。

```typescript
interface StudyBuddiesListProps {
  buddies: Friend[];
  onInvite?: (friendId: string) => void;
}
```

**位置**: `src/components/StudyBuddiesList.tsx`

---

### StudyRoom

学习房间组件。

```typescript
interface StudyRoomProps {
  roomId?: string;
  onJoin?: (roomCode: string) => void;
  onLeave?: () => void;
}
```

**位置**: `src/components/StudyRoom.tsx`

---

### UserSwitcher

用户切换组件（开发调试用）。

```typescript
interface UserSwitcherProps {
  currentUser?: User;
  onSwitch?: (user: User) => void;
}
```

**位置**: `src/components/UserSwitcher.tsx`

---

### WorkbenchCard

工作台卡片组件。

```typescript
interface WorkbenchCardProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  onClick?: () => void;
}
```

**位置**: `src/components/WorkbenchCard.tsx`

---

### OpenClawControlPanel ★ v1.3 新增

OpenClaw 控制面板，展示 Gateway 状态、配对信息和实时消息。

```typescript
interface OpenClawControlPanelProps {
  isOpen: boolean;
  onClose: () => void;
}
```

**特性**：
- 集成 `useClawbotChannel()` 获取 Gateway 状态
- 显示连接状态、配对状态、Bot 在线状态
- 实时消息预览
- 配对码生成和撤销

**位置**: `src/components/OpenClawControlPanel.tsx`

---

### VoiceRecorder ★ v1.3 新增

微信风格语音录制模态框。

```typescript
interface VoiceRecorderProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (blob: Blob, duration: number) => void;
}
```

**特性**：
- 微信风格的录制界面
- 录音时长显示
- 上滑取消手势支持

**位置**: `src/components/VoiceRecorder.tsx`

---

### VirtualizedList ★ v1.3 新增

虚拟化列表组件，用于高效渲染大量消息/数据。

```typescript
interface VirtualizedListProps<T> {
  data: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  itemContent?: (index: number, item: T) => React.ReactNode;
  // ... 更多配置
}

interface VirtualizedMessageListProps<T> {
  messages: T[];
  renderMessage: (message: T, index: number) => React.ReactNode;
  keyExtractor: (message: T, index: number) => string | number;
}
```

**特性**：
- 基于 `@tanstack/react-virtual` 的虚拟化渲染
- 支持任意类型数据的列表展示
- `VirtualizedMessageList` 专用于聊天消息列表

**位置**: `src/components/VirtualizedList.tsx`

---

### LazyImage ★ v1.3 新增

懒加载图片组件。

```typescript
interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
}
```

**特性**：
- Intersection Observer 实现懒加载
- 支持占位符
- 加载失败显示兜底图

**位置**: `src/components/LazyImage.tsx`

---

## 性能监控组件

### PerformanceDashboard

性能监控面板（仅开发模式显示）。

```typescript
interface PerformanceDashboardProps {
  visible?: boolean;
}
```

**位置**: `src/components/PerformanceDashboard.tsx`

---

## 使用示例

### 基本使用

```tsx
import Avatar from './components/Avatar';

function App() {
  return (
    <Avatar
      src="https://example.com/avatar.jpg"
      alt="User Avatar"
      size="lg"
      status="online"
    />
  );
}
```

### 带回调

```tsx
import { ConfirmDialog } from './components/ConfirmDialog';

function DeleteButton() {
  const handleConfirm = () => {
    console.log('Confirmed!');
  };

  return (
    <ConfirmDialog
      isOpen={isOpen}
      title="确认删除"
      message="确定要删除这个项目吗？此操作无法撤销。"
      onConfirm={handleConfirm}
      onCancel={() => setIsOpen(false)}
    />
  );
}
```

---

*文档生成时间: 2026-03-23*
