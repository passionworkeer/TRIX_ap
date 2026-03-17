# TRIX 3D Companion - 数据库文档

**最后更新**: 2026-03-17

---

## 概述

本目录包含 TRIX 3D Companion 项目的数据库相关文件。基于 Supabase 生产数据库实际状态生成。

---

## 文件结构

```
database/
├── schema-complete.sql      # 完整数据库初始化脚本 (21表)
├── DATABASE_SCHEMA.md       # 详细表结构文档
├── DATABASE_SETUP_COMPLETE.md  # 设置完成文档
└── add-chat-attachments-storage.sql  # Storage 配置说明
```

---

## 数据库表状态

### ✅ 已存在 (21个表)

| 分类 | 表名 | 说明 |
|------|------|------|
| 用户 | profiles | 用户资料 |
| 好友 | friends, friend_requests | 好友关系与请求 |
| 消息 | chat_messages, unread_counts, notifications, mails | 消息通信 |
| 学习 | study_sessions, study_rooms, study_room_members | 学习功能 |
| 积分 | user_points, point_transactions, achievements, user_achievements | 积分系统 |
| 商城 | mall_items, user_purchased_items, outfits, user_outfits | 积分商城 |
| 日程 | todos, schedules | 待办与日程 |
| 设置 | user_settings | 用户隐私设置 |

### ❌ 缺失 (4个表) - 位置服务

| 表名 | 说明 | 是否需要 |
|------|------|----------|
| places | 地点/商家 | 可选 |
| user_favorite_places | 用户收藏地点 | 可选 |
| user_locations | 用户位置 | 可选 |
| user_location_settings | 位置分享设置 | 可选 |

> 注：这4个表仅用于"地图/位置分享"功能，如不需要可忽略。

---

## 快速开始

### 新项目初始化

在 Supabase SQL Editor 中执行 `schema-complete.sql`（21个表）：

```sql
-- 打开 Supabase Dashboard → SQL Editor
-- 复制粘贴 schema-complete.sql 内容
-- 点击 Run
```

### 添加位置服务（可选）

如需使用地图/位置分享功能，执行：

```sql
-- 创建 places 表
CREATE TABLE IF NOT EXISTS places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  category TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建 user_favorite_places 表
CREATE TABLE IF NOT EXISTS user_favorite_places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  place_id UUID NOT NULL REFERENCES places(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, place_id)
);

-- 创建 user_locations 表
CREATE TABLE IF NOT EXISTS user_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  accuracy INTEGER,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  is_shared BOOLEAN DEFAULT false
);

-- 创建 user_location_settings 表
CREATE TABLE IF NOT EXISTS user_location_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  share_location BOOLEAN DEFAULT false,
  share_with_friends BOOLEAN DEFAULT false,
  auto_expire_minutes INTEGER DEFAULT 60,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 文档

- **DATABASE_SCHEMA.md** - 详细表结构、字段说明、索引、关系图
- **DATABASE_SETUP_COMPLETE.md** - 设置完成确认文档
- **add-chat-attachments-storage.sql** - Storage Bucket 配置

---

**文档版本**: v4.0
**最后更新**: 2026-03-17
