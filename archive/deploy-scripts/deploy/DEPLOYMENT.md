# 🚀 TRIX 3D Companion - 部署指南

**部署时间**: 2026-02-17
**分支**: feature/nanobot-integration
**提交**: 0e98da0

---

## 📋 部署前检查清单

- ✅ 代码已推送到 GitHub
- ✅ 构建测试通过
- ✅ 数据库迁移脚本已准备
- ⏳ 服务器环境检查

---

## 🗄️ 第一步：数据库迁移

### 方法 1：通过 Supabase Dashboard（推荐）

1. 打开 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择你的项目
3. 点击左侧菜单 "SQL Editor"
4. 点击 "New Query"
5. 复制 `database/migration-2026-02-17-user-settings.sql` 内容
6. 粘贴到编辑器
7. 点击 "Run" 执行
8. 验证表创建成功（查看结果）

### 方法 2：通过 Supabase CLI

```bash
# 如果已安装 Supabase CLI
supabase db push
```

### 验证迁移

执行以下 SQL 验证：

```sql
-- 检查表是否存在
SELECT table_name FROM information_schema.tables
WHERE table_name = 'user_settings';

-- 检查现有用户的默认设置是否创建
SELECT COUNT(*) as user_count FROM user_settings;
```

预期结果：
- `user_settings` 表存在
- `user_count` 等于你的用户数量

---

## 🌐 第二步：部署前端应用

### 方法 1：Vercel 部署（推荐）

#### 自动部署（已配置 CI/CD）

```bash
# 如果已配置 GitHub + Vercel 集成
# 只需合并分支到 main 即可自动触发部署
git checkout main
git merge feature/nanobot-integration
git push origin main
```

#### 手动部署

```bash
# 安装 Vercel CLI
npm i -g vercel

# 登录 Vercel
vercel login

# 部署
vercel --prod
```

### 方法 2：传统服务器部署

#### 2.1 构建生产版本

```bash
# 在项目根目录执行
npm run build

# 构建产物在 dist/ 目录
```

#### 2.2 上传到服务器

```bash
# 使用 SCP 上传
scp -r dist/* user@your-server:/var/www/trix-3d-companion/

# 或者使用 rsync
rsync -avz dist/ user@your-server:/var/www/trix-3d-companion/
```

#### 2.3 配置 Nginx

```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /var/www/trix-3d-companion;
    index index.html;

    # SPA 路由支持
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|mp4)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
```

#### 2.4 重启 Nginx

```bash
sudo nginx -t        # 测试配置
sudo systemctl reload nginx
```

---

## 🔧 第三步：环境变量配置

### 生产环境变量

确保在服务器或 Vercel 中配置以下环境变量：

```bash
# Supabase
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

# WebSocket (Clawbot)
VITE_CLAWBOT_CHANNEL_URL=wss://m.jmtrick.com
VITE_CLAWBOT_GATEWAY_URL=wss://m.jmtrick.com
VITE_GATEWAY_DASHBOARD_URL=https://your-dashboard-url
```

---

## ✅ 第四步：验证部署

### 1. 检查网站访问

```bash
curl -I https://your-domain.com
```

预期：返回 200 OK

### 2. 功能测试

在浏览器中测试以下功能：

- [ ] 打开个人中心
- [ ] 点击"关于我们" → 模态框正常显示
- [ ] 点击统计数字 → 详情弹窗正常显示
- [ ] 点击"隐私与安全" → 设置页面正常显示
- [ ] 点击积分徽章 → 历史记录正常显示
- [ ] 测试深色模式切换
- [ ] 测试语言切换

### 3. 数据库验证

```sql
-- 检查是否有用户创建设置
SELECT
  u.email,
  us.allow_stranger_search,
  us.show_online_status,
  us.allow_study_invites
FROM user_settings us
JOIN profiles u ON u.id = us.user_id
LIMIT 5;
```

---

## 🔥 回滚方案

如果部署出现问题，执行以下回滚：

```bash
# 方法 1: Git 回滚
git revert <commit-hash>
git push

# 方法 2: Vercel 回滚
# 在 Vercel Dashboard → Deployments → 找到之前的版本 → Redeploy

# 方法 3: 数据库回滚
DROP TABLE IF EXISTS user_settings;
```

---

## 📊 部署后监控

### 检查日志

```bash
# Nginx 访问日志
tail -f /var/log/nginx/access.log

# Nginx 错误日志
tail -f /var/log/nginx/error.log
```

### 性能监控

- 使用 [Lighthouse](https://developers.google.com/web/tools/lighthouse) 检查性能
- 使用 Vercel Analytics 查看访问数据
- 检查 Supabase Dashboard 查看数据库性能

---

## 📞 支持

如果遇到问题：

1. 检查构建日志：`npm run build`
2. 检查浏览器控制台错误
3. 检查 Supabase 日志
4. 查看网络请求（F12 → Network）

---

**部署完成后，请更新这个文档记录实际部署情况。**
