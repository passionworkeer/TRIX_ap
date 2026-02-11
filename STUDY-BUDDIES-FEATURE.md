# 自习伙伴列表功能

## 功能概述
在自习室页面显示所有正在自习的好友,实时更新在线状态。

## 组件结构

### 1. StudyBuddiesList 组件 (`src/components/StudyBuddiesList.tsx`)

**功能:**
- 显示所有正在自习的好友头像列表
- 当前用户排在第一位(金色边框高亮)
- 横向滚动布局
- 实时监听好友自习状态变化

**数据逻辑:**
```typescript
// 1. 获取当前用户的 is_studying 状态
SELECT is_studying, username, avatar FROM profiles WHERE id = current_user_id

// 2. 获取所有正在自习的好友
SELECT profiles.* FROM friends 
JOIN profiles ON friends.friend_id = profiles.id
WHERE friends.user_id = current_user_id 
  AND friends.status = 'accepted'
  AND profiles.is_studying = true

// 3. 合并列表:自己(如果在自习) + 好友们
```

**实时订阅:**
```typescript
supabase.channel('study-buddies-updates')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'profiles'
  }, (payload) => {
    // 重新获取列表
    fetchStudyBuddies();
  })
```

**视觉设计:**
- 半透明毛玻璃背景 (`bg-white/5 backdrop-blur-xl`)
- 横向滚动容器 (`overflow-x-auto`)
- 圆形头像 (`w-12 h-12`)
- 自己:金色渐变边框 + "我" 标签
- 好友:白色半透明边框 + 用户名
- 绿色实时状态指示器(带动画)

### 2. 集成位置 (`src/screens/Study.tsx`)

```tsx
{/* 顶部导航栏 */}
<header>...</header>

{/* 自习伙伴列表 - 新增 */}
<StudyBuddiesList />

{/* Focus Timer 卡片 */}
<div className="absolute top-[20%]">...</div>
```

## 测试步骤

### 前置条件
确保数据库中:
1. `profiles` 表有 `is_studying` 字段 (boolean)
2. 至少有 2 个测试账号互为好友
3. Supabase Realtime 已启用 `profiles` 表的 UPDATE 事件

### 测试流程

#### 1. 单用户测试
```bash
# 登录账号 A (xiaoming)
# 进入自习室页面
# 预期: 看到"暂无好友在线自习"
```

#### 2. 启动自习测试
```sql
-- 在 Supabase Dashboard 手动更新
UPDATE profiles SET is_studying = true WHERE id = 'xiaoming_uuid';
```
**预期:** 
- 列表显示自己的头像(金色边框)
- 显示 "自习伙伴 (1人正在专注)"
- 用户名显示为 "我"

#### 3. 好友加入测试
```sql
-- 更新好友 alice 的状态
UPDATE profiles SET is_studying = true WHERE id = 'alice_uuid';
```
**预期:**
- 列表自动更新(无需刷新页面)
- 显示 "自习伙伴 (2人正在专注)"
- 自己排第一(金色),alice 排第二(白色)

#### 4. 好友离开测试
```sql
UPDATE profiles SET is_studying = false WHERE id = 'alice_uuid';
```
**预期:**
- alice 头像消失
- 显示 "自习伙伴 (1人正在专注)"

#### 5. 多好友测试
```sql
-- 同时有 3+ 个好友在自习
UPDATE profiles SET is_studying = true WHERE username IN ('alice', 'bob', 'carol');
```
**预期:**
- 横向滚动条出现
- 可以左右滑动查看所有好友
- 顺序:我 → alice → bob → carol

## 控制台日志

成功运行时应看到:
```
🔌 [StudyBuddies] 启动实时监听
📡 [StudyBuddies] 订阅状态: SUBSCRIBED
📊 [StudyBuddies] 好友数据: [...]
✅ [StudyBuddies] 自习伙伴列表: [...]
```

收到更新时:
```
🔥 [StudyBuddies] 检测到 profile 更新: {...}
📊 [StudyBuddies] 好友数据: [...]
✅ [StudyBuddies] 自习伙伴列表: [...]
```

## 已知问题和优化

### 当前实现
- ✅ 实时监听所有 profiles 表的 UPDATE (可能会收到不相关的更新)
- ✅ 每次 UPDATE 都重新查询整个列表 (性能可接受,好友数量一般 < 50)

### 未来优化方向
1. **精确过滤**: 只监听好友的 `is_studying` 字段变化
   ```typescript
   // 需要创建视图或使用 RPC 函数
   .on('postgres_changes', {
     event: 'UPDATE',
     schema: 'public',
     table: 'profiles',
     filter: `id=in.(friend_id_list)` // 需要动态生成
   })
   ```

2. **增量更新**: 不重新获取整个列表,只更新变化的项
   ```typescript
   .on(..., (payload) => {
     const updatedProfile = payload.new;
     setBuddies(prev => {
       if (updatedProfile.is_studying) {
         // 添加到列表
       } else {
         // 从列表移除
       }
     });
   })
   ```

3. **缓存头像**: 使用 IndexedDB 或 localStorage 缓存头像 URL

## 数据库要求

### profiles 表
```sql
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_studying BOOLEAN DEFAULT false;

-- 启用 Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
```

### RLS 策略
```sql
-- 允许用户读取好友的 profiles
CREATE POLICY "Users can view friends' profiles"
ON profiles FOR SELECT
USING (
  id IN (
    SELECT friend_id FROM friends 
    WHERE user_id = auth.uid() AND status = 'accepted'
  )
  OR id = auth.uid()
);
```

## 样式调整

如果需要调整外观:

### 位置
```tsx
// Study.tsx 中调整 margin
<StudyBuddiesList /> // 默认 mb-6
```

### 头像大小
```tsx
// StudyBuddiesList.tsx
<div className="w-12 h-12"> // 改为 w-16 h-16 (更大)
```

### 滚动条样式
```tsx
// 添加自定义滚动条样式
<div className="overflow-x-auto scrollbar-thin scrollbar-thumb-blue-500/50">
```

## 完成状态
- ✅ 组件创建完成
- ✅ 集成到 Study 页面
- ✅ 实时订阅配置
- ✅ 视觉样式符合设计
- ⏳ 等待数据库字段添加
- ⏳ 等待实际测试验证
