# OpenClaw 子代理消息过滤配置说明

## ✅ 已完成的修改

我已经修改了 OpenClaw 的配置文件，添加了子代理消息过滤功能。

### 修改的文件
- **配置文件**: `C:\Users\wang\.openclaw\openclaw.json`
- **备份文件**: `C:\Users\wang\.openclaw\openclaw.json.bak.before-subagent-fix`

### 添加的配置

#### 1. 在 `agents.defaults.subagents` 中添加了消息路由配置：

```json
"subagents": {
  "maxConcurrent": 8,
  "messageRouting": {
    "hideSubagentMessages": true,
    "hideInternalMessages": true,
    "showOnlyFinalResults": true
  }
}
```

#### 2. 在 `gateway` 中添加了消息过滤器配置：

```json
"gateway": {
  "port": 18789,
  "mode": "local",
  "auth": {
    "mode": "token",
    "token": "__GATEWAY_AUTH_TOKEN_REDACTED__"
  },
  "messageFilter": {
    "enabled": true,
    "hideSubagentMessages": true,
    "hideInternalMessages": true,
    "hideDebugMessages": true,
    "allowedTargets": ["user"]
  }
}
```

## 📋 配置项说明

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `enabled` | 是否启用消息过滤器 | `true` |
| `hideSubagentMessages` | 隐藏子代理消息 | `true` |
| `hideInternalMessages` | 隐藏内部系统消息 | `true` |
| `hideDebugMessages` | 隐藏调试消息 | `true` |
| `allowedTargets` | 允许的消息目标 | `["user"]` |
| `showOnlyFinalResults` | 只显示最终结果 | `true` |

## 🔄 如何使配置生效

### 方法 1：重启 OpenClaw Gateway（推荐）

1. **打开任务管理器** (Ctrl + Shift + Esc)
2. **找到 `node.exe` 进程** (PID: 40244)
3. **结束该进程**
4. **重新启动 OpenClaw Gateway**:
   ```bash
   openclaw gateway start
   ```

### 方法 2：使用命令行重启

```bash
# 停止 Gateway
openclaw gateway stop

# 启动 Gateway
openclaw gateway start
```

### 方法 3：使用 PowerShell（需要管理员权限）

```powershell
# 以管理员身份运行 PowerShell
Stop-Process -Id 40244 -Force
# 然后重新启动 Gateway
```

## ✅ 验证配置是否生效

重启后，你应该看到以下行为：

### ✅ 正确的行为
```
你的窗口应该看到：
┌────────────────────────────────────┐
│ 你: "帮我写个黄金分析报告"         │
│                                    │
│ TRIX: "好的，我让 DOC 来处理"      │  ← 显示主代理回复
│                                    │
│ ... (等待 DOC 工作，不显示内部对话) │
│                                    │
│ TRIX: "报告做好了！[文件路径]"     │  ← 只显示最终结果
└────────────────────────────────────┘
```

### ❌ 不应该看到
- 子代理 DOC 的内部消息
- TRIX 与 DOC 之间的协调对话
- 调试和系统日志

## 🧪 测试步骤

1. **重启 Gateway**
2. **发送一个需要子代理处理的任务**
3. **检查是否只看到主代理的消息**

## 🔧 如果配置不生效

### 可能的原因

1. **OpenClaw 版本不支持这些配置项**
   - 检查版本: `openclaw --version`
   - 如果不支持，需要升级 OpenClaw

2. **配置格式错误**
   - 检查 JSON 格式是否正确
   - 查看 Gateway 日志

3. **需要重新认证**
   - 尝试重新连接 Gateway

### 临时解决方案

如果配置不生效，可以使用应用层过滤：

```typescript
// 在你的应用中设置消息过滤
gatewayAPI.setRoutingConfig({
  showSubagentMessages: false,
  showInternalMessages: false,
  showDebugMessages: false
});
```

## 📞 相关文档

- [OpenClaw 官方文档](https://docs.clawd.bot)
- [OpenClaw 集成方案](../OpenClaw-Integration-Practical-Solution.md)
- [三端接通架构文档](../三端接通架构文档.md)

## 🗑️ 恢复原始配置

如果需要恢复原始配置：

```bash
cp C:\Users\wang\.openclaw\openclaw.json.bak.before-subagent-fix C:\Users\wang\.openclaw\openclaw.json
```

然后重启 Gateway。

---

**配置完成时间**: 2026-02-18
**配置文件位置**: `C:\Users\wang\.openclaw\openclaw.json`
**备份文件位置**: `C:\Users\wang\.openclaw\openclaw.json.bak.before-subagent-fix`
