# TRIX 服务器 SSH 连接指南

## 服务器信息

| 项目 | 值 |
|------|-----|
| IP 地址 | 47.243.55.130 |
| SSH 用户名 | root |
| SSH 密码 | Trix2026! |
| SSH 端口 | 22 (默认) |
| PM2 服务名 | clawbot-channel |
| 代码目录 | /opt/clawbot-channel/ |

## 连接方法

### 方法 1: SSH_ASKPASS (推荐，用于 Claude Code)

```bash
# 1. 创建 askpass 脚本
cat > /c/Users/wang/AppData/Local/Temp/askpass.sh << 'SCRIPT'
#!/bin/sh
echo "Trix2026!"
SCRIPT
chmod +x /c/Users/wang/AppData/Local/Temp/askpass.sh

# 2. 使用 SSH_ASKPASS 连接
export DISPLAY=:0
export SSH_ASKPASS=/c/Users/wang/AppData/Local/Temp/askpass.sh
export SSH_ASKPASS_REQUIRE=force
ssh -o StrictHostKeyChecking=no root@47.243.55.130 "命令"
```

### 常用命令

```bash
# 查看进程状态
pm2 list

# 查看日志
pm2 logs clawbot-channel --lines 50

# 重启服务
pm2 restart clawbot-channel

# 查看环境变量
cat /opt/clawbot-channel/.env

# 编辑环境变量
nano /opt/clawbot-channel/.env
```

## 部署新代码步骤

### 1. 上传 server.js
```bash
export DISPLAY=:0
export SSH_ASKPASS=/c/Users/wang/AppData/Local/Temp/askpass.sh
export SSH_ASKPASS_REQUIRE=force

# 上传主文件
scp -o StrictHostKeyChecking=no E:/desktop/trix-3d-companion/server/clawbot-channel/server.js root@47.243.55.130:/opt/clawbot-channel/
```

### 2. 上传 services 目录
```bash
for f in ttsService.js ttsTextSanitizer.js ossService.js messageService.js pairingService.js studyRoomService.js; do
  scp -o StrictHostKeyChecking=no E:/desktop/trix-3d-companion/server/clawbot-channel/services/$f root@47.243.55.130:/opt/clawbot-channel/services/
done
```

### 3. 上传 routes 目录
```bash
for f in mvp.js extended.js supplement.js; do
  scp -o StrictHostKeyChecking=no E:/desktop/trix-3d-companion/server/clawbot-channel/routes/$f root@47.243.55.130:/opt/clawbot-channel/routes/
done
```

### 4. 上传 config 和 middleware
```bash
scp -o StrictHostKeyChecking=no E:/desktop/trix-3d-companion/server/clawbot-channel/config/supabase.js root@47.243.55.130:/opt/clawbot-channel/config/
scp -o StrictHostKeyChecking=no E:/desktop/trix-3d-companion/server/clawbot-channel/config/database.js root@47.243.55.130:/opt/clawbot-channel/config/
scp -o StrictHostKeyChecking=no E:/desktop/trix-3d-companion/server/clawbot-channel/middleware/auth.js root@47.243.55.130:/opt/clawbot-channel/middleware/
```

### 5. 安装依赖 (如需要)
```bash
ssh -o StrictHostKeyChecking=no root@47.243.55.130 "cd /opt/clawbot-channel && npm install @supabase/supabase-js ali-oss"
```

### 6. 重启服务
```bash
ssh -o StrictHostKeyChecking=no root@47.243.55.130 "pm2 restart clawbot-channel"
```

### 7. 验证
```bash
curl http://47.243.55.130:8765/health
curl "http://47.243.55.130:8765/oss/signed-url?key=test.jpg"
```

## 故障排查

### 问题: Permission denied
- 确认密码是否正确 (Trix2026!)
- 确认使用 SSH_ASKPASS 方式

### 问题: 模块找不到
- 登录服务器检查: `pm2 logs clawbot-channel --lines 20`
- 安装缺失模块: `npm install <module-name>`

### 问题: 服务启动失败
- 检查错误日志: `pm2 logs clawbot-channel --err --lines 50`
- 检查 .env 配置是否正确
