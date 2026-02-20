# ⚡ 快速修复配对功能

## 🎯 问题
App 输入配对码后显示 "Invalid or expired pairing code"

## 🔍 原因
服务器返回的配对信息不完整，缺少 `pairingCode` 和 `pairingToken`

## ✅ 解决方案

### 一键修复（需要 SSH 密码）

**Windows 用户:**
```
双击运行: update-server-pairing.bat
```

**Linux/Mac 用户:**
```bash
chmod +x update-server-pairing.sh
./update-server-pairing.sh
```

### 手动修复

执行命令后输入 SSH 密码，脚本会自动：
1. ✅ 备份原文件
2. ✅ 上传修复后的代码
3. ✅ 重启服务
4. ✅ 验证状态

## 🧪 测试

修复后运行测试：
```bash
cd openclaw-skills/pairing
node test-pairing.js
```

应该看到：
```json
{
  "success": true,
  "pairingCode": "ABC123",
  "pairingToken": "xxx"
}
```

## 📝 完整流程

1. 运行更新脚本（输入密码）
2. 等待上传完成
3. 在 OpenClaw 中说"生成配对码"
4. 在 App 中输入配对码
5. 配对成功！

---

**服务器地址:** TRIX_SERVER_HOST:8765
**用户:** root
**详细文档:** PAIRING_FIX_GUIDE.md
