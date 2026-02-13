# 🐛 媒体 URL 调试指南

## ✅ 已完成的修复

### 1. **桶名称统一为 `TRIX`**

在 `src/services/uploadService.ts` 中:
```typescript
// 定义了常量,防止手误
const BUCKET_NAME = 'TRIX';

// 上传文件
supabase.storage.from(BUCKET_NAME).upload(...)

// 获取公共 URL
supabase.storage.from(BUCKET_NAME).getPublicUrl(...)

// 删除文件
supabase.storage.from(BUCKET_NAME).remove(...)
```

### 2. **添加了调试日志**

#### 上传服务 (`uploadService.ts`)
```typescript
// 上传成功后会打印:
console.log('🔗 [Upload] Generated public URL:', {
  bucket: BUCKET_NAME,
  path: filePath,
  fullUrl: urlData.publicUrl
});
```

#### 聊天详情 (`ChatDetail.tsx`)
```typescript
// 加载消息时会打印:
console.log('🖼️ [ChatDetail] Loading media message:', {
  messageType: dbMsg.message_type,
  mediaUri: dbMsg.media_uri,
  mediaType: dbMsg.media_type
});
```

#### 媒体组件 (`MediaMessage.tsx`)
```typescript
// 渲染时会打印:
console.log('🖼️ [MediaMessage] Rendering:', {
  type,
  uri,
  uriLength: uri?.length,
  uriPreview: uri?.substring(0, 100)
});

// 加载失败时会打印:
console.error('❌ [MediaMessage] Image/Video load failed:', uri);
```

## 🔍 如何调试

### 测试步骤:

1. **打开浏览器开发者工具** (F12)
2. **切换到 Console 标签页**
3. **上传一张图片到聊天**
4. **观察控制台输出**,应该看到:

```
📤 [Upload] Upload path: <user-id>/images/<uuid>.jpg
📊 [Upload] Extracted metadata: { width: ..., height: ... }
✅ [Upload] Upload successful: { ... }
🔗 [Upload] Generated public URL: {
  bucket: 'TRIX',
  path: '<user-id>/images/<uuid>.jpg',
  fullUrl: 'https://<project>.supabase.co/storage/v1/object/public/TRIX/<user-id>/images/<uuid>.jpg'
}
✅ [Upload] Complete: { uri: '...', size: '...' }
```

5. **检查生成的 URL 格式**:
   - ✅ 正确: `https://<project>.supabase.co/storage/v1/object/public/TRIX/...`
   - ❌ 错误: `https://<project>.supabase.co/storage/v1/object/public/chat_attachments/...`

6. **查看图片渲染日志**:

```
🖼️ [ChatDetail] Loading media message: {
  messageType: 'image',
  mediaUri: 'https://...',
  mediaType: 'image/jpeg'
}
🖼️ [MediaMessage] Rendering: {
  type: 'image',
  uri: 'https://...',
  uriLength: 150,
  uriPreview: 'https://...'
}
```

7. **如果图片加载失败**,会看到:

```
❌ [MediaMessage] Image load failed: https://...
```

## 🔧 可能的问题和解决方案

### 问题 1: URL 中仍然包含 `chat_attachments`
**解决方案**: 检查是否有旧的缓存数据,清除浏览器缓存或使用隐私模式测试

### 问题 2: 图片 URL 正确但仍然 404
**解决方案**: 
1. 检查 Supabase Storage 中是否真的有该文件
2. 检查存储桶权限设置
3. 确保存储桶是 public 或有正确的 RLS 策略

### 问题 3: 图片显示 CORS 错误
**解决方案**: 
1. 在 Supabase Dashboard > Storage > TRIX > Configuration
2. 确保 CORS 允许你的域名

### 问题 4: 数据库中保存的是旧的 URL
**解决方案**: 
- 旧消息的 URL 不会自动更新
- 只有新上传的图片会使用正确的 URL
- 如需修复旧数据,需要运行数据迁移脚本

## 📋 验证清单

- [x] `uploadService.ts` 使用 `BUCKET_NAME = 'TRIX'` 常量
- [x] 上传时使用 `from(BUCKET_NAME)`
- [x] 获取 URL 时使用 `from(BUCKET_NAME)`
- [x] 删除时使用 `from(BUCKET_NAME)`
- [x] 项目中没有任何 `'chat_attachments'` 字符串
- [x] 添加了详细的调试日志
- [x] `ChatDetail.tsx` 直接使用 `media_uri`,没有路径拼接
- [x] `MediaMessage.tsx` 直接使用传入的 `uri`

## 🎯 预期结果

上传图片后,生成的 URL 应该是:
```
https://<your-project>.supabase.co/storage/v1/object/public/TRIX/<user-id>/images/<uuid>.jpg
```

而不是:
```
https://<your-project>.supabase.co/storage/v1/object/public/chat_attachments/...
```
