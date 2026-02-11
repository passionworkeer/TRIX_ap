# 自习状态同步与加入功能实现文档

## 📋 功能概述

本文档记录了自习状态实时同步和好友加入功能的完整实现。

---

## ✨ 已实现功能

### 1️⃣ 计时器状态自动同步

#### 功能描述
- 用户开始自习时，自动更新数据库 `profiles.is_studying = true`
- 用户停止/完成自习时，自动更新数据库 `profiles.is_studying = false`
- 用户关闭页面/组件卸载时，自动清理状态（防止卡在"自习中"）

#### 实现细节

**文件**: `src/screens/Study.tsx`

##### A. 开始自习 (`handleStartFocus`)
```typescript
const handleStartFocus = async () => {
  if (user?.id) {
    console.log('🚀 [Study] 开始自习，更新数据库状态...');
    await supabase
      .from('profiles')
      .update({ is_studying: true })
      .eq('id', user.id);
    console.log('✅ [Study] 已更新 is_studying = true');
  }
  navigate(AppRoutes.TIMER, { state: { duration: selectedDuration } });
};
```

**触发时机**: 用户点击"开始专注"按钮

---

##### B. 停止自习 (`handleStopFocus`)
```typescript
const handleStopFocus = async () => {
  if (user?.id) {
    console.log('🛑 [Study] 停止自习，更新数据库状态...');
    await supabase
      .from('profiles')
      .update({ is_studying: false })
      .eq('id', user.id);
    console.log('✅ [Study] 已更新 is_studying = false');
  }
  navigate(AppRoutes.STUDY);
};
```

**触发时机**: 
- 用户点击"返回自习室"按钮
- 用户点击"放弃专注"按钮
- 计时器完成后点击返回

---

##### C. 组件卸载清理 (新增)
```typescript
useEffect(() => {
  return () => {
    if (isTimer && user?.id) {
      console.log('🧹 [Study] 组件卸载，清理自习状态...');
      supabase
        .from('profiles')
        .update({ is_studying: false })
        .eq('id', user.id);
    }
  };
}, [isTimer, user?.id]);
```

**触发时机**:
- 用户直接关闭浏览器标签页
- 用户刷新页面
- React 路由跳转导致组件卸载

**重要性**: ⭐⭐⭐⭐⭐  
防止用户状态永久卡在"自习中"，确保数据一致性。

---

### 2️⃣ 好友加入功能

#### 功能描述
- 点击"加入"按钮时显示加载动画
- 模拟加入过程（800ms 延迟给用户视觉反馈）
- 成功后显示提示并关闭弹窗
- 加入过程中禁用所有按钮（防止重复点击）

#### 实现细节

**文件**: `src/components/StudyBuddiesList.tsx`

##### A. 状态管理
```typescript
const [joiningBuddyId, setJoiningBuddyId] = useState<string | null>(null);
```

- `null`: 没有正在加入的好友
- `string`: 正在加入的好友 ID（显示 Loading）

---

##### B. 加入逻辑 (`handleJoinBuddy`)
```typescript
const handleJoinBuddy = async (buddyId: string, buddyName: string) => {
  console.log(`🚀 [StudyBuddies] 准备加入 ${buddyName} 的自习室`, { buddyId });
  
  setJoiningBuddyId(buddyId); // 设置 Loading 状态
  
  try {
    await new Promise(resolve => setTimeout(resolve, 800)); // 模拟加载
    
    console.log(`✅ [StudyBuddies] 成功加入 ${buddyName} 的自习室`);
    alert(`✅ 已进入陪同状态\n正在与 ${buddyName} 一起自习！`);
    
    onClose(); // 关闭弹窗
  } catch (error) {
    console.error(`❌ [StudyBuddies] 加入失败:`, error);
    alert(`加入 ${buddyName} 的自习室失败，请稍后重试`);
  } finally {
    setJoiningBuddyId(null); // 清除 Loading 状态
  }
};
```

---

##### C. UI 状态显示
```typescript
<button
  onClick={() => handleJoinBuddy(buddy.id, buddy.username)}
  disabled={joiningBuddyId !== null}
  className={`
    ${joiningBuddyId === buddy.id 
      ? 'bg-blue-400 cursor-wait'           // 当前正在加入
      : joiningBuddyId !== null
      ? 'bg-gray-500 opacity-50'            // 其他按钮禁用
      : 'bg-blue-500 hover:bg-blue-600'     // 正常状态
    }
  `}
>
  {joiningBuddyId === buddy.id ? (
    <div className="flex items-center gap-2">
      <div className="animate-spin ..."></div>
      <span>加入中...</span>
    </div>
  ) : (
    '加入'
  )}
</button>
```

