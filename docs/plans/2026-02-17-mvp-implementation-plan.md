# TRIX 3D Companion - MVP 功能实现计划

**创建时间**: 2026-02-17
**方案**: 渐进式 MVP 实现（方案 A）
**开发者**: Claude AI

---

## 📋 总览

本计划将逐步实现 5 个 MVP 功能 + 5 项性能优化，每个功能独立实现、测试、提交。

---

## 🎯 Phase 1: 第一优先级功能（预计 30 分钟）

### Task 1.1: 关于页面模态框
**文件**: `src/screens/Profile.tsx`
**改动**: 创建 `AboutDialog` 组件

**实现**:
```typescript
- 创建独立的 AboutDialog 组件
- 显示版本信息、开发团队、版权信息
- 使用现有的 ConfirmDialog 风格
- 支持 ESC 关闭
```

**测试**:
- [ ] 点击"关于我们"按钮打开模态框
- [ ] 显示正确的文本信息
- [ ] ESC 键可以关闭
- [ ] 点击遮罩层关闭

---

### Task 1.2: 数据统计详情弹窗
**文件**: `src/screens/Profile.tsx`
**改动**: 创建 `StatsDetailDialog` 组件

**实现**:
```typescript
- 创建独立的 StatsDetailDialog 组件
- 显示陪伴天数、积分、互动次数的详细信息
- 从 profiles 表读取实际数据
- 美化的统计卡片展示
```

**数据库查询**:
```sql
-- 查询用户统计数据
SELECT
  created_at,
  -- 计算陪伴天数
  EXTRACT(DAY FROM NOW() - created_at) as days_active,
  -- 积分（从 user_points 表）
  total_points,
  -- 互动次数（从 chat_messages 表统计）
  (SELECT COUNT(*) FROM chat_messages WHERE sender_id = profiles.id) as interactions
FROM profiles
LEFT JOIN user_points ON profiles.id = user_points.user_id
WHERE profiles.id = $1;
```

**测试**:
- [ ] 点击统计卡片打开详情
- [ ] 显示正确的陪伴天数
- [ ] 显示正确的积分
- [ ] 显示正确的互动次数

---

## 🎯 Phase 2: 第二优先级功能（预计 1 小时）

### Task 2.1: 隐私设置页面
**文件**: `src/screens/Profile.tsx`, 新建 `src/components/PrivacySettings.tsx`
**数据库**: 可能需要添加 `user_settings` 表

**实现**:
```typescript
- 创建 PrivacySettings 组件
- 简单的开关控件：
  - ✅ 允许陌生人查找我（通过邮箱/用户名）
  - ✅ 显示我的在线状态
  - ✅ 允许好友邀请我自习
- 保存到 user_settings 表
```

**数据库迁移**:
```sql
-- 用户设置表
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  allow_stranger_search BOOLEAN DEFAULT true,
  show_online_status BOOLEAN DEFAULT true,
  allow_study_invites BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
```

**测试**:
- [ ] 打开隐私设置页面
- [ ] 切换开关后保存成功
- [ ] 刷新页面设置保留
- [ ] 数据库正确存储

---

### Task 2.2: 积分历史记录
**文件**: `src/screens/Profile.tsx`, 新建 `src/components/PointsHistory.tsx`
**数据库**: 使用现有的 `point_transactions` 表

**实现**:
```typescript
- 创建 PointsHistory 组件
- 从 point_transactions 表读取历史记录
- 显示：
  - 时间
  - 类型（学习完成、连续学习等）
  - 积分变化（+/-）
  - 描述
- 分页加载（每页 20 条）
```

**数据库查询**:
```sql
SELECT
  created_at,
  transaction_type,
  points_change,
  description,
  balance_after
FROM point_transactions
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT 20 OFFSET $2;
```

**测试**:
- [ ] 打开积分历史页面
- [ ] 显示最近的积分记录
- [ ] 分页加载正常
- [ ] 积分变化显示正确（正/负）

---

## 🎯 Phase 3: 第三优先级功能（预计 2 小时）

### Task 3.1: 装备商店/衣柜
**文件**: `src/screens/Profile.tsx`, 新建 `src/components/Wardrobe.tsx`
**数据库**: 可能需要添加 `user_outfits` 表

**实现**:
```typescript
- 创建 Wardrobe 组件
- 显示所有可用装备
- 标记已装备的装备
- 点击装备切换（暂不实现购买逻辑）
- 简单的动画效果
```

**数据库迁移**:
```sql
-- 用户装备表
CREATE TABLE IF NOT EXISTS user_outfits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  outfit_name TEXT NOT NULL,
  outfit_image TEXT NOT NULL,
  is_equipped BOOLEAN DEFAULT false,
  obtained_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_outfits_user_id ON user_outfits(user_id);
CREATE INDEX IF NOT EXISTS idx_user_outfits_equipped ON user_outfits(user_id, is_equipped);
```

**测试**:
- [ ] 打开衣柜页面
- [ ] 显示所有装备
- [ ] 高亮当前装备
- [ ] 切换装备成功
- [ ] 数据库正确更新

