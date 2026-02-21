# GitHub Actions 全自动部署指南

## ✅ 已完成的配置

GitHub Actions 自动部署已经配置完成！

### 📋 服务器配置状态

| 组件 | 状态 | 说明 |
|------|------|------|
| SSH 密钥 | ✅ 已配置 | `github-actions` 密钥已存在 |
| Git | ✅ 已安装 | `git version 2.25.1` |
| Nginx | ✅ 运行中 | Web 目录已配置 |

## 🚀 配置 GitHub Secrets（只需一次）

SSH 密钥已经配置完成，但还需要在 GitHub 上添加 `SSH_PRIVATE_KEY` Secret。

### 步骤 1：获取私钥内容

**Windows 用户：**
```bash
type %USERPROFILE%\.ssh\github_actions
```

**Linux/Mac 用户：**
```bash
cat ~/.ssh/github_actions
```

### 步骤 2：添加到 GitHub Secrets

1. 访问：https://github.com/meowdoone/TRIX_ap/settings/secrets/actions
2. 点击 "New repository secret"
3. 填写以下内容：
   - **Name**: `SSH_PRIVATE_KEY`
   - **Value**: 粘贴步骤 1 中获取的完整私钥内容（包括 BEGIN 和 END 行）

### ⚠️ 也可以跳过配置（测试阶段）

如果只是测试，可以暂时使用手动脚本部署：
- **Windows**: 双击运行 [deploy.bat](deploy.bat)
- **Linux/Mac**: 运行 `./deploy.sh`

## 🎯 使用方法

配置完成后，**每次推送代码**就会自动部署：

```bash
# 修改代码
git add .
git commit -m "your message"
git push origin feature-nanobot-integration
```

GitHub Actions 会自动：
1. ✅ 构建项目
2. ✅ 上传到服务器
3. ✅ 设置权限
4. ✅ 重启 Nginx

## 📊 监控部署

### 查看部署状态
访问：https://github.com/meowdoone/TRIX_ap/actions

### 查看部署日志
点击具体的 workflow run 可以查看详细日志。

### 部署时间
- ⏱️️ 构建时间：~30 秒
- ⏱️️ 部署时间：~10 秒
- 🔄 总计：~40 秒

## 🔧 故障排查

### 部署失败？

1. **检查 GitHub Secrets**
   - 确认所有 4 个 Secrets 都已配置：
     - `SERVER_HOST`
     - `SERVER_USER`
     - `SSH_PRIVATE_KEY`
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_ANON_KEY`

2. **检查服务器连接**
   ```bash
   ssh root@TRIX_SERVER_HOST
   ```

3. **查看 Actions 日志**
   - 访问 GitHub Actions 页面
   - 点击失败的 workflow
   - 查看详细错误信息

4. **手动回滚**
   ```bash
   ssh root@TRIX_SERVER_HOST
   cd /var/www/html
   rm -rf *
   cp -r ../html-backup/*
   systemctl reload nginx
   ```

### 手动触发部署

如果需要手动触发部署（不推送代码）：

```bash
# 创建空提交
git commit --allow-empty -m "trigger deploy"
git push origin feature-nanobot-integration
```

## 📝 快速参考

### 常用 Git 命令
```bash
# 查看状态
git status

# 查看最新提交
git log -1

# 推送到 GitHub
git push origin feature-nanobot-integration

# 查看远程状态
git remote -v
```

### 服务器命令
```bash
# 查看部署文件
ssh root@TRIX_SERVER_HOST "ls -la /var/www/html"

# 查看后端服务
ssh root@TRIX_SERVER_HOST "pm2 list"

# 查看 Nginx 状态
ssh root@TRIX_SERVER_HOST "systemctl status nginx"

# 查看 Nginx 日志
ssh root@TRIX_SERVER_HOST "tail -f /var/log/nginx/error.log"
```

### 测试部署
```bash
# 测试前端访问
curl -I http://TRIX_SERVER_HOST

# 测试后端 API
curl http://TRIX_SERVER_HOST:8765/health

# 测试 Git 仓库
ssh root@TRIX_SERVER_HOST "cd /opt/trix-3d-companion && git log -1"
```

## 🎉 完成步骤总结

1. ✅ 服务器 SSH 密钥已配置
2. ✅ Git 已安装并初始化
3. ✅ GitHub Actions workflow 已创建
4. ⚠️  需要手动配置 GitHub Secrets（一次性）
5. ⚠️  配置后即可实现全自动部署

---

**需要帮助？** 查看详细部署文档或联系我。
