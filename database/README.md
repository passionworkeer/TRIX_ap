# TRIX 3D Companion - 数据库迁移脚本

**最后更新**: 2026-02-17

---

## 📁 脚本文件说明

### 核心初始化（src/database/）

#### init.sql
**状态**: ⚠️ 已弃用，请使用 `complete-init.sql`
**用途**: 原始数据库初始化脚本
**说明**: 包含基础的表结构，但结构较旧（使用TEXT类型的friend_id）

#### complete-init.sql ⭐
**状态**: ✅ 推荐使用
**用途**: 完整的数据库初始化脚本
**包含**:
- 9个核心表（profiles, friends, chat_messages等）
- 外键关系和索引
- 视图和函数
- 测试数据（6个测试用户）

**使用方法**: 新项目初始化时执行

---

### 增量迁移（database/）

所有文件按创建时间排序，应按顺序执行：

#### 1. add-is-studying-to-profiles.sql (2026-02-11)
**用途**: 添加学习状态字段
**添加字段**: `profiles.is_studying` (BOOLEAN)
**索引**: `idx_profiles_is_studying` (部分索引)

#### 2. add-companion-to-profiles.sql (2026-02-11)
**用途**: 添加自习伙伴功能
**添加字段**: `profiles.companion_id` (UUID，自引用外键)
**索引**: `idx_profiles_companion_id`

#### 3. add-study-time-to-profiles.sql (2026-02-11)
**用途**: 添加累计学习时长
**添加字段**: `profiles.total_study_time` (INTEGER，单位：分钟)
**索引**: `idx_profiles_total_study_time` (部分索引)

#### 4. add-media-support-to-chat-messages.sql (2026-02-12)
**用途**: 为聊天消息添加多媒体支持
**添加字段**:
- `message_type` (TEXT)
- `media_uri` (TEXT)
- `media_type` (TEXT)
- `media_size` (BIGINT)
- `media_metadata` (JSONB)

**索引**: 多个复合索引

#### 5. ~~add-pairing-requests-table.sql~~ (已删除)
> ⚠️ 此文件已废弃。TRIX Native 使用本地 JSON 存储配对信息。

#### 6. add-points-system.sql (2026-02-16) ⭐
**用途**: 创建积分系统
**创建表**:
- `user_points` (用户积分)
- `point_transactions` (积分交易记录)

**函数**:
- `add_user_points()` - 添加积分
- `calculate_user_level()` - 计算等级
- `get_user_points_stats()` - 获取统计

**视图**: `user_points_overview` (积分排行榜)

#### 7. add-user-settings.sql (2026-02-17) ⭐
**用途**: 创建用户隐私设置表
**创建表**: `user_settings`
**字段**:
- `allow_stranger_search` (BOOLEAN)
- `show_online_status` (BOOLEAN)
- `allow_study_invites` (BOOLEAN)

**RLS**: 完整的行级安全策略

#### 8. add-chat-attachments-storage.sql
**类型**: 📄 文档（非SQL脚本）
**用途**: Supabase Storage 配置说明
**内容**: 手动配置Storage桶的步骤

---

## 🚀 使用指南

### 新项目初始化

```bash
# 1. 在Supabase SQL Editor中执行
# 打开 src/database/complete-init.sql
# 全选并执行

# 2. 验证表创建
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

### 增量迁移（添加新功能）

如果从旧版本升级，按顺序执行以下脚本：

```bash
# 必须按顺序执行！
1. database/add-is-studying-to-profiles.sql
2. database/add-companion-to-profiles.sql
3. database/add-study-time-to-profiles.sql
4. database/add-media-support-to-chat-messages.sql
5. database/unified-init-v2.sql  # 推荐使用
# 注意: pairing-requests 相关文件已废弃（TRIX Native 使用本地存储）
6. database/add-points-system.sql ⭐
7. database/add-user-settings.sql ⭐
```

### 已部署的项目

如果数据库已经是最新状态（2026-02-17），无需执行任何脚本。

---

## ✅ 验证检查

执行任何脚本后，运行以下验证：

```sql
-- 1. 检查所有表
SELECT COUNT(*) as table_count
FROM information_schema.tables
WHERE table_schema = 'public';

-- 预期结果: 13个表（不含views）

-- 2. 检查核心表
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('profiles', 'user_settings', 'user_points', 'point_transactions')
ORDER BY table_name;

-- 预期结果: 4个表都存在

-- 3. 检查外键关系
SELECT COUNT(*) as foreign_key_count
FROM information_schema.table_constraints
WHERE table_schema = 'public'
AND constraint_type = 'FOREIGN KEY';

-- 预期结果: 大于等于5个
```

---

## 🔧 故障排除

### 错误: relation "profiles" does not exist

**原因**: 未执行初始化脚本

**解决**: 先执行 `src/database/complete-init.sql`

### 错误: column "xxx" does not exist

**原因**: 未执行对应的增量迁移脚本

**解决**: 按顺序执行所有增量脚本

### 错误: duplicate key value violates unique constraint

**原因**: 重复执行了同一个脚本

**解决**:
```sql
-- 检查是否已存在
SELECT table_name FROM information_schema.tables
WHERE table_name = 'user_settings';

-- 如果存在，跳过CREATE TABLE部分
```

---

## 📝 开发者注意事项

### 不要修改的文件
- ❌ `src/database/init.sql` (已弃用)
- ❌ `database/migration-2026-02-17-user-settings.sql` (已删除，重复)

### 推荐使用的文件
- ✅ `src/database/complete-init.sql` (新项目初始化)
- ✅ `database/*.sql` (增量迁移，按需执行)

### 添加新表

1. 创建新的SQL文件：`database/add-your-feature.sql`
2. 遵循命名规范：`add-{feature-name}.sql`
3. 包含完整的CREATE TABLE语句
4. 添加必要的索引和外键
5. 在本README中添加说明

---

## 📞 帮助

**问题**: 联系后端团队
**文档更新**: 更新日期和版本号

---

**文档版本**: v1.0
**最后更新**: 2026-02-17
