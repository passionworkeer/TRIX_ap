# 环境变量参考文档

> 本文档详细列出 TRIX 3D Companion 项目中使用的所有环境变量
> **最后更新**: 2026-03-17

---

## 目录

1. [必需变量](#1-必需变量)
2. [TRIX Native Channel](#2-trix-native-channel-推荐)
3. [Legacy Clawbot (兼容)](#3-legacy-clawbot-兼容)
4. [阿里云 OSS](#4-阿里云-oss)
5. [日志配置](#5-日志配置)
6. [其他配置](#6-其他配置)
7. [服务器端变量](#7-服务器端变量)

---

## 1. 必需变量

### Supabase 配置

| 变量名 | 类型 | 必需 | 说明 |
|--------|------|------|------|
| `VITE_SUPABASE_URL` | string | ✅ | Supabase 项目 URL，如 `https://__SUPABASE_PROJECT_REF_REDACTED__.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | string | ✅ | Supabase anon public key |

**获取方式**:
1. 访问 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择项目 → Settings → API
3. 复制 Project URL 和 anon key

---

## 2. TRIX Native Channel (推荐)

这是推荐的通道配置，用于 iOS 与 Web 的双向消息同步。

| 变量名 | 类型 | 必需 | 说明 |
|--------|------|------|------|
| `VITE_TRIX_NATIVE_SERVER_URL` | string | 推荐 | TRIX Native Server 地址<br>开发: `http://localhost:8788`<br>生产: `http://TRIX_SERVER_HOST:8788` |
| `VITE_TRIX_NATIVE_PUBLIC_URL` | string | 可选 | 对外公开的 URL，用于生成 QR 码链接 |

**配置示例**:

```bash
# 开发环境
VITE_TRIX_NATIVE_SERVER_URL=http://localhost:8788
VITE_TRIX_NATIVE_PUBLIC_URL=http://localhost:8788

# 生产环境
VITE_TRIX_NATIVE_SERVER_URL=http://TRIX_SERVER_HOST:8788
VITE_TRIX_NATIVE_PUBLIC_URL=http://TRIX_SERVER_HOST:8788
```

---

## 3. Legacy Clawbot (兼容)

旧的通道配置，仅用于兼容现有部署。

| 变量名 | 类型 | 必需 | 说明 |
|--------|------|------|------|
| `VITE_CLAWBOT_CHANNEL_URL` | string | ❌ | Clawbot Channel WebSocket 地址 (已废弃) |
| `VITE_GATEWAY_WS_URL` | string | ❌ | Gateway WebSocket 地址 |
| `VITE_GATEWAY_AUTH_TOKEN` | string | ❌ | Gateway 认证 Token |

**注意**: 使用 TRIX Native Channel 时不需要这些变量。

---

## 4. 阿里云 OSS

用于文件上传（图片、音频、视频）。

| 变量名 | 类型 | 必需 | 说明 |
|--------|------|------|------|
| `VITE_ALIYUN_OSS_REGION` | string | 推荐 | OSS 区域，如 `oss-cn-hangzhou` |
| `VITE_ALIYUN_OSS_BUCKET` | string | 推荐 | OSS Bucket 名称 |
| `VITE_ALIYUN_OSS_ACCESS_KEY_ID` | string | 推荐 | Access Key ID |
| `VITE_ALIYUN_OSS_ACCESS_KEY_SECRET` | string | 推荐 | Access Key Secret |
| `VITE_ALIYUN_OSS_ENDPOINT` | string | 推荐 | OSS 端点，如 `oss-cn-hangzhou.aliyuncs.com` |

**配置示例**:

```bash
VITE_ALIYUN_OSS_REGION=oss-cn-hangzhou
VITE_ALIYUN_OSS_BUCKET=your-bucket-name
VITE_ALIYUN_OSS_ACCESS_KEY_ID=LTAI...
VITE_ALIYUN_OSS_ACCESS_KEY_SECRET=your-secret
VITE_ALIYUN_OSS_ENDPOINT=oss-cn-hangzhou.aliyuncs.com
```

---

## 5. 日志配置

| 变量名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `VITE_LOG_LEVEL` | string | `error` (生产) / `debug` (开发) | 日志级别: `debug` \| `info` \| `warn` \| `error` |
| `VITE_ENABLE_REMOTE_LOGGING` | string | `false` | 是否启用远程日志上报 |
| `VITE_REMOTE_LOG_ENDPOINT` | string | - | 远程日志服务端点 |

---

## 6. 其他配置

| 变量名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `VITE_USE_SERVER_OSS_UPLOAD` | string | `true` | 是否使用服务端 OSS 上传 (`true` / `false`) |
| `VITE_TTS_PROXY_URL` | string | - | TTS 语音合成代理 URL |

---

## 7. 服务器端变量

这些变量用于 TRIX Native Server (端口 8788)。

### 服务器运行

| 变量名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `PORT` | number | `8788` | 服务器端口 |
| `HOST` | string | `0.0.0.0` | 服务器绑定地址 |
| `NODE_ENV` | string | `development` | 运行环境 |

### TRIX Native Server

| 变量名 | 类型 | 说明 |
|--------|------|------|
| `TRIX_NATIVE_ADMIN_TOKEN` | string | 管理员 Token，用于创建配对码 |
| `TRIX_NATIVE_PUBLIC_BASE_URL` | string | 公开访问地址，用于生成 QR 码 |
| `TRIX_NATIVE_STORAGE_DIR` | string | 数据存储目录，默认 `./.trix-native-channel` |

### OpenClaw Gateway

| 变量名 | 类型 | 说明 |
|--------|------|------|
| `GATEWAY_URL` | string | Gateway WebSocket 地址，如 `ws://127.0.0.1:18789` |
| `GATEWAY_AUTH_TOKEN` | string | Gateway 认证 Token |

---

## 环境文件优先级

项目使用以下环境文件（优先级从高到低）:

1. `.env.production` - 生产环境
2. `.env` - 本地开发
3. `.env.example` - 模板文件

**注意**: 前端环境变量必须以 `VITE_` 开头，否则无法在浏览器中使用。

---

## 快速配置

### 开发环境

```bash
# 复制模板
cp .env.example .env

# 编辑 .env 填入真实配置
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_TRIX_NATIVE_SERVER_URL=http://localhost:8788
```

### 生产环境 (.env.production)

```bash
VITE_SUPABASE_URL=https://__SUPABASE_PROJECT_REF_REDACTED__.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_TRIX_NATIVE_SERVER_URL=http://TRIX_SERVER_HOST:8788
VITE_TRIX_NATIVE_PUBLIC_URL=http://TRIX_SERVER_HOST:8788
```

---

## 故障排查

### Q: 提示 "VITE_SUPABASE_URL is required"

**A**: 确保在 `.env` 文件中正确配置了 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`

### Q: TRIX Native 配对失败

**A**: 检查 `VITE_TRIX_NATIVE_SERVER_URL` 是否正确配置，服务器是否运行

### Q: 文件上传失败

**A**: 检查阿里云 OSS 配置是否正确，Access Key 是否有上传权限

---

**最后更新**: 2026-03-17
