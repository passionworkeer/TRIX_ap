# 🎬 主界面视频背景实现说明

## 📋 修改内容

### 文件: `src/components/HeroBackground.tsx`

**原实现**: 静态图片 (`/assets/role.jpg`)  
**新实现**: 循环播放视频 (`/assets/role_video.mp4`)

---

## 🎯 核心改动

### 1. 资源路径更新
```typescript
// 旧代码
const HERO_BG = "/assets/role.jpg";

// 新代码
const HERO_VIDEO = "/assets/role_video.mp4";
```

### 2. HTML 元素替换
```tsx
// 旧代码: 图片元素
<img
  src={HERO_BG}
  alt="Hero Character"
  style={{ ... }}
/>

// 新代码: 视频元素
<video
  src={HERO_VIDEO}
  autoPlay
  loop
  muted
  playsInline
  style={{ ... }}
/>
```

---

## 🔧 关键属性说明

### 视频属性
- **`autoPlay`**: 页面加载时自动播放
- **`loop`**: 无限循环播放
- **`muted`**: 静音播放 (必须,否则浏览器会阻止自动播放)
- **`playsInline`**: 移动端内联播放 (防止全屏)

### 样式保持
- **定位**: `position: absolute` 全屏覆盖
- **尺寸**: `width/height: 100%` 铺满容器
- **填充**: `objectFit: cover` 保持比例裁剪
- **对齐**: `objectPosition: center` 居中显示
- **层级**: `zIndex: 1` (在背景色之上,渐变遮罩之下)

---

## 📦 文件结构

### 视频文件位置
```
src/
  assets/
    role_video.mp4  ← 源视频文件
```

### 公开访问路径
```
/assets/role_video.mp4  ← 浏览器访问路径
```

**注意**: Vite 会自动将 `public/assets/` 映射到 `/assets/`

---

## ✅ 验证清单

### 前端检查
- [ ] 视频文件已放置在 `public/assets/role_video.mp4`
- [ ] 页面加载时视频自动播放
- [ ] 视频循环播放无闪烁
- [ ] 视频保持静音状态
- [ ] 移动端视频正常显示 (不全屏)

### 浏览器兼容性
- [ ] Chrome/Edge (Chromium): ✅ 完全支持
- [ ] Safari (iOS/macOS): ✅ 支持 (需要 `playsInline`)
- [ ] Firefox: ✅ 完全支持

### 控制台检查
```javascript
// 如果视频加载失败会显示:
❌ 视频加载失败: /assets/role_video.mp4
```

---

## 🐛 常见问题

### 问题 1: 视频不自动播放
**原因**: 浏览器阻止带声音的自动播放  
**解决**: 确保添加了 `muted` 属性

### 问题 2: 移动端视频全屏
**原因**: 默认行为  
**解决**: 添加 `playsInline` 属性

### 问题 3: 视频加载失败
**排查步骤**:
1. 检查文件路径: `public/assets/role_video.mp4`
2. 检查文件格式: MP4 (H.264 编码最佳)
3. 打开浏览器 DevTools → Network 查看请求状态

### 问题 4: 视频太大加载慢
**优化建议**:
- 压缩视频大小 (建议 < 5MB)
- 使用 H.264 编码 + MP4 容器
- 降低分辨率 (1080p → 720p)
- 使用工具: HandBrake, FFmpeg

```bash
# FFmpeg 压缩示例
ffmpeg -i input.mp4 -vcodec h264 -acodec aac -b:v 1M -s 1280x720 output.mp4
```

---

## 📊 技术对比

| 特性 | 图片 | 视频 |
|------|------|------|
| 文件大小 | ~200KB | ~2-5MB |
| 加载速度 | ⚡ 快 | 🐢 较慢 |
| 视觉效果 | 静态 | 🎬 动态 |
| 用户体验 | 普通 | ⭐ 更吸引 |
| 浏览器支持 | ✅ 全部 | ✅ 现代浏览器 |

---

## 🎨 渐变遮罩说明

视频上方保留了原有的渐变遮罩:
```css
background: linear-gradient(
  to bottom, 
  rgba(0,0,0,0.3),  /* 顶部半透明黑色 */
  transparent,       /* 中间透明 */
  rgba(0,0,0,0.6)   /* 底部较深黑色 */
)
```

**作用**: 
- 提升文字可读性
- 营造景深效果
- 与界面其他元素融合

---

## 🚀 下一步优化建议

### 性能优化
1. **懒加载**: 仅在首页加载视频
2. **预加载**: `<link rel="preload" as="video" href="/assets/role_video.mp4">`
3. **多格式支持**:
```tsx
<video>
  <source src="/assets/role_video.webm" type="video/webm" />
  <source src="/assets/role_video.mp4" type="video/mp4" />
</video>
```

### 用户体验
1. **加载占位**: 视频加载前显示图片
2. **播放控制**: 添加暂停/播放按钮
3. **用户偏好**: 尊重 `prefers-reduced-motion` 设置

```tsx
const prefersReducedMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)'
).matches;

// 如果用户偏好减少动画,显示静态图片
```

---

## 📝 总结

✅ **已完成**:
- 视频元素替换图片元素
- 自动循环播放配置
- 全屏覆盖样式保持
- 错误处理机制

🎯 **效果**:
- 主界面更加生动有趣
- 视觉吸引力提升
- 保持了原有的布局和层级

⚠️ **注意事项**:
- 确保视频文件已放置在 `public/assets/`
- 视频大小控制在合理范围 (< 5MB)
- 移动端流量消耗需考虑
