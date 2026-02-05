# 🔐 GitHub 认证解决方案

## 问题诊断
仓库存在于 https://github.com/meowdoone/TRIX_ap，但无法推送。
这是因为 GitHub 需要身份验证。

## ✅ 推荐解决方案：使用 GitHub CLI（最简单）

### 步骤 1: 安装 GitHub CLI

如果还没安装，在 PowerShell 中运行：

```powershell
winget install --id GitHub.cli
```

或者下载安装：https://cli.github.com/

### 步骤 2: 登录 GitHub

```powershell
gh auth login
```

按照提示操作：
1. 选择 `GitHub.com`
2. 选择 `HTTPS`
3. 选择 `Login with a web browser`
4. 复制一次性代码，在浏览器中授权

### 步骤 3: 推送代码

```powershell
git push -u origin main
```

---

## 🔑 备选方案：使用 Personal Access Token

### 步骤 1: 创建 Token

1. 访问：https://github.com/settings/tokens
2. 点击 **"Generate new token"** → **"Generate new token (classic)"**
3. 填写信息：
   - **Note**: `TRIX_ap Push Access`
   - **Expiration**: 选择有效期（建议 90 天）
   - **Select scopes**: 勾选 `repo`（完整仓库访问权限）
4. 点击 **"Generate token"**
5. **立即复制 token**（只显示一次！）格式：`ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### 步骤 2: 使用 Token 推送

#### 方式 A: 在命令行输入（推荐）

```powershell
git push -u origin main
```

当提示输入用户名和密码时：
- **Username**: `meowdoone`
- **Password**: `粘贴你的 token`（不是 GitHub 密码！）

#### 方式 B: 在 URL 中包含认证信息

```powershell
git remote set-url origin https://meowdoone:你的token@github.com/meowdoone/TRIX_ap.git
git push -u origin main
```

⚠️ 注意：这种方式会将 token 存储在配置文件中

---

## 🔐 备选方案 2：使用 SSH（永久解决）

### 步骤 1: 生成 SSH 密钥

```powershell
ssh-keygen -t ed25519 -C "your_email@example.com"
```

按 Enter 使用默认路径，设置密码（可选）

### 步骤 2: 复制公钥

```powershell
cat ~/.ssh/id_ed25519.pub
```

复制输出的内容（以 `ssh-ed25519` 开头）

### 步骤 3: 添加到 GitHub

1. 访问：https://github.com/settings/ssh/new
2. **Title**: `TRIX Development Machine`
3. **Key**: 粘贴公钥内容
4. 点击 **"Add SSH key"**

### 步骤 4: 修改远程地址并推送

```powershell
git remote set-url origin git@github.com:meowdoone/TRIX_ap.git
git push -u origin main
```

---

## 🚀 快速测试

测试与 GitHub 的连接：

```powershell
# HTTPS 测试
git ls-remote https://github.com/meowdoone/TRIX_ap.git

# SSH 测试（如果配置了 SSH）
ssh -T git@github.com
```

如果成功，应该看到远程分支列表或欢迎消息。

---

## ❓ 常见问题

### Q: Token 忘记复制怎么办？
A: 删除旧 token，重新生成一个新的

### Q: 推送时一直不提示输入密码？
A: 运行以下命令清除缓存：
```powershell
git credential-manager delete https://github.com
```

### Q: 如何检查当前使用的认证方式？
A: 运行：
```powershell
git remote get-url origin
```
- 如果是 `https://` 开头 → 使用 HTTPS + Token
- 如果是 `git@github.com:` 开头 → 使用 SSH

---

## 📌 我推荐的方案

**最简单**: 使用 GitHub CLI（`gh auth login`）
**最安全**: 使用 SSH 密钥
**最快捷**: 使用 Personal Access Token

选择一个适合你的方案，完成后运行：

```powershell
git push -u origin main
```

所有修改就会成功推送到 GitHub！🚀
