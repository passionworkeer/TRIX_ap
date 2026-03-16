# 聊天详情页"取消配对"功能使用指南

## ✅ 已修复的问题

**问题描述**：
- 聊天详情页右上角三个点按钮无法点击
- 用户无法取消与 Clawbot 的配对
- 无法切换到新的 Clawbot 或重新配对

**修复内容**：
1. ✅ 修复按钮点击功能
2. ✅ 添加下拉菜单（包含"取消配对"选项）
3. ✅ 实现取消配对逻辑
4. ✅ 添加 ESC 键关闭菜单
5. ✅ 添加确认对话框和提示信息

---

## 🎯 功能说明

### 菜单位置

**聊天详情页**（`/chat/detail`）右上角的三个点按钮（`⋮`）

### 使用步骤

#### 取消配对流程

1. **打开聊天详情页**
   - 进入与 Clawbot 的聊天界面
   - URL: `http://localhost:5173/#/chat/detail`

2. **点击右上角三个点按钮**
   - 按钮位置：聊天标题右侧
   - 图标：三个竖排的点（`⋮`）

3. **选择"取消配对"**
   - 点击后会弹出确认对话框
   - 对话框内容：
     ```
     确定要取消与 Clawbot 的配对吗？

     取消后需要重新配对才能继续使用。
     ```

4. **确认取消**
   - 点击"确定"：取消配对
   - 点击"取消"：关闭对话框，保持配对

5. **自动导航**
   - 取消配对后自动返回聊天列表页
   - 提示：`配对已取消，您可以重新进入配对页面连接新的 Clawbot`

---

## 🔄 重新配对流程

取消配对后，如何重新配对新的 Clawbot：

### 第一步：Clawbot 发起配对

1. 启动新的 Clawbot
2. Clawbot 连接到服务器：`ws://TRIX_SERVER_HOST:8765`
3. Clawbot 发送 `bot_request_pairing` 请求
4. Clawbot 显示配对码和二维码

### 第二步：App 用户配对

1. 打开 App
2. 进入"我的"页面（Profile）
3. 点击"设备配对"
4. 选择：
   - **扫码配对**：扫描 Clawbot 屏幕上的二维码
   - **输入配对码**：手动输入 6 位配对码

### 第三步：完成配对

1. App 显示"配对码验证成功"
2. Clawbot 收到 `user_paired` 事件
3. Clawbot 确认配对
4. 配对成功，可以开始聊天

---

## 📊 菜单选项说明

### 当已配对时（Clawbot Channel）

```
┌─────────────────────────────┐
│ Clawbot 配对管理            │
├─────────────────────────────┤
│ ✕  取消配对                 │  ← 红色文字
└─────────────────────────────┘
```

**功能**：
- 点击"取消配对"会清理本地配对状态
- 清除 localStorage 中的配对信息
- 返回聊天列表页

### 当未配对时（Clawbot Channel）

```
┌─────────────────────────────┐
│ 当前未配对                  │
│ 请在 Clawbot 端发起配对      │
└─────────────────────────────┘
```

**说明**：
- 显示当前未配对状态
- 提示用户需要在 Clawbot 端发起配对

### 普通聊天（非 Clawbot）

```
┌─────────────────────────────┐
│ 聊天设置                    │
└─────────────────────────────┘
```

**说明**：
- 普通好友聊天暂无特殊设置

---

## ⌨️ 键盘快捷键

- **ESC**：关闭菜单（如果菜单已打开）

---

## 🔧 技术实现细节

### 文件修改

**文件**：[src/screens/ChatDetail.tsx](src/screens/ChatDetail.tsx)

**修改内容**：

1. **添加状态管理**（第 52-54 行）：
   ```typescript
   const { messages, sendMessage, isPaired, unpair } = useClawbotChannel();
   const [showMenu, setShowMenu] = useState(false);
   ```

