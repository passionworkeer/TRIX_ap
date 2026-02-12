# 📱 TRIX 3D - Clawbot 扫码配对功能实现指南

## 🎯 功能概述

实现手机 App (TRIX 3D) 与电脑端 Clawbot Gateway 的扫码配对功能。

---

## 📋 实现清单

### ✅ 已完成的工作

1. **修复 ClawbotPairingService**
   - ✅ 去除 React Native 依赖
   - ✅ 改用 Web API (localStorage, navigator)
   - ✅ 支持生成配对请求
   - ✅ 支持轮询配对状态
   - ✅ 支持取消配对

2. **创建 QRCodePairingContext**
   - ✅ 提供全局配对状态管理
   - ✅ startPairing() - 开始配对
   - ✅ cancelPairing() - 取消配对
   - ✅ resetPairing() - 重置状态

3. **创建 QRCodePairing 页面**
   - ✅ UI 界面（手动输入配对码）
   - ✅ 实时状态显示
   - ✅ 配对成功后自动跳转

4. **更新路由**
   - ✅ 添加 `/qr-pairing` 路由
   - ✅ 集成到 App.tsx

5. **更新环境变量**
   - ✅ 添加 `VITE_CLAWBOT_GATEWAY_URL`
   - ✅ 添加 `VITE_CLAWBOT_GATEWAY_TOKEN`

6. **创建数据库表**
   - ✅ `database/add-pairing-requests-table.sql`

---

## 🚀 配对流程

```
┌─────────────────────┐                    ┌─────────────────────┐
│  电脑端 (Gateway)   │                    │  手机端 (TRIX App)  │
└─────────────────────┘                    └─────────────────────┘
         │                                           │
         │  1. 启动 Gateway                         │
         │  2. 进入配对模式                         │
         │  3. 生成二维码 + 配对码                  │
         │     [QR Code]                             │
         │                                           │
         │                    ←───────────────────── │  4. 打开配对页面
         │                                           │  5. 扫描二维码
         │                                           │     或手动输入配对码
         │                                           │
         │                    ←───────────────────── │  6. 发送配对请求
         │                                           │     (存入 Supabase)
         │  7. 收到配对请求                         │
         │  8. 显示审批界面                         │
         │     [允许] [拒绝]                         │
         │                                           │
         │  9. 点击 [允许]                          │
         │  10. 生成 device_token                    │
         │  11. 写入 Supabase                        │
         │                                           │
         │                    ────────────────────→  │  12. 轮询检测到审批
         │                                           │  13. 获得 device_token
         │                                           │  14. 保存 token
         │                                           │  15. 建立 WebSocket
         │                                           │  16. ✅ 配对成功!
         │  ←─────────────────────────────────────→  │
         │        WebSocket 连接已建立               │
         └───────────────────────────────────────────┘
```

---

## 🔧 需要你配置的部分

### 1. Clawbot Gateway 配置

在电脑上创建 `~/.openclaw/openclaw.json`:

```json
{
  "gateway": {
    "mode": "local",
    "port": 18789,
    "bind": "0.0.0.0",
    "auth": {
      "mode": "token",
      "token": "8743d26357758f202c9bb5a21db706185d66f9c98f9c3ff1"
    }
  },
  "channels": {
    "webchat": {
      "enabled": true,
      "pairing": {
        "enabled": true,
        "approvalMode": "manual",
        "qrCodeEnabled": true,
        "supabaseUrl": "https://hmbukjvrbyhbuqumqdug.supabase.co",
        "supabaseKey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
      }
    }
  }
}
```

**关键配置项说明：**
- `bind: "0.0.0.0"` - 允许局域网访问
- `approvalMode: "manual"` - 手动审批（更安全）
- `qrCodeEnabled: true` - 启用二维码生成
- `supabaseUrl` - Supabase 项目 URL
- `supabaseKey` - Supabase Anon Key

### 2. Supabase 数据库配置

在 Supabase Dashboard 执行 SQL:

```bash
# 进入 Supabase Dashboard
https://supabase.com/dashboard/project/hmbukjvrbyhbuqumqdug

# SQL Editor → New Query → 粘贴并执行
database/add-pairing-requests-table.sql
```

### 3. 启动 Gateway

```bash
# macOS/Linux
openclaw gateway

# 或后台运行
nohup openclaw gateway &

# 查看日志
tail -f ~/.openclaw/gateway.log

# 验证运行
curl http://127.0.0.1:18789/health
```

### 4. 获取局域网 IP

**macOS:**
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

