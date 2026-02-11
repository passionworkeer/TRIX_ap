# 计时器数据库同步功能实现指南

## 📋 概述

本文档记录如何将计时器的开始/停止状态同步到 Supabase 数据库，让好友能实时看到用户的自习状态。

---

## 🎯 实现目标

- ✅ 用户点击"开始自习"时 → 更新 `profiles.is_studying = true`
- ✅ 用户完成或放弃自习时 → 更新 `profiles.is_studying = false`
- ✅ 好友能实时在"自习伙伴列表"中看到状态变化

---

## 📦 第一步：执行数据库迁移

### 1.1 运行 SQL 脚本

在 Supabase Dashboard 的 SQL Editor 中执行：

```sql
-- 文件路径: database/add-is-studying-to-profiles.sql

-- 添加 is_studying 字段
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_studying BOOLEAN DEFAULT false;

-- 创建索引（优化查询性能）
CREATE INDEX IF NOT EXISTS idx_profiles_is_studying 
ON profiles(is_studying) 
WHERE is_studying = true;

-- 添加注释
COMMENT ON COLUMN profiles.is_studying IS '用户是否正在自习（true=自习中, false=未自习）';

-- 启用 Realtime（如果还没启用）
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
```

### 1.2 验证字段是否添加成功

```sql
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'is_studying';
```

预期输出：
```
column_name  | data_type | column_default | is_nullable
-------------|-----------|----------------|------------
is_studying  | boolean   | false          | YES
```

---

## 🔧 第二步：前端代码修改

### 2.1 Study.tsx 修改内容

#### 新增导入
```typescript
import { supabase } from "../config/supabase";
import { useAuth } from "../contexts/AuthContext";
```

#### 获取当前用户
```typescript
const { user } = useAuth(); // 在组件内部
```

#### 修改 handleStartFocus（开始自习）
```typescript
const handleStartFocus = async () => {
  // 更新数据库
  if (user?.id) {
    const { error } = await supabase
      .from('profiles')
      .update({ is_studying: true })
      .eq('id', user.id);
    
    if (error) console.error('更新失败:', error);
  }
  
  // 跳转到计时器
  navigate(AppRoutes.TIMER, { state: { duration: selectedDuration } });
};
```

#### 新增 handleStopFocus（停止自习）
```typescript
const handleStopFocus = async () => {
  // 更新数据库
  if (user?.id) {
    const { error } = await supabase
      .from('profiles')
      .update({ is_studying: false })
      .eq('id', user.id);
    
    if (error) console.error('更新失败:', error);
  }
  
  // 返回主页
  navigate(AppRoutes.STUDY);
};
```

#### 替换所有返回按钮的 onClick
将原来的 `onClick={() => navigate(AppRoutes.STUDY)}` 改为 `onClick={handleStopFocus}`

影响的按钮：
1. 计时器页面左上角的关闭按钮（X）
2. 专注完成后的"返回自习室"按钮
3. 底部的"放弃专注"按钮

---

### 2.2 StudyBuddiesList.tsx 修改内容

#### 简化 fetchStudyBuddies 查询逻辑

**旧逻辑（复杂）：**
1. 查 `friends` 表 → 获取 `is_studying = true` 的好友 ID
2. 查 `profiles` 表 → 获取好友基本信息
3. 手动合并数据

**新逻辑（简单）：**
1. 查 `friends` 表 → 获取所有好友 ID
2. 查 `profiles` 表 → 筛选 `is_studying = true` 的好友（一次性完成）

```typescript
// 第一步：获取好友 ID
const { data: friendsData } = await supabase
  .from('friends')
  .select('friend_id')
  .eq('user_id', userId)
  .eq('status', 'accepted');

// 第二步：直接筛选正在自习的好友
const friendIds = friendsData.map(f => f.friend_id);
const { data: profiles } = await supabase
  .from('profiles')
  .select('id, username, avatar_url, is_studying')
  .in('id', friendIds)
  .eq('is_studying', true); // ✅ 直接筛选
```

#### 修改 Realtime 监听

**旧逻辑：** 监听 `friends` 表
```typescript
table: 'friends'
```

**新逻辑：** 监听 `profiles` 表
```typescript
table: 'profiles'
```

---

## 🧪 第三步：测试流程

### 3.1 本地测试

1. **启动开发服务器**
   ```bash
   npm run dev
   ```

