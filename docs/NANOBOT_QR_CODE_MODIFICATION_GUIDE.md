# Nanobot Web 界面 QR 码显示配置指南

## 需要修改的文件

`e:\desktop\nanobot\nanobot\web_interface_final.py`

---

## 修改 1：添加 QR 码显示区域（HTML）

**位置**：找到配对码显示部分（约第 1021 行）

**原代码**：
```html
<div style="text-align: center; padding: 20px 0;">
    <div id="pairingCodeDisplay" style="font-size: 32px; font-weight: 700; color: var(--accent); letter-spacing: 4px; margin-bottom: 10px;">-</div>
    <div style="color: var(--text-muted); font-size: 13px;">配对码</div>
</div>
```

**修改为**：
```html
<div style="text-align: center; padding: 20px 0;">
    <div id="pairingCodeDisplay" style="font-size: 32px; font-weight: 700; color: var(--accent); letter-spacing: 4px; margin-bottom: 10px;">-</div>
    <div style="color: var(--text-muted); font-size: 13px;">配对码</div>

    <!-- QR 码显示区域 -->
    <div id="qrCodeContainer" style="margin-top: 20px; display: none;">
        <img id="qrCodeImage" style="max-width: 200px; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.3);" />
        <div style="margin-top: 10px; color: var(--text-muted); font-size: 12px;">扫描二维码快速配对</div>
    </div>
</div>
```

---

## 修改 2：添加 QR 码处理逻辑（JavaScript）

**位置**：在 `<script>` 标签内，找到配对码生成相关代码

**添加以下函数**：
```javascript
// 显示 QR 码
function showQRCode(qrCodeData) {
    const qrContainer = document.getElementById('qrCodeContainer');
    const qrImage = document.getElementById('qrCodeImage');

    if (qrCodeData && qrContainer && qrImage) {
        qrImage.src = qrCodeData;
        qrContainer.style.display = 'block';
    }
}

// 隐藏 QR 码
function hideQRCode() {
    const qrContainer = document.getElementById('qrCodeContainer');
    if (qrContainer) {
        qrContainer.style.display = 'none';
    }
}
```

---

## 修改 3：修改 on_cloud_message 函数

**位置**：第 1705 行 `def on_cloud_message(ws, message):`

**原代码**：
```python
def on_cloud_message(ws, message):
    """处理从云端收到的消息"""
    try:
        data = json.loads(message)
        msg_type = data.get('type', '')

        if msg_type == 'pairing_success':
            # 手机App配对成功
            pairing_status['status'] = 'connected'
            ...
```

**修改为**：
```python
def on_cloud_message(ws, message):
    """处理从云端收到的消息"""
    try:
        data = json.loads(message)
        msg_type = data.get('type', '')

        if msg_type == 'pairing_registered':
            # 配对码注册成功（云端返回 QR 码）
            code = data.get('code')
            qr_code = data.get('qr_code')  # Base64 编码的 QR 码
            pairing_url = data.get('pairing_url')
            expires_in = data.get('expires_in', 3600)

            pairing_status['code'] = code
            pairing_status['status'] = 'waiting'
            pairing_status['qr_code'] = qr_code

            log_collector.add_log(f'配对码已生成: {code} (有效期: {expires_in}秒)', 'success')

            # 通知前端更新（通过 SSE）
            # 前端会在 /logs 流中收到这个消息并显示 QR 码

        elif msg_type == 'pairing_success':
            # 手机App配对成功
            code = data.get('code')
            client_info = data.get('client_info', {})

            pairing_status['status'] = 'connected'
            pairing_status['connected_at'] = datetime.now().isoformat()
            pairing_status['client_info'] = client_info

            log_collector.add_log(f"✅ 手机App已配对成功: {code}", 'success')
            log_collector.add_log(f"设备信息: {json.dumps(client_info, ensure_ascii=False)}", 'info')

        elif msg_type == 'chat_message':
            # 收到手机App发来的消息
            user_message = data.get('message', '')
            log_collector.add_log(f"收到手机消息: {user_message[:50]}...", 'info')

            # 处理消息（调用nanobot）
            threading.Thread(target=process_mobile_message, args=(user_message, data.get('msg_id'))).start()

        elif msg_type == 'ping':
            # 心跳
            ws.send(json.dumps({'type': 'pong'}))

    except Exception as e:
        log_collector.add_log(f'处理云端消息错误: {str(e)}', 'error')
```

---

## 修改 4：更新前端 SSE 日志处理

**位置**：在 HTML 的 JavaScript 部分，EventSource 日志处理

**添加 QR 码显示逻辑**：
```javascript
// EventSource 日志处理
const eventSource = new EventSource('/logs');
eventSource.onmessage = function(event) {
    const log = JSON.parse(event.data);

    // 添加日志到界面
    addLogToUI(log);

    // 检查是否是配对码生成消息
    if (log.message && log.message.includes('配对码已生成:')) {
        // 从 pairing_status API 获取 QR 码
        fetch('/api/pairing/status')
            .then(response => response.json())
            .then(data => {
                if (data.status.qr_code) {
                    showQRCode(data.status.qr_code);
                }
            });
    }

    // 检查是否是配对成功消息
    if (log.message && log.message.includes('已配对成功')) {
        hideQRCode();  // 隐藏 QR 码
    }
};
```

---

## 完整的修改步骤

1. **备份原文件**：
   ```bash
   copy e:\desktop\nanobot\nanobot\web_interface_final.py e:\desktop\nanobot\nanobot\web_interface_final.py.backup
   ```

2. **手动修改**：
   - 按照上面的 4 个修改点依次修改

3. **重启 Nanobot**：
   ```bash
   # 停止旧进程（如果在运行）
   # 按 Ctrl+C 停止

   # 启动新版本
   cd e:\desktop\nanobot\nanobot
   python web_interface_final.py
   ```

4. **测试 QR 码功能**：
   - 访问 `http://localhost:5000`
   - 点击"生成配对码"
   - 应该看到配对码 + QR 码图片

---

## 自动化修改（可选）

如果你想让我帮你自动修改，我可以：

1. 读取整个文件
2. 使用 Edit 工具进行精确修改
3. 保存并验证

需要我帮你自动修改吗？

---

## 预期效果

修改完成后：

1. **生成配对码时**：
   - 显示 8 位配对码（如：`A1B2C3D4`）
   - 同时显示 QR 码图片
   - 提示"扫描二维码快速配对"

2. **App 扫码配对**：
   - App 扫描 QR 码
   - 自动解析配对码和服务器地址
   - 一键配对成功

3. **配对成功后**：
   - QR 码自动隐藏
   - 显示"已连接"状态

---

**文档版本**: 1.0.0
**创建时间**: 2026-02-14
