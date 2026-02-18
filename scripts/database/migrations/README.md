# 数据库迁移指南

## 📋 迁移内容

本次迁移将创建以下数据库对象：

1. **`friend_latest_messages` 视图**
   - 用于好友列表显示
   - 包含好友信息、最新消息和未读计数
   - 位置: [databaseService.ts:171](src/services/databaseService.ts#L171)

2. **`mark_messages_as_read` 存储过程**
   - 用于批量标记消息为已读
   - 同时重置未读计数
   - 位置: [databaseService.ts:476](src/services/databaseService.ts#L476)

## 🚀 执行方法

### 方法 1: Supabase Dashboard (推荐)

1. 打开 Supabase SQL Editor:
   ```
   https://app.supabase.com/project/_/sql
   ```

2. 依次执行以下 SQL 文件:
   - [001_create_friend_latest_messages_view.sql](database-migrations/001_create_friend_latest_messages_view.sql)
   - [002_create_mark_messages_as_read_function.sql](database-migrations/002_create_mark_messages_as_read_function.sql)

### 方法 2: 使用 psql 命令行

如果你有 `psql` 客户端，可以执行:

```bash
psql -h db.hmbukjvrbyhbuqumqdug.supabase.co \
     -U postgres.hmbukjvrbyhbuqumqdug \
     -d postgres \
     -f database-migrations/001_create_friend_latest_messages_view.sql

psql -h db.hmbukjvrbyhbuqumqdug.supabase.co \
     -U postgres.hmbukjvrbyhbuqumqdug \
     -d postgres \
     -f database-migrations/002_create_mark_messages_as_read_function.sql
```

## ✅ 验证方法

执行迁移后，运行验证脚本:

```bash
node verify-migrations.mjs
```

## 📊 迁移详情

### 001_create_friend_latest_messages_view.sql

创建一个视图，用于获取好友列表，包含:
- 好友的基本信息 (从 profiles 表)
- 好友关系状态 (从 friends 表)
- 最新消息内容和时间 (从 unread_counts 表)
- 未读消息计数

**视图定义:**
```sql
CREATE VIEW friend_latest_messages AS
SELECT
  f.user_id,
  f.friend_id,
  p.username as name,
  p.avatar_url,
  f.status,
  p.bio,
  f.study_time,
  f.is_studying,
  COALESCE(uc.unread_count, 0) as unread_count,
  uc.last_message,
  uc.last_message_time
FROM friends f
LEFT JOIN profiles p ON f.friend_id = p.id
LEFT JOIN unread_counts uc ON f.user_id = uc.user_id AND f.friend_id = uc.friend_id
WHERE f.status = 'accepted';
```

### 002_create_mark_messages_as_read_function.sql

创建一个存储过程，用于:
1. 标记与某个好友的所有消息为已读
2. 重置未读计数为 0

**函数签名:**
```sql
mark_messages_as_read(p_user_id uuid, p_friend_id uuid)
```

**调用示例:**
```javascript
await supabase.rpc('mark_messages_as_read', {
  p_user_id: userId,
  p_friend_id: friendId
});
```

## 🔍 故障排查

如果遇到问题:

1. **权限错误**: 确保你的 Supabase 账号有足够的权限执行 DDL 语句

2. **对象已存在**: 如果视图或函数已存在，迁移脚本会先删除再创建

3. **依赖表缺失**: 确保 `profiles`, `friends`, `chat_messages`, `unread_counts` 表已存在

## 📝 相关文档

- [数据库需求文档](docs/database-requirements/DATABASE-REQUIREMENTS.md)
- [数据库最佳实践 Skill](.claude/skills/supabase-postgres-best-practices/skill.md)

---

**创建日期:** 2026-02-18
**版本:** 1.0.0