2. **测试开始自习**
   - 登录账户 A
   - 点击"开始自习"
   - 打开浏览器控制台，查看日志：
     ```
     🚀 [Study] 开始自习，更新数据库状态...
     ✅ [Study] 已更新 is_studying = true
     ```

3. **验证数据库**
   在 Supabase Dashboard 运行：
   ```sql
   SELECT id, username, is_studying 
   FROM profiles 
   WHERE is_studying = true;
   ```

4. **测试停止自习**
   - 点击"返回自习室"或"放弃专注"
   - 查看日志：
     ```
     🛑 [Study] 停止自习，更新数据库状态...
     ✅ [Study] 已更新 is_studying = false
     ```

---

### 3.2 好友实时可见性测试

1. **准备两个账户**
   - 账户 A 和账户 B 已经是好友关系（`status = 'accepted'`）

2. **打开两个浏览器窗口**
   - 窗口 1：登录账户 A
   - 窗口 2：登录账户 B

3. **账户 A 开始自习**
   - 窗口 1：点击"开始自习"
   - 窗口 2：点击右上角 `+` 打开好友列表
   - 预期：看到账户 A 出现在列表中

4. **账户 A 停止自习**
   - 窗口 1：点击"返回自习室"
   - 窗口 2：列表中账户 A 应该消失（实时更新）

5. **查看控制台日志**
   - 窗口 2 应该显示：
     ```
     🔥 [StudyBuddies] 检测到 profiles 更新: {...}
     📊 [StudyBuddies] 正在自习的好友: []
     ```

---

## 🐛 故障排查

### 问题 1：点击"开始自习"后没有更新数据库

**检查项：**
- ✅ 是否成功登录？（`user?.id` 是否存在）
- ✅ 控制台是否有错误日志？
- ✅ `profiles` 表是否有 `is_studying` 字段？

**解决方案：**
```typescript
// 在 handleStartFocus 开头添加调试日志
console.log('当前用户:', user);
```

---

### 问题 2：好友列表没有实时更新

**检查项：**
- ✅ Realtime 是否已启用？在 Supabase Dashboard 检查 `profiles` 表的 Realtime 设置
- ✅ 控制台是否显示订阅成功？查找 `📡 [StudyBuddies] 订阅状态: SUBSCRIBED`

**解决方案：**
手动启用 Realtime：
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
```

---

### 问题 3：查询报错 "column is_studying does not exist"

**原因：** 数据库迁移未执行

**解决方案：**
重新执行 `database/add-is-studying-to-profiles.sql`

---

## 📊 数据库架构变更总结

### 变更前
```
friends 表：
- user_id
- friend_id
- status
- is_studying ← 错误位置

profiles 表：
- id
- username
- avatar_url
```

### 变更后
```
friends 表：
- user_id
- friend_id
- status

profiles 表：
- id
- username
- avatar_url
- is_studying ← 正确位置 ✅
```

---

## ✅ 功能清单

- [x] 添加 `profiles.is_studying` 字段
- [x] 修改 `Study.tsx` 开始/停止逻辑
- [x] 简化 `StudyBuddiesList.tsx` 查询逻辑
- [x] 修改 Realtime 监听目标表
- [x] 添加详细日志输出
- [x] 文档化实施步骤

---

## 🎉 完成后效果

1. **用户体验**
   - 点击"开始自习" → 即时进入计时器
   - 完成/放弃专注 → 状态自动更新

2. **好友视角**
   - 打开"自习伙伴列表" → 实时看到正在自习的好友
   - 好友开始/停止自习 → 列表自动刷新

3. **技术实现**
   - 数据库状态与 UI 状态完全同步
   - Realtime 订阅自动推送更新
   - 代码逻辑简洁清晰（从两步查询简化为一步筛选）

---

## 📝 后续优化建议

1. **添加离线处理**
   - 如果数据库更新失败，本地仍然允许计时
   - 后台重试更新机制

2. **增强用户反馈**
   - 更新成功后显示 Toast 提示
   - 更新失败时显示错误提示

3. **性能优化**
   - 使用 RPC 函数批量查询好友状态
   - 添加本地缓存减少查询次数

---

## 📚 相关文件

- `database/add-is-studying-to-profiles.sql` - 数据库迁移脚本
- `src/screens/Study.tsx` - 计时器主界面
- `src/components/StudyBuddiesList.tsx` - 好友列表组件
- `src/contexts/AuthContext.tsx` - 用户认证上下文

---

**作者**: AI Assistant  
**日期**: 2026-02-11  
**版本**: 1.0