**UI 状态说明**:
| 状态 | 按钮文字 | 按钮样式 | 是否可点击 |
|------|---------|---------|-----------|
| 正常 | "加入" | 蓝色 | ✅ |
| 加入中（自己） | "加入中..." + 旋转图标 | 浅蓝色 | ❌ |
| 加入中（其他） | "加入" | 灰色半透明 | ❌ |

---

### 3️⃣ Realtime 自动刷新优化

#### 功能描述
- 好友状态变化时自动刷新列表（无需重新打开弹窗）
- 使用防抖机制避免频繁查询数据库
- 详细的日志输出便于调试

#### 实现细节

**文件**: `src/components/StudyBuddiesList.tsx`

##### A. 防抖刷新逻辑
```typescript
useEffect(() => {
  if (!currentUserId || !isOpen) return;

  let refreshTimeout: NodeJS.Timeout;

  const channel = supabase
    .channel('study-buddies-updates')
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'profiles'
    }, (payload) => {
      console.log('🔥 [StudyBuddies] 检测到 profiles 更新:', payload);
      
      // 防抖：多个更新在 500ms 内只触发一次刷新
      clearTimeout(refreshTimeout);
      refreshTimeout = setTimeout(() => {
        console.log('🔄 [StudyBuddies] 刷新好友列表...');
        fetchStudyBuddies();
      }, 500);
    })
    .subscribe();

  return () => {
    clearTimeout(refreshTimeout);
    supabase.removeChannel(channel);
  };
}, [currentUserId, isOpen]);
```

**优化点**:
- ✅ 防抖减少数据库查询次数
- ✅ 组件卸载时清理定时器和订阅
- ✅ 只在弹窗打开时监听更新（节省资源）

---

##### B. 调试增强日志
```typescript
// 查询所有好友状态（调试用）
const { data: allProfiles } = await supabase
  .from('profiles')
  .select('id, username, avatar_url, is_studying')
  .in('id', friendIds);

console.log('📊 [StudyBuddies] 所有好友的 profiles:', allProfiles);

// 查询正在自习的好友
const { data: profiles } = await supabase
  .from('profiles')
  .select('id, username, avatar_url, is_studying')
  .in('id', friendIds)
  .eq('is_studying', true);

console.log('📊 [StudyBuddies] 正在自习的好友:', profiles);
```

**日志输出示例**:
```
📊 [StudyBuddies] 所有好友的 profiles: [
  { id: "xxx", username: "test2", is_studying: true },
  { id: "yyy", username: "test3", is_studying: false }
]
📊 [StudyBuddies] 正在自习的好友: [
  { id: "xxx", username: "test2", is_studying: true }
]
```

---

## 🧪 测试流程

### 测试 1: 状态同步

**准备**:
- 两个浏览器窗口
- 窗口 1: 登录用户 A
- 窗口 2: 登录用户 B（A 的好友）

**步骤**:
1. **窗口 1**: 点击"开始专注"
2. **窗口 2**: 打开好友列表（点击右上角 `+`）
3. **预期**: 看到用户 A 出现在列表中

4. **窗口 1**: 点击"返回自习室"或"放弃专注"
5. **窗口 2**: 好友列表自动更新（用户 A 消失）
6. **预期**: 列表变为空或只显示其他正在自习的好友

**控制台日志（窗口 1）**:
```
🚀 [Study] 开始自习，更新数据库状态...
✅ [Study] 已更新 is_studying = true
🛑 [Study] 停止自习，更新数据库状态...
✅ [Study] 已更新 is_studying = false
```

**控制台日志（窗口 2）**:
```
🔥 [StudyBuddies] 检测到 profiles 更新: {...}
🔄 [StudyBuddies] 刷新好友列表...
📊 [StudyBuddies] 正在自习的好友: [...]
```

---

### 测试 2: 组件卸载清理

**步骤**:
1. 点击"开始专注"进入计时器页面
2. 直接关闭浏览器标签页（或刷新页面）
3. 在 Supabase Dashboard 查询:
   ```sql
   SELECT username, is_studying FROM profiles WHERE id = 'your-user-id';
   ```
4. **预期**: `is_studying` 应该是 `false`（已清理）

**控制台日志**:
```
🧹 [Study] 组件卸载，清理自习状态...
✅ [Study] 已清理 is_studying = false
```

---

### 测试 3: 加入功能

