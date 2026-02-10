# 🎯 多人自习室 MVP - 测试指南

## 功能概述

实现了一个支持实时同步的多人自习室,最多可容纳 6 人同时学习。

## 核心功能

### 1. ✅ Start Focus 按钮 → 加入自习室
- 点击 "开始专注" 按钮
- 自动调用 `upsert_study_room_member` RPC 函数
- 将当前用户的状态设置为 `focusing`
- 更新 `last_seen` 时间戳

### 2. ✅ 实时订阅 (Real-time Subscription)
- 使用 Supabase Channel 监听 `study_room_members` 表的变化
- 支持三种事件: INSERT, UPDATE, DELETE
- 任何成员状态变化都会实时刷新座位列表

### 3. ✅ 座位显示 (6 个座位)
- 采用 Grid 布局 (2x3 在移动端, 3x3 在桌面端)
- 有人的座位:
  - 显示用户头像 (Avatar 组件)
  - 显示用户名 (display_name)
  - 显示专注状态 (绿色火焰图标)
  - 显示学习时长 (基于 joined_at 计算)
- 空座位:
  - 灰色用户图标
  - "空座位" 文字提示

### 4. ✅ 自动标记 Idle (5 分钟规则)
- Frontend 过滤: `loadMembers()` 函数会过滤掉 `last_seen` 超过 5 分钟的成员
- Backend 清理: `cleanup_inactive_members()` RPC 函数可定期执行
- 心跳机制: 每 2 分钟自动更新 `last_seen` 时间戳

## 测试步骤

### 前置条件
1. ✅ 执行数据库迁移 (参考 `MIGRATION-INSTRUCTIONS.md`)
2. ✅ 确保已登录 (有有效的 Supabase session)
3. ✅ 打开自习室弹窗

### 测试场景 A: 单用户加入
1. 点击首页的自习室入口
2. 点击 "开始专注" 按钮
3. **预期结果**:
   - 按钮变为 "停止专注" (红色)
   - 右上角显示学习时间计时器 (00:00:01, 00:00:02...)
   - 第一个座位显示当前用户的头像和名称
   - 顶部显示 "1 / 6 人正在专注学习"

### 测试场景 B: 多用户实时同步
1. 打开两个浏览器窗口/隐身模式
2. 使用不同账号登录
3. 第一个用户点击 "开始专注"
4. 第二个用户打开自习室
5. **预期结果**:
   - 第二个用户能看到第一个用户在座位上
   - 第二个用户点击 "开始专注" 后,第一个用户立即看到更新
   - 两个用户都显示 "2 / 6 人正在专注学习"

### 测试场景 C: 停止专注
1. 点击 "停止专注" 按钮
2. **预期结果**:
   - 计时器停止
   - 按钮变回 "开始专注" (绿色)
   - 座位变为空座位 (或从列表中移除)
   - 其他用户立即看到该用户离开

### 测试场景 D: 5 分钟 Idle 规则
1. 用户 A 加入自习室
2. 等待 5 分钟不执行任何操作 (心跳停止)
3. 用户 B 打开自习室
4. **预期结果**:
   - 用户 B 不会看到用户 A (因为超过 5 分钟)
   - 或者手动执行 `cleanup_inactive_members()` 后,用户 A 状态变为 `idle`

### 测试场景 E: 心跳保活
1. 用户加入自习室
2. 保持窗口打开 3-4 分钟
3. **预期结果**:
   - 每 2 分钟自动更新 `last_seen` 时间戳
   - 用户不会被标记为 idle
   - 其他用户持续能看到该用户在座位上

## 技术实现细节

### Database Schema
```sql
ALTER TABLE study_room_members 
ADD COLUMN status TEXT CHECK (status IN ('focusing', 'idle', 'away'));
ADD COLUMN last_seen TIMESTAMPTZ DEFAULT NOW();
ADD COLUMN display_name TEXT;
ADD COLUMN avatar_url TEXT;
```

### RPC Functions
```typescript
// 加入/更新状态
await supabase.rpc('upsert_study_room_member', {
  p_room_id: '00000000-0000-0000-0000-000000000001',
  p_user_id: userId,
  p_status: 'focusing',
  p_display_name: 'John Doe',
  p_avatar_url: 'https://...'
});

// 清理过期成员
await supabase.rpc('cleanup_inactive_members');
```

### Real-time Subscription
```typescript
const channel = supabase
  .channel(`study_room:${roomId}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'study_room_members',
    filter: `room_id=eq.${roomId}`
  }, loadMembers)
  .subscribe();
```

## 已知限制

1. **单房间限制**: 当前硬编码为 `DEFAULT_ROOM_ID`,未来可扩展为多房间选择
2. **心跳间隔**: 2 分钟心跳可能导致网络开销,可根据需求调整
3. **Idle 清理**: 需要手动调用或设置 Supabase Cron Job
4. **座位数量**: 固定 6 个座位,可调整 `maxSeats` 常量

## 下一步优化建议

- [ ] 添加房间选择功能 (创建/加入房间)
- [ ] 显示每个成员的实时学习时长
- [ ] 添加聊天功能 (房间内消息)
- [ ] 添加专注统计 (每日/每周排行榜)
- [ ] 添加番茄钟功能 (25分钟专注 + 5分钟休息)
- [ ] 添加背景音乐/白噪音播放
- [ ] 设置 Supabase Cron Job 自动清理 idle 成员

## Troubleshooting

### 问题: 点击 "开始专注" 没有反应
- 检查是否已登录 (控制台查看 `currentUserId`)
- 检查数据库迁移是否执行成功
- 检查浏览器控制台是否有错误

### 问题: 看不到其他用户
- 检查两个用户是否在同一个 `room_id`
- 检查实时订阅是否正常工作
- 检查 `last_seen` 时间戳是否在 5 分钟内

### 问题: 用户被错误标记为 idle
- 检查心跳是否正常运行 (每 2 分钟)
- 检查 `last_seen` 字段是否正确更新
- 尝试手动刷新页面

---

✅ **MVP 已完成! 开始测试吧!**
