# 阿里云 OSS 配置指南

## 📋 概述

本项目使用阿里云 OSS 存储多模态数据（图片、视频等）。

**Bucket 信息：**
- Region: `oss-cn-shenzhen`
- Bucket: `jmtrick-assets`
- Endpoint: `oss-cn-shenzhen.aliyuncs.com`

---

## ⚙️ 配置 CORS 规则（必须）

由于浏览器安全限制，需要在 OSS Bucket 配置 CORS 规则才能上传文件。

### 步骤 1：登录阿里云 OSS 控制台

1. 访问：https://oss.console.aliyun.com/
2. 选择 Bucket：`jmtrick-assets`
3. 点击 **权限管理** → **跨域设置（CORS）**

### 步骤 2：添加 CORS 规则

点击 **创建规则**，填写以下信息：

| 字段 | 值 |
|------|-----|
| **来源（Allowed Origin）** | `*` （开发环境）或你的域名 |
| **允许 Methods** | `GET, POST, PUT, DELETE, HEAD` |
| **允许 Headers** | `*` |
| **暴露 Headers** | `ETag, x-oss-request-id` |
| **缓存时间** | `3600` |

**示例配置：**

```json
[
  {
    "allowedOrigin": ["*"],
    "allowedMethod": ["GET", "POST", "PUT", "DELETE", "HEAD"],
    "allowedHeader": ["*"],
    "exposeHeader": ["ETag", "x-oss-request-id"],
    "maxAgeSeconds": 3600
  }
]
```

### 步骤 3：保存配置

点击 **确定** 保存 CORS 规则。

---

## 🔐 安全建议

### 当前实现（开发/测试）

当前代码直接在前端使用 `AccessKey` 和 `AccessKeySecret`，适合开发和测试。

### 生产环境推荐

**生产环境应该使用以下方式之一：**

#### 方案 1：STS 临时凭证（推荐）

1. 创建 RAM 角色
2. 使用 STS 服务生成临时凭证
3. 前端使用临时凭证上传

**优点：**
- ✅ 临时凭证可设置过期时间
- ✅ 可以限制权限范围
- ✅ 密钥泄露风险小

#### 方案 2：后端签名 URL

1. 前端请求后端生成签名 URL
2. 前端使用签名 URL 直接上传

**优点：**
- ✅ 前端不暴露密钥
- ✅ 可以控制上传权限
- ✅ 更加安全

---

## 📊 上传流程

### 当前实现

```
┌─────────────┐
│  用户选择    │
│  文件/图片   │
└──────┬──────┘
       │
       ↓
┌─────────────┐
│ NanobotBridge│
│ uploadMedia()│
└──────┬──────┘
       │
       ↓
┌─────────────┐
│  OSSService │
│ uploadFile()│
└──────┬──────┘
       │
       ↓
┌─────────────────────────┐
│ 阿里云 OSS Bucket        │
│ jmtrick-assets          │
│ oss-cn-shenzhen         │
└─────────────────────────┘
```

### 返回的 URL 格式

```
https://jmtrick-assets.oss-cn-shenzhen.aliyuncs.com/trix-uploads/1234567890_abc123.jpg
```

---

## 🧪 测试上传

### 在浏览器控制台测试

```javascript
// 1. 导入服务
import ossService from './services/OSSService';

// 2. 创建测试文件
const blob = new Blob(['Hello OSS'], { type: 'text/plain' });

// 3. 上传
const result = await ossService.uploadFile(blob);
console.log('上传成功:', result.url);
```

### 在 App 中使用

```typescript
import { nanobotBridge } from './services/NanobotBridge';

// 上传图片
const file = ...; // 用户选择的文件
const url = await nanobotBridge.uploadMedia(file);

// 发送图片消息
nanobotBridge.sendMessage('查看这张图片', 'image', url);
```

---

## 📁 文件命名规则

上传的文件会自动按照以下规则命名：

```
trix-uploads/{timestamp}_{random}.{extension}
```

**示例：**
- `trix-uploads/1706123456789_abc123.jpg`
- `trix-uploads/1706123456790_def456.png`
- `trix-uploads/1706123456791_ghi789.mp4`

---

## 💰 成本估算

### 存储费用

- 标准存储（LRS）：¥0.12/GB/月
- 预估：1GB ≈ ¥0.12/月

### 流量费用

- 外网流出流量：¥0.50/GB
- CDN 回源流量：¥0.15/GB

**建议：** 配置 CDN 加速降低流量成本

---

## 🔧 故障排查

### 上传失败：403 Forbidden

**原因：** CORS 规则未配置或配置错误

**解决：** 检查 CORS 规则是否正确配置

### 上传失败：SignatureDoesNotMatch

**原因：** 签名计算错误

**解决：**
1. 检查 AccessKey 和 Secret 是否正确
2. 检查系统时间是否准确

### 上传失败：AccessDenied

**原因：** RAM 权限不足

**解决：** 确保 RAM 用户有 OSS 写入权限

---

## 📝 相关文件

- `src/services/OSSService.ts` - OSS 上传服务
- `src/services/NanobotBridge.ts` - 使用 OSS 上传的 Bridge
- `.env` - OSS 配置信息

---

## ⚠️ 重要提醒

**当前实现使用明文 AccessKey Secret，仅适合开发和测试！**

**生产环境务必使用：**
- STS 临时凭证
- 或后端签名 URL

---

有问题随时联系！
