# 配对状态一致性问题

## 问题
配对后出现"表里已绑定但实际未配对"的状态脏写

## 根因
`pair_with_token` 先绑定用户再检查 Bot 在线，导致 Bot 离线时仍写入用户绑定

## 标准解决方案

```typescript
// 1. 先检查 Bot 在线
const botOnline = await checkBotOnline(botId)
if (!botOnline) {
  return { success: false, error: 'Bot is offline' }
}

// 2. 验证 Token
const tokenValid = await validateToken(token)
if (!tokenValid) {
  return { success: false, error: 'Invalid token' }
}

// 3. 执行原子绑定（使用事务）
await transaction(async (tx) => {
  await tx.insert(pairings).values({
    botId,
    userId,
    status: 'paired',
    createdAt: new Date()
  })
  await updateBotState(botId, 'paired')
})
```

## 验证步骤

1. Bot 离线时尝试配对 → 应该失败
2. 配对中断后重启 → 状态应该重置
3. 并发配对请求 → 只有一个成功

## 相关文件
- `src/services/databaseService.ts:141`
- `src/contexts/ClawbotChannelContext.tsx`
- `server/clawbot-channel/server.js:360`

## Commit 示例
```
fix(pairing): ensure bot online before binding user

Problem: Bot offline still writes user binding to database
Solution: Check bot status first, then execute atomic binding

Fixes: #123
```
