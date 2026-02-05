# 🔧 Supabase 配置快速指南

## ❌ 常见错误：Invalid API key

如果你看到这个错误：
```
获取好友列表失败: {message: 'Invalid API key', hint: 'Double check your Supabase `anon` or `service_role` API key.'}
```

**原因**：使用了错误格式的 API Key（如 `sb_publishable_...` 开头的密钥）

## ✅ 正确的配置步骤

### 1️⃣ 访问 Supabase 项目设置

打开浏览器，访问：
```
https://supabase.com/dashboard/project/__SUPABASE_PROJECT_REF_REDACTED__/settings/api
```

### 2️⃣ 找到正确的密钥

在页面上你会看到：

#### 📍 Project URL
```
https://__SUPABASE_PROJECT_REF_REDACTED__.supabase.co
```
✅ 这个 URL 是正确的

#### 🔑 Project API keys

这里有两个密钥：

1. **anon public** ✅ 这是你需要的！
   - 格式：`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ...`
   - 特征：以 `eyJ` 开头，非常长（约 200+ 字符）
   - 用途：前端应用使用

2. **service_role** ❌ 不要用这个！
   - 格式：也是 `eyJ` 开头的 JWT token
   - 用途：仅限后端服务器使用，有完全访问权限

### 3️⃣ 复制正确的密钥

1. 点击 **anon public** 旁边的复制按钮
2. 打开 `e:\desktop\trix-3d-companion\.env` 文件
3. 替换 `VITE_SUPABASE_ANON_KEY` 的值

**正确示例**：
```env
VITE_SUPABASE_URL=https://__SUPABASE_PROJECT_REF_REDACTED__.supabase.co
VITE_SUPABASE_ANON_KEY=__SUPABASE_ANON_KEY_REDACTED__
```

**错误示例**（不要使用）：
```env
VITE_SUPABASE_ANON_KEY=__SUPABASE_PUBLISHABLE_KEY_REDACTED__  ❌ 错误格式！
```

### 4️⃣ 重启开发服务器

保存 `.env` 文件后，在终端运行：
```powershell
npm run dev
```

### 5️⃣ 验证连接

打开浏览器控制台（F12），如果看到好友列表、聊天记录等数据，说明配置成功！

## 🔍 其他密钥说明

### JWT Secret（不需要）
- 位置：Project Settings > API > JWT Settings
- 用途：仅用于验证 JWT token，不需要在前端使用
- **前端不需要配置这个！**

### Database Password（不需要）
- 位置：Project Settings > Database
- 用途：直接连接 PostgreSQL 数据库（如使用 psql 客户端）
- **前端不需要配置这个！**

## 📝 当前已配置

我已经帮你在 `.env` 文件中配置了正确的密钥。如果还是无法连接，请：

1. 确认你已经在 Supabase 控制台执行了 `database/init.sql` 脚本
2. 检查 Supabase 项目是否处于活动状态（未暂停）
3. 检查浏览器控制台是否有其他错误信息

## 🚀 测试数据库连接

打开浏览器控制台，运行：
```javascript
import { supabase } from './src/config/supabase';

// 测试连接
const { data, error } = await supabase.from('friends').select('*');
console.log('数据库连接测试:', data, error);
```

如果返回好友数据，说明连接成功！
