# 🚀 上传App到服务器指南

## 步骤1: 确认本地构建完成

本地App已经构建完成，文件在 `e:\desktop\trix-3d-companion\dist\`

## 步骤2: 上传到服务器

在PowerShell中执行：

```powershell
# 上传dist目录到服务器
scp -r e:\desktop\trix-3d-companion\dist\* root@47.243.55.130:/var/www/html/
```

输入密码后等待上传完成。

## 步骤3: 在服务器上重启Nginx

```bash
ssh root@47.243.55.130

# 重启Nginx
systemctl restart nginx

# 或重新加载配置
nginx -s reload

# 检查Nginx状态
systemctl status nginx
```

## 步骤4: 验证App可访问

在浏览器打开：
```
http://47.243.55.130
```

应该可以看到最新的App界面。

---

## 🔧 如果遇到问题

### 问题1: 404错误

检查Nginx配置：
```bash
nginx -t
cat /etc/nginx/sites-enabled/default
```

### 问题2: 权限问题

```bash
chown -R www-data:www-data /var/www/html
chmod -R 755 /var/www/html
```

### 问题3: 清除缓存

在浏览器中按 `Ctrl+Shift+R` 强制刷新，或清除浏览器缓存。

---

## ✅ 验证清单

- [ ] App文件已上传到 `/var/www/html/`
- [ ] Nginx已重启
- [ ] 浏览器可以访问 `http://47.243.55.130`
- [ ] App界面正常显示
- [ ] 可以登录
- [ ] 可以连接到Relay Server

---

## 📱 测试流程

1. **访问App**: http://47.243.55.130
2. **登录账号**
3. **进入Clawbot聊天页面**
4. **发送测试消息**: "你好 OpenClaw"
5. **验证响应**: <1秒收到AI回复

---

## 🎯 当前状态

- ✅ **本地Bridge**: 已连接到云端
  - `[Bridge] ✅ 已连接到云端 Relay Server`

- ✅ **云端Relay Server**: 运行中
  - 地址: `ws://47.243.55.130:8765`

- ✅ **OpenClaw Gateway**: 运行中
  - 地址: `localhost:18789`

- ⏳ **App**: 等待上传到服务器

---

**上传完成后，就可以通过手机测试了！** 🚀
