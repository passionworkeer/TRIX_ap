# Clawbot Channel 服务器部署指南

## 服务器信息
- **IP**: 47.243.55.130
- **用户**: root
- **端口**: 22

## 部署步骤

### 步骤 1: 连接到服务器

使用 Windows PowerShell、CMD 或 SSH 客户端连接：

```powershell
# PowerShell
ssh root@47.243.55.130
```

或使用 SSH 客户端工具（PuTTY、MobaXterm 等）连接。

### 步骤 2: 停止旧版服务器

连接成功后，先停止当前运行的 Python 服务器：

```bash
# 查找占用 8765 端口的进程
lsof -i :8765

# 杀死进程
kill -9 $(lsof -ti:8765)

# 或使用 pkill
pkill -f cloud_server_advanced.py
```

### 步骤 3: 创建目录

```bash
# 创建 Clawbot Channel 目录
mkdir -p /opt/clawbot-channel
cd /opt/clawbot-channel
```

### 步骤 4: 上传代码

**方法 A: 使用 scp 上传（在本地 Windows PowerShell 执行）**

```powershell
scp E:\desktop\trix-3d-companion\clawbot-channel.zip root@47.243.55.130:/opt/clawbot-channel/
```

**方法 B: 使用 WinSCP/FileZilla 等 SFTP 工具上传**

1. 连接到 47.243.55.130 (root 用户)
2. 导航到 `/opt/clawbot-channel/`
3. 上传 `clawbot-channel.zip` 文件

**方法 C: 使用 SSH 客户端内置文件传输**

如 MobaXterm、Bitvise SSH 等工具支持直接拖拽上传。

### 步骤 5: 解压并安装

在 SSH 服务器终端执行：

```bash
# 进入目录
cd /opt/clawbot-channel

# 解压文件
unzip clawbot-channel.zip

# 安装 Node.js 依赖
npm install

# 创建数据目录
mkdir -p data logs
```

### 步骤 6: 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑配置
nano .env
```

修改以下配置（按实际需求）：

```env
# 服务器配置
PORT=8765
HOST=0.0.0.0

# 数据库
DATABASE_PATH=./data/pairing.db

# 配对配置
PAIRING_CODE_EXPIRY=300000
PAIRING_TOKEN_EXPIRY=600000

# Clawbot Webhook 密钥
CLAWBOT_WEBHOOK_SECRET=your-secret-here-change-me

# 阿里云 OSS（可选）
OSS_REGION=oss-cn-hangzhou
OSS_BUCKET=your-bucket
OSS_ACCESS_KEY_ID=your-key
OSS_ACCESS_KEY_SECRET=your-secret
```

按 `Ctrl+X` 保存，`Y` 确认，`Enter` 退出。

### 步骤 7: 安装 PM2（进程管理器）

```bash
# 全局安装 PM2
npm install -g pm2

# 或使用 npx（无需安装）
npx pm2 -v
```

### 步骤 8: 启动服务器

```bash
# 使用 PM2 启动
pm2 start ecosystem.config.js

# 保存 PM2 进程列表
pm2 save

# 设置开机自启（可选）
pm2 startup
```

### 步骤 9: 验证服务器运行

```bash
# 查看服务状态
pm2 status

# 查看实时日志
pm2 logs clawbot-channel

# 检查端口监听
lsof -i :8765
# 或
netstat -tlnp | grep 8765

# 测试 HTTP API
curl http://localhost:8765/health
```

预期输出：
```json
{"status":"ok","timestamp":"2024-02-15T..."}
```

## PM2 常用命令

```bash
# 查看状态
pm2 status

# 查看日志
pm2 logs clawbot-channel

# 实时日志
pm2 logs clawbot-channel --lines 100

# 重启服务
pm2 restart clawbot-channel

# 停止服务
pm2 stop clawbot-channel

# 删除服务
pm2 delete clawbot-channel
```

## 防火墙配置

确保 8765 端口已开放：

```bash
# 检查防火墙
iptables -L -n | grep 8765

# 如果没有，添加规则
iptables -I INPUT -p tcp --dport 8765 -j ACCEPT
service iptables save

# 或使用 ufw（Ubuntu）
ufw allow 8765/tcp
```

## 更新服务器代码

当需要更新服务器代码时：

```bash
# 1. 在本地重新构建
npm run build

# 2. 重新打包
Compress-Archive -Path E:\desktop\trix-3d-companion\server\clawbot-channel\* -DestinationPath E:\desktop\trix-3d-companion\clawbot-channel-update.zip

# 3. 上传到服务器
scp E:\desktop\trix-3d-companion\clawbot-channel-update.zip root@47.243.55.130:/opt/clawbot-channel/

# 4. 在服务器上解压
cd /opt/clawbot-channel
unzip -o clawbot-channel-update.zip

# 5. 重启服务
pm2 restart clawbot-channel
```

## 故障排查

### 问题 1: 端口被占用

```bash
# 查找占用进程
lsof -i :8765

# 杀死进程
kill -9 $(lsof -ti:8765)
```

### 问题 2: 依赖安装失败

```bash
# 清理缓存重装
rm -rf node_modules package-lock.json
npm install

# 或使用淘宝镜像
npm install --registry=https://registry.npmmirror.com
```

### 问题 3: PM2 无法启动

```bash
# 检查 Node.js 版本
node -v  # 需要 >= 14.0

# 查看详细错误
pm2 logs clawbot-channel --err

# 手动运行测试
node server.js
```

### 问题 4: 数据库错误

```bash
# 删除数据库重新初始化
rm ./data/pairing.db
pm2 restart clawbot-channel
```

## App 端配置

服务器部署完成后，需要在 App 的 `.env.local` 中更新配置：

```env
# Clawbot Channel 服务器地址
VITE_CLAWBOT_CHANNEL_URL=wss://m.jmtrick.com
# 或使用 IP
VITE_CLAWBOT_CHANNEL_URL=wss://47.243.55.130:8765
```

然后重新启动 App：

```bash
npm run dev
```

## 下一步

部署完成后：
1. ✅ 确保 Clawbot 已配置并运行
2. ✅ 打开 App 进行配对测试
3. ✅ 验证消息收发功能

需要帮助？随时告诉我！
