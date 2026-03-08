# API.md - API 参考

> TRIX 3D Companion API 快速参考。完整文档见 [docs/API_DOCUMENTATION.md](./docs/API_DOCUMENTATION.md)

---

## 🏠 基础信息

| 环境 | URL |
|------|-----|
| 开发 | `http://TRIX_SERVER_HOST:8765` |
| 生产 | `https://api.trix3d.com/api` |

### 认证

除以下端点外，所有 API 需要在 Header 中携带认证 token：

```http
Authorization: Bearer <token>
```

### 可选认证端点

这些端点认证可选（不带 token 也可访问）：

- `GET /mall/items`
- `GET /mall/items/:id`
- `GET /places/nearby`
- `GET /places/search`
- `GET /health`

---

## 📡 端点索引

### 用户模块 `/user`

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/user/profile` | 获取用户资料 |
| PUT | `/user/profile` | 更新用户资料 |
| POST | `/user/avatar` | 更新头像 |
| GET | `/user/stats` | 用户统计 |
| GET | `/user/settings` | 获取设置 |
| PUT | `/user/settings` | 更新设置 |

### 好友模块 `/friends`

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/friends` | 好友列表 |
| POST | `/friends` | 添加好友 |
| DELETE | `/friends/:id` | 删除好友 |
| GET | `/friends/requests` | 好友请求 |
| POST | `/friends/requests/:id/accept` | 接受请求 |
| POST | `/friends/requests/:id/decline` | 拒绝请求 |

### 聊天模块 `/chat`

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/chat/rooms` | 聊天房间列表 |
| POST | `/chat/rooms` | 创建房间 |
| GET | `/chat/rooms/:roomId` | 房间详情 |
| GET | `/chat/rooms/:roomId/messages` | 消息历史 |
| POST | `/chat/rooms/:roomId/messages` | 发送消息 |
| POST | `/chat/rooms/:roomId/messages/read` | 标记已读 |

### 学习模块 `/study`

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/study/sessions` | 学习记录 |
| POST | `/study/sessions` | 创建记录 |
| PUT | `/study/sessions/:id` | 更新记录 |
| DELETE | `/study/sessions/:id` | 删除记录 |
| GET | `/study/stats` | 学习统计 |
| GET | `/study/stats/weekly` | 每周统计 |
| GET | `/study/history/daily` | 每日汇总 |
| GET | `/study/history/weekly` | 每周汇总 |
| GET | `/study/history/monthly` | 每月汇总 |
| POST | `/study/room/create` | 创建自习室 |
| POST | `/study/room/join` | 加入自习室 |
| POST | `/study/room/leave` | 离开自习室 |
| GET | `/study/goals` | 学习目标 |
| POST | `/study/goals` | 创建目标 |
| PUT | `/study/goals/:id` | 更新目标 |
| DELETE | `/study/goals/:id` | 删除目标 |

### 日程模块 `/schedules`

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/schedules` | 日程列表 |
| POST | `/schedules` | 创建日程 |
| PUT | `/schedules/:id` | 更新日程 |
| DELETE | `/schedules/:id` | 删除日程 |
| GET | `/schedules/range` | 范围查询 |
| GET | `/schedules/upcoming` | 即将到来 |

### 待办模块 `/todos`

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/todos` | 待办列表 |
| POST | `/todos` | 创建待办 |
| PUT | `/todos/:id` | 更新待办 |
| DELETE | `/todos/:id` | 删除待办 |
| POST | `/todos/:id/toggle` | 切换状态 |

### 成就模块 `/achievements`

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/achievements` | 成就列表 |
| POST | `/achievements/check` | 检查成就 |
| POST | `/achievements/:id/unlock` | 解锁成就 |

### 商城模块 `/mall`

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/mall/items` | 商品列表 |
| GET | `/mall/items/:id` | 商品详情 |
| POST | `/mall/purchase` | 购买商品 |
| GET | `/mall/purchase/history` | 购买历史 |

### 衣柜模块 `/wardrobe`

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/wardrobe/outfits` | 装扮列表 |
| POST | `/wardrobe/outfits/:id/equip` | 装备装扮 |
| POST | `/wardrobe/outfits/:id/unequip` | 卸下装扮 |

### 积分模块 `/points`

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/points` | 当前积分 |
| GET | `/points/history` | 积分历史 |
| POST | `/points/add` | 添加积分 |
| POST | `/points/deduct` | 扣除积分 |

### 配对模块 `/pairing`

| 方法 | 端点 | 描述 |
|------|------|------|
| POST | `/pairing/request` | 请求配对 |
| POST | `/pairing/confirm` | 确认配对 |
| POST | `/pairing/deny/:id` | 拒绝配对 |
| GET | `/pairing/devices` | 已配对设备 |
| DELETE | `/pairing/devices/:id` | 删除配对 |
| GET | `/pairing/status/:id` | 配对状态 |

### 通知模块 `/notifications`

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/notifications` | 通知列表 |
| PUT | `/notifications/:id/read` | 标记已读 |
| POST | `/notifications/read-all` | 全部已读 |
| POST | `/notifications/device-token` | 设备令牌 |
| GET | `/notifications/settings` | 通知设置 |
| PUT | `/notifications/settings` | 更新设置 |
| GET | `/notifications/preferences` | 通知偏好 |
| PUT | `/notifications/preferences` | 更新偏好 |

### 地点模块 `/places`

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/places/nearby` | 附近地点 |
| GET | `/places/search` | 搜索地点 |
| GET | `/places/favorites` | 收藏地点 |
| POST | `/places/favorites` | 添加收藏 |
| DELETE | `/places/favorites/:id` | 删除收藏 |
| POST | `/places/:placeId/favorite` | 切换收藏 |

### 位置模块 `/locations`

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/locations` | 共享位置 |
| POST | `/locations/share` | 分享位置 |
| GET | `/locations/:id` | 位置详情 |

### 快照模块 `/snapshots`

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/snapshots` | 快照列表 |
| POST | `/snapshots` | 创建快照 |
| GET | `/snapshots/:id` | 快照详情 |
| DELETE | `/snapshots/:id` | 删除快照 |

### 未读计数模块 `/unread`

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/unread/counts` | 所有未读计数 |
| GET | `/unread/counts/:friendId` | 指定未读 |
| PUT | `/unread/counts/:friendId` | 更新计数 |
| POST | `/unread/read-all` | 全部已读 |

### AI 对话模块 `/clawbot`

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/clawbot/conversations` | 对话列表 |
| POST | `/clawbot/conversations` | 创建对话 |
| GET | `/clawbot/conversations/:conversationId/messages` | 消息历史 |
| POST | `/clawbot/conversations/:conversationId/messages` | 发送消息 |
| DELETE | `/clawbot/conversations/:id` | 删除对话 |

### 系统端点

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/health` | 健康检查 |

---

## 📝 响应格式

### 成功响应

```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

### 错误响应

```json
{
  "success": false,
  "data": null,
  "error": "错误信息"
}
```

---

## 🔗 相关链接

- 完整 API 文档: [docs/API_DOCUMENTATION.md](./docs/API_DOCUMENTATION.md)
- API 类型定义: [docs/API_TYPES.md](./docs/API_TYPES.md)
- 数据库 Schema: [docs/DATABASE_SCHEMA.md](./docs/DATABASE_SCHEMA.md)

---

**最后更新**: 2026-03-08
