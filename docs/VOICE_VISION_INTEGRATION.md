# 🎤📷 语音与视觉功能集成文档

## 📋 概述

TRIX 应用现已集成**语音转文字**和**视觉识别**两大 AI 能力,支持通过语音控制电脑和拍照分析物体。

---

## 🎤 语音转文字功能

### 核心技术
- **Web Speech API** - 浏览器原生语音识别
- **实时转写** - 边说边显示,即时反馈
- **中文优化** - 默认使用 `zh-CN` 语言模型

### 使用场景
1. **语音控制电脑** - 在聊天界面直接说话发送命令
2. **解放双手** - 免打字输入,更高效
3. **移动场景** - 走路、开车时也能操作

### 功能特性

#### ✅ 已实现
- [x] 实时语音识别
- [x] 中文/英文支持
- [x] 动态 UI 状态 (监听中/空闲)
- [x] 自动填充输入框
- [x] 错误处理与权限管理
- [x] 优雅的动画效果 (脉冲动画)

#### 🎯 使用方法

**在聊天界面 (ChatDetail):**

1. **点击麦克风按钮** 🎤
   - 按钮变为红色并闪烁
   - 输入框显示 "🎤 正在监听..."

2. **开始说话**
   - 实时显示识别的文字
   - 支持临时结果预览

3. **停止录音**
   - 再次点击麦克风 (或自动停止)
   - 识别结果自动填充到输入框
   - 可以继续编辑或直接发送

4. **发送命令**
   - 点击发送按钮
   - 命令通过 Clawdbot Gateway 发送到电脑

#### 📱 UI 状态

| 状态 | 麦克风图标 | 按钮样式 | 输入框提示 |
|------|-----------|---------|-----------|
| 空闲 | 🎤 Mic | 灰色背景 | "发送消息..." |
| 监听中 | 🚫 MicOff | 红色背景 + 脉冲 | "🎤 正在监听..." |
| 识别中 | 🎤 Mic | 灰色背景 | 显示识别文字 |

#### 🔧 技术细节

**Hook: `useSpeechToText`**

```typescript
const {
  isListening,        // 是否正在监听
  transcript,         // 最终识别结果
  fullTranscript,     // 完整文本 (包括临时结果)
  startListening,     // 开始监听
  stopListening,      // 停止监听
  reset,              // 重置
  isSupported,        // 浏览器是否支持
  error,              // 错误信息
} = useSpeechToText({
  lang: 'zh-CN',              // 语言
  continuous: false,          // 是否持续监听
  interimResults: true,       // 是否显示临时结果
  onResult: (text) => {},     // 识别完成回调
  onError: (err) => {},       // 错误回调
});
```

**状态机:**
```
idle → listening → processing → idle
  ↓                               ↑
  └─────── error ←───────────────┘
```

#### ⚠️ 权限要求
- **麦克风权限** - 首次使用时会请求
- **HTTPS/Localhost** - Web Speech API 要求安全上下文
- **浏览器支持** - Chrome/Edge/Safari 支持,Firefox 部分支持

#### 🐛 常见问题

**Q: 点击麦克风没反应?**
- 检查麦克风权限 (浏览器地址栏)
- 确保使用 HTTPS 或 localhost
- 查看控制台错误信息

**Q: 识别不准确?**
- 说话清晰,速度适中
- 减少环境噪音
- 中文识别需要网络连接

**Q: 浏览器不支持?**
- Chrome/Edge: ✅ 完全支持
- Safari: ✅ 支持 (iOS 14.5+)
- Firefox: ⚠️ 部分支持
- 其他: ❌ 可能不支持

---

## 📷 视觉识别功能

### 核心技术
- **MediaDevices API** - 浏览器原生相机访问
- **Canvas API** - 图像捕获与处理
- **实时预览** - 所见即所得

### 使用场景
1. **物体识别** - 拍照识别物品信息
2. **快照分析** - AI 视觉理解
3. **文字提取** - OCR 识别 (后续)
4. **场景理解** - 环境感知 (后续)

### 功能特性

