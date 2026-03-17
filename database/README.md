# TRIX 3D Companion - 数据库文档

**最后更新**: 2026-03-17

---

## 概述

本目录包含 TRIX 3D Companion 项目的数据库相关文件。基于当前 Supabase 生产数据库实际状态生成。

---

## 文件结构

```
database/
├── schema-complete.sql      # 完整数据库初始化脚本 (推荐)
├── migrations/
│   └── add-missing-tables.sql  # 缺失表迁移脚本
├── docs/
│   ├── README.md           # 数据库测试数据说明
│   └── SCHEMA.md           # 表结构文档
├── DATABASE_SCHEMA.md       # 数据库架构文档
├── DATABASE_SETUP_COMPLETE.md  # 设置完成文档
├── add-chat-attachments-storage.sql  # Storage 配置说明
└── README.md               # 本文件
```

---

## 快速开始

### 新项目初始化

在 Supabase SQL Editor 中执行 `schema-complete.sql`：

```sql
-- 打开 Supabase Dashboard → SQL Editor
-- 复制粘贴 schema-complete.sql 内容
-- 点击 Run
```

### 现有项目升级

如果已有数据库结构，运行 `migrations/add-missing-tables.sql` 添加缺失的表：

```sql
-- 打开 Supabase Dashboard → SQL Editor
-- 复制粘贴 migrations/add-missing-tables.sql 内容
-- 点击 Run
```

---

## 数据库表 (25个)

### 核心用户

| 表名 | 说明 | 状态 |
|------|------|------|
| profiles | 用户资料 | ✅ 存在 |
| friends | 好友关系 | ⚠️ 需迁移 |
| friend_requests | 好友请求 | ⚠️ 需迁移 |

### 消息通信

| 表名 | 说明 | 状态 |
|------|------|------|
| chat_messages | 聊天消息 | ✅ 存在 |
| unread_counts | 未读计数 | ✅ 存在 |
| notifications | 通知 | ✅ 存在 |
| mails | 邮件 | ✅ 存在 |

### 学习功能

| 表名 | 说明 | 状态 |
|------|------|------|
| study_sessions | 学习记录 | ⚠️ 需迁移 |
| study_rooms | 学习室 | ✅ 存在 |
| study_room_members | 学习室成员 | ✅ 存在 |

### 积分商城

| 表名 | 说明 | 状态 |
|------|------|------|
| user_points | 用户积分 | ✅ 存在 |
| point_transactions | 积分交易 | ⚠️ 需迁移 |
| achievements | 成就 | ✅ 存在 |
| user_achievements | 用户成就 | ⚠️ 需迁移 |
| mall_items | 商城商品 | ✅ 存在 |
| user_purchased_items | 已购商品 | ⚠️ 需迁移 |
| outfits | 装扮 | ✅ 存在 |
| user_outfits | 用户装扮 | ⚠️ 需迁移 |

### 位置服务

| 表名 | 说明 | 状态 |
|------|------|------|
| places | 地点 | ⚠️ 需迁移 |
| user_favorite_places | 收藏地点 | ⚠️ 需迁移 |
| user_locations | 用户位置 | ⚠️ 需迁移 |
| user_location_settings | 位置设置 | ⚠️ 需迁移 |

### 日程待办

| 表名 | 说明 | 状态 |
|------|------|------|
| todos | 待办事项 | ⚠️ 需迁移 |
| schedules | 日程 | ⚠️ 需迁移 |

### 设置

| 表名 | 说明 | 状态 |
|------|------|------|
| user_settings | 用户隐私设置 | ⚠️ 需迁移 |

---

## 当前状态

- **总表数**: 25
- **已存在**: 12
- **需迁移**: 13 (包含 1 个废弃的 pairing_requests)

---

**文档版本**: v3.0
**最后更新**: 2026-03-17
