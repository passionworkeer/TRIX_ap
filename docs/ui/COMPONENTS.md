# Web 组件文档

> **版本**: v1.0
> **最后更新**: 2026-03-31（基于 src/components/ 实际文件扫描）
> **组件总数**: 30 个根组件 + chat/map/ui 子目录组件 + 12 个自定义 hooks

---

## 1. 根目录组件（38 个）

按功能分组：

### 认证与会话
| 组件 | 文件 | 说明 |
|------|------|------|
| `ProtectedRoute` | `ProtectedRoute.tsx` | 路由守卫，未登录重定向 |
| `UserSwitcher` | `UserSwitcher.tsx` | 多账号切换（开发/调试用）|

### 通用 UI
| 组件 | 文件 | 说明 |
|------|------|------|
| `ConfirmDialog` | `ConfirmDialog.tsx` | 确认对话框 |
| `ErrorBoundary` | `ErrorBoundary.tsx` | 错误边界，捕获渲染错误 |
| `LoadingSpinner` | `LoadingSpinner.tsx` | 加载指示器 |
| `LazyImage` | `LazyImage.tsx` | 懒加载图片 |
| `DynamicBackground` | `DynamicBackground.tsx` | 动态背景 |
| `HeroBackground` | `HeroBackground.tsx` | 首屏背景 |
| `GlassPanel` | `GlassPanel.tsx` | 毛玻璃面板 |
| `VirtualizedList` | `VirtualizedList.tsx` | 虚拟化列表（大数据量）|
| `Modal` | `ui/Modal.tsx` | 基础 Modal |
| `ConfirmModal` | `ui/ConfirmModal.tsx` | 确认类 Modal |

### 导航
| 组件 | 文件 | 说明 |
|------|------|------|
| `GlassDock` | `GlassDock.tsx` | 底部导航栏（5 个 Tab）|

### 聊天相关
| 组件 | 文件 | 说明 |
|------|------|------|
| `MediaMessage` | `MediaMessage.tsx` | 媒体消息（图片/语音）|
| `VoiceMessage` | `VoiceMessage.tsx` | 语音消息 |
| `VoiceRecorder` | `VoiceRecorder.tsx` | 语音录制 |
| `FileAttachmentCard` | `FileAttachmentCard.tsx` | 文件附件卡片 |
| `FilePicker` | `FilePicker.tsx` | 文件选择器 |
| `MessageInput` | `chat/MessageInput.tsx` | 聊天输入框 |
| `ChatHeader` | `chat/ChatHeader.tsx` | 聊天页头部 |
| `MessageList` | `chat/MessageList.tsx` | 消息列表 |

### AI / 伴侣
| 组件 | 文件 | 说明 |
|------|------|------|
| `HomeBotBubble` | `HomeBotBubble.tsx` | 首页 AI 气泡 |
| `AIActionModal` | `AIActionModal.tsx` | AI 操作弹窗 |
| `AIActionSelector` | `AIActionSelector.tsx` | AI 操作选择器 |
| `OpenClawControlPanel` | `OpenClawControlPanel.tsx` | OpenClaw 控制面板 |

### 学习 / 自习
| 组件 | 文件 | 说明 |
|------|------|------|
| `StudyRoom` | `StudyRoom.tsx` | 自习室主组件 |
| `StudyBuddiesList` | `StudyBuddiesList.tsx` | 一起学习的伙伴列表 |
| `AchievementsPanel` | `AchievementsPanel.tsx` | 成就面板 |

### 社交 / 地图
| 组件 | 文件 | 说明 |
|------|------|------|
| `FriendPopupContent` | `map/FriendPopupContent.tsx` | 地图好友气泡 |
| `PlacePopupContent` | `map/PlacePopupContent.tsx` | 地图地点气泡 |

### 快照 / 拍照
| 组件 | 文件 | 说明 |
|------|------|------|
| `SnapshotModal` | `SnapshotModal.tsx` | AI 快照弹窗 |
| `QRScanner` | `QRScanner.tsx` | 二维码扫描 |

### 成就 / 积分
| 组件 | 文件 | 说明 |
|------|------|------|
| `PointsHistory` | `PointsHistory.tsx` | 积分历史 |
| `StatsDetailDialog` | `StatsDetailDialog.tsx` | 统计数据详情 |

### 虚拟衣橱
| 组件 | 文件 | 说明 |
|------|------|------|
| `OutfitCard` | `OutfitCard.tsx` | 装扮卡片 |
| `OutfitPreview` | `OutfitPreview.tsx` | 装扮预览 |

### 好友系统
| 组件 | 文件 | 说明 |
|------|------|------|
| `AddFriendModal` | `AddFriendModal.tsx` | 添加好友弹窗 |
| `MailPanel` | `MailPanel.tsx` | 通知/邮件面板 |

### 通知
| 组件 | 文件 | 说明 |
|------|------|------|
| `NotificationPanel` | `NotificationPanel.tsx` | 通知面板 |

### 设置 / 关于
| 组件 | 文件 | 说明 |
|------|------|------|
| `AboutDialog` | `AboutDialog.tsx` | 关于对话框 |
| `PrivacySettings` | `PrivacySettings.tsx` | 隐私设置 |
| `Avatar` | `Avatar.tsx` | 用户头像 |

### Desktop 专属
| 组件 | 文件 | 说明 |
|------|------|------|
| `WorkbenchCard` | `WorkbenchCard.tsx` | 工作台卡片（Desktop）|
| `WorkbenchModal` | `WorkbenchModal.tsx` | 工作台弹窗（Desktop）|
| `PerformanceDashboard` | `PerformanceDashboard.tsx` | 性能仪表盘（Desktop）|

---

## 2. 自定义 Hooks（12 个）

| Hook | 文件 | 说明 |
|------|------|------|
| `useAudioPlayer` | `useAudioPlayer.ts` | 音频播放 |
| `useBotStateMachine` | `useBotStateMachine.ts` | Bot 状态机 |
| `useCamera` | `useCamera.ts` | 相机控制 |
| `useClawbotMessages` | `useClawbotMessages.ts` | AI 消息获取 |
| `useConfirmModal` | `useConfirmModal.tsx` | 确认弹窗 Hook |
| `useImmersiveVoice` | `useImmersiveVoice.ts` | 沉浸式语音 |
| `useNotification` | `useNotification.ts` | 通知管理 |
| `useResourcePreloader` | `useResourcePreloader.ts` | 资源预加载 |
| `useSpeechToText` | `useSpeechToText.ts` | 语音转文字 |
| `useTouchGestures` | `useTouchGestures.ts` | 手势识别 |
| `useVoiceRecorder` | `useVoiceRecorder.ts` | 语音录制 Hook |
| `useWebVitals` | `useWebVitals.ts` | Web Vitals 性能指标 |

> **注意**: `useClawbotMessages` 是一个 hook，不是服务。消息通过 `ClawbotChannelContext` 获取。

---

## 3. 测试覆盖

所有主要组件均有 `.test.tsx` 测试文件，位于同一目录。

---

**最后更新**: 2026-03-31
