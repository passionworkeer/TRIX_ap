# TRIX × OpenClaw 项目修改指令

> 给 Cursor 的执行文档。按顺序执行，每步完成后验证再继续。
> 当前项目：trix-3d-companion | 插件包：packages/trix-openclaw-native

---

## 执行前：先读懂现状

当前项目有三层问题：

1. **Plugin 层**：`startAccount` 提前返回，导致 channel 显示 `configured` 不是 `running`
2. **服务器层**：OpenClaw 插件复用了 clientToken 用户面协议，没有独立的 bot/service 身份
3. **前端层**：消息气泡方向判断有 bug，sender 逻辑用了错误的字段

---

## Phase 1：修复 Plugin 层（最优先）

### 1.1 修复 startAccount（最关键的一处修改）

**文件**：`packages/trix-openclaw-native/src/plugin/plugin.ts`

找到 `gateway.startAccount` 的实现，把整个函数替换为：

```typescript
startAccount: async (ctx: any) => {
  const log = ctx.log ?? {};
  const account = ctx.cfg.channels?.['trix-native']
    ?.accounts?.[ctx.accountId ?? 'default'];

  if (!account?.serverUrl) {
    log.warn?.('[trix-native] No serverUrl configured, skipping startAccount');
    return;
  }

  const effectiveAccount = {
    ...account,
    accountId: ctx.accountId ?? 'default',
    storageDir: account.storageDir
      || path.resolve('.trix-native-channel/openclaw'),
  };

  log.info?.(`[trix-native] Starting account ${effectiveAccount.accountId}`);

  // 启动 WebSocket 长连接，拿到 cleanup 函数
  const cleanup = await startInboundMonitor(ctx, effectiveAccount);

  // ⚠️ 关键：挂起直到 Gateway 关闭（abortSignal 触发）
  // 不加这段 = channel 显示 configured 而非 running
  // = Gateway 触发 auto-restart 循环
  // 参考：openclaw/openclaw issue #27933 #26478 #26363
  try {
    await new Promise<void>((resolve) => {
      if (ctx.abortSignal?.aborted) {
        resolve();
        return;
      }
      ctx.abortSignal?.addEventListener('abort', () => resolve(), { once: true });
    });
  } finally {
    cleanup?.();
    log.info?.(`[trix-native] Account ${effectiveAccount.accountId} stopped`);
    ctx.setStatus?.({
      accountId: effectiveAccount.accountId,
      running: false,
      lastStopAt: Date.now(),
    });
  }
},
```

### 1.2 修复 startInboundMonitor 返回值

**文件**：`packages/trix-openclaw-native/src/plugin/inbound.ts`

`startInboundMonitor` 必须返回一个 cleanup 函数供 `startAccount` 的 `finally` 块调用。

找到函数末尾，把原来的代码改为：

```typescript
export async function startInboundMonitor(
  ctx: any,
  account: any
): Promise<(() => void) | undefined> {   // ← 返回类型必须是 cleanup 函数
  const key = account.accountId;
  const log = ctx.log ?? {};
  const abortSignal = ctx.abortSignal as AbortSignal | undefined;

  if (activeMonitors.get(key)) {
    log.warn?.(`[${key}] Inbound monitor already running, skipping`);
    return undefined;
  }
  activeMonitors.set(key, true);

  let stopped = false;
  let currentSocket: any = null;

  // ⚠️ abort 时必须删除 Map key，否则重启后无法重连
  abortSignal?.addEventListener('abort', () => {
    stopped = true;
    activeMonitors.delete(key);           // ← 这行必须有
    currentSocket?.close(1000, 'plugin stop');
    currentSocket = null;
  }, { once: true });

  // ... WebSocket connect 逻辑保持不变 ...

  // 函数末尾：返回 cleanup（不是 void）
  return () => {
    stopped = true;
    activeMonitors.delete(key);
    currentSocket?.close(1000, 'plugin stop');
    currentSocket = null;
  };
}
```

### 1.3 修复 openclaw.plugin.json

**文件**：`packages/trix-openclaw-native/openclaw.plugin.json`

确认包含以下字段（缺 `channels` 字段会导致 Gateway 启动失败）：

```json
{
  "id": "openclaw-native-channel",
  "channels": ["trix-native"],
  "configSchema": {
    "type": "object",
    "additionalProperties": false,
    "properties": {}
  }
}
```

### 1.4 修复 package.json 的 openclaw.extensions

**文件**：`packages/trix-openclaw-native/package.json`

确认：
- `id` 字段的值（`openclaw-native-channel`）必须和 `openclaw.plugin.json` 里的 `id` 一致
- `extensions` 指向 `./src/index.ts`（不是 dist）

