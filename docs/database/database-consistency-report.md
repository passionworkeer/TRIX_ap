# TRIX 3D Companion - Web & iOS 数据库一致性分析报告

> 生成日期: 2026-03-10
> 分析范围: Web (React + Supabase) vs iOS (SwiftUI + REST API)
> **重要**: 已连接到实际 Supabase 数据库验证

---

## 📊 执行摘要

| 维度 | Web 端 | iOS 端 |
|------|--------|--------|
| 数据访问方式 | 直接访问 Supabase | 通过 REST API |
| 主用户表 | `profiles` | 通过 `/auth/me` API |
| 总数据库表 | ~25 个 | ~26 个数据模型 |

### 🔴 发现的严重问题

1. **用户表不一致**: Web 使用 `profiles`，数据库初始化脚本使用 `users`
2. **字段不匹配**: 多处字段名/类型不一致
3. **部分功能 iOS 未实现**: 位置共享、邮件等功能 iOS 缺失

---

## 📋 完整对比表

### 1. 用户/认证模块

| 功能 | Web 表/视图 | iOS 模型 | 状态 | 问题 |
|------|-------------|----------|------|------|
| 用户基本信息 | `profiles` | `User` | ⚠️ 不一致 | Web 用 profiles，DB 初始化用 users |
| 用户积分 | `user_points` | `PointsResponse` | ⚠️ 字段差异 | 字段名不完全匹配 |
| 用户设置 | `user_settings` | ❌ 无 | ❌ 缺失 | iOS 未实现 |

**profiles 表字段 (Web):**
```
id, username, points, avatar_config, full_name, avatar_url, website, bio,
is_studying, companion_id, days_active, interaction_count, last_active_at,
created_at, updated_at, total_study_time, current_streak
```

**users 表字段 (DB 初始化脚本):**
```
id, email, username, display_name, avatar_url, bio, created_at, updated_at
```

---

### 2. 好友/聊天模块

| 功能 | Web 表 | iOS 模型 | 状态 | 字段对比 |
|------|--------|----------|------|----------|
| 好友关系 | `friends` | `Friend` | ✅ 一致 | 字段基本匹配 |
| 好友最新消息 | `friend_latest_messages` (视图) | `FriendLatestMessage` | ✅ 一致 | Web 用视图，iOS 用 API |
| 聊天消息 | `chat_messages` | `ChatMessage` | ⚠️ 字段差异 | Web 有更多媒体字段 |
| 未读计数 | `unread_counts` | `UnreadCounts` | ✅ 一致 | 字段匹配 |
| 好友请求 | ❌ 无独立表 | `FriendRequest` | ⚠️ 可能缺失 | 需要确认 |

**chat_messages 字段差异:**

| 字段 | Web | iOS | 说明 |
|------|-----|-----|------|
| message_type | ✅ | ✅ | 一致 |
| media_uri | ✅ | ✅ | Web 有更多字段 |
| media_type | ✅ | ✅ | |
| media_size | ✅ | ❌ | iOS 缺失 |
| media_metadata | ✅ | ❌ | iOS 缺失 |
| voice_url | ✅ | ✅ | |
| voice_duration | ✅ | ✅ | |
| voice_transcript | ✅ | ❌ | iOS 缺失 |
| voice_mime_type | ✅ | ❌ | iOS 缺失 |

---

### 3. 学习模块

| 功能 | Web 表 | iOS 模型 | 状态 | 问题 |
|------|--------|----------|------|------|
| 学习记录 | `study_sessions` | `StudySession` | ⚠️ 字段差异 | duration vs duration_minutes |
| 学习统计 | ❌ 实时计算 | `StudyStats` | ⚠️ 计算方式不同 | Web 实时计算，iOS 有专门 API |
| 学习目标 | ❌ 无 | `StudyGoal` | ❌ 缺失 | iOS 有，Web 无 |
| 自习室 | `study_rooms` | `StudyRoom` | ⚠️ 字段差异 | Web 有完整 CRUD，iOS 主要是加入/离开 |
| 自习室成员 | `study_room_members` | `StudyRoomMember` | ⚠️ 字段差异 | |

**study_sessions 字段差异:**

