# Database Scripts

数据库管理脚本和迁移文件。

## 📁 目录结构

```
database/
├── README.md              # 本文件
├── check.mjs              # 数据库结构验证脚本
├── verify-migrations.mjs  # 迁移验证脚本
└── migrations/            # SQL 迁移文件
    ├── README.md          # 迁移指南
    ├── 001_create_friend_latest_messages_view.sql
    └── 002_create_mark_messages_as_read_function.sql
```

## 🚀 快速开始

### 1. 验证数据库结构

```bash
# 检查所有表、视图和存储过程是否正确配置
node scripts/database/check.mjs
```

### 2. 验证迁移状态

```bash
# 检查迁移是否已应用
node scripts/database/verify-migrations.mjs
```

### 3. 执行迁移

由于 Supabase 不支持通过客户端直接执行 DDL，请使用以下方法之一：

**方法 A: Supabase Dashboard（推荐）**

1. 打开 [SQL Editor](https://app.supabase.com/project/_/sql)
2. 依次执行 `migrations/` 目录下的 SQL 文件

**方法 B: psql 命令行**

```bash
psql -h db.__SUPABASE_PROJECT_REF_REDACTED__.supabase.co \
     -U postgres.__SUPABASE_PROJECT_REF_REDACTED__ \
     -d postgres \
     -f scripts/database/migrations/001_create_friend_latest_messages_view.sql

psql -h db.__SUPABASE_PROJECT_REF_REDACTED__.supabase.co \
     -U postgres.__SUPABASE_PROJECT_REF_REDACTED__ \
     -d postgres \
     -f scripts/database/migrations/002_create_mark_messages_as_read_function.sql
```

## 📊 数据库架构

### 核心表

| 表名 | 说明 | 代码位置 |
|------|------|----------|
| `profiles` | 用户资料 | [docs/database-requirements/DATABASE-REQUIREMENTS.md](../../docs/database-requirements/DATABASE-REQUIREMENTS.md#L5) |
| `friends` | 好友关系 | [docs/database-requirements/DATABASE-REQUIREMENTS.md](../../docs/database-requirements/DATABASE-REQUIREMENTS.md#L29) |
| `chat_messages` | 聊天消息 | [docs/database-requirements/DATABASE-REQUIREMENTS.md](../../docs/database-requirements/DATABASE-REQUIREMENTS.md#L97) |
| `unread_counts` | 未读消息计数 | [docs/database-requirements/DATABASE-REQUIREMENTS.md](../../docs/database-requirements/DATABASE-REQUIREMENTS.md#L128) |
| `notifications` | 通知 | [docs/database-requirements/DATABASE-REQUIREMENTS.md](../../docs/database-requirements/DATABASE-REQUIREMENTS.md#L151) |
| `mails` | 邮件 | [docs/database-requirements/DATABASE-REQUIREMENTS.md](../../docs/database-requirements/DATABASE-REQUIREMENTS.md#L175) |
| `study_sessions` | 学习记录 | [docs/database-requirements/DATABASE-REQUIREMENTS.md](../../docs/database-requirements/DATABASE-REQUIREMENTS.md#L198) |

### 视图

| 视图名 | 说明 | 定义 |
|--------|------|------|
| `friend_latest_messages` | 好友列表（含最新消息） | [migrations/001_](migrations/001_create_friend_latest_messages_view.sql) |

### 存储过程

| 函数名 | 说明 | 定义 |
|--------|------|------|
| `mark_messages_as_read` | 标记消息为已读 | [migrations/002_](migrations/002_create_mark_messages_as_read_function.sql) |

## 🔧 相关文档

- [数据库需求文档](../../docs/database-requirements/DATABASE-REQUIREMENTS.md)
- [Supabase 最佳实践 Skill](../../.claude/skills/supabase-postgres-best-practices/skill.md)
- [迁移指南](migrations/README.md)

## ⚠️ 注意事项

1. **计算字段**: `days_active` 和 `interaction_count` 是计算字段，不由数据库存储
2. **会话ID**: `conversation_id` 是文本字段，格式为 `${smallerUUID}_${largerUUID}`
3. **好友信息**: `friends` 表不存储 `name`、`avatar_url`、`bio`，通过 `profiles` 表 JOIN 获取