```json
{
  "name": "@trix-app/openclaw-native-channel",
  "openclaw": {
    "extensions": ["./src/index.ts"],
    "channel": {
      "id": "trix-native",
      "label": "TRIX Native",
      "selectionLabel": "TRIX Native (Paired)",
      "aliases": ["trix", "native"]
    },
    "install": {
      "npmSpec": "@trix-app/openclaw-native-channel"
    }
  }
}
```

### 1.5 验证 Phase 1

```bash
cd packages/trix-openclaw-native && npm run build
openclaw plugins install E:/desktop/trix-3d-companion/packages/trix-openclaw-native
openclaw gateway restart

# 等 10 秒后检查
openclaw channels status
```

**必须看到**：
```
TRIX Native default (TRIX Native): enabled, configured, running
```

`running` 出现了才继续 Phase 2。如果还是 `configured`，说明 1.1 没改对。

---

## Phase 2：服务器层新增 Service Plane

当前问题：OpenClaw 插件用的是 `clientToken`（用户面），这不是 bot 应该有的身份。
需要新增 `serviceToken`（服务面），让 OpenClaw 以 bot 身份连接。

### 2.1 服务器新增 serviceToken 认证

**文件**：服务器 `/root/trix-native-server/index.js`（在服务器上修改）

在服务器初始化逻辑里，生成并持久化 `serviceToken`：

```javascript
// 服务器启动时生成 serviceToken（如果还没有）
if (!state.serviceToken) {
  state.serviceToken = crypto.randomBytes(24).toString('hex');
  await saveState(state);
}
```

### 2.2 服务器新增 role=agent 的 WebSocket 处理

在 `/ws` 端点的 upgrade 处理里，增加 agent 角色验证：

```javascript
// handleSocket 里
const role = searchParams.get('role') ?? 'user';
const serviceToken = searchParams.get('serviceToken');
const adminToken = searchParams.get('adminToken');

if (role === 'agent') {
  // 验证 serviceToken 或 adminToken 都可以
  const validToken = state.serviceToken || state.adminToken;
  const providedToken = serviceToken || adminToken;
  if (!providedToken || providedToken !== validToken) {
    socket.close(4001, 'Invalid service token');
    return;
  }
}
```

### 2.3 服务器新增 /api/service/messages 端点

```javascript
// POST /api/service/messages
// Authorization: Bearer <serviceToken>
if (request.method === 'POST' && url.pathname === '/api/service/messages') {
  await assertServiceToken(request.headers['authorization']);
  const body = await readJsonBody(request);
  const message = await createMessage({
    ...body,
    direction: 'outbound',
  });
  // 广播给所有 role=user 的 WS 连接
  await broadcast({ type: 'message.created', payload: { message } },
    { conversationId: message.conversationId, role: 'user' });
  sendJson(response, 201, { message });
  return;
}
```

### 2.4 更新 OpenClaw 配置，用 serviceToken

```bash
# 先从服务器拿 serviceToken
ssh -p 22222 root@TRIX_SERVER_HOST "cat /root/trix-native-server/.trix-native-channel/state.json | grep serviceToken"

# 写入配置
openclaw config set channels.trix-native.accounts.default.serviceToken "<上面拿到的值>"
```

### 2.5 更新 Plugin 的 outbound 和 inbound 用 serviceToken

**文件**：`packages/trix-openclaw-native/src/plugin/outbound.ts`（或 `plugin.ts` 里的 outbound）

把所有使用 `x-trix-admin-token` 的地方改为：

```typescript
headers: {
  'content-type': 'application/json',
  'authorization': `Bearer ${account.serviceToken || account.adminToken}`,
},
```

**文件**：`packages/trix-openclaw-native/src/plugin/inbound.ts`

把 WS URL 的 token 参数改为：

```typescript
const wsUrl = `${wsBase}/ws`
  + `?role=agent`
  + `&accountId=${encodeURIComponent(account.accountId)}`
  + `&serviceToken=${encodeURIComponent(account.serviceToken || account.adminToken || '')}`;
```

---

## Phase 3：修复前端消息气泡方向

### 3.1 找到并修复 sender 判断逻辑

**文件**：`src/services/TrixNativeChannelClient.ts`

搜索 `sender` 相关的映射逻辑，找到如下代码：

```typescript
// ❌ 错误（当前可能是这样的）
sender: direction === 'outbound' ? 'user' : 'bot'

// ✅ 正确
sender: direction === 'inbound' ? 'user' : 'bot'
```

逻辑说明：
- `inbound` = 用户发给 Agent = 右侧气泡（自己）
- `outbound` = Agent 回复给用户 = 左侧气泡（对方）

### 3.2 检查 direction 字段是否正确传递

在同一文件里找到发送消息的代码，确认：

