# TRIX3D 组件文档

> 本文档列出所有前端 React 组件
> 版本: 1.2.0
> 最后更新: 2026-03-17
> 组件总数: 60+

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

*文档生成时间: 2026-03-04*