2. **添加菜单按钮**（第 558-617 行）：
   - 点击事件：`onClick={() => setShowMenu(!showMenu)}`
   - 菜单组件：使用 `AnimatePresence` 和 `motion.div` 实现动画

3. **取消配对逻辑**（第 583-592 行）：
   ```typescript
   onClick={() => {
     const confirmed = window.confirm('确定要取消与 Clawbot 的配对吗？\n\n取消后需要重新配对才能继续使用。');
     if (confirmed) {
       unpair();  // 调用 Context 的 unpair 方法
       setShowMenu(false);
       navigate('/chat');  // 返回聊天列表
       alert('配对已取消，您可以重新进入配对页面连接新的 Clawbot');
     }
   }}
   ```

4. **ESC 键监听**（第 298-307 行）：
   ```typescript
   useEffect(() => {
     const handleKeyDown = (e: KeyboardEvent) => {
       if (e.key === 'Escape' && showMenu) {
         setShowMenu(false);
       }
     };
     window.addEventListener('keydown', handleKeyDown);
     return () => window.removeEventListener('keydown', handleKeyDown);
   }, [showMenu]);
   ```

### unpair() 方法实现

**文件**：[src/contexts/ClawbotChannelContext.tsx](src/contexts/ClawbotChannelContext.tsx)

**功能**：
1. 调用 `ClawbotChannelBridge.unpair()`
2. 清理配对状态（`pairingStatus: 'idle'`）
3. 清除设备ID（`deviceId: ''`）
4. 清除配对码（`pairingCode: null`）
5. 清空消息列表（`messages: []`）

**localStorage 清理**：
- 删除 `clawbot_paired`
- 删除 `clawbot_device_id`

---

## 🧪 测试步骤

### 测试 1：菜单打开/关闭

1. 进入聊天详情页
2. 点击右上角三个点按钮
3. ✅ 菜单应该弹出
4. 点击遮罩层（菜单外部区域）
5. ✅ 菜单应该关闭

### 测试 2：ESC 键关闭

1. 打开菜单
2. 按下 ESC 键
3. ✅ 菜单应该关闭

### 测试 3：取消配对

1. 确保已配对 Clawbot
2. 打开菜单，点击"取消配对"
3. ✅ 应该弹出确认对话框
4. 点击"确定"
5. ✅ 应该返回聊天列表页
6. ✅ localStorage 中的配对信息应该被清除
7. ✅ 再次进入聊天详情页，应该显示"未配对"状态

### 测试 4：重新配对

1. 取消配对后，在 Clawbot 端发起配对
2. 在 App 端输入新的配对码
3. ✅ 应该能成功配对
4. ✅ 可以正常发送消息

---

## 🐛 已知问题

### 问题 1：Bot is offline

**症状**：取消配对后，如果 Clawbot 断开连接，再次配对时会提示"Bot is offline"

**原因**：旧的 Clawbot socket 仍存在于服务器内存中

**解决方案**：
- 服务器已实现自动清理机制
- Clawbot 重连时会自动恢复配对
- 参考：[CLAWBOT_PERSISTENT_CONNECTION.md](CLAWBOT_PERSISTENT_CONNECTION.md)

### 问题 2：取消配对后消息丢失

**说明**：这是预期行为

**原因**：Clawbot Channel 是实时通信，消息不存储在本地数据库

**解决方案**：如需保存消息，请在服务器端实现消息持久化

---

## 📞 技术支持

如有问题，请检查：

1. **控制台日志**：
   - 浏览器控制台（F12）
   - 查看是否有错误信息

2. **localStorage**：
   - 打开浏览器开发工具
   - Application → Local Storage
   - 检查 `clawbot_paired` 和 `clawbot_device_id`

3. **服务器日志**：
   ```bash
   ssh root@TRIX_SERVER_HOST "pm2 logs trix-native --lines 50"
   ```

---

**更新时间**：2026-02-15 13:00
**修复版本**：v1.0.0
**状态**：✅ 已修复并可用
