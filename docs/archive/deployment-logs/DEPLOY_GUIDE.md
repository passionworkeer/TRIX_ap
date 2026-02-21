# TRIX 3D Companion - 自动部署使用说明

## 🚀 最简单的自动部署方式

已经为你创建了一键部署脚本，无需每次都让我帮忙！

### Windows 用户

**使用方法：**

1. 修改代码后，双击运行 `deploy.bat`
2. 脚本会自动：
   - 推送代码到 Git
   - 本地构建
   - 上传到服务器
   - 重启服务

**或者手动执行：**
```bash
deploy.bat
```

### Linux/Mac 用户

**使用方法：**
```bash
./deploy.sh
```

## 📋 部署流程说明

脚本会自动执行以下步骤：

1. **推送到 Git** - 将本地更改推送到 GitHub
2. **本地构建** - 运行 `npm run build`
3. **清空服务器** - 删除服务器上的旧文件
4. **上传文件** - 上传构建后的文件
5. **设置权限** - 配置正确的文件权限
6. **重启服务** - 重启 Nginx

## ⚙️ 配置说明

### 服务器信息（已配置）
- **服务器IP**: TRIX_SERVER_HOST
- **用户**: root
- **前端目录**: /var/www/html
- **后端服务**: clawbot-channel (PM2)

### Git 仓库（已配置）
- **仓库**: git@github.com:meowdoone/TRIX_ap.git
- **分支**: feature/nanobot-integration

## 🔧 故障排查

### 部署失败？

1. **SSH 连接失败**
   ```bash
   # 测试 SSH 连接
   ssh root@TRIX_SERVER_HOST
   ```

2. **构建失败**
   ```bash
   # 本地测试构建
   npm run build
   ```

3. **服务器文件权限错误**
   ```bash
   # 修复权限
   ssh root@TRIX_SERVER_HOST "chown -R www-data:www-data /var/www/html/"
   ```

### 查看服务器状态

```bash
# 查看前端文件
ssh root@TRIX_SERVER_HOST "ls -la /var/www/html/"

# 查看后端服务
ssh root@TRIX_SERVER_HOST "pm2 list"

# 查看 Nginx 日志
ssh root@TRIX_SERVER_HOST "tail -f /var/log/nginx/access.log"
```

## 📱 验证部署

部署完成后，访问 http://TRIX_SERVER_HOST 验证：
1. **强制刷新**: Ctrl+Shift+R (Windows) 或 Cmd+Shift+R (Mac)
2. **清除缓存**: F12 → Application → Clear storage → Clear site data
3. **检查版本**: 查看控制台没有错误

## 🎯 使用场景

### 场景 1：修改了前端代码

```bash
# 1. 修改代码
# 2. 运行部署脚本
./deploy.sh

# 3. 等待部署完成（约 30 秒）
# 4. 访问服务器验证
```

### 场景 2：修改了环境变量

```bash
# 1. 修改 .env 或 .env.production
# 2. 运行部署脚本
./deploy.sh

# 3. 验证配置生效
```

### 场景 3：修改了后端代码

```bash
# 1. 修改 server/clawbot-channel/ 中的代码
# 2. 运行部署脚本（只部署前端）
./deploy.sh

# 3. 单独重启后端
ssh root@TRIX_SERVER_HOST "cd /opt/clawbot-channel && pm2 restart clawbot-channel"
```

## ⚡ 快速命令

```bash
# 查看部署状态
curl -I http://TRIX_SERVER_HOST

# 查看 Git 状态
git status

# 查看最新提交
git log -1

# 快速部署（Windows）
deploy.bat

# 快速部署（Linux/Mac）
./deploy.sh
```

## 📝 注意事项

1. **确保网络连接** - 需要能访问 GitHub 和服务器
2. **SSH 密钥** - 确保已配置 SSH 密钥免密登录
3. **本地构建成功** - 部署前确保本地 `npm run build` 成功
4. **备份重要数据** - 重要更改前先备份

## 🔐 安全建议

- 不要在代码中提交敏感信息
- 定期更换 SSH 密钥
- 限制服务器 SSH 访问 IP
- 定期更新依赖包

## 📞 需要帮助？

如果部署失败，请提供：
1. 错误信息截图
2. 控制台输出
3. 具体操作步骤

---

**最后更新**: 2026-02-19
**维护者**: TIX 3D Companion Team
