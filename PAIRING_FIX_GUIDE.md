# 🚀 服务器配对功能修复指南

## 📋 修复内容

### ✅ 已完成
1. **服务器代码修复** - `server/clawbot-channel/server.js:304`
   - 添加 `pairingCode`、`pairingToken`、`pairingId`、`expiresAt` 到返回值
2. **Skill 代码修复** - `openclaw-skills/pairing/index.js`
   - 使用 Socket.IO 连接服务器
   - 正确处理服务器返回的配对信息
3. **依赖安装** - `socket.io-client` 已安装
4. **更新脚本** - 创建了自动化更新脚本

### 📝 待执行
- 上传修复后的代码到服务器
- 重启服务器服务
- 测试配对功能

## 🔧 执行步骤

### 方法 1: 自动化脚本（推荐）

**Windows:**
```bash
# 双击运行或在命令行执行
update-server-pairing.bat
```

**Linux/Mac:**
```bash
chmod +x update-server-pairing.sh
./update-server-pairing.sh
```

### 方法 2: 手动更新

#### 1. 连接服务器
```bash
ssh root@47.243.55.130
# 密码会提供给你
```

#### 2. 备份原文件
```bash
cd /opt/clawbot-channel
cp server.js server.js.backup
```

#### 3. 编辑代码
```bash
nano server.js
```

**找到第 304 行，修改：**
```javascript
// 修改前
callback({ success: true, restored: false });

// 修改后
callback({
  success: true,
  restored: false,
  pairingCode: pairing.pairingCode,
  pairingToken: pairing.pairingToken,
  pairingId: pairing.id,
  expiresAt: pairing.expiresAt
});
```

#### 4. 重启服务
```bash
pm2 restart clawbot-channel
```

#### 5. 查看日志
```bash
pm2 logs clawbot-channel --lines 20
```

## 🧪 测试步骤

### 1. 测试服务器 API
```bash
cd openclaw-skills/pairing
node test-pairing.js
```

**预期输出:**
```json
{
  "success": true,
  "restored": false,
  "pairingCode": "ABC123",
  "pairingToken": "uuid-xxx",
  "pairingId": "uuid-xxx",
  "expiresAt": "2026-02-20T..."
}
```

### 2. 完整配对流程

1. **在 OpenClaw 中**：`"生成配对码"`
2. **查看输出**：
   ```
   ✅ 配对码已生成！
   📱 配对码：ABC123
   ⏰ 有效期：5分0秒
   ```
3. **在手机 App 中**：输入配对码 `ABC123`
4. **验证**：App 显示"等待设备确认" → 配对成功

## 🌐 服务器信息

- **IP**: 47.243.55.130
- **端口**: 8765
- **用户**: root（或 ubuntu）
- **路径**: /opt/clawbot-channel
- **进程**: clawbot-channel (PM2)

## ⚠️ 注意事项

1. **密码安全**: SSH 密码不会被脚本保存，需要每次输入
2. **备份**: 更新前会自动备份原文件
3. **回滚**: 如有问题，可以使用备份恢复
   ```bash
   ssh root@47.243.55.130
   cd /opt/clawbot-channel
   cp server.js.backup server.js
   pm2 restart clawbot-channel
   ```

## 📊 修复前后对比

### 修复前
```json
// 服务器返回
{ "success": true, "restored": false }

// Skill 期望
pairingCode: undefined ❌
pairingToken: undefined ❌
```

### 修复后
```json
// 服务器返回
{
  "success": true,
  "restored": false,
  "pairingCode": "ABC123",
  "pairingToken": "uuid",
  "pairingId": "uuid",
  "expiresAt": "2026-02-20T..."
}

// Skill 处理
pairingCode: "ABC123" ✅
pairingToken: "uuid" ✅
```

## 🔍 故障排查

### 问题 1: SSH 连接失败
```bash
# 检查网络
ping 47.243.55.130

# 检查 SSH 服务
telnet 47.243.55.130 22
```

### 问题 2: 配对码仍然无效
```bash
# 检查服务器日志
ssh root@47.243.55.130
pm2 logs clawbot-channel --lines 50

# 检查数据库
sqlite3 /opt/clawbot-channel/data/clawbot.db
SELECT * FROM pairings WHERE status='pending';
```

### 问题 3: PM2 进程未运行
```bash
ssh root@47.243.55.130
pm2 status
pm2 start /opt/clawbot-channel/ecosystem.config.js
```

## 📞 联系方式

如有问题，请提供：
- 服务器日志输出
- test-pairing.js 的输出
- 具体错误信息