**Windows:**
```powershell
ipconfig | findstr "IPv4"
```

**Linux:**
```bash
hostname -I
```

示例输出: `192.168.1.100`

### 5. 更新 .env 文件

修改手机 App 的 `.env` 文件:

```bash
# 将这里的 IP 改成你的电脑局域网 IP
VITE_CLAWBOT_GATEWAY_URL=ws://192.168.1.100:18789
VITE_CLAWBOT_GATEWAY_TOKEN=8743d26357758f202c9bb5a21db706185d66f9c98f9c3ff1
```

---

## 📱 使用流程

### 手机端操作

1. 打开 TRIX App
2. 进入"设置" → "Clawbot 配对"（或直接访问 `/qr-pairing`）
3. 输入设备名称（可选）
4. 两种方式配对：
   - **方式 A：扫描二维码**（推荐）
     - 点击"开始配对"
     - 使用相机扫描电脑屏幕上的二维码
   - **方式 B：手动输入**
     - 点击"手动输入配对码"
     - 从电脑端复制 JSON 配对码
     - 粘贴到输入框
     - 点击"使用配对码连接"

5. 等待电脑端审批（最多 6 分钟）
6. 配对成功！自动跳转到首页

### 电脑端操作 (Gateway)

Gateway 会自动：
1. 监听 Supabase 的 `pairing_requests` 表
2. 发现新请求时显示审批界面
3. 显示二维码和配对码
4. 等待用户点击 [允许] 或 [拒绝]
5. 审批通过后生成 `device_token` 并写入数据库

---

## 🔍 调试与测试

### 1. 检查 Gateway 是否运行

```bash
curl http://192.168.1.100:18789/health

# 预期输出
{"status":"ok","version":"1.0.0"}
```

### 2. 检查数据库表

在 Supabase Dashboard → Table Editor:

```sql
SELECT * FROM pairing_requests ORDER BY created_at DESC LIMIT 10;
```

### 3. 手动测试配对请求

```sql
-- 插入测试请求
INSERT INTO pairing_requests (id, device_id, device_name, device_type, status)
VALUES ('test-123', 'test-device', 'Test Phone', 'mobile', 'pending');

-- 模拟审批通过
UPDATE pairing_requests
SET status = 'approved', device_token = 'test-token-abc123'
WHERE id = 'test-123';
```

### 4. 查看 App 日志

在浏览器开发者工具 → Console:

```
[ClawbotPairing] 初始化
[ClawbotPairing] 配对请求已生成: trix-1676543210-abc123
[ClawbotPairing] 开始轮询配对状态
[ClawbotPairing] 轮询第 1 次，状态: pending
...
[ClawbotPairing] ✅ 配对成功！Token 已保存
```

---

## 🐛 常见问题

### 1. **配对一直显示"等待审批"**

**原因:** Gateway 未运行或未监听 Supabase

**解决:**
```bash
# 检查 Gateway 是否运行
ps aux | grep openclaw

# 查看 Gateway 日志
tail -f ~/.openclaw/gateway.log

# 重启 Gateway
pkill openclaw
openclaw gateway
```

### 2. **手机无法连接到 Gateway**

**原因:** IP 地址错误或防火墙阻止

**解决:**
```bash
# 确认电脑 IP
ifconfig | grep "inet "

# 在手机浏览器访问测试
http://192.168.1.100:18789/health

# 开放端口（macOS/Linux）
sudo ufw allow 18789/tcp

# 或关闭防火墙（不推荐）
sudo ufw disable
```

### 3. **配对超时**

**原因:** 轮询次数达到上限（默认 180 次 = 6 分钟）

**解决:**
- 提示用户更快审批
- 或修改 `clawbotPairingService.ts` 中的 `maxAttempts` 参数

### 4. **二维码无法扫描**

**原因:** App 未实现相机扫描功能

**解决:**
- 使用"手动输入配对码"功能
- 或集成第三方扫码库（如 `html5-qrcode`）

---

## 🎨 下一步优化

- [ ] 集成相机扫码功能
- [ ] 添加配对历史记录
- [ ] 支持多设备配对
- [ ] 配对码过期提醒
- [ ] 自动重连机制

---

## 📞 获取帮助

- GitHub Issues: [https://github.com/meowdoone/TRIX_ap/issues](https://github.com/meowdoone/TRIX_ap/issues)
- Clawbot 文档: `docs/CLAWBOT_*.md`

---

**✅ 所有代码已实现完毕！现在你可以配置 Clawbot Gateway 并开始测试了。**
