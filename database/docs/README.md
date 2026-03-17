# 🗄️ TRIX 3D Companion - Supabase 数据库配置指南

## 📋 数据库结构概览

### 核心表 (9 张)

1. **users** - 用户表
   - 存储用户基本信息（邮箱、用户名、头像等）

2. **friends** - 好友表
   - 存储好友信息（姓名、状态、学习时长等）

3. **chat_messages** - 聊天记录表
   - 存储所有聊天消息（发送者、内容、时间戳）

4. **unread_counts** - 未读消息计数表
   - 存储每个好友的未读消息数量和最新消息

5. **notifications** - 通知表
   - 存储系统通知、好友请求等

6. **mails** - 邮件表
   - 存储邮件消息

7. **study_sessions** - 学习记录表
   - 存储学习时长和学习内容

8. **study_rooms** - 自习室表
   - 存储自习室信息

9. **study_room_members** - 自习室成员表
   - 存储自习室成员关系

### 视图 (1 个)

- **friend_latest_messages** - 好友最新消息视图
  - 方便查询好友列表及最新消息

### 函数 (2 个)

1. **send_message()** - 发送消息并自动更新未读计数
2. **mark_messages_as_read()** - 标记消息为已读

---

## 🚀 快速开始

### 步骤 1: 打开 Supabase SQL 编辑器

访问你的项目 SQL 编辑器：
```
https://supabase.com/dashboard/project/__SUPABASE_PROJECT_REF_REDACTED__/sql/new
```

### 步骤 2: 复制并执行 SQL 脚本

1. 打开 `database/init.sql` 文件
2. 复制全部内容（Ctrl+A, Ctrl+C）
3. 粘贴到 Supabase SQL 编辑器中
4. 点击右下角 **"Run"** 按钮执行

### 步骤 3: 验证数据

执行完成后，你可以运行以下查询验证数据：

```sql
-- 查看所有好友
SELECT * FROM friends;

-- 查看聊天记录
SELECT * FROM chat_messages ORDER BY created_at DESC;

-- 查看未读消息
SELECT * FROM unread_counts;

-- 查看好友最新消息视图
SELECT * FROM friend_latest_messages;
```

---

## 📊 Mock 数据说明

### 用户数据
- **1 个用户**：你自己（ID: `00000000-0000-0000-0000-000000000001`）

### 好友数据
- **Alice** - UI/UX 设计师（在线，学习中）
- **Bob** - 算法竞赛爱好者（在线，学习中）
- **Carol** - 机器学习研究生（忙碌）
- **David** - 健身达人（在线，学习中）
- **Emma** - 文学爱好者（离线）

### 聊天记录
- **Alice**: 11 条消息（关于设计、展览）
- **Bob**: 13 条消息（关于算法学习）
- **Carol**: 8 条消息（关于项目协作）
- **David**: 10 条消息（关于运动、自习）
- **Emma**: 10 条消息（关于考试复习）

### 未读消息
- Alice: 2 条未读
- Bob: 1 条未读
- Carol: 1 条未读
- Emma: 1 条未读
- David: 0 条未读

> **注意**: Clawbot AI 助手已移至 TRIX Native Channel，通过 OpenClaw Gateway 连接。

---

## 🔧 常用 SQL 操作

### 1. 查询某个好友的所有聊天记录

```sql
SELECT * FROM chat_messages 
WHERE friend_id = 'alice' 
ORDER BY created_at ASC;
```

### 2. 发送新消息

```sql
-- 使用函数发送消息（会自动更新未读计数）
SELECT send_message('alice', 'user', '你好！');
```

### 3. 标记消息为已读

```sql
-- 使用函数标记已读
SELECT mark_messages_as_read(
  '00000000-0000-0000-0000-000000000001',
  'alice'
);
```

### 4. 更新好友在线状态

```sql
UPDATE friends 
SET status = 'online', 
    is_studying = true 
WHERE friend_id = 'alice';
```

### 5. 清空所有聊天记录（重置测试）

```sql
-- ⚠️ 警告：这会删除所有聊天记录
DELETE FROM chat_messages;
DELETE FROM unread_counts;

-- 然后重新运行 init.sql 中的 INSERT 语句
```

### 6. 查看今天的学习记录

```sql
SELECT * FROM study_sessions 
WHERE started_at >= CURRENT_DATE 
ORDER BY started_at DESC;
```

---

## 🔐 安全策略 (RLS)

数据库已启用行级安全策略 (Row Level Security)。

当前配置为**开放模式**（所有人可读可写），方便开发测试。

### 生产环境建议

在生产环境中，你应该修改策略为：

```sql
-- 示例：只允许用户访问自己的数据
CREATE POLICY "Users can only view own data" 
ON friends FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Users can only insert own data" 
ON friends FOR INSERT 
WITH CHECK (user_id = auth.uid());
```

---

## 📈 性能优化

### 已创建的索引

```sql
-- 好友表
idx_friends_user_id
idx_friends_friend_id
idx_friends_status

-- 聊天记录表
idx_chat_messages_friend_id
idx_chat_messages_created_at

-- 未读计数表
idx_unread_counts_user_id
idx_unread_counts_friend_id

-- 通知表
idx_notifications_user_id
idx_notifications_is_read
idx_notifications_created_at

-- 邮件表
idx_mails_user_id
idx_mails_is_read
idx_mails_created_at
```

---

## 🐛 故障排除

### 问题 1: 执行 SQL 失败

**解决方法**:
1. 检查是否有权限执行 DDL 语句
2. 确认没有重复执行脚本（表已存在）
3. 如果需要重新执行，先删除所有表：

```sql
-- ⚠️ 删除所有表（慎用）
DROP TABLE IF EXISTS study_room_members CASCADE;
DROP TABLE IF EXISTS study_rooms CASCADE;
DROP TABLE IF EXISTS study_sessions CASCADE;
DROP TABLE IF EXISTS mails CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS unread_counts CASCADE;
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS friends CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP VIEW IF EXISTS friend_latest_messages;
DROP FUNCTION IF EXISTS send_message;
DROP FUNCTION IF EXISTS mark_messages_as_read;
```

### 问题 2: 数据未显示

**解决方法**:
1. 检查 RLS 策略是否正确
2. 确认 `user_id` 匹配
3. 查看 Supabase 日志

### 问题 3: 时间戳不正确

**解决方法**:
- Supabase 使用 UTC 时区
- 前端需要转换为本地时区显示

---

## 📚 下一步

1. **连接前端**: 修改前端代码，使用 Supabase Client 连接数据库
2. **实时同步**: 启用 Supabase Realtime 功能
3. **认证集成**: 集成 Supabase Auth
4. **文件存储**: 使用 Supabase Storage 存储头像等文件

---

## 🆘 需要帮助？

- Supabase 文档: https://supabase.com/docs
- SQL 参考: https://www.postgresql.org/docs/
- TRIX 项目文档: 查看项目根目录的 README.md

---

**创建时间**: 2026-02-05  
**数据库版本**: v1.0  
**最后更新**: 2026-02-05
