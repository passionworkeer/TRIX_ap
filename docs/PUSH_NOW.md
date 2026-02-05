# 🚀 立即推送到 GitHub - 简单 3 步

## ❌ 当前问题
SSH 配置较复杂，建议使用 HTTPS + Personal Access Token 方式

## ✅ 解决方案（只需 3 步）

### 📍 步骤 1: 创建 Personal Access Token

1. **访问**: https://github.com/settings/tokens/new
2. **填写表单**:
   - **Note**: `TRIX_ap Push` 
   - **Expiration**: 选择 `90 days`
   - **Select scopes**: ✅ 勾选 `repo`（完整仓库访问）
3. **点击**: `Generate token`（页面底部绿色按钮）
4. **复制 Token**: `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
   
   ⚠️ **重要**: Token 只显示一次，请立即复制保存！

### 📍 步骤 2: 在终端推送代码

在 PowerShell 中运行：

```powershell
git push -u origin main
```

### 📍 步骤 3: 输入认证信息

会弹出 Windows 凭据管理器窗口（或命令行提示）：

- **Username**: `meowdoone`
- **Password**: `粘贴刚才复制的 token`（不是你的 GitHub 密码！）

完成！代码就会开始推送到 GitHub 🎉

---

## 🔍 如果没有弹出凭据窗口

手动输入：

```powershell
git push -u origin main
```

当提示时：
```
Username for 'https://github.com': meowdoone
Password for 'https://meowdoone@github.com': [粘贴你的 token]
```

---

## 📊 预期结果

推送成功后你会看到：

```
Enumerating objects: 45, done.
Counting objects: 100% (45/45), done.
Delta compression using up to 8 threads
Compressing objects: 100% (38/38), done.
Writing objects: 100% (44/44), 25.67 KiB | 2.09 MiB/s, done.
Total 44 (delta 12), reused 0 (delta 0), pack-reused 0
remote: Resolving deltas: 100% (12/12), done.
To https://github.com/meowdoone/TRIX_ap.git
   a1b2c3d..dfcfd24  main -> main
Branch 'main' set up to track remote branch 'main' from 'origin'.
```

然后访问 https://github.com/meowdoone/TRIX_ap 就能看到所有代码了！

---

## ❓ 常见问题

### Q: Token 在哪里创建？
A: https://github.com/settings/tokens/new

### Q: Token 选择什么权限？
A: 只需勾选 `repo`（完整仓库访问权限）

### Q: Token 忘记复制怎么办？
A: 删除旧的，重新创建一个新的

### Q: 推送时没有要求输入密码？
A: 可能缓存了旧凭据，运行：
```powershell
git credential reject https://github.com
git push -u origin main
```

---

## 🎯 现在开始

1. 打开: https://github.com/settings/tokens/new
2. 创建 Token 并复制
3. 运行: `git push -u origin main`
4. 输入用户名和 Token

就这么简单！🚀