---

## 🎯 Phase 4: 性能优化（预计 2 小时）

### Task 4.1: 修复定时器内存泄漏
**文件**: `src/screens/Home.tsx`, `src/screens/ChatDetail.tsx`, `src/screens/Study.tsx`

**实现**:
```typescript
// 检查所有 useEffect 中的 setInterval/setTimeout
// 确保都在 return 中清理
useEffect(() => {
  const interval = setInterval(callback, 5000);
  return () => clearInterval(interval); // ✅ 必须清理
}, [deps]);
```

**检查点**:
- [ ] Home.tsx: updateCounts interval
- [ ] ChatDetail.tsx: 所有 intervals
- [ ] Study.tsx: timer intervals
- [ ] 其他文件中的 intervals

**测试**:
- [ ] 使用 React DevTools Profiler 检查内存泄漏
- [ ] 多次切换页面后内存不增长
- [ ] 定时器正确清理

---

### Task 4.2: 轮询改为 Supabase Realtime
**文件**: `src/screens/Home.tsx`, 新建 `src/services/realtimeService.ts`

**实现**:
```typescript
- 创建 realtimeService.ts
- 使用 Supabase Realtime 监听数据库变化
- 替代 5 秒轮询
- 监听：mail 表、notifications 表
```

**代码示例**:
```typescript
// 替换前：每 5 秒查询
const interval = setInterval(async () => {
  await getUnreadMailCount();
  await getUnreadNotificationCount();
}, 5000);

// 替换后：实时监听
const channel = supabase
  .channel('public:mail')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'mail'
  }, (payload) => {
    // 实时更新未读数
    getUnreadMailCount();
  })
  .subscribe();
```

**测试**:
- [ ] 收到新邮件时未读数实时更新
- [ ] 收到新通知时未读数实时更新
- [ ] 网络断开后自动重连
- [ ] 取消订阅正确清理

---

### Task 4.3: React 性能优化
**文件**: 多个组件文件

**实现**:
```typescript
1. 添加 React.memo 到列表项组件
2. 使用 useMemo 缓存计算结果
3. 使用 useCallback 缓存事件处理器
4. 优化 Context 使用
```

**优化点**:
- [ ] Chat.tsx: FriendList 组件 memo
- [ ] Profile.tsx: OutfitCard 组件 memo
- [ ] Home.tsx: useMemo 缓存计数
- [ ] 事件处理器 useCallback

**测试**:
- [ ] 使用 React DevTools Profiler 对比前后性能
- [ ] 减少不必要的 re-render
- [ ] 交互更流畅

---

### Task 4.4: 图片懒加载
**文件**: 多个包含图片的组件

**实现**:
```typescript
- 使用 React Lazy Load 或原生 loading="lazy"
- 添加占位符
- 优化图片格式（WebP）
```

**优化点**:
- [ ] Profile.tsx: 头像和装备图片
- [ ] Chat.tsx: 好友头像
- [ ] Map.tsx: 地点图片

**测试**:
- [ ] 图片在视口内才加载
- [ ] 滚动流畅，无卡顿
- [ ] Lighthouse 性能分数提升

---

### Task 4.5: 代码分割和路由懒加载
**文件**: `src/App.tsx`

**实现**:
```typescript
// 替换前
import { Home } from './screens/Home';
import { Profile } from './screens/Profile';

// 替换后
const Home = lazy(() => import('./screens/Home'));
const Profile = lazy(() => import('./screens/Profile'));

// 添加 Suspense
<Suspense fallback={<Loading />}>
  <Routes>
    <Route path="/home" element={<Home />} />
  </Routes>
</Suspense>
```

**测试**:
- [ ] 首次加载的 JS 体积减少
- [ ] 路由切换正常
- [ ] 显示加载状态
- [ ] 构建产物正确分割

---

## 📊 测试清单

每个功能完成后必须测试：

### 功能测试
- [ ] 所有功能正常工作
- [ ] 没有控制台错误
- [ ] UI 显示正确
- [ ] 数据正确存储

### 性能测试
- [ ] 无内存泄漏
- [ ] Lighthouse 分数 > 90
- [ ] 首屏加载 < 3 秒
- [ ] 交互响应 < 100ms

### 兼容性测试
- [ ] Chrome 最新版
- [ ] Safari 最新版
- [ ] 移动端 iOS
- [ ] 移动端 Android

---

## 🚀 提交策略

每个功能独立提交：

```bash
# 功能 1
git commit -m "feat: 添加关于页面模态框"

# 功能 2
git commit -m "feat: 添加数据统计详情弹窗"

# ... 其他功能

# 最终提交
git commit -m "chore: 完成 MVP 功能实现和性能优化"
```

---

## 📝 完成标准

✅ 所有 5 个功能实现并测试通过
✅ 所有 5 项性能优化完成
✅ 生产环境构建成功
✅ Lighthouse 分数 > 90
✅ 无控制台错误或警告
✅ 代码提交历史清晰

---

**开始时间**: 2026-02-17
**预计完成时间**: 2026-02-17（同日）