| 字段 | Web | iOS | 说明 |
|------|-----|-----|------|
| duration | INTEGER | - | Web 直接存储分钟数 |
| duration_minutes | - | ✅ | iOS 用 durationMinutes |
| started_at | ✅ | ✅ | 一致 |
| ended_at | ✅ | ✅ | 一致 |
| start_time | ✅ | ❌ | Web 额外字段 |
| subject | ✅ | ✅ | 一致 |
| notes | ✅ | ✅ | 一致 |

---

### 4. 积分/商城模块

| 功能 | Web 表 | iOS 模型 | 状态 | 问题 |
|------|--------|----------|------|------|
| 用户积分 | `user_points` | `UserPointsStats` | ⚠️ 字段差异 | |
| 积分交易 | `point_transactions` | `PointsTransaction` | ✅ 已修复 | 实际表名为 point_transactions（单数），已修复 mallService.ts 中的代码 Bug |
| 商城物品 | `mall_items` | `MallItem` | ✅ 一致 | |
| 已购物品 | `user_purchased_items` | `PurchaseHistoryItem` | ⚠️ 字段差异 | |
| 订单 | ❌ 无 | `Order` | ❌ 缺失 | Web 无订单表 |

**积分表命名问题: ✅ 已修复**
- `database/add-points-system.sql`: 使用 `point_transactions` (单数) — **正确**
- `database/create_missing_tables.sql`: 使用 `points_transactions` (复数) — **错误**
- `src/services/mallService.ts`: 原混用两者 → **已修复为 `point_transactions`（单数）**
- **结论**: 实际表名为 `point_transactions`（单数），与其他表命名一致

---

### 5. 成就/衣柜模块

| 功能 | Web 表 | iOS 模型 | 状态 | 问题 |
|------|--------|----------|------|------|
| 成就定义 | `achievements` | `Achievement` | ✅ 一致 | |
| 用户成就 | `user_achievements` | `UserAchievement` | ✅ 一致 | |
| 装扮物品 | `outfits` | `Outfit` | ✅ 一致 | |
| 用户装扮 | `user_outfits` | (API 返回) | ✅ 一致 | |

---

### 6. 待办/日程模块

| 功能 | Web 表 | iOS 模型 | 状态 | 问题 |
|------|--------|----------|------|------|
| 待办事项 | `todos` | `APITodo` | ⚠️ 字段差异 | |
| 日程 | `schedules` | `ScheduleCreateRequest` | ⚠️ 字段差异 | |

**schedules 字段差异:**

| 字段 | Web | iOS | 说明 |
|------|-----|-----|------|
| title | ✅ | ✅ | |
| description | ✅ | ✅ | |
| start_time | ✅ | ✅ | |
| end_time | ✅ | ✅ | |
| all_day | ✅ | ❌ | iOS 缺失 |
| recurrence | ✅ | ❌ | iOS 缺失 |
| location | ✅ | ✅ | |
| reminders | ✅ | ❌ | iOS 缺失 |
| color | ✅ | ❌ | iOS 缺失 |
| sync_status | ✅ | ❌ | iOS 缺失 |

---

### 7. 位置/地点模块

| 功能 | Web 表 | iOS 模型 | 状态 | 问题 |
|------|--------|----------|------|------|
| 地点 | `places` | `Place` | ⚠️ 字段差异 | |
| 用户收藏地点 | `user_favorite_places` | ❌ 无 | ❌ 缺失 | iOS 无收藏功能 |
| 用户位置 | `user_locations` | `Location` | ⚠️ 字段差异 | |
| 位置设置 | `user_location_settings` | ❌ 无 | ❌ 缺失 | iOS 无 |
| 好友关系 | `friends` | ❌ 无 | ❌ 缺失 | iOS 无位置共享（`locationService.ts` 曾错误引用 `friendships`） |

---

### 8. 通知/消息模块

| 功能 | Web 表 | iOS 模型 | 状态 | 问题 |
|------|--------|----------|------|------|
| 系统通知 | `notifications` | `APIAppNotification` | ⚠️ 字段差异 | |
| 内部邮件 | `mails` | ❌ 无 | ❌ 缺失 | iOS 无邮件功能 |

**notifications 字段差异:**

