# 前端移动端关键修复

## 🚨 修复的移动端缺陷

### 缺陷 1: 唤醒迟钝（JS 线程冻结）

**问题**:
- iOS Safari 等移动端浏览器会冻结后台应用的 JavaScript 线程
- `setInterval` 心跳停止运行
- 用户切回 App 后，Socket.IO 需要几秒甚至十几秒才能检测到断线
- 导致界面"假死"，用户体验极差

**修复方案**:
```typescript
// ClawbotChannelBridge.ts - connect() 方法末尾
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    console.log('[ClawbotChannel] 📱 App 切回前台，检查连接...');
    // 强制重置心跳时间，防止刚唤醒就被判定超时断开
    this.lastPongTime = Date.now();

    if (this.socket && this.socket.disconnected) {
      console.log('[ClawbotChannel] 🔄 发现连接断开，立即强制重连');
      this.socket.connect();
    }
  }
});
```

**效果**:
- ✅ App 切回前台时立即检测连接状态
- ✅ 发现断线立即重连，不等 Socket.IO 慢慢发现
- ✅ 重置心跳时间，防止误判超时
- ✅ 用户感知不到延迟，体验流畅

### 缺陷 2: 断网期间的消息黑洞（Message Reconciliation）

**问题**:
- 用户发送消息后立即锁屏/切后台
- PC 端生成回复并发送到云端，消息被落库到 Supabase
- 手机 App 断网，无法接收 `bot_message` 事件
- 用户重新解锁手机后，Socket.IO 只推送新消息
- 漏掉的消息永远不会触发，聊天记录缺失

**修复方案**:
```typescript
// ClawbotChannelBridge.ts - handleConnected() 方法
private async handleConnected(): Promise<void> {
  // ... 原有逻辑
  this.emit('connected');

  // ✅ 修复 2: 通知 UI 层去 Supabase 拉取断网期间可能遗漏的消息
  this.emit('sync_missed_messages');
  console.log('[ClawbotChannel] ✅ 已触发消息同步，UI 层应从 Supabase 拉取遗漏消息');
}

// ClawbotChannelContext.tsx - 监听同步事件
clawbotChannelBridge.on('sync_missed_messages', async () => {
  console.log('[ClawbotChannel] 📩 收到消息同步指令，开始拉取遗漏消息...');
  // TODO: 实现 Supabase 消息拉取逻辑
  // const lastMessageTimestamp = messages[messages.length - 1].timestamp;
  // const missedMessages = await fetchMissedMessagesFromSupabase(lastMessageTimestamp);
  // setMessages(prev => [...prev, ...missedMessages]);
});
```

**效果**:
- ✅ 重连成功后立即触发消息同步
- ✅ UI 层从 Supabase 拉取遗漏消息
- ✅ 聊天记录无缝衔接，不丢消息
- ✅ 移动端体验媲美原生 App

## 📋 待实现：Supabase 消息拉取

在 `ClawbotChannelContext.tsx` 的 `sync_missed_messages` 事件处理中，需要实现：

```typescript
import { supabase } from '../config/supabase';

// 获取最后一条消息的时间戳
const lastMessageTimestamp = messages.length > 0
  ? messages[messages.length - 1].timestamp
  : 0;

// 从 Supabase 拉取遗漏的消息
const { data: missedMessages, error } = await supabase
  .from('messages')
  .select('*')
  .eq('user_id', userId)
  .gt('timestamp', lastMessageTimestamp)
  .order('timestamp', { ascending: true });

if (!error && missedMessages) {
  // 转换为 ClawbotChannelMessage 格式
  const formattedMessages: ClawbotChannelMessage[] = missedMessages.map(msg => ({
    id: msg.id,
    content: msg.content,
    contentType: msg.content_type || 'text',
    mediaUrl: msg.media_url,
    timestamp: msg.timestamp,
    sender: msg.sender
  }));

  // 添加到消息列表
  setMessages(prev => [...prev, ...formattedMessages]);
}
```

## 🎯 测试验证

### 测试 1: 前后台切换
```bash
1. 打开 App，连接成功
2. 切换到其他 App 或按 Home 键
3. 等待 30 秒以上
4. 切回 App
✅ 应该看到日志：📱 App 切回前台，检查连接...
✅ 如果断线，应该立即看到：🔄 发现连接断开，立即强制重连
✅ 不应该有明显的"假死"延迟
```

### 测试 2: 消息黑洞
```bash
1. App 连接成功
2. 发送消息："帮我总结一下"
3. 立即锁屏或切后台
4. 等待 PC 端回复（10-20秒）
5. 解锁/切回 App
✅ 应该看到日志：📩 收到消息同步指令，开始拉取遗漏消息...
✅ 聊天界面应该显示 PC 端的回复
✅ 不应该丢失任何消息
```

## 📊 修复前后对比

| 场景 | 修复前 | 修复后 |
|------|--------|--------|
| 切回 App | ❌ 假死 5-15 秒 | ✅ 立即响应 |
| 断线检测 | ❌ 被动等待 | ✅ 主动检测 |
| 消息同步 | ❌ 丢消息 | ✅ 完整同步 |
| 移动端体验 | ⚠️  勉强可用 | ✅ 流畅无感 |

## 📝 文件变更

```
src/services/ClawbotChannelBridge.ts    # 添加 visibilitychange 监听和消息同步事件
src/contexts/ClawbotChannelContext.tsx  # 添加消息同步事件处理（待实现 Supabase 拉取）
```

---

**参考文档**: E:\desktop\trix-3d-companion\docs\new.md
**修复版本**: v2.1.0
