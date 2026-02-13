# 📱 TRIX 3D - Clawbot 扫码配对完整指南

## ✅ 已完成的功能

### 1. **相机扫码组件** (`src/components/QRScanner.tsx`)
- ✅ 使用 `html5-qrcode` 库实现
- ✅ 支持自动对焦和连续扫描
- ✅ 精美的扫描界面和动画效果
- ✅ 相机权限检测和错误提示
- ✅ 扫描成功后自动关闭

### 2. **配对页面增强** (`src/screens/QRCodePairing.tsx`)
- ✅ 集成相机扫描功能
- ✅ 支持两种配对方式：
  - 📷 扫描二维码（推荐）
  - ⌨️ 手动输入配对码
- ✅ 实时显示配对状态
- ✅ 配对成功自动保存 token

### 3. **聊天界面集成** (`src/screens/Chat.tsx`)
- ✅ Clawbot 机器人显示在列表最顶部
- ✅ 实时显示连接状态：
  - 🟢 **已连接** - 绿色圆点 + "AI 助手已就绪"
  - 🔴 **未连接** - 灰色圆点 + "点击扫码配对"
- ✅ 点击行为：
  - 未连接 → 跳转到扫码配对页面
  - 已连接 → 进入聊天界面

---

## 🎯 使用流程

### 第一步：电脑端启动 Clawbot Gateway

```bash
# 1. 安装 OpenClaw (macOS)
brew install openclaw

# 2. 创建配置文件 ~/.openclaw/openclaw.json
{
  "gateway": {
    "mode": "local",
    "port": 18789,
    "bind": "0.0.0.0",
    "auth": {
      "mode": "token",
      "token": "REDACTED_CLAWBOT_GATEWAY_TOKEN"
    }
  },
  "channels": {
    "webchat": {
      "enabled": true,
      "pairing": {
        "enabled": true,
        "approvalMode": "manual",
        "qrCodeEnabled": true,
        "supabaseUrl": "https://__SUPABASE_PROJECT_REF_REDACTED__.supabase.co",
        "supabaseKey": "你的 Supabase Anon Key"
      }
    }
  }
}

# 3. 启动 Gateway
openclaw gateway

# 4. 进入配对模式（Gateway 会生成二维码）
# 在 Gateway 界面点击 "Pairing Mode" 或使用命令
openclaw pair
```

---

### 第二步：手机端扫码配对

#### 方式 A：从聊天界面配对（推荐）

1. **打开 TRIX App**
2. **进入"Chat"标签页**
3. **找到顶部的 Clawbot 机器人**
   - 显示状态："未连接"（橙色标签）
   - 右侧图标：扫描图标
4. **点击 Clawbot**
   - 自动跳转到配对页面
5. **点击"扫描二维码配对"按钮**
   - 允许相机权限
   - 将手机对准电脑屏幕上的二维码
6. **扫描成功！**
   - 自动开始配对流程
   - 等待电脑端审批（最多 6 分钟）
7. **电脑端点击"允许"**
8. **配对完成！**
   - 手机显示"配对成功"
   - 自动跳转到首页
   - 返回 Chat 页面，Clawbot 显示"已连接"

#### 方式 B：手动输入配对码

如果相机不可用或扫描失败：

1. 在配对页面点击"手动输入配对码"
2. 从电脑端复制 JSON 格式的配对码
3. 粘贴到输入框
4. 点击"使用配对码连接"

---

## 🎨 界面截图说明

### Chat 页面 - Clawbot 未连接

```
┌────────────────────────────────┐
│         Chat                   │
│  ┌──────────────────────────┐  │
│  │ 🔍 搜索                  │  │
│  └──────────────────────────┘  │
│                                │
│  ┌──────────────────────────┐  │
│  │ 🧙 Clawbot [未连接]     📷│  │  ← 点击跳转到配对
│  │    🔴 点击扫码配对        │  │
│  └──────────────────────────┘  │
│  ────────── Friends ──────────  │
│  │ 👤 Alice                 💬│  │
│  │ 👤 Bob                   📸│  │
└────────────────────────────────┘
```

### Chat 页面 - Clawbot 已连接

```
┌────────────────────────────────┐
│         Chat                   │
│  ┌──────────────────────────┐  │
│  │ 🔍 搜索                  │  │
│  └──────────────────────────┘  │
│                                │
│  ┌──────────────────────────┐  │
│  │ 🧙 Clawbot              📷│  │  ← 点击进入聊天
│  │    🟢 AI 助手已就绪      │  │
│  └──────────────────────────┘  │
│  ────────── Friends ──────────  │
│  │ 👤 Alice                 💬│  │
│  │ 👤 Bob                   📸│  │
└────────────────────────────────┘
```

### 扫码配对页面

```
┌────────────────────────────────┐
│  ← Clawbot 配对               │
├────────────────────────────────┤
│                                │
│        📡                      │
│    连接到 Clawbot              │
│  扫描二维码或手动输入配对码    │
│                                │
│  ┌──────────────────────────┐  │
│  │ 设备名称（可选）          │  │
│  │ [TRIX-Windows]            │  │
│  └──────────────────────────┘  │
│                                │
│  ┌──────────────────────────┐  │
│  │  📷 扫描二维码配对       │  │ ← 点击打开相机
│  └──────────────────────────┘  │
│                                │
│      手动输入配对码 ▼          │
│                                │
└────────────────────────────────┘
```

### 相机扫描界面