| 字段 | Web | iOS | 说明 |
|------|-----|-----|------|
| type | ✅ | ✅ | |
| title | ✅ | ✅ | |
| content | ✅ | ✅ (body) | 字段名不同 |
| avatar_url | ✅ | ✅ | |
| is_read | ✅ | ✅ | |
| created_at | ✅ | ✅ | |
| data | ❌ | ✅ | iOS 额外字段 |

---

### 9. 配对模块

| 功能 | Web 表 | iOS 模型 | 状态 | 问题 |
|------|--------|----------|------|------|
| 配对请求 | `pairing_requests` | `PairingRequest` | ✅ 一致 | |
| 配对设备 | ❌ 无 | `PairedDevice` | ⚠️ 存储方式不同 | Web 无持久化 |

---

### 10. AI 对话模块 (Clawbot)

| 功能 | Web 表 | iOS 模型 | 状态 | 问题 |
|------|--------|----------|------|------|
| AI 对话 | ❌ 无 | `ClawbotConversation` | ❌ 缺失 | Web 直接调用 API，无存储 |

---

## 🔴 关键问题汇总

### 1. 用户表问题 (严重)

**现状:**
- Web 使用 `profiles` 表
- DB 初始化脚本创建 `users` 表
- iOS 通过 `/auth/me` API 获取用户信息

**建议:** 统一使用 `profiles` 表（Web 已实现），更新 `complete-init.sql`

---

### 2. 积分表命名不一致 (严重) — ✅ 已修复

**现状:**
- `add-points-system.sql`: `point_transactions` ✅ 正确
- `create_missing_tables.sql`: `points_transactions` ❌ 错误
- Web 代码原混用两者

**✅ 已修复（2026-03-21）:** `src/services/mallService.ts` 中 `points_transactions` → `point_transactions`（单数，与实际表名一致）

---

### 3. iOS 缺失的功能 (中等)

| 功能 | Web | iOS | 优先级 |
|------|-----|-----|--------|
| 用户设置 | ✅ | ❌ | 中 |
| 位置共享 | ✅ | ❌ | 低 |
| 邮件 | ✅ | ❌ | 低 |
| 收藏地点 | ✅ | ❌ | 低 |
| 学习目标 | ❌ | ✅ | 中 |
| AI 对话持久化 | ❌ | ✅ | 低 |

---

### 4. 字段不匹配 (需评估)

部分字段差异可能不影响功能，但建议统一:

- `duration` vs `duration_minutes`
- `content` vs `body`
- `all_day`, `recurrence`, `reminders`, `color` 等可选字段

---

## 📝 建议的数据库表清单

基于分析，建议保留的表结构:

```sql
-- 核心表 (Web + iOS 共用)
profiles          -- 用户扩展信息 (统一使用)
friends           -- 好友关系
chat_messages     -- 聊天消息
unread_counts     -- 未读计数
notifications     -- 通知
study_sessions    -- 学习记录
study_rooms       -- 自习室
study_room_members -- 自习室成员

-- 积分/商城
user_points       -- 用户积分
point_transactions -- 积分交易 (已修复：实际表名为 point_transactions 单数)
mall_items        -- 商城物品
user_purchased_items -- 已购物品

-- 成就/衣柜
achievements      -- 成就定义
user_achievements -- 用户成就
outfits           -- 装扮物品
user_outfits      -- 用户装扮

-- 待办/日程
todos             -- 待办
schedules         -- 日程

-- 配对
pairing_requests  -- 配对请求

-- 地点 (可选实现)
places            -- 地点
user_favorite_places -- 收藏地点
user_locations   -- 用户位置
```

---

## 🔧 后续行动

1. **统一用户表**: 将 `complete-init.sql` 中的 `users` 表改为使用 `profiles`
2. **修复积分表命名**: ✅ 已修复 — `mallService.ts` 已更正为 `point_transactions`（单数）
3. **补齐 iOS 功能**: 根据业务优先级实现缺失功能
4. **字段同步**: 考虑添加可选字段到 iOS 端

---

> **⚠️ 本报告生成于 2026-03-10，反映彼时状态。积分表命名问题已于 2026-03-21 修复（见上述更新）。**
