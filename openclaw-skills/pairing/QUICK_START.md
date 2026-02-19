# 🚀 OpenClaw配对功能 - 快速开始指南

## ✅ 配对功能已完成！

### 📦 文件位置

所有文件已创建在：
```
e:\desktop\trix-3d-companion\openclaw-skills\pairing\
```

包含文件：
- `index.js` - Skill主文件
- `package.json` - Skill配置
- `README.md` - 详细文档
- `install.bat` - 安装脚本

---

## 🎯 使用方法

### 步骤1: 安装Skill

**方式A：自动安装（推荐）**

双击运行：
```
e:\desktop\trix-3d-companion\openclaw-skills\pairing\install.bat
```

**方式B：手动安装**

1. 创建目录：
```bash
mkdir C:\Users\wang\.openclaw\skills\pairing
```

2. 复制文件：
```
从：e:\desktop\trix-3d-companion\openclaw-skills\pairing\
到：C:\Users\wang\.openclaw\skills\pairing\
```

3. 安装依赖：
```bash
cd C:\Users\wang\.openclaw\skills\pairing
npm install
```

### 步骤2: 重启OpenClaw Gateway

```powershell
# 停止OpenClaw
# 然后重新启动
start /B node "C:\nodejs_global\node_modules\openclaw-cn\dist\index.js"
```

### 步骤3: 在OpenClaw中生成配对码

在OpenClaw对话界面输入：

```
生成配对码
```

**或者**：

```
给我一个配对码
```

OpenClaw会返回：

```
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

### 步骤4: 手机App配对

1. **打开手机App**
   - 访问: `http://47.243.55.130`
   - 强制刷新: `Ctrl+Shift+R`

2. **进入配对页面**

3. **输入配对码**
   - 输入OpenClaw给你的配对码（例如：`EXCJ76`）

4. **确认配对**

5. **开始聊天**
   - 配对成功后自动跳转到聊天页面
   - 发送消息测试

---

## 💬 支持的对话方式

你可以在OpenClaw中输入以下任何一句话：

- ✅ "生成配对码"
- ✅ "给我配对码"
- ✅ "配对码"
- ✅ "pairing code"
- ✅ "生成二维码"
- ✅ "qr code"
- ✅ "扫码配对"
- ✅ "我要配对"

OpenClaw会识别你的意图并生成相应的配对码或二维码。

---

## 🔄 完整使用流程

```
┌─────────────────┐
│   用户操作      │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ 在OpenClaw中输入: "生成配对码"           │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ OpenClaw返回配对码: EXCJ76              │
│ 有效期: 5分钟                           │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ 手机App访问: http://47.243.55.130       │
│ 进入配对页面                            │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ 输入配对码: EXCJ76                      │
│ 点击确认配对                            │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ ✅ 配对成功！                           │
│ 可以开始聊天了                          │
└─────────────────────────────────────────┘
```

---

## 🎯 使用场景

### 场景1: 给朋友使用

1. 朋友访问你的OpenClaw
2. 输入"生成配对码"
3. 获得配对码
4. 朋友的手机App输入配对码
5. 配对成功，可以聊天

### 场景2: 多设备使用

1. 在OpenClaw中生成配对码
2. 手机1输入配对码配对
3. 需要时，再生成新配对码
4. 手机2也可以配对

---

## 🔧 故障排查

### 问题1: Skill无法加载

**检查**：
```powershell
# 检查skill目录是否存在
dir C:\Users\wang\.openclaw\skills\pairing

# 应该看到:
# index.js
# package.json
# README.md
```

**解决**：
```powershell
# 重新运行安装脚本
e:\desktop\trix-3d-companion\openclaw-skills\pairing\install.bat
```

### 问题2: OpenClaw不识别命令

**原因**：OpenClaw Gateway未重启

**解决**：
```powershell
# 重启OpenClaw Gateway
# 停止当前进程
# 重新启动
start /B node "C:\nodejs_global\node_modules\openclaw-cn\dist\index.js"
```

### 问题3: 配对码无效

**原因**：配对码已过期（5分钟有效期）

**解决**：重新在OpenClaw中输入"生成配对码"

---

## 📞 快速参考

### 安装命令

```powershell
e:\desktop\trix-3d-companion\openclaw-skills\pairing\install.bat
```

### 使用对话

```
你：生成配对码
OpenClaw：✅ 配对码已生成！📱 配对码：EXCJ76...
```

### 临时配对管理器

如果Skill未安装，可以使用临时工具：

```bash
cd e:\desktop\trix-3d-companion\bridge
node pairing-manager.js generate-code
```

---

## ✅ 检查清单

在开始使用前，请确认：

- [ ] Skill已安装到 `C:\Users\wang\.openclaw\skills\pairing\`
- [ ] OpenClaw Gateway已重启
- [ ] 本地Bridge运行中
- [ ] 云端Relay Server运行中
- [ ] 手机可以访问 `http://47.243.55.130`

---

**现在可以开始使用了！** 🎉

1. 运行安装脚本
2. 重启OpenClaw
3. 在OpenClaw中输入"生成配对码"
4. 在手机App中输入配对码
5. 开始聊天！