```
┌────────────────────────────────┐
│  📷 扫描二维码            ✕   │
├────────────────────────────────┤
│                                │
│   ┌────────────────────┐      │
│   │                    │      │
│   │   [相机画面]       │      │
│   │                    │      │
│   │   ┌──────────┐     │      │
│   │   │          │     │      │
│   │   │   扫描框 │     │      │
│   │   │          │     │      │
│   │   └──────────┘     │      │
│   │                    │      │
│   └────────────────────┘      │
│                                │
│  将二维码对准扫描框            │
│  保持距离适中，确保二维码清晰  │
│                                │
└────────────────────────────────┘
```

---

## 📝 技术实现细节

### 扫描器配置

```typescript
// QRScanner.tsx
const scanner = new Html5Qrcode('qr-reader');

await scanner.start(
  { facingMode: 'environment' }, // 后置摄像头
  {
    fps: 10, // 每秒扫描 10 帧
    qrbox: { width: 250, height: 250 }, // 扫描框大小
  },
  onScanSuccess, // 扫描成功回调
  onScanError    // 扫描失败回调（可忽略）
);
```

### 连接状态管理

```typescript
// Chat.tsx
const [isClawbotConnected, setIsClawbotConnected] = useState(false);

useEffect(() => {
  const token = localStorage.getItem('clawbot_device_token');
  setIsClawbotConnected(!!token);
}, []);
```

### 扫描成功处理

```typescript
// QRCodePairing.tsx
const handleScanSuccess = async (decodedText: string) => {
  // 1. 解析二维码内容
  const qrData = JSON.parse(decodedText);
  
  // 2. 保存配对信息
  localStorage.setItem('clawbot_gateway_url', qrData.gatewayUrl);
  localStorage.setItem('clawbot_pairing_token', qrData.pairingToken);
  
  // 3. 开始配对流程
  await startPairing(deviceName);
};
```

---

## 🔧 电脑端 Gateway 需要返回的二维码格式

```json
{
  "gatewayUrl": "ws://192.168.1.100:18789",
  "pairingToken": "REDACTED_CLAWBOT_GATEWAY_TOKEN",
  "requestId": "trix-1676543210-abc123",
  "expiresAt": "2026-02-12T12:00:00Z"
}
```

---

## 🐛 常见问题

### 1. **相机无法启动**

**问题:** 点击"扫描二维码配对"后显示"相机权限被拒绝"

**解决:**
1. 点击浏览器地址栏的锁图标
2. 找到"相机"权限
3. 选择"允许"
4. 刷新页面重试

**Chrome:**
```
chrome://settings/content/camera
```

**Safari (iOS):**
```
设置 → Safari → 相机 → 允许
```

### 2. **扫描不出二维码**

**问题:** 相机正常打开，但扫描不出二维码

**解决:**
1. 确保电脑屏幕亮度足够
2. 保持距离适中（15-30cm）
3. 避免反光和抖动
4. 尝试调整角度
5. 如果还是不行，使用"手动输入配对码"

### 3. **配对超时**

**问题:** 显示"等待电脑端审批..."超过 6 分钟

**解决:**
1. 检查电脑端 Gateway 是否正常运行
2. 检查 Supabase 数据库连接
3. 查看电脑端是否弹出审批界面
4. 重新扫码配对

### 4. **Clawbot 显示未连接，但之前配对过**

**问题:** token 丢失或过期

**解决:**
```javascript
// 清除旧 token，重新配对
localStorage.removeItem('clawbot_device_token');
localStorage.removeItem('clawbot_gateway_url');
localStorage.removeItem('clawbot_pairing_token');

// 重新扫码配对
```

---

## 📊 配对流程时序图

```
手机端                   Supabase               电脑端 Gateway
  │                         │                         │
  │  1. 点击"扫码配对"     │                         │
  │─────────────────────────>│                         │
  │                         │                         │
  │  2. 扫描二维码          │                         │
  │  (获取 gatewayUrl 等)  │                         │
  │                         │                         │
  │  3. 插入配对请求        │                         │
  │─────────────────────────>│                         │
  │     INSERT pairing_     │                         │
  │     requests (pending)  │                         │
  │                         │                         │
  │                         │  4. 轮询检测新请求      │
  │                         │<────────────────────────│
  │                         │    SELECT * WHERE       │
  │                         │    status='pending'     │
  │                         │                         │
  │                         │  5. 显示审批界面        │
  │                         │    [允许] [拒绝]        │
  │                         │                         │
  │                         │  6. 用户点击[允许]      │
  │                         │                         │
  │                         │  7. 更新状态+生成token  │
  │                         │<────────────────────────│
  │                         │    UPDATE pairing_      │
  │                         │    SET status='approved'│
  │                         │    device_token='xxx'   │
  │                         │                         │
  │  8. 轮询检测到审批      │                         │
  │<─────────────────────────│                         │
  │    SELECT * WHERE       │                         │
  │    status='approved'    │                         │
  │                         │                         │
  │  9. 保存 token          │                         │
  │  localStorage.setItem() │                         │
  │                         │                         │
  │  10. 显示"配对成功"     │                         │
  │  跳转到首页             │                         │
  │                         │                         │
  │  11. 建立 WebSocket 连接│                         │
  │─────────────────────────┼────────────────────────>│
  │    ws://...?token=xxx   │                         │
  │                         │                         │
  │  ✅ 配对完成！          │                         │
  └─────────────────────────┴─────────────────────────┘
```

---

## 🎉 下一步

现在你可以：

1. **配置电脑端 Gateway**
   - 安装 OpenClaw
   - 创建配置文件
   - 启动 Gateway

2. **配置 Supabase**
   - 执行 `database/add-pairing-requests-table.sql`

3. **测试配对**
   - 打开 TRIX App
   - 进入 Chat 页面
   - 点击 Clawbot
   - 扫码配对！

---

**完成！享受 AI 助手吧！** 🎊
