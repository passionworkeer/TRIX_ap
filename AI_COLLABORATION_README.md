# 🚀 TRIX 3D Companion - AI 协作项目说明

> **重要**: 本项目特别优化了文档和配置，方便任何 AI（Claude、ChatGPT、Copilot 等）理解和协作。

---

## 📚 快速导航

### 对于 AI 助手

如果你是 AI 助手，请优先阅读以下文档：

| 文档 | 用途 | 链接 |
|------|------|------|
| **自动部署 Skill** | 快速配置任何项目的 GitHub Actions 自动部署 | [.claude/skills/auto-deploy.md](.claude/skills/auto-deploy.md) |
| **完整部署指南** | 详细的自动部署实现原理和 AI 协作说明 | [docs/AUTO_DEPLOY_COMPLETE_GUIDE.md](docs/AUTO_DEPLOY_COMPLETE_GUIDE.md) |
| **项目部署文档** | 本项目的部署配置和使用说明 | [DEPLOY.md](DEPLOY.md) |

### 对于开发者

| 文档 | 用途 |
|------|------|
| [DEPLOY.md](DEPLOY.md) | 如何部署本项目到服务器 |
| [docs/AUTO_DEPLOY_COMPLETE_GUIDE.md](docs/AUTO_DEPLOY_COMPLETE_GUIDE.md) | 自动系统完整指南（含 AI 协作） |

---

## 🤖 AI 协作特性

本项目特别为 AI 助手优化，包含：

### ✅ Skill 系统

**位置**: [`.claude/skills/`](.claude/skills/)

可复用的技能文档，让其他项目也能快速使用：
- `auto-deploy.md` - GitHub Actions 自动部署（通用）

### ✅ 完整配置文档

所有关键配置都有详细说明：
- GitHub Actions 工作流
- Nginx 配置
- SSH 密钥管理
- 服务器初始化

### ✅ 提示词模板

文档中包含标准提示词，AI 可以直接使用：
```
"我的项目已配置 GitHub Actions 自动部署，请参考：
.claude/skills/auto-deploy.md"
```

---

## 🎯 项目信息

### 技术栈

- **前端**: React 19 + Vite 6 + TypeScript 5.8
- **样式**: Tailwind CSS (CDN)
- **后端**: Supabase (BaaS)
- **服务器**: Nginx (轻量级，适合 2GB 服务器)
- **CI/CD**: GitHub Actions

### 自动部署

- **触发**: `git push origin main`
- **时间**: 约 70 秒
- **构建**: 在 GitHub Actions（云端）
- **部署**: 自动上传到服务器 47.243.55.130

---

## 📁 关键文件

### GitHub Actions
- [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) - 自动部署工作流

### 配置文件
- [`deploy/nginx.conf`](deploy/nginx.conf) - Nginx 配置模板
- [`vite.config.ts`](vite.config.ts) - Vite 构建配置（已优化）

### 文档
- [`DEPLOY.md`](DEPLOY.md) - 部署文档
- [`docs/AUTO_DEPLOY_COMPLETE_GUIDE.md`](docs/AUTO_DEPLOY_COMPLETE_GUIDE.md) - 完整指南
- [`.claude/skills/auto-deploy.md`](.claude/skills/auto-deploy.md) - 部署 Skill

---

## 🚀 快速开始

### 方式 1: 使用 AI 助手

告诉 AI：
```
"我的项目参考 TRIX 3D Companion 的自动部署配置。
关键配置：
- 仓库: meowdoone/TRIX_ap
- 服务器: 47.243.55.130
- Skill 文件: .claude/skills/auto-deploy.md

请帮我：[描述你的需求]"
```

### 方式 2: 手动配置

参考文档：
1. 服务器初始化：[DEPLOY.md](DEPLOY.md#第-1-步初始化服务器)
2. GitHub 配置：[docs/AUTO_DEPLOY_COMPLETE_GUIDE.md](docs/AUTO_DEPLOY_COMPLETE_GUIDE.md#github-配置)
3. 测试部署：`git push origin main`

---

## 🔧 维护

### 更新依赖
```bash
npm update
```

### 检查部署状态
```bash
# GitHub Actions
gh run list -R meowdoone/TRIX_ap

# 服务器文件
ssh root@47.243.55.130 "ls -la /var/www/trix-3d-companion-web"

# Nginx 状态
ssh root@47.243.55.130 "systemctl status nginx"
```

### 回滚部署
```bash
ssh root@47.243.55.130
rm -rf /var/www/trix-3d-companion-web
cp -r /var/www/trix-3d-companion-web-backup /var/www/trix-3d-companion-web
systemctl reload nginx
```

---

## 📞 获取帮助

### 问题排查

1. 查看部署日志：[GitHub Actions](https://github.com/meowdoone/TRIX_ap/actions)
2. 检查 Nginx 日志：`/var/log/nginx/trix-3d-companion-error.log`
3. 阅读文档：[docs/AUTO_DEPLOY_COMPLETE_GUIDE.md](docs/AUTO_DEPLOY_COMPLETE_GUIDE.md#常见问题)

### 联系方式

- GitHub Issues: [https://github.com/meowdoone/TRIX_ap/issues](https://github.com/meowdoone/TRIX_ap/issues)

---

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE)

---

## 🙏 致谢

- [Supabase](https://supabase.com/) - 后端服务
- [Vite](https://vitejs.dev/) - 构建工具
- [GitHub Actions](https://github.com/features/actions) - CI/CD 平台

---

**项目**: TRIX 3D Companion
**仓库**: https://github.com/meowdoone/TRIX_ap
**AI 协作**: ✅ 已优化

> 💡 **提示**: 所有配置和文档都纳入版本控制，可以安全地让 AI 访问和理解！
