# TRIX3D 后端 API 文档

> 版本: 1.2.0
> 最后更新: 2026-03-15

---

## 目录

1. [概述](#概述)
2. [基础配置](#基础配置)
3. [认证](#认证)
4. [API 端点列表](#api-端点列表)
5. [TRIX Native Server API](#trix-native-server-api)
6. [响应格式](#响应格式)
7. [错误码](#错误码)
8. [数据库表结构](#数据库表结构)

---

## 概述

本 API 为 TRIX3D 应用提供后端服务，支持用户管理、社交、学习、商城等功能。

### 服务端口

| 服务 | 端口 | 描述 |
|------|------|------|
| Clawbot Channel | ~~8765~~ (已废弃) | AI 对话服务 |
| TRIX Native Server | 8788 | iOS-Web 消息同步 (当前唯一) |

### 技术栈

- **运行时**: Node.js
- **框架**: Express.js
- **数据库**: PostgreSQL (Supabase) + SQLite (本地)
- **实时通信**: WebSocket

---

## 基础配置

### 基础 URL

| 环境 | 服务 | URL |
|------|------|-----|
| ~~开发环境~~ | ~~Clawbot Channel~~ | ~~已废弃~~ |
| ~~生产环境~~ | ~~Clawbot Channel~~ | ~~已废弃~~ |
| 开发环境 | TRIX Native | `http://TRIX_SERVER_HOST:8788/api` |
| 生产环境 | TRIX Native | `https://trix-native.trix3d.com/api` |

### 请求头

```http
Content-Type: application/json
Authorization: Bearer <jwt_token>
```

---

## 认证

### 认证方式

所有需要认证的 API 端点都必须在请求头中携带 JWT Token：

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

Token 通过 Supabase Auth 获取。

### 可选认证

部分端点支持可选认证（带 Token 返回用户专属数据，不带返回公开数据）：

- `GET /mall/items`
- `GET /places/nearby`
- `GET /places/search`

---

## API 端点列表

### 1. 用户模块 `/user`

| 方法 | 端点 | 认证 | 描述 |
|------|------|------|------|
| GET | `/user/profile` | ✅ | 获取用户资料 |
| PUT | `/user/profile` | ✅ | 更新用户资料 |
| POST | `/user/avatar` | ✅ | 更新用户头像 |
| GET | `/user/stats` | ✅ | 获取用户统计 |
| GET | `/user/settings` | ✅ | 获取用户设置 |
| PUT | `/user/settings` | ✅ | 更新用户设置 |

#### 请求/响应示例

**GET /user/profile**

```bash
curl -X GET http://TRIX_SERVER_HOST:8788/api/user/profile \
  -H "Authorization: Bearer <token>"
```

```json
{
  "success": true,
  "message": "成功",
  "data": {
    "id": "uuid",
    "username": "user123",
    "full_name": "张三",
    "bio": "你好",
    "avatar_url": "https://...",
    "points": 1000,
    "days_active": 30
  }
}
```

**PUT /user/profile**

```json
{
  "username": "newusername",
  "full_name": "新名字",
  "bio": "新简介",
  "school": "清华大学",
  "grade": "高三"
}
```

---

### 2. 好友模块 `/friends`

| 方法 | 端点 | 认证 | 描述 |
|------|------|------|------|
| GET | `/friends` | ✅ | 获取好友列表 |
| POST | `/friends` | ✅ | 添加好友 |
| DELETE | `/friends/:id` | ✅ | 删除好友 |
| GET | `/friends/requests` | ✅ | 获取好友请求 |
| POST | `/friends/requests/:id/accept` | ✅ | 接受请求 |
| POST | `/friends/requests/:id/decline` | ✅ | 拒绝请求 |

---

### 3. 日程模块 `/schedules`

| 方法 | 端点 | 认证 | 描述 |
|------|------|------|------|
| GET | `/schedules` | ✅ | 获取日程列表 |
| POST | `/schedules` | ✅ | 创建日程 |
| PUT | `/schedules/:id` | ✅ | 更新日程 |
| DELETE | `/schedules/:id` | ✅ | 删除日程 |
| GET | `/schedules/range?start=&end=` | ✅ | 按日期范围查询 |
| GET | `/schedules/upcoming?minutes=30` | ✅ | 获取即将到来的日程 |

---

### 4. 待办模块 `/todos`

| 方法 | 端点 | 认证 | 描述 |
|------|------|------|------|
| GET | `/todos` | ✅ | 获取待办列表 |
| POST | `/todos` | ✅ | 创建待办 |
| PUT | `/todos/:id` | ✅ | 更新待办 |
| DELETE | `/todos/:id` | ✅ | 删除待办 |
| POST | `/todos/:id/toggle` | ✅ | 切换完成状态 |

---

### 5. 成就模块 `/achievements`

| 方法 | 端点 | 认证 | 描述 |
|------|------|------|------|
| GET | `/achievements` | ✅ | 获取成就列表（含解锁状态）|
| POST | `/achievements/check` | ✅ | 检查并解锁成就 |
| POST | `/achievements/:id/unlock` | ✅ | 手动解锁成就 |

---

### 6. 商城模块 `/mall`

| 方法 | 端点 | 认证 | 描述 |
|------|------|------|------|
| GET | `/mall/items` | ❓ | 获取商品列表 |
| GET | `/mall/items/:id` | ❓ | 获取单个商品 |
| POST | `/mall/purchase` | ✅ | 购买商品 |
| GET | `/mall/purchase/history` | ✅ | 获取购买历史 |

---

### 7. 衣柜模块 `/wardrobe`

| 方法 | 端点 | 认证 | 描述 |
|------|------|------|------|
| GET | `/wardrobe/outfits` | ✅ | 获取装扮列表 |
| POST | `/wardrobe/outfits/:id/equip` | ✅ | 装备装扮 |
| POST | `/wardrobe/outfits/:id/unequip` | ✅ | 卸下装扮 |

---

### 8. 学习历史模块 `/study/history`

| 方法 | 端点 | 认证 | 描述 |
|------|------|------|------|
| GET | `/study/history/daily?days=7` | ✅ | 每日学习汇总 |
| GET | `/study/history/weekly` | ✅ | 每周学习汇总 |
| GET | `/study/history/monthly` | ✅ | 每月学习汇总 |

---

### 9. 学习记录模块 `/study/sessions`

| 方法 | 端点 | 认证 | 描述 |
|------|------|------|------|
| GET | `/study/sessions` | ✅ | 获取学习记录 |
| POST | `/study/sessions` | ✅ | 创建学习记录 |
| PUT | `/study/sessions/:id` | ✅ | 更新学习记录 |
| DELETE | `/study/sessions/:id` | ✅ | 删除学习记录 |
| GET | `/study/stats` | ✅ | 获取学习统计 |
| GET | `/study/stats/weekly` | ✅ | 获取每周学习数据 |

---

### 10. 学习房间模块 `/study/room`

| 方法 | 端点 | 认证 | 描述 |
|------|------|------|------|
| POST | `/study/room/create` | ✅ | 创建学习房间 |
| POST | `/study/room/join` | ✅ | 加入学习房间 |
| POST | `/study/room/leave` | ✅ | 离开学习房间 |

---

### 11. 聊天模块 `/chat`

| 方法 | 端点 | 认证 | 描述 |
|------|------|------|------|
| GET | `/chat/rooms` | ✅ | 获取聊天房间列表 |
| POST | `/chat/rooms` | ✅ | 创建聊天房间 |
| GET | `/chat/rooms/:roomId` | ✅ | 获取聊天房间详情 |
| GET | `/chat/rooms/:roomId/messages` | ✅ | 获取消息列表 |
| POST | `/chat/rooms/:roomId/messages` | ✅ | 发送消息 |
| POST | `/chat/rooms/:roomId/messages/read` | ✅ | 标记已读 |

---

### 12. 配对模块 `/pairing`

| 方法 | 端点 | 认证 | 描述 |
|------|------|------|------|
| POST | `/pairing/request` | ✅ | 创建配对请求 |
| POST | `/pairing/confirm` | ✅ | 确认配对 |
| GET | `/pairing/status/:id` | ✅ | 查询配对状态 |
| GET | `/pairing/devices` | ✅ | 获取已配对设备 |
| DELETE | `/pairing/devices/:id` | ✅ | 解除配对 |

---

### 13. 地点模块 `/places`

| 方法 | 端点 | 认证 | 描述 |
|------|------|------|------|
| GET | `/places/nearby?latitude=&longitude=&radius=` | ❓ | 获取附近地点 |
| GET | `/places/search?q=&category=` | ❓ | 搜索地点 |
| GET | `/places/favorites` | ✅ | 获取收藏地点 |
| POST | `/places/favorites` | ✅ | 添加收藏 |
| DELETE | `/places/favorites/:id` | ✅ | 删除收藏 |
| POST | `/places/:placeId/favorite` | ✅ | 切换收藏状态 |

---

### 14. 位置模块 `/locations`

| 方法 | 端点 | 认证 | 描述 |
|------|------|------|------|
| GET | `/locations` | ✅ | 获取位置列表 |
| GET | `/locations/:id` | ✅ | 获取单个位置 |
| POST | `/locations/share` | ✅ | 分享位置 |

---

### 15. 积分模块 `/points`

| 方法 | 端点 | 认证 | 描述 |
|------|------|------|------|
| GET | `/points` | ✅ | 获取用户积分 |
| GET | `/points/history` | ✅ | 获取积分历史 |
| POST | `/points/add` | ✅ | 增加积分 |
| POST | `/points/deduct` | ✅ | 扣除积分 |

---

### 16. 快照模块 `/snapshots`

| 方法 | 端点 | 认证 | 描述 |
|------|------|------|------|
| GET | `/snapshots` | ✅ | 获取快照列表 |
| POST | `/snapshots` | ✅ | 创建快照 |
| GET | `/snapshots/:id` | ✅ | 获取单个快照 |
| DELETE | `/snapshots/:id` | ✅ | 删除快照 |

---

### 17. 通知模块 `/notifications`

| 方法 | 端点 | 认证 | 描述 |
|------|------|------|------|
| GET | `/notifications` | ✅ | 获取通知列表 |
| PUT | `/notifications/:id/read` | ✅ | 标记已读 |
| POST | `/notifications/read-all` | ✅ | 全部标记已读 |
| POST | `/notifications/device-token` | ✅ | 保存设备令牌 |
| GET | `/notifications/settings` | ✅ | 获取通知设置 |
| PUT | `/notifications/settings` | ✅ | 更新通知设置 |
| GET | `/notifications/preferences` | ✅ | 获取通知偏好 |
| PUT | `/notifications/preferences` | ✅ | 更新通知偏好 |

---

### 18. 上传模块 `/upload`

| 方法 | 端点 | 认证 | 描述 |
|------|------|------|------|
| POST | `/upload` | ✅ | 文件上传 |
| POST | `/upload/base64` | ✅ | Base64 上传 |

---

### 19. 未读计数模块 `/unread`

| 方法 | 端点 | 认证 | 描述 |
|------|------|------|------|
| GET | `/unread/counts` | ✅ | 获取所有未读计数 |
| GET | `/unread/counts/:friendId` | ✅ | 获取与某好友的未读计数 |
| PUT | `/unread/counts/:friendId` | ✅ | 更新未读计数 |
| POST | `/unread/read-all` | ✅ | 标记全部已读 |

---

### 20. AI 对话模块 `/clawbot`

| 方法 | 端点 | 认证 | 描述 |
|------|------|------|------|
| GET | `/clawbot/conversations` | ✅ | 获取对话列表 |
| POST | `/clawbot/conversations` | ✅ | 创建对话 |
| GET | `/clawbot/conversations/:id/messages` | ✅ | 获取对话消息 |
| POST | `/clawbot/conversations/:id/messages` | ✅ | 发送消息 |
| DELETE | `/clawbot/conversations/:id` | ✅ | 删除对话 |

---

### 21. 学习目标模块 `/study/goals`

| 方法 | 端点 | 认证 | 描述 |
|------|------|------|------|
| GET | `/study/goals` | ✅ | 获取学习目标列表 |
| POST | `/study/goals` | ✅ | 创建学习目标 |
| PUT | `/study/goals/:id` | ✅ | 更新学习目标 |
| DELETE | `/study/goals/:id` | ✅ | 删除学习目标 |

---

## TRIX Native Server API

TRIX Native Server (端口 8788) 提供 iOS 设备与 Web 前端的双向消息同步。

### 配对相关

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/pairings` | 生成配对码 |
| GET | `/api/pairings/:code` | 查询配对状态 |
| POST | `/api/pairings/:code/claim` | 确认配对 |

### 认证

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/auth` | 认证获取 token |

### 消息

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/messages/from-plugin` | Plugin 发送消息到手机 |
| GET | `/api/messages/to-plugin` | Plugin 拉取手机消息 |

### 文件上传

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/upload` | 上传图片/音频/视频/文件 |

### WebSocket

| 路径 | 描述 |
|------|------|
| `/ws/phone?code=XXX` | iOS 连接，实时接收消息 |
| `/ws/plugin?token=XXX` | OpenClaw Plugin 连接 |

### 配对码流程

```
1. iOS 生成配对码 → POST /api/pairings
2. Web 前端输入配对码 → GET /api/pairings/:code
3. iOS 确认配对 → POST /api/pairings/:code/claim
4. 双方建立 WebSocket 连接 → /ws/phone
```

---

## 响应格式

### 成功响应

```json
{
  "success": true,
  "message": "成功",
  "data": { ... }
}
```

### 错误响应

```json
{
  "success": false,
  "error": "错误信息"
}
```

---

## 错误码

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 401 | 未授权 / Token 无效 |
| 403 | 权限不足 |
| 404 | 资源不存在 |
| 500 | 服务器错误 |

---

## 数据库表结构

### 核心表

```sql
-- 用户资料扩展
profiles (扩展字段)
├── points: 积分
├── days_active: 活跃天数
├── total_study_time: 总学习时间
├── current_streak: 当前连续天数
├── school: 学校
├── grade: 年级
├── avatar_config: 头像配置
├── is_studying: 是否在学习
```

### 社交表

```sql
friends -- 好友关系
friend_requests -- 好友请求

chat_rooms -- 聊天房间
chat_room_participants -- 房间参与者
chat_messages -- 聊天消息
```

### 功能表

```sql
schedules -- 日程
todos -- 待办事项
achievements -- 成就
user_achievements -- 用户成就
mall_items -- 商城商品
user_purchased_items -- 已购商品
outfits -- 装扮
user_outfits -- 用户装扮
user_points -- 用户积分
points_transactions -- 积分记录
purchase_history -- 购买历史
```

### 学习表

```sql
study_sessions -- 学习记录
study_stats -- 学习统计
study_rooms -- 学习房间
study_room_participants -- 房间参与者
```

### 位置表

```sql
places -- 地点
place_favorites -- 地点收藏
user_locations -- 用户位置
```

### 其他表

```sql
pairing_requests -- 配对请求
paired_devices -- 已配对设备
snapshots -- AI 快照
notifications -- 通知
device_tokens -- 设备令牌
```

---

## 常用查询参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `limit` | number | 限制返回数量 |
| `offset` | number | 偏移量 |
| `page` | number | 页码 |
| `days` | number | 天数 |
| `minutes` | number | 分钟数 |
| `latitude` | number | 纬度 |
| `longitude` | number | 经度 |
| `radius` | number | 半径(米) |
| `start` | string | 开始时间 |
| `end` | string | 结束时间 |
| `category` | string | 分类 |
| `q` | string | 搜索关键词 |
| `unread_only` | boolean | 仅未读 |

---

## Socket.io 事件

### 连接

```javascript
const socket = new WebSocket('ws://TRIX_SERVER_HOST:8788/ws/phone');
```

### 事件列表

| 事件 | 方向 | 说明 |
|------|------|------|
| `app_register` | 客户端 → 服务端 | 注册用户连接 |
| `bot_request_pairing` | 客户端 → 服务端 | 机器人请求配对 |
| `bot_confirm_pairing` | 客户端 → 服务端 | 确认配对 |
| `study_room_create` | 客户端 → 服务端 | 创建学习房间 |
| `study_room_join` | 客户端 → 服务端 | 加入学习房间 |
| `study_room_leave` | 客户端 → 服务端 | 离开学习房间 |
| `message_sent` | 服务端 → 客户端 | 消息发送成功 |
| `bot_message` | 服务端 → 客户端 | 机器人消息 |

---

## 更新日志

### 2026-03-03

- 初始版本
- 实现所有 MVP + 扩展 API
- 支持用户、好友、日程、待办、成就、商城、衣柜、学习、聊天、配对、地点、积分、快照、通知等功能
