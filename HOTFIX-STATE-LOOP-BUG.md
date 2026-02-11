# 🚨 紧急修复：状态循环 Bug 解决方案

## 📋 问题描述

### Bug 表现
日志显示 `is_studying` 设为 `true` 后立即被清理函数设回 `false`，导致：
- ✅ 数据库更新成功 (`is_studying = true`)
- ❌ 立即触发清理 (`is_studying = false`)
- ❌ Realtime 监听到状态变化，但最终状态仍是 `false`
- ❌ 好友列表无法看到用户在自习

### 根本原因
```typescript
// ❌ 错误的依赖数组
useEffect(() => {
  return () => {
    // 清理逻辑
  };
}, [isTimer, user?.id]); // 🔥 isTimer 每次变化都会触发清理！
```

**问题分析**:
1. 用户点击"开始专注" → `handleStartFocus` 更新 `is_studying = true`
2. `navigate(AppRoutes.TIMER)` 导致路由变化 → `isTimer` 从 `false` 变为 `true`
3. `useEffect` 检测到 `isTimer` 变化 → 先执行清理函数 → 设置 `is_studying = false`
4. 然后才执行新的 effect（但已经晚了）

**结果**: 状态刚设为 `true` 就被清理为 `false`，形成逻辑循环。

---

## ✅ 修复方案

### 1️⃣ Study.tsx - 修复清理 useEffect

#### 修复前（错误）
```typescript
useEffect(() => {
  return () => {
    if (isTimer && user?.id) {
      supabase.from('profiles').update({ is_studying: false }).eq('id', user.id);
    }
  };
}, [isTimer, user?.id]); // ❌ 依赖 isTimer 导致频繁触发
```

#### 修复后（正确）
```typescript
useEffect(() => {
  return () => {
    const userId = user?.id;
    if (userId) {
      console.log('🧹 [Study] 组件卸载，清理自习状态...');
      supabase
        .from('profiles')
        .update({ is_studying: false })
        .eq('id', userId);
    }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []); // ✅ 空依赖数组：仅在组件卸载时执行
```

**关键点**:
- ✅ 依赖数组为空 `[]`
- ✅ 闭包捕获 `user?.id` 值（不需要依赖）
- ✅ 只在组件彻底销毁时执行一次
- ✅ 移除 `isTimer` 条件判断

---

### 2️⃣ StudyBuddiesList.tsx - 强化 Realtime 监听

#### 优化点

**A. 唯一 Channel 名称**
```typescript
// 修复前
.channel('study-buddies-updates')

// 修复后
.channel(`study-buddies-realtime-${currentUserId}`) // 每个用户独立 channel
```

**B. 详细的状态日志**
```typescript
(payload) => {
  console.log('🔥 [StudyBuddies] 检测到 profiles 更新:', payload);
  console.log('🔍 [StudyBuddies] 更新的字段:', payload.new);
  
  // 检查是否是 is_studying 字段变化
  if ('is_studying' in payload.new) {
    console.log(`📊 [StudyBuddies] is_studying 变化: ${payload.old?.is_studying} → ${payload.new.is_studying}`);
    // 触发刷新...
  }
}
```

**C. 订阅状态确认**
```typescript
.subscribe((status) => {
  console.log(`📡 [StudyBuddies] 订阅状态: ${status}`);
  if (status === 'SUBSCRIBED') {
    console.log('✅ [StudyBuddies] Realtime 订阅成功！');
  } else if (status === 'CHANNEL_ERROR') {
    console.error('❌ [StudyBuddies] Realtime 订阅失败！');
  }
});
```

---

## 🧪 验证修复

### 测试步骤

1. **清空控制台日志**

2. **点击"开始专注"**

**预期日志（修复后）**:
```
🚀 [Study] 开始自习，更新数据库状态...
✅ [Study] 已更新 is_studying = true
(路由跳转，进入计时器页面)
(⚠️ 不应该出现 "🧹 组件卸载" 日志！)
```

