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
# 直接运行（推荐）
npx git+https://github.com/passionworkeer/trix-channel.git

# 或克隆后运行
git clone https://github.com/passionworkeer/trix-channel.git
cd trix-channel
npm install
node index.js
```

## 使用

### 前置条件

1. 安装并运行 OpenClaw:
   ```bash
   openclaw-cn gateway
   ```

2. 确保 Gateway 已配置 Token

### 启动

```bash
# 默认配置
node index.js

# 或使用 CLI
npx trix-channel
```

## GitHub

https://github.com/passionworkeer/trix-channel

## 许可证

MIT