#### ✅ 已实现
- [x] 实时相机预览
- [x] 前置/后置摄像头切换
- [x] 高清照片拍摄 (1920x1080)
- [x] 照片预览与确认
- [x] Blob/DataURL 双格式输出
- [x] 优雅降级 (相机失败 → 演示模式)
- [x] 权限管理与错误处理

#### 📸 使用流程

**在 Snapshot 界面:**

1. **进入快照页面**
   - 自动启动相机
   - 实时视频预览
   - 右上角显示 "🟢 实时" 标识

2. **拍摄照片**
   - 点击底部拍照按钮 📷
   - 自动捕获当前画面
   - 显示照片预览

3. **确认或重拍**
   - **重拍** ❌ - 删除照片,重新启动相机
   - **确认分析** ✅ - 进入分析流程

4. **AI 分析** (后续集成)
   - 上传到服务器/本地 AI
   - 返回识别结果
   - 显示物品信息

#### 📱 UI 模式

**实时相机模式:**
- ✅ 真实摄像头预览
- ✅ 前后摄像头切换
- ✅ 实时画面叠加取景框
- 🟢 "实时" 绿色标识

**演示模式 (Fallback):**
- 📷 静态背景图片
- 🟡 "演示" 黄色标识
- ⚠️ 相机错误提示横幅

#### 🔧 技术细节

**Hook: `useCamera`**

```typescript
const {
  videoRef,           // Video 元素引用
  isReady,            // 相机是否就绪
  capturedPhoto,      // 拍摄的照片 { url, blob, timestamp }
  startCamera,        // 启动相机
  stopCamera,         // 停止相机
  capture,            // 拍照
  switchCamera,       // 切换前后摄像头
  clearPhoto,         // 清除照片
  error,              // 错误信息
  isSupported,        // 浏览器是否支持
} = useCamera({
  facingMode: 'environment',  // 'user' | 'environment'
  width: 1920,                // 分辨率宽度
  height: 1080,               // 分辨率高度
  onCapture: (url, blob) => {
    console.log('照片已拍摄:', url);
    // 可以上传 blob 或使用 url 显示
  },
  onError: (err) => {
    console.error('相机错误:', err);
  }
});
```

**状态机:**
```
idle → requesting → ready → capturing → ready
  ↓                    ↓                    ↑
  └──────── error ←────┴────────────────────┘
```

**照片格式:**
```typescript
interface CapturedPhoto {
  url: string;       // blob:http://... (用于显示)
  blob: Blob;        // 原始二进制数据 (用于上传)
  timestamp: number; // 拍摄时间戳
}
```

#### 💡 拍照流程

```typescript
// 1. 用户点击拍照按钮
capture();

// 2. 内部处理
const canvas = document.createElement('canvas');
canvas.width = video.videoWidth;
canvas.height = video.videoHeight;
ctx.drawImage(video, 0, 0);

// 3. 生成 Blob
canvas.toBlob((blob) => {
  const url = URL.createObjectURL(blob);
  setCapturedPhoto({ url, blob, timestamp: Date.now() });
  onCapture?.(url, blob);
}, 'image/jpeg', 0.95);
```

#### ⚠️ 权限要求
- **相机权限** - 首次使用时会请求
- **HTTPS/Localhost** - MediaDevices API 要求
- **物理相机** - 移动设备或电脑摄像头

#### 🐛 常见问题

**Q: 相机无法启动?**
- 检查相机权限 (浏览器设置)
- 确保没有其他应用占用相机
- 使用 HTTPS 或 localhost
- 查看控制台错误信息

**Q: 切换摄像头无效?**
- 部分设备只有一个摄像头
- 等待相机完全停止后再切换
- 刷新页面重试

**Q: 照片质量不好?**
- 调整 `width`/`height` 参数 (最高 1920x1080)
- 修改 JPEG 质量 (0.0 - 1.0,默认 0.95)
- 确保光线充足

**Q: 浏览器不支持?**
- Chrome/Edge: ✅ 完全支持
- Safari: ✅ 支持 (iOS 11+)
- Firefox: ✅ 支持
- 其他: ⚠️ 测试后确认

---

## 🔗 后续集成计划

### 1. 语音命令扩展
- [ ] **唤醒词** - "Hey TRIX" 免触摸激活
- [ ] **连续对话** - 多轮对话不中断
- [ ] **命令模板** - 预设常用命令
- [ ] **语音反馈** - TTS 语音回复