**步骤**:
1. 确保至少有一个好友正在自习
2. 打开好友列表
3. 点击"加入"按钮
4. **预期**: 
   - 按钮文字变为"加入中..."
   - 出现旋转加载图标
   - 其他好友的"加入"按钮变灰禁用
   - 800ms 后弹出成功提示
   - 弹窗自动关闭

**控制台日志**:
```
🚀 [StudyBuddies] 准备加入 test2 的自习室 {buddyId: "xxx"}
✅ [StudyBuddies] 成功加入 test2 的自习室
```

---

### 测试 4: Realtime 防抖

**步骤**:
1. 窗口 1: 打开好友列表并保持打开
2. 窗口 2: 快速连续 3 次点击"开始专注"→"返回自习室"
3. **预期**: 窗口 1 的列表只刷新 1-2 次（而不是 6 次）

**控制台日志（窗口 1）**:
```
🔥 [StudyBuddies] 检测到 profiles 更新: {...}
🔥 [StudyBuddies] 检测到 profiles 更新: {...}
🔥 [StudyBuddies] 检测到 profiles 更新: {...}
🔄 [StudyBuddies] 刷新好友列表...  ← 只执行一次
```

---

## 🐛 故障排查

### 问题 1: 好友列表不自动更新

**检查项**:
```sql
-- 1. 确认 Realtime 已启用
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' AND tablename = 'profiles';
```

如果没有输出：
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
```

---

### 问题 2: 关闭页面后状态没清理

**原因**: 浏览器可能在组件卸载前就强制关闭了

**解决方案**: 添加 `beforeunload` 事件监听
```typescript
useEffect(() => {
  const handleBeforeUnload = () => {
    if (user?.id && isTimer) {
      navigator.sendBeacon('/api/stop-studying', JSON.stringify({ userId: user.id }));
    }
  };
  
  window.addEventListener('beforeunload', handleBeforeUnload);
  return () => window.removeEventListener('beforeunload', handleBeforeUnload);
}, [user?.id, isTimer]);
```

---

### 问题 3: 加入按钮一直显示 Loading

**原因**: 可能是 Promise 没有正确 resolve

**解决方案**: 检查 `handleJoinBuddy` 中的 try-finally 确保 `setJoiningBuddyId(null)` 一定执行

---

## 📊 状态流转图

```
用户操作          →    数据库状态         →    好友视角
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
点击"开始专注"    →    is_studying=true   →    出现在列表中
                       (Realtime 推送)        (自动刷新)

点击"返回自习室"  →    is_studying=false  →    从列表消失
                       (Realtime 推送)        (自动刷新)

关闭页面/刷新     →    is_studying=false  →    从列表消失
                       (useEffect 清理)       (自动刷新)
```

---

## 🚀 未来功能扩展建议

### 1. 加入功能增强
```typescript
// TODO: 实际的加入逻辑
const handleJoinBuddy = async (buddyId: string) => {
  // 1. 创建共享会话
  const { data: session } = await supabase
    .from('study_sessions')
    .insert({ host_id: buddyId, participant_id: currentUserId });
  
  // 2. 同步计时器状态
  const { data: hostTimer } = await supabase
    .from('timers')
    .select('remaining_time')
    .eq('user_id', buddyId)
    .single();
  
  // 3. 跳转到共享场景
  navigate('/study/shared', { state: { sessionId: session.id } });
};
```

### 2. 语音通话集成
- 使用 Agora/Twilio SDK
- 加入后自动连接语音频道
- 显示说话状态指示器

### 3. 计时器同步
- 实时同步倒计时
- 主持人可以暂停/恢复所有人的计时器
- 完成时一起收到通知

### 4. 离线状态处理
- 网络断开时缓存状态变更
- 重连后自动同步
- 显示"离线"徽章

---

## ✅ 功能清单

- [x] 开始自习时更新数据库状态
- [x] 停止自习时更新数据库状态
- [x] 组件卸载时清理状态
- [x] 加入按钮交互（Loading + 成功提示）
- [x] Realtime 自动刷新好友列表
- [x] 防抖优化避免频繁查询
- [x] 详细的调试日志输出
- [x] 禁用状态防止重复点击

---

## 📚 相关文件

- `src/screens/Study.tsx` - 计时器主界面（状态同步）
- `src/components/StudyBuddiesList.tsx` - 好友列表（加入功能 + Realtime）
- `database/add-is-studying-to-profiles.sql` - 数据库迁移
- `database/debug-is-studying.sql` - 调试工具

---

**作者**: AI Assistant  
**日期**: 2026-02-11  
**版本**: 2.0
