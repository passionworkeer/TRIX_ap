# MyApp Bridge 快速部署指南

## 📋 前置要求

- 阿里云服务器（Ubuntu 20.04+）
- 开放端口：5001, 80, 443
- 域名（可选，推荐）
- SSL 证书（可选，推荐）

---

## 🚀 一键部署（推荐）

### 步骤 1：上传部署文件到服务器

```bash
# 在本地（Windows）执行
scp -r deploy/ root@your-server-ip:/root/myapp-deploy/
```

或者使用 FTP 工具上传 `deploy` 文件夹到服务器。

### 步骤 2：运行部署脚本

```bash
# SSH 登录到服务器
ssh root@your-server-ip

# 进入部署目录
cd /root/myapp-deploy

# 添加执行权限
chmod +x deploy.sh

# 运行部署脚本
./deploy.sh
```

### 步骤 3：检查服务状态

```bash
# 查看服务状态
systemctl status myapp-bridge

# 查看日志
journalctl -u myapp-bridge -f
```

---

## 🌐 配置域名和 SSL（可选但推荐）

### 步骤 1：上传 SSL 证书

```bash
# 创建证书目录
mkdir -p /etc/nginx/ssl

# 上传证书（在本地执行）
scp cert.pem root@your-server-ip:/etc/nginx/ssl/
scp key.pem root@your-server-ip:/etc/nginx/ssl/
```

### 步骤 2：配置 Nginx

```bash
# 复制 Nginx 配置
cp nginx.conf /etc/nginx/sites-available/myapp-bridge

# 修改域名
nano /etc/nginx/sites-available/myapp-bridge
# 替换 your-domain.com 为你的实际域名

# 启用配置
ln -s /etc/nginx/sites-available/myapp-bridge /etc/nginx/sites-enabled/

# 测试配置
nginx -t

# 重启 Nginx
systemctl restart nginx
```

### 步骤 3：开放防火墙端口

```bash
# 如果使用 ufw
ufw allow 80
ufw allow 443
ufw allow 5001

# 或者在阿里云控制台开放端口
```

---

## ✅ 验证部署

### 测试 API

```bash
# 生成配对码
curl -X POST http://your-server-ip:5001/api/pairing/generate

# 预期输出：
# {
#   "success": true,
#   "code": "A1B2C3D4",
#   "expires_in": 3600,
#   "message": "请用户在App中输入此配对码"
# }
```

### 测试 WebSocket

```javascript
// 在浏览器控制台测试
const socket = io('http://your-server-ip:5001');
socket.on('connect', () => console.log('已连接'));
```

---

## 🔧 更新 App 配置

部署完成后，更新 `.env` 文件：

```bash
# .env
VITE_NANOBOT_SERVER_URL=https://your-domain.com
# 或者（如果没有域名）
VITE_NANOBOT_SERVER_URL=http://your-server-ip:5001
```

---

## 📊 管理命令

```bash
# 查看服务状态
systemctl status myapp-bridge

# 重启服务
systemctl restart myapp-bridge

# 停止服务
systemctl stop myapp-bridge

# 查看日志
journalctl -u myapp-bridge -f

# 查看 Nginx 日志
tail -f /var/log/nginx/myapp-bridge.access.log
```

---

## 🐛 故障排查

### 服务启动失败

```bash
# 查看详细日志
journalctl -u myapp-bridge -n 100

# 检查端口占用
netstat -tulpn | grep 5001

# 手动运行测试
cd /opt/myapp-bridge
python3 pairing_server.py
```

### WebSocket 连接失败

```bash
# 检查 Nginx 配置
nginx -t

# 查看 Nginx 错误日志
tail -f /var/log/nginx/error.log

# 检查防火墙
ufw status
```

---

## 🔐 安全建议

1. **更改密钥**
   ```bash
   # 编辑 pairing_server.py
   nano /opt/myapp-bridge/pairing_server.py
   # 修改 SECRET_KEY
   ```

2. **启用 Redis**
   ```bash
   systemctl start redis
   systemctl enable redis
   ```

3. **配置防火墙**
   ```bash
   ufw enable
   ufw allow ssh
   ufw allow 80
   ufw allow 443
   ```

4. **定期更新**
   ```bash
   apt-get update && apt-get upgrade
   ```

---

## 📝 下一步

1. ✅ 部署完成
2. 更新 App `.env` 配置
3. 重启 App 开发服务器
4. 访问 `/nanobot-pairing` 测试连接

---

## 💰 成本估算

- **阿里云 ECS（2核4G）**: ¥100-200/月
- **域名**: ¥50-100/年
- **SSL 证书**: Let's Encrypt 免费
- **Redis**: 本地安装免费

**总计**: 约 ¥100-200/月

---

有问题随时问我！🚀