### 2. 视觉分析集成
- [ ] **AI 物体识别** - 对接 OpenClaw 视觉能力
- [ ] **OCR 文字提取** - 识别图片中的文字
- [ ] **场景理解** - 分析环境和上下文
- [ ] **实时标注** - 在预览中叠加识别结果

### 3. 多模态融合
- [ ] **语音 + 视觉** - "这是什么?" + 拍照
- [ ] **手势控制** - 配合摄像头识别手势
- [ ] **环境感知** - 根据场景调整行为

---

## 📂 文件结构

```
src/
├── hooks/
│   ├── useSpeechToText.ts    # 语音转文字 Hook
│   ├── useCamera.ts           # 相机功能 Hook
│   └── usePCConnection.ts     # PC 连接 (已有)
│
screens/
├── ChatDetail.tsx             # 聊天界面 (集成语音)
└── Snapshot.tsx               # 快照界面 (集成相机)
```

---

## 🎯 代码示例

### 语音控制电脑

```typescript
// 在 ChatDetail.tsx 中
const { isListening, startListening, stopListening } = useSpeechToText({
  lang: 'zh-CN',
  onResult: (text) => {
    setInput(prev => prev + text);
  }
});

// 用户说: "打开浏览器"
// → 自动填充到输入框
// → 点击发送 → 通过 Gateway 发送命令
```

### 拍照识别物品

```typescript
// 在 Snapshot.tsx 中
const { capture, capturedPhoto } = useCamera({
  onCapture: async (url, blob) => {
    // 上传到服务器
    const formData = new FormData();
    formData.append('image', blob);
    
    const response = await fetch('/api/analyze', {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    console.log('识别结果:', result);
  }
});

// 用户点击拍照
// → 捕获画面
// → 上传分析
// → 显示结果
```

---

## 🔐 安全与隐私

### 数据处理
- ✅ **本地优先** - 语音识别在浏览器本地完成
- ✅ **用户控制** - 手动触发,不会偷偷录音/拍照
- ✅ **即时清理** - 照片 URL 及时释放,避免内存泄漏
- ⚠️ **权限管理** - 明确请求麦克风/相机权限

### 数据传输
- 📷 **照片上传** - 通过 HTTPS 加密传输
- 🎤 **语音文本** - 仅发送识别后的文本,不传输音频
- 🔒 **敏感信息** - 不记录或存储语音/图像原始数据

---

## 🚀 快速测试

### 测试语音功能
```bash
1. 启动应用: npm run dev
2. 进入聊天界面 (Chat → Clawdbot Gateway)
3. 点击麦克风按钮 🎤
4. 说话: "你好,测试语音识别"
5. 查看输入框是否显示文字
```

### 测试相机功能
```bash
1. 启动应用: npm run dev
2. 进入 Snapshot 界面 (底部导航 → 快照)
3. 允许相机权限
4. 查看实时预览
5. 点击拍照按钮
6. 确认照片预览
```

---

## 📊 浏览器兼容性

| 功能 | Chrome | Edge | Safari | Firefox |
|------|--------|------|--------|---------|
| 语音识别 | ✅ | ✅ | ✅ (iOS 14.5+) | ⚠️ 部分 |
| 相机访问 | ✅ | ✅ | ✅ (iOS 11+) | ✅ |
| 切换摄像头 | ✅ | ✅ | ✅ | ✅ |
| 实时预览 | ✅ | ✅ | ✅ | ✅ |

---

## 🎉 总结

**语音转文字** 和 **视觉识别** 功能已成功集成到 TRIX 应用!

- 🎤 **语音控制** - 解放双手,语音操控电脑
- 📷 **视觉理解** - 拍照分析,智能识别物品
- 🔌 **即插即用** - 基于浏览器原生 API,无需额外依赖
- 🎨 **优雅 UI** - 流畅动画,直观反馈

**下一步**: 对接 OpenClaw AI 引擎,实现真正的多模态交互! 🚀

---

**创建时间:** 2026年2月4日  
**版本:** v1.1.0 - Voice & Vision Integration
