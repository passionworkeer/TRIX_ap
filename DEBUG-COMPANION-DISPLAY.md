# 🧪 双头像显示问题排查指南

## 问题描述
用户反馈：加入好友自习室后，计时器页面没有显示双头像

## 已实现的修复
1. ✅ 计时器页面隐藏底部导航栏（保持专注）
2. ✅ 添加详细的调试日志

## 排查步骤

### Step 1: 检查浏览器控制台日志

刷新页面后，执行以下操作并观察日志：

1. **用户 B 开始自习**（点击"开始专注"）
   ```
   期待日志:
   🚀 [Study] 开始自习，更新数据库状态...
   ✅ [Study] 已更新 is_studying = true
   ```

2. **用户 A 打开好友列表**
   ```
   期待日志:
   🔌 [StudyBuddies] 启动实时监听 profiles 表
   📊 [StudyBuddies] 正在自习的好友: [{ id: ..., username: ..., avatar_url: ... }]
   ```

3. **用户 A 点击"加入"**
   ```
   期待日志:
   🚀 [StudyBuddies] 准备加入 XXX 的自习室
   🔗 [StudyBuddies] 建立双向连接: A_ID ↔️ B_ID
   ✅ [StudyBuddies] 双向连接建立成功！
   🚀 [StudyBuddies] 传递给计时器页面的数据: { duration: 25, companion: {...} }
   ```

4. **计时器页面加载**
   ```
   期待日志:
   🎯 [Study] Location state: { duration: 25, companion: {...} }
   🎯 [Study] Companion data: { id: ..., username: ..., avatar: ... }
   🎯 [Study] Is timer page: true
   ```

### Step 2: 检查关键数据

在控制台执行以下命令：

```javascript
// 检查 location.state
console.log('State:', window.location.hash, history.state);

// 检查 companion 是否为 undefined
// (需要在 Study 组件内打断点)
```

### Step 3: 数据库验证

在 Supabase Dashboard -> SQL Editor 执行：

```sql
-- 检查双向关联是否建立
SELECT 
  u1.id as user1_id,
  u1.username as user1_name,
  u1.is_studying as user1_studying,
  u1.companion_id as user1_companion,
  u2.id as user2_id,
  u2.username as user2_name,
  u2.is_studying as user2_studying,
  u2.companion_id as user2_companion
FROM profiles u1
JOIN profiles u2 ON u1.companion_id = u2.id
WHERE u1.companion_id IS NOT NULL;

-- 预期结果:
-- user1 和 user2 的 companion_id 应该互相指向对方
-- 例如: A.companion_id = B.id AND B.companion_id = A.id
```

### Step 4: UI 检查

在计时器页面，检查以下元素：

```javascript
// 在浏览器控制台执行
document.querySelector('[data-companion-avatars]'); // 应该存在
document.querySelectorAll('.ring-blue-500\\/50, .ring-purple-500\\/50'); // 应该有2个
```

## 可能的问题原因

### 问题 1: location.state 丢失
**症状**: `🎯 [Study] Location state: undefined`

**原因**: React Router 在某些情况下会丢失 state（如刷新页面）

**解决方案**: 
- 方案 A: 从数据库查询 companion_id 并获取好友信息
- 方案 B: 使用 URL 参数传递 companion_id

### 问题 2: companion_id 未建立
**症状**: 数据库查询返回空结果

**原因**: 
- 数据库迁移未执行（companion_id 字段不存在）
- 双向更新失败（网络错误或权限问题）

**解决方案**:
1. 执行 `database/add-companion-to-profiles.sql`
2. 检查 Supabase 日志查看错误信息

### 问题 3: Avatar 组件渲染失败
**症状**: companion 数据存在，但页面不显示

**原因**:
- avatar 字段为 null 或空字符串
- Avatar 组件内部错误

**解决方案**:
- 检查 Avatar 组件是否正确处理空值
- 查看浏览器控制台是否有 React 错误

## 临时调试代码

如果上述方法都无法定位问题，添加以下代码到 Study.tsx：

```typescript
// 在双头像显示部分之前
useEffect(() => {
  if (isTimer) {
    console.log('=== 计时器页面调试信息 ===');
    console.log('1. location:', location);
    console.log('2. location.state:', location.state);
    console.log('3. companion:', companion);
    console.log('4. user:', user);
    console.log('5. profile:', profile);
    console.log('=========================');
  }
}, [isTimer, location, companion, user, profile]);
```

## 修复验证清单

完成以下操作后，问题应该解决：

- [ ] 浏览器控制台看到完整的日志链路（从点击加入到页面加载）
- [ ] 数据库中 companion_id 字段存在且双向关联正确
- [ ] 计时器页面底部导航栏已隐藏
- [ ] 双头像正常显示（蓝色 + 紫色光晕）
- [ ] 用户名显示在头像下方
- [ ] 连接线动画正常播放

## 下一步优化

如果当前实现不稳定，考虑以下改进：

### 方案 A: URL 参数传递
```typescript
// StudyBuddiesList.tsx
navigate(`${AppRoutes.TIMER}?companion=${buddy.id}`);

// Study.tsx
const searchParams = new URLSearchParams(location.search);
const companionId = searchParams.get('companion');

useEffect(() => {
  if (companionId) {
    // 从数据库查询好友信息
    fetchCompanionInfo(companionId);
  }
}, [companionId]);
```

### 方案 B: Context API 管理状态
```typescript
// CompanionContext.tsx
const [companion, setCompanion] = useState<CompanionInfo | null>(null);

// 跨组件共享 companion 状态，避免 location.state 丢失
```

### 方案 C: 从数据库查询
```typescript
// Study.tsx - 进入计时器页面时
useEffect(() => {
  if (isTimer && user?.id) {
    // 查询自己的 companion_id
    const { data } = await supabase
      .from('profiles')
      .select('companion_id')
      .eq('id', user.id)
      .single();
    
    if (data?.companion_id) {
      // 查询好友信息
      const { data: companionProfile } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .eq('id', data.companion_id)
        .single();
      
      setCompanion(companionProfile);
    }
  }
}, [isTimer, user?.id]);
```

---

**创建时间**: 2026-02-11  
**目的**: 快速定位双头像不显示问题  
**相关 PR**: aadac50
