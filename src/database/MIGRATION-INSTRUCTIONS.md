# 数据库迁移说明

## 🎯 自习室状态字段迁移

### 迁移文件
`migration-add-study-room-status.sql`

### 执行步骤

1. **登录 Supabase Dashboard**
   - 打开浏览器访问: https://supabase.com/dashboard
   - 登录你的账号

2. **进入 SQL Editor**
   - 选择你的项目
   - 点击左侧菜单的 `SQL Editor`

3. **执行迁移**
   - 点击 `New Query` 创建新查询
   - 复制 `migration-add-study-room-status.sql` 文件的全部内容
   - 粘贴到查询编辑器中
   - 点击 `Run` 按钮执行

4. **验证结果**
   - 执行成功后,应该看到 "Success. No rows returned" 消息
   - 你可以通过以下 SQL 验证字段是否添加成功:
   
   ```sql
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'study_room_members';
   ```

### 迁移内容

#### 新增字段
- `status` (TEXT): 成员状态 ('focusing' | 'idle' | 'away')
- `last_seen` (TIMESTAMPTZ): 最后活跃时间
- `display_name` (TEXT): 显示名称
- `avatar_url` (TEXT): 头像 URL

#### 新增函数

**`upsert_study_room_member()`**
- 功能: 更新或插入成员状态
- 参数:
  - `p_room_id` (UUID): 房间 ID
  - `p_user_id` (UUID): 用户 ID
  - `p_status` (TEXT): 状态 ('focusing' | 'idle' | 'away')
  - `p_display_name` (TEXT): 显示名称
  - `p_avatar_url` (TEXT): 头像 URL
- 返回: UUID (成员 ID)

**`cleanup_inactive_members()`**
- 功能: 清理超过 5 分钟未活跃的成员
- 参数: 无
- 返回: void
- 说明: 将 `last_seen` 超过 5 分钟的成员标记为 'idle' 状态

#### 新增索引
- `idx_study_room_members_status`: 加速按状态查询
- `idx_study_room_members_last_seen`: 加速按时间查询

### 测试迁移

执行以下 SQL 测试新增功能:

```sql
-- 测试 upsert 函数
SELECT upsert_study_room_member(
  '00000000-0000-0000-0000-000000000001'::uuid,  -- room_id
  '00000000-0000-0000-0000-000000000001'::uuid,  -- user_id
  'focusing',                                     -- status
  '测试用户',                                      -- display_name
  ''                                              -- avatar_url
);

-- 查看结果
SELECT * FROM study_room_members 
WHERE room_id = '00000000-0000-0000-0000-000000000001';

-- 测试清理函数
SELECT cleanup_inactive_members();
```

### 注意事项

⚠️ **重要提示**:
- 这个迁移是**幂等的**(可以多次执行而不会出错)
- 使用 `IF NOT EXISTS` 确保字段不会被重复添加
- 使用 `CREATE OR REPLACE` 确保函数可以安全更新
- 迁移会自动为所有现有记录设置默认值:
  - `status` = 'idle'
  - `last_seen` = NOW()

### 回滚方案

如果需要回滚此迁移,执行以下 SQL:

```sql
-- 删除函数
DROP FUNCTION IF EXISTS upsert_study_room_member(UUID, UUID, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS cleanup_inactive_members();

-- 删除索引
DROP INDEX IF EXISTS idx_study_room_members_status;
DROP INDEX IF EXISTS idx_study_room_members_last_seen;

-- 删除字段
ALTER TABLE study_room_members DROP COLUMN IF EXISTS status;
ALTER TABLE study_room_members DROP COLUMN IF EXISTS last_seen;
ALTER TABLE study_room_members DROP COLUMN IF EXISTS display_name;
ALTER TABLE study_room_members DROP COLUMN IF EXISTS avatar_url;
```

---

## 📝 其他说明

### 使用示例

在 TypeScript/React 中调用 RPC 函数:

```typescript
// 加入自习室 (开始专注)
const { data, error } = await supabase.rpc('upsert_study_room_member', {
  p_room_id: '00000000-0000-0000-0000-000000000001',
  p_user_id: userId,
  p_status: 'focusing',
  p_display_name: userName,
  p_avatar_url: userAvatar
});

// 清理过期成员 (可以通过 Supabase Cron Jobs 定期执行)
const { error } = await supabase.rpc('cleanup_inactive_members');
```

### 实时订阅

监听自习室成员变化:

```typescript
const channel = supabase
  .channel(`study_room:${roomId}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'study_room_members',
    filter: `room_id=eq.${roomId}`
  }, (payload) => {
    console.log('成员状态变化:', payload);
    // 重新加载成员列表
  })
  .subscribe();
```

---

✅ **迁移准备完成! 请按照上述步骤在 Supabase Dashboard 中执行迁移。**
