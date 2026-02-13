# 双向自习功能 - 完整开发文档

> **版本**: v1.0
> **最后更新**: 2026-02-11

---

## 目录

1. [功能概述](#功能概述)
2. [快速开始](#快速开始)
3. [实现细节](#实现细节)
4. [问题排查](#问题排查)
5. [已知问题与解决方案](#已知问题与解决方案)

---

## 功能概述

### 核心功能

**双向自习**允许用户加入好友的自习室，实时看到彼此的学习状态：

- 🎯 **状态同步**: 用户开始/停止自习时，自动更新到数据库
- 👥 **伙伴列表**: 显示所有正在自习的好友
- 🔗 **双向关联**: 用户 A 加入用户 B 的自习室时，建立双向连接
- 🔄 **实时更新**: 使用 Supabase Realtime 实现状态实时推送

### 数据流

```
┌─────────────┐      开始自习       ┌─────────────┐
│  用户 A     │ ──────────────────> │  Database  │
│             │ <─────────────────  │             │
└─────────────┘      Realtime       └─────────────┘
       │                                   ▲
       │                                   │
       │         加入自习室                │
       └───────────────────────────────────┘
                  ┌─────────────┐
                  │  用户 B     │
                  └─────────────┘
```

---

## 快速开始

### Step 1: 数据库迁移

在 Supabase Dashboard 的 SQL Editor 中执行：

```sql
-- 添加 is_studying 字段
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS is_studying BOOLEAN DEFAULT false;

-- 添加 companion_id 字段
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS companion_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_profiles_is_studying ON profiles(is_studying);
CREATE INDEX IF NOT EXISTS idx_profiles_companion_id ON profiles(companion_id);

-- 启用 Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
```

### Step 2: 验证配置

1. 检查 `profiles` 表是否有 `is_studying` 和 `companion_id` 字段
2. 确认 Realtime 已启用
3. 测试状态同步功能

---

## 实现细节

### 1. 状态同步机制

#### 开始自习

```typescript
const handleStartFocus = async () => {
  if (user?.id) {
    await supabase
      .from('profiles')
      .update({ is_studying: true })
      .eq('id', user.id);
  }
  navigate(AppRoutes.TIMER, { state: { duration: selectedDuration } });
};
```

#### 停止自习

```typescript
const handleStopFocus = async () => {
  if (user?.id) {
    await supabase
      .from('profiles')
      .update({ is_studying: false })
      .eq('id', user.id);
  }
};
```

#### 组件卸载清理

```typescript
useEffect(() => {
  return () => {
    // 组件卸载时清理状态
    if (user?.id) {
      supabase.from('profiles').update({ is_studying: false }).eq('id', user.id);
    }
  };
}, [user?.id]); // ✅ 正确：仅依赖 user.id
```

### 2. 伙伴列表查询

```typescript
// 获取正在自习的好友
const { data } = await supabase
  .from('friends')
  .select(`
    friend_id,
    profiles!friends_friend_id_fkey (
      id,
      username,
      avatar_url,
      is_studying
    )
  `)
  .eq('user_id', userId)
  .eq('status', 'accepted')
  .eq('profiles.is_studying', true);
```

### 3. Realtime 订阅

```typescript
supabase
  .channel('study-buddies-updates')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'profiles',
    filter: `id=eq.${userId}`
  }, (payload) => {
    // 状态变化时刷新列表
    fetchStudyBuddies();
  })
  .subscribe();
```

### 4. 双向连接

```typescript
// 用户 A 加入用户 B 的自习室
const handleJoin = async (buddyId: string) => {
  const { data: { user } } = await supabase.auth.getUser();

  // A 指向 B
  await supabase
    .from('profiles')
    .update({ companion_id: buddyId })
    .eq('id', user.id);

  // B 也指向 A（双向关联）
  await supabase
    .from('profiles')
    .update({ companion_id: user.id })
    .eq('id', buddyId);
};
```

---

## 问题排查

### 双头像不显示

**症状**: 加入好友自习室后，计时器页面没有显示双头像

**排查步骤**:

1. **检查浏览器控制台日志**

   期待看到：
   ```
   🚀 [Study] 开始自习，更新数据库状态...
   ✅ [Study] 已更新 is_studying = true
   🔗 [StudyBuddies] 建立双向连接: A_ID ↔️ B_ID
   🎯 [Study] Companion data: { id: ..., username: ..., avatar: ... }
   ```

2. **检查数据库**

   ```sql
   SELECT id, username, is_studying, companion_id
   FROM profiles
   WHERE id IN ('user-a-id', 'user-b-id');
   ```

   确认：
   - `is_studying = true`
   - `companion_id` 正确设置

3. **检查 Location State**

   ```javascript
   // 在控制台执行
   window.history.state?.state
   ```

   确认包含 `companion` 数据

### 状态循环 Bug

**症状**: `is_studying` 设为 `true` 后立即被设回 `false`

**根本原因**: useEffect 依赖数组包含 `isTimer`，导致频繁触发清理

**修复方案**:

```typescript
// ❌ 错误
useEffect(() => {
  return () => {
    if (isTimer && user?.id) {
      supabase.from('profiles').update({ is_studying: false }).eq('id', user.id);
    }
  };
}, [isTimer, user?.id]); // 依赖 isTimer 导致频繁触发

// ✅ 正确
useEffect(() => {
  return () => {
    if (user?.id) {
      supabase.from('profiles').update({ is_studying: false }).eq('id', user.id);
    }
  };
}, [user?.id]); // 仅依赖 user.id
```

### 头像尺寸不匹配

**症状**: 双人头像大小不一致

**解决方案**: 移除固定的 `w-16 h-16` 容器，使用 Avatar 组件的 `size` 属性

```typescript
// ❌ 错误
<div className="w-16 h-16">
  <Avatar src={avatar_url} size="lg" />
</div>

// ✅ 正确
<Avatar src={avatar_url} size="xl" />
```

---

## 已知问题与解决方案

### 问题 1: 状态卡在"自习中"

**原因**: 用户异常退出（关闭浏览器、崩溃等）

**解决方案**:
- 组件卸载时自动清理状态
- 添加心跳机制（可选）
- 后台定时任务清理过期状态（待实现）

### 问题 2: Realtime 延迟

**症状**: 状态更新后，好友列表延迟显示

**解决方案**:
- 添加防抖优化（500ms）
- 手动刷新功能
- 检查 Supabase Realtime 连接状态

### 问题 3: 双向连接不一致

**症状**: A 能看到 B，但 B 看不到 A

**解决方案**:
- 确保双向更新都执行成功
- 添加事务处理（可选）
- 添加重试机制

---

## 测试清单

- [ ] 开始自习后，`is_studying` 正确设为 `true`
- [ ] 停止自习后，`is_studying` 正确设为 `false`
- [ ] 伙伴列表显示正在自习的好友
- [ ] 加入自习室后，建立双向连接
- [ ] 计时器页面显示双头像
- [ ] 状态变化时，好友列表实时更新
- [ ] 组件卸载时，状态正确清理

---

## 相关文档

- [DATABASE-REQUIREMENTS.md](./DATABASE-REQUIREMENTS.md) - 数据库设计
- [CHANGELOG.md](./CHANGELOG.md) - 开发迭代日志

---

**维护者**: TRIX 3D Companion 开发团队
**最后更新**: 2026-02-11
