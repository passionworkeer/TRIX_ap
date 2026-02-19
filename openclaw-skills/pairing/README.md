# OpenClaw Pairing Skill

生成配对码和二维码，用于手机App配对连接。

## 功能

- ✅ 生成6位配对码
- ✅ 生成二维码Token
- ✅ 5分钟有效期
- ✅ 简单易用的对话式交互

## 安装

### 方式1：手动安装

```bash
cd C:\Users\wang\.openclaw\skills
git clone https://github.com/your-repo/pairing.git
cd pairing
npm install
```

### 方式2：OpenClaw命令安装

在OpenClaw对话中输入：
```
安装skill pairing
```

## 使用

### 对话方式

直接在OpenClaw对话界面输入：

```
你：生成配对码
OpenClaw：✅ 配对码已生成！
📱 配对码：ABC123
⏰ 有效期：5分0秒
...
```

### 支持的触发词

- "生成配对码"
- "给我配对码"
- "配对码"
- "pairing code"
- "生成二维码"
- "qr code"
- "扫码配对"
- "我要配对"

## 配对流程

1. **在OpenClaw中输入**：`生成配对码`
2. **获得配对码**：例如 `ABC123`
3. **打开手机App**：访问 `http://47.243.55.130`
4. **输入配对码**：`ABC123`
5. **配对成功**：开始聊天

## 示例对话

```
你：生成配对码

OpenClaw：
✅ 配对码已生成！

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 配对码：EXCJ76
⏰ 有效期：5分0秒
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

使用方法：
1. 打开手机App
2. 进入配对页面
3. 输入配对码：EXCJ76
4. 点击确认配对

配对成功后即可开始聊天！
```

```
你：生成二维码

OpenClaw：
✅ 二维码已生成！

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔑 Token：a1b2c3d4e5f6...
⏰ 有效期：5分0秒
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

使用方法：
1. 打开手机App
2. 进入配对页面
3. 扫描二维码

或者访问以下地址查看二维码：
https://api.qrserver.com/v1/create-qr-code/?...

配对成功后即可开始聊天！
```

## 配置

### 默认配置

```javascript
{
  expiresIn: 300,    // 配对码有效期（秒）- 默认5分钟
  codeLength: 6,     // 配对码长度 - 默认6位
  codeChars: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 字符集（排除易混淆字符）
}
```

### 自定义配置

编辑 `index.js` 中的 `options`：

```javascript
options: {
  expiresIn: 600,    // 10分钟
  codeLength: 8,     // 8位配对码
}
```

## 技术细节

### 配对码生成

- 使用加密安全的随机数生成器
- 排除易混淆字符（如：0/O, 1/I/l）
- 内存存储（实际应用建议使用Redis）

### 过期处理

- 自动清理过期配对码
- 每次执行时清理
- 5分钟有效期

## 故障排查

### 问题1：Skill无法加载

**解决方案**：
```bash
# 检查skill是否在正确目录
ls C:\Users\wang\.openclaw\skills\pairing

# 检查依赖是否安装
cd C:\Users\wang\.openclaw\skills\pairing
npm install

# 重启OpenClaw
```

### 问题2：配对码无效

**原因**：配对码已过期

**解决方案**：重新生成配对码

### 问题3：App无法连接

**检查**：
1. 本地Bridge是否运行
2. 云端Relay Server是否运行
3. 网络连接是否正常

## 开发

### 本地测试

```bash
cd C:\Users\wang\.openclaw\skills\pairing
node test.js
```

### 调试

在OpenClaw对话中输入：
```
debug skill pairing
```

## 更新日志

### v1.0.0 (2026-02-19)
- ✅ 初始版本
- ✅ 支持配对码生成
- ✅ 支持二维码生成
- ✅ 对话式交互

## 许可证

MIT

## 作者

TRIX Team

## 支持

如有问题，请查看：
- OpenClaw文档
- 项目GitHub仓库
- 技术支持频道
