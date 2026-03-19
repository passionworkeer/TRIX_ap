# TRIX Native OpenClaw Channel

一个独立的 TRIX 原生 OpenClaw 通道包，目标是把你现在的“桥接式多模态”升级成“正式通道式多模态”：

- 生成 `pairing code` 或 `QR code`
- 配对状态和设备绑定持久化到本地磁盘
- 服务绑定 `0.0.0.0`，支持跨局域网访问
- 所有附件先落盘，再按图片 / 音频 / 视频 / 文件做正式处理
- 对 OpenClaw：图片走原生 `attachments`，非图片走 `MediaPath(s)` 风格上下文
- 对终端用户：OpenClaw 回复的 `mediaUrl(s)` 会重新编码成附件广播给客户端

## 目录

- `src/server`：HTTP + WebSocket pairing / message server
- `src/attachments`：附件持久化、类型识别、OpenClaw staging
- `src/plugin`：OpenClaw channel plugin 适配层
- `src/pairing`：pairing code、QR、设备绑定
- `src/storage`：JSON 状态持久化

## 快速启动

```bash
npm install
npm --workspace packages/trix-openclaw-native run build
node packages/trix-openclaw-native/dist/cli.js server start --host 0.0.0.0 --port 8788
```

创建配对码：

```bash
node packages/trix-openclaw-native/dist/cli.js pairing create --server http://127.0.0.1:8788 --label "My Phone"
```

## 环境变量

- `TRIX_NATIVE_STORAGE_DIR`：数据目录，默认 `./.trix-native-channel`
- `TRIX_NATIVE_PUBLIC_BASE_URL`：生成 QR/配对链接时对外暴露的地址
- `TRIX_NATIVE_ADMIN_TOKEN`：管理口令；未提供时首次启动自动生成并持久化
- `OPENCLAW_PACKAGE_PATH`：当 `openclaw` 没装到本地 `node_modules` 时，指定本机 OpenClaw 安装目录

## OpenClaw 插件使用方式

1. 把这个包编译后通过 `openclaw plugins install` 安装到 OpenClaw。
2. 在 OpenClaw 配置中增加 `channels.trix-native` 账号配置：

```json
{
  "channels": {
    "trix-native": {
      "enabled": true,
      "defaultAccount": "default",
      "dmPolicy": "open",
      "accounts": {
        "default": {
          "name": "TRIX Native",
          "serviceUrl": "http://192.168.1.20:8788",
          "publicBaseUrl": "http://192.168.1.20:8788",
          "serviceToken": "<trix-service-token>",
          "storageDir": ".trix-native-channel/openclaw"
        }
      }
    }
  }
}
```

3. 在 OpenClaw channel setup 中选择 `trix-native`，调用 `loginWithQrStart` 生成 QR，再让手机端使用 `claim` 接口绑定。正式通道只需要 `serviceUrl + serviceToken`；`adminToken` 只保留给服务器运维和 break-glass 场景。

## 当前实现边界

- 这是一个新的独立通道包，不会覆盖你当前 `clawbot-channel` 旧链路。
- 图片输入会优先走 Gateway 原生 `attachments` 风格；插件入站会把所有非图片附件落盘为本地路径并注入 `MediaPath(s)`。
- 如果你后面要把 iOS/Web 真正切到这条通道，只需要把当前前端的消息协议升级成 `attachments[]` 即可。