```typescript
// 用户发消息时，direction 必须是 'inbound'
body: JSON.stringify({
  conversationId: session.conversationId,
  clientToken: session.clientToken,
  direction: 'inbound',   // ← 必须是 inbound，不是 outbound
  senderId: session.clientId,
  text: params.text,
})
```

### 3.3 检查运算符优先级 bug

在同一文件里搜索包含 `direction` 的三元表达式，检查是否有括号缺失：

```typescript
// ❌ 有 bug（运算符优先级问题）
const direction = rawMessage.direction || rawMessage.from === 'agent' ? 'outbound' : 'inbound';

// ✅ 修复（加括号）
const direction = rawMessage.direction || (rawMessage.from === 'agent' ? 'outbound' : 'inbound');
```

### 3.4 前端构建部署

```bash
# 本地构建
npm run build

# 部署到服务器
scp -P 22222 -r dist/* root@TRIX_SERVER_HOST:/var/www/html/
```

---

## Phase 4：服务器稳定性

### 4.1 防止端口冲突（EADDRINUSE）

服务器上检查并修复：

```bash
ssh -p 22222 root@TRIX_SERVER_HOST "
  # 查看所有运行中的相关进程
  pm2 status
  
  # 删除重复的进程，只保留一个
  pm2 delete all
  pm2 start index.js --name trix-native-server
  pm2 save
"
```

### 4.2 PM2 配置防止重启风暴

```bash
ssh -p 22222 root@TRIX_SERVER_HOST "
cat > /root/trix-native-server/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'trix-native-server',
    script: 'index.js',
    max_restarts: 5,
    restart_delay: 5000,
    watch: false
  }]
};
EOF
pm2 restart ecosystem.config.js
pm2 save
"
```

---

## Phase 5：端到端验证

按顺序执行以下验证：

```bash
# 1. Gateway 状态
openclaw gateway status
# 期望：RPC probe: ok

# 2. Channel 状态（最关键）
openclaw channels status
# 期望：TRIX Native default (TRIX Native): enabled, configured, running

# 3. 日志检查（只应出现一次 connected，无 auto-restart）
openclaw logs --limit 30 | grep trix
# 期望：[trix-native] WS connected (default)
# 不应有：auto-restart attempt / closed unexpectedly（循环出现）

# 4. 服务器稳定性
ssh -p 22222 root@TRIX_SERVER_HOST "pm2 status"
# 期望：status=online，restarts < 3
```

### 手机测试验证

```bash
# 5. 重新配对（如果之前配对失效）
openclaw trix setup
# 立刻用手机扫码，不要等待

# 6. 发消息测试
# 手机发 "hello" → 等 Agent 回复
# 手机发一张图片 → 确认图片显示正常
# 确认气泡方向：自己发的在右，Bot 回复在左
```

---

## 常见问题处理

### 问题：Gateway 启动超时

```bash
# 前台运行查看完整日志
openclaw gateway run 2>&1 | head -50
```

找到报错原因，通常是：
- Plugin 代码有语法错误（TypeScript 编译失败）
- 配置文件有 `unknown channel id` 错误（检查 openclaw.plugin.json 的 channels 字段）

### 问题：Channel 还是 configured 不是 running

说明 Phase 1.1 没有生效，检查：

```bash
# 确认插件文件是否更新
ls -la C:/Users/wang/.openclaw/extensions/openclaw-native-channel/src/plugin/plugin.ts

# 确认是否重新安装了插件
openclaw plugins install E:/desktop/trix-3d-companion/packages/trix-openclaw-native

# 重启 Gateway
openclaw gateway restart
```

### 问题：WebSocket 一直 code=4000 断开

说明服务器不认识 serviceToken 或不支持 `role=agent`。检查：

```bash
ssh -p 22222 root@TRIX_SERVER_HOST "
  # 查看服务器日志
  pm2 logs trix-native-server --lines 20 --nostream
  
  # 搜索服务器是否处理 role=agent
  grep -n 'role.*agent\|agent.*role' /root/trix-native-server/index.js
"
```

### 问题：消息气泡方向还是反的

说明前端没有重新构建或部署。确认：

```bash
# 1. 重新构建
npm run build

# 2. 检查构建产物时间戳
ls -la dist/assets/js/

# 3. 重新部署到服务器
scp -P 22222 -r dist/* root@TRIX_SERVER_HOST:/var/www/html/

# 4. 手机清除浏览器缓存后重新访问
```

---

## 完成后提交代码

```bash
cd E:/desktop/trix-3d-companion

git add packages/trix-openclaw-native/src/plugin/
git add packages/trix-openclaw-native/openclaw.plugin.json
git add packages/trix-openclaw-native/package.json
git add src/services/TrixNativeChannelClient.ts

git commit -m "fix: openclaw channel plugin - startAccount lifecycle, service plane, bubble direction"

git push
```