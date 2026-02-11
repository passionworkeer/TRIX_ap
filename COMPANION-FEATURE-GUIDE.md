# 🚀 双向自习功能使用指南

## ✨ 新功能说明

### 1. 头像显示优化
- **问题**: 之前双人头像大小不匹配
- **解决**: 移除固定的 `w-16 h-16` 外层容器，直接使用 Avatar 组件的 `size="xl"` 属性
- **效果**: 头像尺寸统一为 56x56 (xl size)，带有光晕阴影效果

### 2. 双向状态同步
- **核心概念**: 当用户 A 加入用户 B 的自习室时，建立双向关联
  - A 的 `companion_id` 指向 B
  - B 的 `companion_id` 指向 A
  - 两人都能看到对方的头像

- **数据库字段**: `profiles.companion_id` (UUID, 外键关联到 profiles.id)

### 3. 实时更新机制
- **Realtime 订阅**: 监听 `is_studying` 和 `companion_id` 字段变化
- **防抖优化**: 500ms 延迟刷新，避免频繁查询
- **自动刷新**: 好友加入/离开时，列表实时更新

---

## 📋 部署步骤

### Step 1: 执行数据库迁移

1. 打开 Supabase Dashboard
2. 进入 SQL Editor
3. 执行 `database/add-companion-to-profiles.sql` 脚本

```sql
-- 添加 companion_id 字段
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS companion_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_profiles_companion_id ON profiles(companion_id);
```

### Step 2: 启用 Realtime（如未启用）

在 Supabase Dashboard:
1. Table Editor → profiles 表
2. 点击 "Realtime" 标签
3. 确保 "Enable Realtime" 开关是打开状态

### Step 3: 验证数据库

```sql
-- 查看表结构
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name IN ('is_studying', 'companion_id');

-- 预期结果:
-- companion_id | uuid | YES
-- is_studying  | boolean | YES
```

### Step 4: 刷新浏览器

```bash
# 如果开发服务器在运行，直接刷新页面即可
# 如果未运行，启动开发服务器
npm run dev
```

---

## 🧪 测试场景

### 场景 1: 用户 A 加入用户 B 的自习室

**步骤:**
1. 用户 B 先点击"开始专注"，进入自习室（is_studying = true）
2. 用户 A 打开好友列表（StudyBuddiesList）
3. 看到用户 B 在列表中（显示"正在自习"）
4. 用户 A 点击"加入" → 跳转到计时器页面

**预期数据库状态:**
```
User A: { is_studying: true, companion_id: B.id }
User B: { is_studying: true, companion_id: A.id }
```

**预期 UI 显示:**
- 用户 A 的计时器页面显示双头像（A 蓝色光晕 + B 紫色光晕）
- 用户 B 的计时器页面同步显示双头像（如果刷新页面）

### 场景 2: 用户 A 停止自习

**步骤:**
1. 用户 A 点击"停止自习"（X 按钮）
2. 返回自习室主页

**预期数据库状态:**
```
User A: { is_studying: false, companion_id: null }
User B: { is_studying: true, companion_id: null }  // 关联被清除
```

**预期 UI 显示:**
- 用户 B 的好友列表：用户 A 从列表中消失（不再显示）
- 用户 B 的计时器页面：双头像消失（变成单人）

### 场景 3: 浏览器关闭/刷新

**步骤:**
1. 用户 A 和用户 B 正在一起自习（双向关联已建立）
2. 用户 A 关闭浏览器标签页（或刷新页面）

**预期数据库状态:**
```
User A: { is_studying: false, companion_id: null }
User B: { is_studying: true, companion_id: null }  // 关联被清除
```

**技术实现:**
- `beforeunload` 事件捕获关闭/刷新操作
- 异步清理双方的 `companion_id` 字段

---

## 🔍 调试工具

### 实时查看数据库状态

```sql
-- 查看所有自习中的用户
SELECT id, username, is_studying, companion_id 
FROM profiles 
WHERE is_studying = true;

-- 查看所有配对关系
SELECT 
  u1.username AS user1,
  u2.username AS user2,
  u1.is_studying AS user1_studying,
  u2.is_studying AS user2_studying
FROM profiles u1
JOIN profiles u2 ON u1.companion_id = u2.id
WHERE u1.companion_id IS NOT NULL;
```

### 浏览器控制台日志

关键日志标识:
- `🚀 [StudyBuddies] 准备加入 XXX 的自习室` - 加入开始
- `🔗 [StudyBuddies] 建立双向连接: A ↔️ B` - 双向更新
- `✅ [StudyBuddies] 双向连接建立成功！` - 加入成功
- `🛑 [Study] 停止自习，更新数据库状态...` - 停止开始
- `🔗 [Study] 清除好友 XXX 的关联` - 清除好友关联
- `🌐 [Study] 浏览器关闭，清理自习状态...` - beforeunload 触发

---

## ⚠️ 已知限制

### 1. 多人自习室（暂不支持）
- **当前设计**: companion_id 是单一字段，只能关联一个好友
- **限制**: 无法实现 3 人及以上的群组自习
- **未来改进**: 可改用 `study_sessions` 表实现多人房间

