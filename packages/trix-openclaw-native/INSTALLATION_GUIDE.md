# TRIX Native OpenClaw Channel - 完整安装测试指南

## 1. 当前构建状态

✅ **构建成功** - 所有 TypeScript 文件已编译到 `dist/` 目录

### 输出文件结构
```
dist/
├── openclaw-entry.js      # OpenClaw 插件入口
├── openclaw-entry.d.ts    # 类型定义
├── index.js               # 通用导出
├── index.d.ts             # 类型定义
├── cli.js                 # CLI 工具
├── cli.d.ts
├── types.js / types.d.ts
├── server/                # 服务器相关
├── plugin/                # 插件相关
├── attachments/           # 附件处理
├── pairing/               # 配对服务
├── storage/               # 存储服务
└── utils/                 # 工具函数
```

## 2. 安装步骤

### 步骤 1: 打包插件

在 OpenClaw 机器上执行：

```bash
# 进入项目目录
cd /path/to/trix-3d-companion/packages/trix-openclaw-native

# 构建（已执行）
npm run build

# 创建打包文件
npm pack

# 输出：trix-app-openclaw-native-channel-0.1.0.tgz
```

### 步骤 2: 安装到 OpenClaw

```bash
# 方式1：直接安装打包文件
openclaw plugins install /path/to/trix-app-openclaw-native-channel-0.1.0.tgz

# 方式2：安装目录（开发模式）
openclaw plugins install /path/to/trix-3d-companion/packages/trix-openclaw-native

# 验证安装
openclaw plugins list
```

### 步骤 3: 获取 Admin Token

```bash
# 在服务器状态文件中找到 adminToken
cat packages/trix-openclaw-native/.trix-native-channel/state.json | grep adminToken

# 输出示例：
# "adminToken": "a1b2c3d4e5f6..."
```

### 步骤 4: 配置 OpenClaw

编辑 `~/.openclaw/config.json`：

```json5
{
  // ... 其他配置

  "channels": {
    // 其他 channels ...

    "trixNative": {
      "enabled": true,
      "defaultAccount": "default",
      "accounts": {
        "default": {
          "name": "TRIX Native",
          "serverUrl": "http://TRIX_SERVER_HOST:8788",
          "adminToken": "YOUR_ADMIN_TOKEN_HERE"
        }
      }
    }
  }
}
```

## 3. 创建配对码

### 方式1：使用 CLI

```bash
# 在本地项目目录
npx trix-openclaw-native pairing create \
  --server http://TRIX_SERVER_HOST:8788 \
  --admin-token YOUR_ADMIN_TOKEN \
  --label "My iPhone"

# 输出：
# Pairing code: XXXXXXXX
# Join URL: http://TRIX_SERVER_HOST:8788/claim?code=XXXXXXXX
```

### 方式2：使用 API

```bash
curl -X POST http://TRIX_SERVER_HOST:8788/api/pairings \
  -H "Content-Type: application/json" \
  -H "X-Trix-Admin-Token: YOUR_ADMIN_TOKEN" \
  -d '{"label": "My iPhone"}'

# 返回：
# {
#   "code": "XXXXXXXX",
#   "claimUrl": "http://TRIX_SERVER_HOST:8788/claim?code=XXXXXXXX",
#   ...
# }
```

## 4. 手机端配对

1. 打开 TRIX iOS App 或 Web 前端
2. 进入「设备配对」页面
3. 扫描 QR 码或手动输入配对码 `XXXXXXXX`
4. 配对成功，WebSocket 自动连接

## 5. 测试多模态消息

### 测试文字消息
```
手机发送: "你好，OpenClaw！"
期望: OpenClaw Agent 收到消息并回复
```

### 测试图片消息
```
手机发送: [选择一张照片]
期望:
1. 照片上传到服务器
2. OpenClaw Agent 收到图片 URL
3. Vision 模型分析图片内容
4. 返回分析结果
```

### 测试语音消息
```
手机发送: [录制一段语音]
期望:
1. 语音文件上传到服务器
2. OpenClaw Agent 收到音频
3. Whisper 转文字（如配置了）
4. 返回转文字结果或回复
```

## 6. 故障排查

### 插件无法安装
```bash
# 检查打包文件
npm pack --dry-run

# 检查 OpenClaw 插件目录
openclaw config get root
cd $(openclaw config get root)/plugins
ls -la
```

### 配置不生效
```bash
# 验证配置格式
openclaw config validate

# 查看 channels 配置
openclaw config get channels
```

### 无法连接服务器
```bash
# 测试服务器健康
curl http://TRIX_SERVER_HOST:8788/health

# 查看 OpenClaw 日志
tail -f /tmp/openclaw/openclaw-*.log
```

### 配对码无效
```bash
# 查看服务器配对状态
curl http://TRIX_SERVER_HOST:8788/api/pairings \
  -H "X-Trix-Admin-Token: YOUR_TOKEN"

# 配对码默认 24 小时过期，创建新的
```

## 7. 总结

### 已完成 ✅
1. TypeScript 代码编写完成
2. 构建成功（`npm run build`）
3. `openclaw.plugin.json` 已完善配置

### 需要手动执行 🔧
1. 在 OpenClaw 机器上：
   ```bash
   openclaw plugins install /path/to/trix-openclaw-native
   ```
2. 配置 `~/.openclaw/config.json`
3. 创建配对码
4. 手机配对
5. 测试消息

---

**有问题随时告诉我！**
