# 🚀 GitHub Actions 全自动部署指南

## ✅ 已完成的配置

GitHub Actions 自动部署已经配置完成！

### 📦 工作流程文件
- [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) - 自动部署工作流

## 🔧 需要手动配置的步骤

### 步骤 1：配置 GitHub Secrets

访问：https://github.com/meowdoone/TRIX_ap/settings/secrets/actions

添加以下 Secrets：

| Secret 名称 | 值 |
|------------|-----|
| `SERVER_HOST` | `TRIX_SERVER_HOST` |
| `SERVER_USER` | `root` |
| `SSH_PRIVATE_KEY` | 见步骤 2 |
| `VITE_SUPABASE_URL` | `https://__SUPABASE_PROJECT_REF_REDACTED__.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGci...` (完整密钥) |

### 步骤 2：生成 SSH 密钥对

**Windows 用户：**
```bash
# 运行配置脚本
setup-auto-deploy.bat
```

**Linux/Mac 用户：**
```bash
# 生成密钥对
ssh-keygen -t rsa -b 4096 -C "github-actions" -f ~/.ssh/github_actions

# 上传公钥到服务器
ssh-copy-id -i ~/.ssh/github_actions.pub root@TRIX_SERVER_HOST
```

**获取私钥：**
```bash
# Windows
type %USERPROFILE%\.ssh\github_actions

# Linux/Mac
cat ~/.ssh/github_actions
```

复制整个输出（包括 `-----BEGIN` 和 `-----END` 行）到 `SSH_PRIVATE_KEY` Secret。

## 🎯 使用方法

配置完成后，**每次推送代码**就会自动部署：

```bash
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

### 部署时间
- ⏱️ 通常需要 2-3 分钟
- 🔄 构建时间：~30 秒
- 📤 部署时间：~10 秒

### 部署日志
点击具体的 workflow run 可以查看详细日志。

## 🆘 故障排查

### 部署失败？

1. **检查 Secrets**
   - 访问仓库设置页面
   - 确认所有 Secrets 都已正确配置

2. **检查 SSH 密钥**
   ```bash
   # 测试 SSH 连接
   ssh -i ~/.ssh/github_actions root@TRIX_SERVER_HOST
   ```

3. **查看 Actions 日志**
   - 访问 Actions 页面
   - 点击失败的 workflow
   - 查看详细错误信息

### 手动触发部署

如果需要手动触发部署（不推送代码）：

```bash
# 创建空提交
git commit --allow-empty -m "trigger deploy"
git push origin feature-nanobot-integration
```

## 🔄 回滚部署

如果新版本有问题，可以快速回滚：

```bash
ssh root@TRIX_SERVER_HOST
cd /var/www/html
rm -rf *
cp -r ../html-backup/* .
systemctl reload nginx
```

## 📋 与手动部署的对比

| 方式 | 优点 | 缺点 |
|------|------|------|
| **GitHub Actions** | 全自动，推送即部署，有日志 | 需要 2-3 分钟，需要配置 Secrets |
| **手动脚本** (`deploy.bat`) | 快速（30 秒），无需配置 | 需要手动运行 |

两种方式都已配置好，你可以根据需要选择使用！

## 🎉 配置完成清单

- [x] GitHub Actions workflow 文件已创建
- [x] 工作流已推送到 GitHub
- [ ] GitHub Secrets 已配置（需要手动完成）
- [ ] SSH 密钥已生成并上传（需要手动完成）

完成以上所有步骤后，就可以实现**全自动部署**了！

---

**需要帮助？** 查看 [DEPLOY_GUIDE.md](DEPLOY_GUIDE.md) 或联系我。