### 2. 网络中断处理
- **问题**: 如果用户网络突然断开，beforeunload 可能无法执行
- **影响**: 数据库中的 is_studying 状态可能残留
- **建议**: 后续添加定时清理脚本（例如：超过 2 小时的 is_studying=true 自动清零）

### 3. 并发冲突
- **场景**: 用户 A 和用户 B 同时加入对方的自习室
- **当前处理**: 后执行的操作会覆盖前一个
- **改进方向**: 添加乐观锁或数据库触发器检测冲突

---

## 📊 数据库表结构

### profiles 表（相关字段）

| 字段名 | 类型 | 说明 | 约束 |
|--------|------|------|------|
| id | UUID | 用户 ID | PRIMARY KEY |
| username | TEXT | 用户名 | NOT NULL |
| avatar_url | TEXT | 头像 URL | NULLABLE |
| is_studying | BOOLEAN | 是否正在自习 | DEFAULT false |
| companion_id | UUID | 一起自习的好友 ID | FOREIGN KEY → profiles.id |

### 索引

```sql
CREATE INDEX idx_profiles_companion_id ON profiles(companion_id);
CREATE INDEX idx_profiles_is_studying ON profiles(is_studying);  -- 如果已存在
```

---

## 🎨 UI 组件结构

### Study.tsx（计时器页面）

```tsx
{companion && (
  <div className="mb-8 flex items-center gap-6">
    {/* 我的头像 - 蓝色光晕 */}
    <div className="rounded-full ring-4 ring-blue-500/50 shadow-blue-500/30">
      <Avatar name={myUsername} avatar={myAvatar} size="xl" />
    </div>
    
    {/* 连接线动画 */}
    <div className="flex items-center gap-2">
      <div className="w-10 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500 animate-pulse" />
      <div className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-pulse shadow-purple-400/50" />
      <div className="w-10 h-0.5 bg-gradient-to-r from-purple-500 to-blue-500 animate-pulse" />
    </div>
    
    {/* 好友头像 - 紫色光晕 */}
    <div className="rounded-full ring-4 ring-purple-500/50 shadow-purple-500/30">
      <Avatar name={companion.username} avatar={companion.avatar} size="xl" />
    </div>
  </div>
)}
```

---

## 🔄 状态流转图

```
单人自习模式:
┌─────────────┐
│ 自习室主页   │
│ is_studying: false
│ companion_id: null
└──────┬──────┘
       │ 点击"开始专注"
       ▼
┌─────────────┐
│ 计时器页面   │
│ is_studying: true
│ companion_id: null
└──────┬──────┘
       │ 点击"停止"
       ▼
┌─────────────┐
│ 自习室主页   │
│ is_studying: false
│ companion_id: null
└─────────────┘

双人自习模式:
User A                          User B
┌─────────────┐                ┌─────────────┐
│ 自习室主页   │                │ 计时器页面   │
│ is_studying: false           │ is_studying: true
│ companion_id: null           │ companion_id: null
└──────┬──────┘                └─────────────┘
       │ 点击"加入 B"                   ▲
       ▼                               │
┌─────────────┐   双向更新链接    ┌─────────────┐
│ 计时器页面   │◄──────────────►│ 计时器页面   │
│ is_studying: true            │ is_studying: true
│ companion_id: B.id           │ companion_id: A.id
│ 显示双头像   │                │ 显示双头像   │
└──────┬──────┘                └─────────────┘
       │ A 点击"停止"
       ▼
┌─────────────┐   清除关联      ┌─────────────┐
│ 自习室主页   │──────────────►│ 计时器页面   │
│ is_studying: false           │ is_studying: true
│ companion_id: null           │ companion_id: null
└─────────────┘                │ 双头像消失   │
                               └─────────────┘
```

---

## 💡 最佳实践

### 1. 代码规范
- ✅ 使用 `companion_id` 而不是 `companion` 避免命名冲突
- ✅ 双向更新使用事务确保数据一致性
- ✅ 错误回滚机制（加入失败时清除已更新的状态）

### 2. 性能优化
- ✅ Realtime 订阅使用防抖（500ms）避免频繁查询
- ✅ 使用索引加速 `companion_id` 查询
- ✅ 只在需要时订阅 Realtime（弹窗打开时）

### 3. 用户体验
- ✅ 加入中显示 Loading 状态（joiningBuddyId）
- ✅ 错误提示清晰（alert 提示失败原因）
- ✅ 视觉反馈（双头像 + 连接线动画）

---

## 📚 相关文件

- **数据库迁移**: `database/add-companion-to-profiles.sql`
- **TypeScript 接口**: `src/config/supabase.ts` (Profile)
- **UI 组件**: `src/screens/Study.tsx`
- **好友列表**: `src/components/StudyBuddiesList.tsx`
- **路由定义**: `src/types.ts` (AppRoutes.TIMER)

---

## 🎯 下一步优化方向

1. **多人自习室**: 改用 `study_sessions` 表支持 3+ 人房间
2. **自动清理**: 定时任务清理过期的 is_studying 状态
3. **通知推送**: 好友加入时发送浏览器通知
4. **数据统计**: 记录一起自习的总时长
5. **UI 增强**: 显示好友当前自习科目/进度

---

**更新时间**: 2026-02-11  
**版本**: v1.0.0  
**作者**: GitHub Copilot + meowdoone
