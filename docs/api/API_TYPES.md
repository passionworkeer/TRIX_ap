# TRIX3D API TypeScript 类型定义

> 本文档为 AI 提供完整的 TypeScript 类型定义，方便理解和调用 API
> 版本: 1.2.1
> **最后更新**: 2026-03-20

---

## 目录

1. [通用类型](#通用类型)
2. [用户模块](#用户模块)
3. [认证模块](#认证模块)
4. [聊天模块](#聊天模块)
5. [学习模块](#学习模块)
6. [社交模块](#社交模块)
7. [商城模块](#商城模块)
8. [位置模块](#位置模块)
9. [通知模块](#通知模块)
10. [TRIX Native 模块](#trix-native-模块)
11. [错误码详解](#错误码详解)

---

## 通用类型

### API 响应格式

```typescript
// 成功响应
interface ApiResponse<T> {
  success: true;
  message: string;
  data: T;
}

// 错误响应
interface ApiError {
  success: false;
  error: string;
}

// 分页响应
interface PaginatedResponse<T> {
  success: true;
  message: string;
  data: T[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
```

### 基础类型

```typescript
// UUID 类型
type UUID = string;

// 时间戳
type Timestamp = string; // ISO 8601 格式: "2026-03-04T12:00:00Z"

// 分数/积分
type Points = number;

// 布尔值
type Boolean = boolean;

// 枚举: 用户等级
enum UserLevel {
  NEWBIE = 0,
  BEGINNER = 1,
  INTERMEDIATE = 2,
  ADVANCED = 3,
  EXPERT = 4,
  MASTER = 5
}

// 枚举: 成就状态
enum AchievementStatus {
  LOCKED = 'locked',
  UNLOCKED = 'unlocked',
  IN_PROGRESS = 'in_progress'
}

// 枚举: 通知类型
enum NotificationType {
  FRIEND_REQUEST = 'friend_request',
  STUDY_INVITE = 'study_invite',
  ACHIEVEMENT = 'achievement',
  POINTS = 'points',
  SYSTEM = 'system'
}

// 枚举: 消息类型
enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  VOICE = 'voice',
  FILE = 'file',
  SYSTEM = 'system'
}

// 枚举: 学习房间状态
enum StudyRoomStatus {
  WAITING = 'waiting',
  STUDYING = 'studying',
  FINISHED = 'finished',
  CANCELLED = 'cancelled'
}
```

---

## 用户模块

### 用户资料

```typescript
interface UserProfile {
  id: UUID;
  username: string;
  full_name: string;
  bio: string;
  avatar_url: string;
  avatar_config?: AvatarConfig;
  points: Points;
  days_active: number;
  total_study_time: number;
  current_streak: number;
  school?: string;
  grade?: string;
  is_studying: boolean;
  interaction_count: number;
  level: UserLevel;
  created_at: Timestamp;
  updated_at: Timestamp;
}

interface AvatarConfig {
  head: string;
  outfit?: string;
  background?: string;
  accessories?: string[];
}

interface UserStats {
  total_study_time: number;
  total_focus_sessions: number;
  current_streak: number;
  longest_streak: number;
  total_points: Points;
  points_this_month: Points;
  achievements_unlocked: number;
  total_achievements: number;
  friends_count: number;
  messages_sent: number;
}

interface UserSettings {
  user_id: UUID;
  allow_stranger_search: boolean;
  show_online_status: boolean;
  allow_study_invites: boolean;
  notification_enabled: boolean;
  sound_enabled: boolean;
  dark_mode: boolean;
  language: 'zh' | 'en' | 'ja' | 'zh-TW';
}
```

### 用户相关 API

```typescript
// GET /user/profile
type GetUserProfileResponse = ApiResponse<UserProfile>;

// PUT /user/profile
interface UpdateUserProfileRequest {
  username?: string;
  full_name?: string;
  bio?: string;
  school?: string;
  grade?: string;
}
type UpdateUserProfileResponse = ApiResponse<UserProfile>;

// POST /user/avatar
interface UpdateAvatarRequest {
  avatar_url?: string;
  avatar_config?: AvatarConfig;
}
type UpdateAvatarResponse = ApiResponse<UserProfile>;

// GET /user/stats
type GetUserStatsResponse = ApiResponse<UserStats>;

// GET /user/settings
type GetUserSettingsResponse = ApiResponse<UserSettings>;

// PUT /user/settings
interface UpdateUserSettingsRequest {
  allow_stranger_search?: boolean;
  show_online_status?: boolean;
  allow_study_invites?: boolean;
  notification_enabled?: boolean;
  sound_enabled?: boolean;
  dark_mode?: boolean;
  language?: string;
}
type UpdateUserSettingsResponse = ApiResponse<UserSettings>;
```

---

## 认证模块

### 认证请求/响应

```typescript
// 登录请求
interface LoginRequest {
  email: string;
  password: string;
}

// 注册请求
interface RegisterRequest {
  email: string;
  password: string;
  username: string;
  full_name?: string;
}

// 认证响应
interface AuthResponse {
  user: {
    id: UUID;
    email: string;
    email_confirmed_at: Timestamp;
  };
  session: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    expires_at: number;
  };
}

// 刷新 Token 请求
interface RefreshTokenRequest {
  refresh_token: string;
}

// 刷新 Token 响应
interface RefreshTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at: number;
}

// 当前用户响应
interface CurrentUserResponse {
  id: UUID;
  email: string;
  email_confirmed_at: Timestamp;
  created_at: Timestamp;
}
```

---

## 聊天模块

### 聊天类型

```typescript
interface ChatRoom {
  id: UUID;
  name?: string;
  type: 'direct' | 'group';
  participants: ChatParticipant[];
  last_message?: ChatMessage;
  unread_count: number;
  created_at: Timestamp;
  updated_at: Timestamp;
}

interface ChatParticipant {
  user_id: UUID;
  username: string;
  full_name: string;
  avatar_url: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: Timestamp;
  last_read_at?: Timestamp;
}

interface ChatMessage {
  id: UUID;
  room_id: UUID;
  sender_id: UUID;
  sender_name: string;
  sender_avatar: string;
  type: MessageType;
  content: string;
  metadata?: MessageMetadata;
  created_at: Timestamp;
  is_read: boolean;
}

interface MessageMetadata {
  // 图片消息
  width?: number;
  height?: number;
  thumbnail_url?: string;

  // 语音消息
  duration?: number;
  waveform?: number[];

  // 文件消息
  file_name?: string;
  file_size?: number;
  file_url?: string;
}
```

### 聊天 API

```typescript
// GET /chat/rooms
type GetChatRoomsResponse = ApiResponse<ChatRoom[]>;

// POST /chat/rooms
interface CreateChatRoomRequest {
  name?: string;
  type: 'direct' | 'group';
  participants: UUID[]; // 用户 ID 列表
}
type CreateChatRoomResponse = ApiResponse<ChatRoom>;

// GET /chat/rooms/:roomId
type GetChatRoomResponse = ApiResponse<ChatRoom>;

// GET /chat/rooms/:roomId/messages
interface GetMessagesQuery {
  limit?: number;
  before?: Timestamp; // 用于分页
}
type GetMessagesResponse = ApiResponse<ChatMessage[]>;

// POST /chat/rooms/:roomId/messages
interface SendMessageRequest {
  type: MessageType;
  content: string;
  metadata?: MessageMetadata;
}
type SendMessageResponse = ApiResponse<ChatMessage>;

// POST /chat/rooms/:roomId/messages/read
interface MarkReadRequest {
  message_id?: UUID; // 单条消息ID，不传则标记全部已读
}
type MarkReadResponse = ApiResponse<{ updated_count: number }>;
```

---

## 学习模块

### 学习类型

```typescript
interface StudySession {
  id: UUID;
  user_id: UUID;
  start_time: Timestamp;
  end_time?: Timestamp;
  duration: number; // 分钟
  focus_mode: boolean;
  subject?: string;
  notes?: string;
  points_earned: Points;
  created_at: Timestamp;
}

interface StudyStats {
  total_study_time: number; // 总学习时间（分钟）
  total_focus_sessions: number;
  average_session_length: number;
  current_streak: number;
  longest_streak: number;
  this_week_time: number;
  this_month_time: number;
  today_time: number;
}

interface StudyRoom {
  id: UUID;
  code: string;
  name: string;
  status: StudyRoomStatus;
  host_id: UUID;
  host_name: string;
  participants: StudyRoomParticipant[];
  max_participants: number;
  start_time?: Timestamp;
  end_time?: Timestamp;
  created_at: Timestamp;
}

interface StudyRoomParticipant {
  user_id: UUID;
  username: string;
  full_name: string;
  avatar_url: string;
  joined_at: Timestamp;
  is_host: boolean;
  study_time: number;
  status: 'joined' | 'studying' | 'left';
}

interface StudyGoal {
  id: UUID;
  user_id: UUID;
  title: string;
  description?: string;
  target_minutes: number;
  current_minutes: number;
  deadline?: Timestamp;
  completed: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
}

interface DailyStudyRecord {
  date: string; // "2026-03-04"
  total_minutes: number;
  sessions_count: number;
  focus_sessions: number;
  points_earned: Points;
}

interface WeeklyStudyData {
  week_start: string;
  week_end: string;
  daily_records: DailyStudyRecord[];
  total_minutes: number;
  average_daily: number;
}
```

### 学习 API

```typescript
// GET /study/sessions
interface GetStudySessionsQuery {
  start_date?: string;
  end_date?: string;
  limit?: number;
}
type GetStudySessionsResponse = ApiResponse<StudySession[]>;

// POST /study/sessions
interface CreateStudySessionRequest {
  start_time: Timestamp;
  duration: number;
  focus_mode: boolean;
  subject?: string;
  notes?: string;
}
type CreateStudySessionResponse = ApiResponse<StudySession>;

// PUT /study/sessions/:id
interface UpdateStudySessionRequest {
  end_time?: Timestamp;
  duration?: number;
  notes?: string;
}
type UpdateStudySessionResponse = ApiResponse<StudySession>;

// DELETE /study/sessions/:id
type DeleteStudySessionResponse = ApiResponse<{ deleted: boolean }>;

// GET /study/stats
type GetStudyStatsResponse = ApiResponse<StudyStats>;

// GET /study/stats/weekly
type GetWeeklyStudyDataResponse = ApiResponse<WeeklyStudyData>;

// POST /study/room/create
interface CreateStudyRoomRequest {
  name: string;
  max_participants?: number;
  password?: string;
}
type CreateStudyRoomResponse = ApiResponse<StudyRoom>;

// POST /study/room/join
interface JoinStudyRoomRequest {
  code: string;
  password?: string;
}
type JoinStudyRoomResponse = ApiResponse<StudyRoom>;

// POST /study/room/leave
type LeaveStudyRoomResponse = ApiResponse<{ left: boolean }>;

// GET /study/history/daily
interface GetDailyHistoryQuery {
  days?: number; // 默认 7
}
type GetDailyHistoryResponse = ApiResponse<DailyStudyRecord[]>;
```

---

## 社交模块

### 好友类型

```typescript
interface Friend {
  id: UUID;
  user_id: UUID;
  friend_id: UUID;
  friend_info: {
    id: UUID;
    username: string;
    full_name: string;
    avatar_url: string;
    is_studying: boolean;
    last_active?: Timestamp;
  };
  created_at: Timestamp;
}

interface FriendRequest {
  id: UUID;
  from_user_id: UUID;
  to_user_id: UUID;
  from_user: {
    id: UUID;
    username: string;
    full_name: string;
    avatar_url: string;
  };
  status: 'pending' | 'accepted' | 'declined';
  created_at: Timestamp;
  responded_at?: Timestamp;
}
```

### 好友 API

```typescript
// GET /friends
type GetFriendsResponse = ApiResponse<Friend[]>;

// POST /friends
interface AddFriendRequest {
  user_id: UUID;
}
type AddFriendResponse = ApiResponse<FriendRequest>;

// DELETE /friends/:id
type RemoveFriendResponse = ApiResponse<{ removed: boolean }>;

// GET /friend/requests
type GetFriendRequestsResponse = ApiResponse<FriendRequest[]>;

// POST /friend/requests/:id/accept
type AcceptFriendRequestResponse = ApiResponse<Friend>;

// POST /friend/requests/:id/decline
type DeclineFriendRequestResponse = ApiResponse<{ declined: boolean }>;
```

### 配对类型

```typescript
interface PairingRequest {
  id: UUID;
  user_id: UUID;
  device_id: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  expires_at: Timestamp;
  created_at: Timestamp;
}

interface PairedDevice {
  id: UUID;
  user_id: UUID;
  device_name: string;
  device_type: 'ios' | 'android' | 'web';
  last_paired_at: Timestamp;
  is_active: boolean;
}
```

### 配对 API

```typescript
// POST /pairing/request
interface CreatePairingRequest {
  device_id: string;
  device_name: string;
  device_type: 'ios' | 'android' | 'web';
}
type CreatePairingRequestResponse = ApiResponse<PairingRequest>;

// POST /pairing/confirm
interface ConfirmPairingRequest {
  request_id: UUID;
  code: string;
}
type ConfirmPairingResponse = ApiResponse<PairedDevice>;

// GET /pairing/devices
type GetPairedDevicesResponse = ApiResponse<PairedDevice[]>;

// DELETE /pairing/devices/:id
type UnpairDeviceResponse = ApiResponse<{ unpaired: boolean }>;
```

---

## 商城模块

### 商城类型

```typescript
interface MallItem {
  id: UUID;
  name: string;
  description: string;
  category: 'outfit' | 'avatar' | 'background' | 'effect';
  price: Points;
  image_url: string;
  is_available: boolean;
  limited_quantity?: number;
  sold_count?: number;
  created_at: Timestamp;
}

interface UserPurchasedItem {
  id: UUID;
  item_id: UUID;
  item: MallItem;
  purchased_at: Timestamp;
  is_equipped: boolean;
}

interface PurchaseHistory {
  id: UUID;
  item_id: UUID;
  item_name: string;
  price: Points;
  purchased_at: Timestamp;
}
```

### 商城 API

```typescript
// GET /mall/items
interface GetMallItemsQuery {
  category?: string;
  page?: number;
  limit?: number;
}
type GetMallItemsResponse = ApiResponse<MallItem[]>;

// GET /mall/items/:id
type GetMallItemResponse = ApiResponse<MallItem>;

// POST /mall/purchase
interface PurchaseItemRequest {
  item_id: UUID;
}
type PurchaseItemResponse = ApiResponse<UserPurchasedItem>;

// GET /mall/purchase/history
type GetPurchaseHistoryResponse = ApiResponse<PurchaseHistory[]>;
```

### 衣柜 API

```typescript
// GET /wardrobe/outfits
type GetUserOutfitsResponse = ApiResponse<UserPurchasedItem[]>;

// POST /wardrobe/outfits/:id/equip
type EquipOutfitResponse = ApiResponse<UserPurchasedItem>;

// POST /wardrobe/outfits/:id/unequip
type UnequipOutfitResponse = ApiResponse<UserPurchasedItem>;
```

---

## 位置模块

### 位置类型

```typescript
interface Place {
  id: UUID;
  name: string;
  description: string;
  category: 'dining' | 'entertainment' | 'study' | 'shopping' | 'park';
  latitude: number;
  longitude: number;
  address?: string;
  image_url?: string;
  is_popular: boolean;
  favorite_count: number;
}

interface UserLocation {
  id: UUID;
  user_id: UUID;
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
  shared_at: Timestamp;
  expires_at?: Timestamp;
}

interface PlaceFavorite {
  id: UUID;
  place_id: UUID;
  place: Place;
  favorited_at: Timestamp;
}
```

### 位置 API

```typescript
// GET /places/nearby
interface GetNearbyPlacesQuery {
  latitude: number;
  longitude: number;
  radius?: number; // 米，默认 1000
  category?: string;
}
type GetNearbyPlacesResponse = ApiResponse<Place[]>;

// GET /places/search
interface SearchPlacesQuery {
  q: string;
  category?: string;
}
type SearchPlacesResponse = ApiResponse<Place[]>;

// GET /places/favorites
type GetFavoritePlacesResponse = ApiResponse<PlaceFavorite[]>;

// POST /places/favorites
interface AddFavoritePlaceRequest {
  place_id: UUID;
}
type AddFavoritePlaceResponse = ApiResponse<PlaceFavorite>;

// DELETE /places/favorites/:id
type RemoveFavoritePlaceResponse = ApiResponse<{ removed: boolean }>;

// GET /locations
type GetUserLocationsResponse = ApiResponse<UserLocation[]>;

// POST /locations/share
interface ShareLocationRequest {
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
  expires_in?: number; // 秒，默认 3600
}
type ShareLocationResponse = ApiResponse<UserLocation>;
```

---

## 积分模块

### 积分类型

```typescript
interface PointsInfo {
  user_id: UUID;
  total_points: Points;
  available_points: Points;
  lifetime_points: Points;
}

interface PointsTransaction {
  id: UUID;
  user_id: UUID;
  amount: number; // 正数增加，负数扣除
  type: 'earn' | 'spend' | 'bonus' | 'deduct';
  reason: string;
  created_at: Timestamp;
}
```

### 积分 API

```typescript
// GET /points
type GetPointsResponse = ApiResponse<PointsInfo>;

// GET /points/history
interface GetPointsHistoryQuery {
  type?: 'earn' | 'spend' | 'bonus' | 'deduct';
  limit?: number;
  offset?: number;
}
type GetPointsHistoryResponse = ApiResponse<PointsTransaction[]>;

// POST /points/add
interface AddPointsRequest {
  amount: number;
  reason: string;
}
type AddPointsResponse = ApiResponse<PointsTransaction>;
```

---

## 通知模块

### 通知类型

```typescript
interface Notification {
  id: UUID;
  user_id: UUID;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  is_read: boolean;
  created_at: Timestamp;
}

interface NotificationSettings {
  user_id: UUID;
  friend_requests: boolean;
  study_invites: boolean;
  achievements: boolean;
  points: boolean;
  system: boolean;
  email: boolean;
  push: boolean;
}
```

### 通知 API

```typescript
// GET /notifications
interface GetNotificationsQuery {
  type?: NotificationType;
  is_read?: boolean;
  limit?: number;
  offset?: number;
}
type GetNotificationsResponse = ApiResponse<Notification[]>;

// PUT /notifications/:id/read
type MarkNotificationReadResponse = ApiResponse<Notification>;

// POST /notifications/read-all
type MarkAllNotificationsReadResponse = ApiResponse<{ updated_count: number }>;

// GET /notifications/settings
type GetNotificationSettingsResponse = ApiResponse<NotificationSettings>;

// PUT /notifications/settings
interface UpdateNotificationSettingsRequest {
  friend_requests?: boolean;
  study_invites?: boolean;
  achievements?: boolean;
  points?: boolean;
  system?: boolean;
  email?: boolean;
  push?: boolean;
}
type UpdateNotificationSettingsResponse = ApiResponse<NotificationSettings>;
```

---

## 成就模块

### 成就类型

```typescript
interface Achievement {
  id: UUID;
  name: string;
  description: string;
  icon_url: string;
  category: 'study' | 'social' | 'points' | 'streak';
  requirement: number;
  reward_points: Points;
  status: AchievementStatus;
  unlocked_at?: Timestamp;
  progress?: number;
}
```

### 成就 API

```typescript
// GET /achievements
type GetAchievementsResponse = ApiResponse<Achievement[]>;

// POST /achievements/check
type CheckAchievementsResponse = ApiResponse<{
  new_achievements: Achievement[];
  total_unlocked: number;
}>;

// POST /achievements/:id/unlock
type UnlockAchievementResponse = ApiResponse<Achievement>;
```

---

## 待办和日程模块

### 待办类型

```typescript
interface Todo {
  id: UUID;
  user_id: UUID;
  title: string;
  description?: string;
  priority: 'high' | 'medium' | 'low';
  is_completed: boolean;
  due_date?: Timestamp;
  created_at: Timestamp;
  updated_at: Timestamp;
  completed_at?: Timestamp;
}
```

### 待办 API

```typescript
// GET /todos
interface GetTodosQuery {
  is_completed?: boolean;
  priority?: 'high' | 'medium' | 'low';
  limit?: number;
}
type GetTodosResponse = ApiResponse<Todo[]>;

// POST /todos
interface CreateTodoRequest {
  title: string;
  description?: string;
  priority?: 'high' | 'medium' | 'low';
  due_date?: Timestamp;
}
type CreateTodoResponse = ApiResponse<Todo>;

// PUT /todos/:id
interface UpdateTodoRequest {
  title?: string;
  description?: string;
  priority?: 'high' | 'medium' | 'low';
  is_completed?: boolean;
  due_date?: Timestamp;
}
type UpdateTodoResponse = ApiResponse<Todo>;

// DELETE /todos/:id
type DeleteTodoResponse = ApiResponse<{ deleted: boolean }>;

// POST /todos/:id/toggle
type ToggleTodoResponse = ApiResponse<Todo>;
```

### 日程类型

```typescript
interface Schedule {
  id: UUID;
  user_id: UUID;
  title: string;
  description?: string;
  start_time: Timestamp;
  end_time?: Timestamp;
  location?: string;
  reminder?: number; // 分钟
  is_completed: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
}
```

### 日程 API

```typescript
// GET /schedules
interface GetSchedulesQuery {
  start?: string;
  end?: string;
}
type GetSchedulesResponse = ApiResponse<Schedule[]>;

// POST /schedules
interface CreateScheduleRequest {
  title: string;
  description?: string;
  start_time: Timestamp;
  end_time?: Timestamp;
  location?: string;
  reminder?: number;
}
type CreateScheduleResponse = ApiResponse<Schedule>;

// PUT /schedules/:id
interface UpdateScheduleRequest {
  title?: string;
  description?: string;
  start_time?: Timestamp;
  end_time?: Timestamp;
  location?: string;
  reminder?: number;
  is_completed?: boolean;
}
type UpdateScheduleResponse = ApiResponse<Schedule>;

// DELETE /schedules/:id
type DeleteScheduleResponse = ApiResponse<{ deleted: boolean }>;
```

---

## 快照模块

### 快照类型

```typescript
interface Snapshot {
  id: UUID;
  user_id: UUID;
  title: string;
  description?: string;
  image_url: string;
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
  };
  created_at: Timestamp;
}
```

### 快照 API

```typescript
// GET /snapshots
type GetSnapshotsResponse = ApiResponse<Snapshot[]>;

// POST /snapshots
interface CreateSnapshotRequest {
  title: string;
  description?: string;
  image_url: string;
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
  };
}
type CreateSnapshotResponse = ApiResponse<Snapshot>;

// GET /snapshots/:id
type GetSnapshotResponse = ApiResponse<Snapshot>;

// DELETE /snapshots/:id
type DeleteSnapshotResponse = ApiResponse<{ deleted: boolean }>;
```

---

## AI 对话模块 (Clawbot)

### AI 对话类型

```typescript
interface AIConversation {
  id: UUID;
  user_id: UUID;
  title: string;
  last_message?: string;
  message_count: number;
  created_at: Timestamp;
  updated_at: Timestamp;
}

interface AIMessage {
  id: UUID;
  conversation_id: UUID;
  role: 'user' | 'assistant';
  content: string;
  created_at: Timestamp;
}
```

### AI 对话 API

```typescript
// GET /clawbot/conversations
type GetConversationsResponse = ApiResponse<AIConversation[]>;

// POST /clawbot/conversations
interface CreateConversationRequest {
  title?: string;
}
type CreateConversationResponse = ApiResponse<AIConversation>;

// GET /clawbot/conversations/:id/messages
type GetAIMessagesResponse = ApiResponse<AIMessage[]>;

// POST /clawbot/conversations/:id/messages
interface SendAIMessageRequest {
  content: string;
  // 可选：对话上下文
  context?: {
    study_mode?: boolean;
    subject?: string;
  };
}
interface SendAIMessageResponse {
  message: AIMessage;
  // 流式响应时可能返回 delta
  delta?: string;
}
type SendAIMessageResponse = ApiResponse<SendAIMessageResponse>;

// DELETE /clawbot/conversations/:id
type DeleteConversationResponse = ApiResponse<{ deleted: boolean }>;
```

---

## WebSocket 事件

### 连接

```typescript
// WebSocket URL（通过 TrixNativeChannelClient 连接）
const WS_URL = 'https://trix.love';

// 连接
const ws = new WebSocket(WS_URL + '?token=' + access_token);
```

### 事件类型

```typescript
// 消息事件
interface WSMessageEvent {
  type: 'message' | 'typing' | 'read' | 'presence';
  room_id?: UUID;
  data: unknown;
}

// 消息
interface WSMessage {
  id: UUID;
  room_id: UUID;
  sender_id: UUID;
  type: MessageType;
  content: string;
  created_at: Timestamp;
}

// 打字中
interface WSTyping {
  room_id: UUID;
  user_id: UUID;
  is_typing: boolean;
}

// 在线状态
interface WSPresence {
  user_id: UUID;
  status: 'online' | 'offline' | 'away';
  last_seen?: Timestamp;
}

// 学习房间状态
interface WSStudyRoomEvent {
  type: 'participant_joined' | 'participant_left' | 'room_started' | 'room_ended';
  room_code: string;
  participant?: StudyRoomParticipant;
  timestamp: Timestamp;
}
```

---

## 错误码详解

| 状态码 | 错误码 | 说明 | 解决方案 |
|--------|--------|------|----------|
| 400 | INVALID_REQUEST | 请求参数错误 | 检查请求体格式 |
| 401 | INVALID_TOKEN | Token 无效 | 重新登录获取新 token |
| 401 | TOKEN_EXPIRED | Token 已过期 | 使用 refresh_token 刷新 |
| 403 | FORBIDDEN | 无权限 | 检查用户权限 |
| 404 | NOT_FOUND | 资源不存在 | 检查资源 ID |
| 429 | RATE_LIMITED | 请求过于频繁 | 等待后重试 |
| 500 | SERVER_ERROR | 服务器错误 | 联系技术支持 |

---

## TRIX Native 模块

### 概述

TRIX Native 模块提供 iOS 设备与 Web 前端的双向通信能力，基于 OpenClaw 平台实现。

### 配对相关类型

```typescript
// 配对请求响应
type ClaimResponse = {
  conversationId: string;
  clientToken: string;
  websocketUrl: string;
  pairing: {
    code: string;  // 6位配对码，如 "JJ3JSW7Z"
  };
  agentOnline?: boolean;
};

// 存储的会话信息
type StoredSession = {
  serverUrl: string;
  websocketUrl: string;
  conversationId: string;
  clientToken: string;
  clientId: string;
  deviceName?: string;
  pairingCode?: string;
};
```

### 消息相关类型

```typescript
// 附件上传响应
type UploadResponse = {
  attachment: {
    id: string;
    url: string;
    kind: 'image' | 'audio' | 'video' | 'file';
    mimeType: string;
    fileName: string;
    size: number;
    width?: number;
    height?: number;
    duration?: number;
  };
};

// 消息附件输入
interface NativeMessageAttachmentInput {
  uploadId?: string;
  kind?: 'image' | 'audio' | 'video' | 'file';
  url?: string;
  mimeType?: string;
  fileName?: string;
  size?: number;
  width?: number;
  height?: number;
  duration?: number;
}

// 上传附件响应
export interface NativeUploadAttachment {
  attachmentId: string;
  url: string;
  kind: 'image' | 'audio' | 'video' | 'file';
  mimeType: string;
  fileName: string;
  size: number;
  width?: number;
  height?: number;
  duration?: number;
}

// 会话消息响应
type ConversationMessagesResponse = {
  messages: Array<{
    id: string;
    conversationId: string;
    direction: 'inbound' | 'outbound' | 'system';
    text: string;
    attachments: Array<{
      id: string;
      kind: 'image' | 'audio' | 'video' | 'file';
      mimeType: string;
      fileName: string;
      sizeBytes: number;
      publicUrl?: string;
      width?: number;
      height?: number;
      durationMs?: number;
    }>;
    senderId: string;
    senderName?: string;
    createdAt: number;  // Unix 时间戳
    metadata?: Record<string, unknown>;
  }>;
  agentOnline?: boolean;
};
```

### WebSocket 事件类型

```typescript
type NativeSocketEvents = {
  connecting: void;
  connected: { agentOnline: boolean };
  disconnected: void;
  reconnecting: { attempt: number };
  pairing_success: { deviceId: string; deviceName: string };
  unpaired: void;
  bot_online: { deviceId: string; message: string; timestamp: number };
  bot_offline: { deviceId: string; message: string; timestamp: number };
  message: ClawbotChannelMessage;
  error: ErrorPayload;
  history: ClawbotChannelMessage[];
};

type NativeSocketEventName = keyof NativeSocketEvents;
type NativeSocketEventPayload<TEvent extends NativeSocketEventName> = NativeSocketEvents[TEvent];
type EventCallback<TPayload> = (payload: TPayload) => void;
```

### 服务器配置

| 环境变量 | 说明 | 默认值 |
|----------|------|--------|
| VITE_TRIX_NATIVE_SERVER_URL | TRIX Native 服务器地址 | http://TRIX_SERVER_HOST:8788 |

### 配对流程

1. 用户在 iOS 设备上生成配对码（6位字母数字）
2. 用户在 Web 前端输入配对码
3. Web 前端调用 `/claim` 接口获取会话信息
4. 建立 WebSocket 连接进行消息通信

---

*文档生成时间: 2026-03-15*
*适用于 TRIX3D API v1.2.0*
