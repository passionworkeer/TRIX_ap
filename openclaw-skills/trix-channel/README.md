# @openclaw/trix-channel

> TRIX App Channel for OpenClaw - 连接手机 App 到 OpenClaw Gateway

## 功能

- ✅ 直连 OpenClaw Gateway
- ✅ 实时消息转发
- ✅ 配对码生成
- ✅ 自动重连
- ✅ 多模态支持

## 安装

```bash
# 全局安装（发布到 npm 后）
npm install -g @openclaw/trix-channel

# 本地仓库测试安装（当前可直接这样验证）
npm install -g ./openclaw-skills/trix-channel
```

## 使用

### 前置条件

1. 安装并运行 OpenClaw:
   ```bash
   openclaw gateway
   ```

2. 确保 Gateway 已配置 Token

### 启动

```bash
# 常驻启动
trix-channel

# 等价别名
trix-channel start
trix-channel run
```

启动后会自动：

- 连接本地 OpenClaw Gateway
- 向 `clawbot-channel` 注册设备
- 打印 6 位配对码
- 打印可供手机扫描的终端二维码

手机端可以：

- 扫描终端二维码完成 `pair_with_token`
- 或手动输入 6 位配对码完成 `pair_with_code`

### 生成配对信息

```bash
# 生成 fresh 配对并常驻等待手机连接
trix-channel pair

# 只输出 6 位配对码，适合手输
trix-channel pair --code-only

# 输出 JSON，适合脚本集成
trix-channel pair --json
```

### 查看状态

```bash
trix-channel status
trix-channel status --json
trix-channel --version
```

## GitHub

https://github.com/passionworkeer/trix-channel

## 许可证

MIT
