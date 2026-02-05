# 🚀 TRIX Production Mode - 完整实施指南

## 📋 概览

本指南将帮助你将 TRIX 从"Mock 模式"迁移到"生产模式"，采用混合架构:
- **数据层 (云端)**: Supabase - 用户认证、用户资料、任务历史
- **操作层 (本地)**: WebSocket - 连接移动应用与本地 Python 服务器 (运行 OpenClaw)

---

## 第一部分: 前端准备

### 1. 安装依赖

```bash
npm install @supabase/supabase-js
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`:

```bash
copy .env.example .env
```

然后编辑 `.env` 文件，填入你的 Supabase 凭据。

---

## 第二部分: Supabase 设置

### 步骤 1: 创建 Supabase 项目

1. 访问 [Supabase Dashboard](https://app.supabase.com)
2. 点击 "New Project"
3. 填写项目信息:
   - Name: `trix-production`
   - Database Password: (记住这个密码)
   - Region: 选择离你最近的区域

### 步骤 2: 获取 API 密钥

1. 进入项目 → Settings → API
2. 复制以下内容到 `.env` 文件:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon/public key** → `VITE_SUPABASE_ANON_KEY`

### 步骤 3: 创建数据库表

1. 进入 SQL Editor (左侧菜单)
2. 点击 "New Query"
3. 复制粘贴以下 SQL 代码并点击 "Run":

\`\`\`sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  points INTEGER DEFAULT 0,
  avatar_config JSONB DEFAULT '{
    "head": "default",
    "body": "default",
    "legs": "default",
    "accessory": "none"
  }'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create task_history table
CREATE TABLE task_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  task_type TEXT NOT NULL,
  task_description TEXT,
  points_earned INTEGER DEFAULT 0,
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_history ENABLE ROW LEVEL SECURITY;

-- Policies for profiles table
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Policies for task_history table
CREATE POLICY "Users can view their own task history"
  ON task_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own task history"
  ON task_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Function to automatically create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile automatically
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
\`\`\`

### 步骤 4: 配置邮箱认证 (可选)

1. 进入 Authentication → Settings
2. 在 "Email Auth" 中配置:
   - 启用 "Enable email confirmations" (如果需要邮箱验证)
   - 或者禁用它用于开发测试

---

## 第三部分: Python 后端设置

### 步骤 1: 安装 Python 依赖

```bash
pip install -r requirements.txt
```

或手动安装:

```bash
pip install websockets
```

### 步骤 2: 运行 WebSocket 服务器

```bash
python server.py
```

你应该看到:

```
Starting TRIX WebSocket Server on 0.0.0.0:8080
Waiting for connections from mobile app...
```

### 步骤 3: 查找你的 PC IP 地址

**Windows (PowerShell):**
```powershell
ipconfig | findstr IPv4
```
PS C:\Users\王健俊> ipconfig | findstr IPv4
   IPv4 ?? . . . . . . . . . . . . : 198.18.0.1
   IPv4 ?? . . . . . . . . . . . . : 192.168.101.4
PS C:\Users\王健俊>
记下你的本地 IP (例如: `192.168.1.100`)

### 步骤 4: 更新前端 WebSocket URL (如果需要)

如果你的移动设备和 PC 在同一局域网:

编辑 `src/hooks/usePCConnection.ts`:

```typescript
export const usePCConnection = (url: string = 'ws://YOUR_PC_IP:8080'): UsePCConnectionReturn => {
```

将 `YOUR_PC_IP` 替换为你的实际 IP。

---

## 第四部分: 测试集成

### 测试 1: Supabase 认证

1. 启动前端应用: `npm run dev`
2. 访问注册页面
3. 填写:
   - 用户名: `testuser`
   - 邮箱: `test@example.com`
   - 密码: `password123`
4. 点击注册
5. 检查 Supabase Dashboard → Authentication → Users，应该能看到新用户

### 测试 2: WebSocket 连接

1. 确保 `server.py` 正在运行
2. 打开前端应用的主页
3. 查看右上角状态指示器:
   - 🟢 绿点 = 已连接
   - 🟡 黄点 = 连接中
   - ⚪ 灰点 = 离线

### 测试 3: 发送命令

1. 进入聊天页面
2. 点击 "TRIX 机器人"
3. 发送消息: `organize files`
4. 观察进度条更新

---

## 第五部分: 数据流架构

```
┌─────────────┐
│ React App   │
│ (Mobile)    │
└─────┬───────┘
      │
      ├─────────────────┐
      │                 │
      ▼                 ▼
┌─────────────┐   ┌──────────────┐
│  Supabase   │   │  WebSocket   │
│  (Cloud)    │   │  (Local PC)  │
│             │   │              │
│ • Auth      │   │ • Commands   │
│ • Profile   │   │ • Progress   │
│ • History   │   │ • OpenClaw   │
└─────────────┘   └──────────────┘
```

### 数据层 (Supabase) - "记忆"
- 用户注册/登录
- 保存用户积分、衣柜配置
- 存储任务历史记录
- 跨设备同步

### 操作层 (WebSocket) - "神经"
- 实时命令传输
- 进度反馈
- 本地 PC 控制
- OpenClaw 集成

---

## 第六部分: 可用命令

当前 `server.py` 支持以下命令:

| 命令 | 描述 | 示例输出 |
|------|------|----------|
| `organize_files` | 整理桌面文件 | 5步进度更新 |
| `clean_downloads` | 清理下载文件夹 | 清理空间统计 |
| `take_screenshot` | 截图 | 保存位置 |
| `ping` | 测试连接 | pong |

---

## 第七部分: 下一步开发

### 短期目标
- [ ] 在 ProfileScreen 中集成 Supabase 数据
- [ ] 在 ChatDetail 中实现真实的 WebSocket 命令
- [ ] 添加任务历史记录功能
- [ ] 实现积分系统

### 中期目标
- [ ] 集成真实的 OpenClaw 功能
- [ ] 添加文件上传/下载
- [ ] 实现语音命令
- [ ] 添加推送通知

### 长期目标
- [ ] 多用户协作
- [ ] AI 助手集成
- [ ] 3D 虚拟环境
- [ ] 移动端原生应用

---

## 🛡️ 安全注意事项

⚠️ **重要安全提示:**

1. **WebSocket 服务器** 目前只应在局域网使用
2. **不要** 将 WebSocket 暴露到公网
3. **生产环境需要**:
   - WSS (WebSocket Secure) + SSL 证书
   - 身份验证令牌
   - IP 白名单
   - 速率限制

4. **Supabase RLS** 已启用,确保:
   - 每个表都有正确的策略
   - 用户只能访问自己的数据

---

## 📞 故障排除

### 问题 1: "找不到模块 react"
**解决方案:** 运行 `npm install`

### 问题 2: WebSocket 连接失败
**检查:**
- 服务器是否在运行?
- 防火墙是否阻止端口 8080?
- IP 地址是否正确?

### 问题 3: Supabase 认证失败
**检查:**
- `.env` 文件是否存在?
- API 密钥是否正确?
- 是否重启了开发服务器?

### 问题 4: SQL 执行错误
**解决方案:**
- 检查是否有语法错误
- 确保按顺序执行所有语句
- 查看 Supabase Logs

---

## 🎉 完成!

你的 TRIX 应用现在已经进入生产模式!

**测试清单:**
- ✅ 用户可以注册/登录
- ✅ WebSocket 连接正常
- ✅ 可以发送命令并接收响应
- ✅ 数据库正确存储用户信息

**下一步:** 开始实现具体的功能逻辑!