**错误日志（修复前）**:
```
🚀 [Study] 开始自习，更新数据库状态...
✅ [Study] 已更新 is_studying = true
🧹 [Study] 组件卸载，清理自习状态... ← ❌ 不应该出现！
✅ [Study] 已清理 is_studying = false
```

---

3. **在另一个窗口打开好友列表**

**预期日志（修复后）**:
```
📡 [StudyBuddies] 订阅状态: SUBSCRIBED
✅ [StudyBuddies] Realtime 订阅成功！
🔥 [StudyBuddies] 检测到 profiles 更新: {...}
🔍 [StudyBuddies] 更新的字段: {id: "xxx", is_studying: true, ...}
📊 [StudyBuddies] is_studying 变化: false → true
🔄 [StudyBuddies] 刷新好友列表...
📊 [StudyBuddies] 正在自习的好友: [{id: "xxx", username: "test1"}]
```

**预期 UI**: 看到好友出现在列表中 ✅

---

4. **关闭浏览器标签页**

**预期日志**:
```
🧹 [Study] 组件卸载，清理自习状态...
✅ [Study] 已清理 is_studying = false
```

**预期**: 好友列表中用户消失 ✅

---

## 📊 修复对比

| 场景 | 修复前 | 修复后 |
|------|--------|--------|
| 点击开始自习 | `true` → 立即清理为 `false` ❌ | `true` → 保持 `true` ✅ |
| 路由跳转 | 触发清理函数 ❌ | 不触发清理 ✅ |
| 组件卸载 | 清理状态 ✅ | 清理状态 ✅ |
| Realtime 监听 | 收到更新但状态已是 `false` ❌ | 收到更新且状态是 `true` ✅ |
| 好友列表 | 看不到用户 ❌ | 看到用户 ✅ |

---

## 🔍 Debug 检查清单

如果修复后仍有问题，按以下顺序检查：

### ✅ 1. 确认数据库字段存在
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'profiles' AND column_name = 'is_studying';
```

### ✅ 2. 确认 Realtime 已启用
```sql
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' AND tablename = 'profiles';
```

如果没有输出：
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
```

### ✅ 3. 手动测试数据库更新
```sql
-- 设置状态为 true
UPDATE profiles SET is_studying = true WHERE id = 'your-user-id';

-- 验证
SELECT id, username, is_studying FROM profiles WHERE id = 'your-user-id';
```

### ✅ 4. 检查 Realtime 连接
在控制台查找：
```
📡 [StudyBuddies] 订阅状态: SUBSCRIBED
✅ [StudyBuddies] Realtime 订阅成功！
```

如果看到 `CHANNEL_ERROR`：
- 检查 Supabase 项目设置中 Realtime 是否启用
- 检查 API Key 是否正确
- 检查网络连接

---

## 💡 核心原则总结

### useEffect 清理函数的正确使用

```typescript
// ❌ 错误：依赖会变化的状态
useEffect(() => {
  return () => cleanup();
}, [someState]); // 每次 someState 变化都会先执行 cleanup

// ✅ 正确：仅在卸载时清理
useEffect(() => {
  return () => cleanup();
}, []); // 只在组件销毁时执行 cleanup
```

### 手动触发 vs 自动监听

```typescript
// ❌ 错误：监听状态变化来同步数据库
useEffect(() => {
  if (isRunning) {
    supabase.update({ is_studying: true });
  }
}, [isRunning]); // 会导致循环触发

// ✅ 正确：在用户操作时直接调用
const handleStart = async () => {
  await supabase.update({ is_studying: true });
  setIsRunning(true);
};
```

---

## 📚 相关文件

- `src/screens/Study.tsx` - 清理 useEffect 修复
- `src/components/StudyBuddiesList.tsx` - Realtime 监听强化
- `SYNC-AND-JOIN-FEATURE.md` - 功能实现文档
- `database/debug-is-studying.sql` - 调试 SQL 脚本

---

**作者**: AI Assistant  
**日期**: 2026-02-11  
**版本**: Hotfix 1.0  
**优先级**: 🚨 Critical
