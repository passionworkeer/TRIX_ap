# 自动部署配置指南

## 🚀 GitHub Actions 自动部署

已完成自动部署配置！现在推送代码到 GitHub 后，会**自动构建并部署**到你的服务器。

---

## 📝 配置步骤

### 第 1 步：配置 GitHub Secrets

1. 访问你的 GitHub 仓库设置：
   ```
   https://github.com/meowdoone/TRIX_ap/settings/secrets/actions
   ```

2. 点击 **"New repository secret"**，添加以下 3 个密钥：

   | Name | Secret | 说明 |
   |-------|---------|------|
   | `SERVER_HOST` | `TRIX_SERVER_HOST` | 服务器 IP 地址 |
   | `SERVER_USER` | `root` | SSH 用户名 |
   | `SSH_PRIVATE_KEY` | (见下方) | SSH 私钥 |

---

### 第 2 步：生成 SSH 密钥对

**在服务器上运行**：

```bash
ssh root@TRIX_SERVER_HOST
```

然后执行：

```bash
# 生成密钥对（如果没有）
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github_actions -N ""

# 查看公钥
cat ~/.ssh/github_actions.pub
```

**复制公钥内容**，然后添加到服务器的授权密钥：

```bash
# 添加公钥到授权列表
cat ~/.ssh/github_actions.pub >> ~/.ssh/authorized_keys

# 设置正确的权限
chmod 700 ~/.ssh
chmod 600 ~/.ssh/github_actions
chmod 600 ~/.ssh/authorized_keys
```

---

### 第 3 步：复制私钥到 GitHub

1. **查看私钥**：
   ```bash
   cat ~/.ssh/github_actions
   ```

2. **复制整个私钥**（包括 `-----BEGIN` 和 `-----END` 行）

3. **在 GitHub 添加 Secret**：
   - Name: `SSH_PRIVATE_KEY`
   - Secret: (粘贴私钥内容)

---

### 第 4 步：测试自动部署

现在只需要推送代码，就会自动部署！

```bash
# 方式 1：推送任意修改
git commit --allow-empty -m "测试自动部署"
git push origin main
```

然后访问 GitHub Actions 页面查看部署进度：
```
https://github.com/meowdoone/TRIX_ap/actions
```

---

## 🔄 工作流程

```
你推送代码到 GitHub
    ↓
GitHub Actions 自动触发
    ↓
在 GitHub 服务器上构建项目
    ↓
通过 SSH 上传到你的服务器
    ↓
自动备份、部署、重启 Nginx
    ↓
✓ 完成！访问 http://TRIX_SERVER_HOST
```

---

## 🛡️ 安全特性

- ✅ 使用 SSH 密钥认证（比密码更安全）
- ✅ 密钥存储在 GitHub Secrets（不会暴露）
- ✅ 部署前自动备份（可回滚）
- ✅ 构建在 GitHub 服务器（不占用你的服务器资源）

---

## 🔧 常见问题

### Q1: 部署失败怎么办？

查看 GitHub Actions 日志：
1. 访问 https://github.com/meowdoone/TRIX_ap/actions
2. 点击失败的工作流
3. 查看具体错误信息

### Q2: 如何回滚到上一版本？

在服务器上执行：
```bash
ssh root@TRIX_SERVER_HOST
rm -rf /var/www/trix-3d-companion-web
cp -r /var/www/trix-3d-companion-web-backup /var/www/trix-3d-companion-web
systemctl reload nginx
```

### Q3: 如何禁用自动部署？

删除或重命名 `.github/workflows/deploy.yml` 文件：
```bash
rm .github/workflows/deploy.yml
git add . && git commit -m "禁用自动部署" && git push
```

---

## 📊 部署时间预估

| 阶段 | 预计时间 |
|------|---------|
| 检出代码 | ~5秒 |
| 安装依赖 | ~30秒 |
| 构建项目 | ~20秒 |
| 上传到服务器 | ~10秒 |
| 部署配置 | ~5秒 |
| **总计** | **约 70秒** |

---

## 🎯 下一步

1. 完成 GitHub Secrets 配置
2. 推送代码测试自动部署
3. 访问 http://TRIX_SERVER_HOST 确认部署成功

完成配置后，你只需要：
```bash
git add .
git commit -m "更新功能"
git push origin main
```

**就这么简单！** 剩下的交给 GitHub Actions 自动完成 🚀
