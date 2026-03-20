# TRIX3D Web 前端界面样式详细文档

> 版本: 1.2.0
> **最后更新**: 2026-03-20

---

## 目录

1. [设计系统基础](#设计系统基础)
2. [登录页面 (Login)](#登录页面-login)
3. [注册页面 (Register)](#注册页面-register)
4. [首页 (Home)](#首页-home)
5. [底部导航栏 (GlassDock)](#底部导航栏-glassdock)
6. [TRIX Bot 气泡 (HomeBotBubble)](#trix-bot-气泡-homebotbubble)
7. [聊天列表页面 (Chat)](#聊天列表页面-chat)
8. [聊天详情页面 (ChatDetail)](#聊天详情页面-chatdetail)
9. [个人资料页面 (Profile)](#个人资料页面-profile)
10. [学习页面 (Study)](#学习页面-study)
11. [积分商城页面 (PointsMall)](#积分商城页面-pointsmall)
12. [衣柜页面 (Wardrobe)](#衣柜页面-wardrobe)
13. [配对页面 (Pairing)](#配对页面-pairing)
14. [快照页面 (Snapshot)](#快照页面-snapshot)
15. [地图页面 (SnapMapScreen)](#地图页面-snapmapscreen)
16. [核心组件样式参考](#核心组件样式参考)

---

## 设计系统基础

### 1.1 色彩系统

#### 主色调 (Primary Colors)

| 色彩名称 | CSS 变量/类名 | 用途 | 色值 |
|----------|--------------|------|------|
| 主色 | `indigo-600` | 主要按钮、链接 | `#4f46e5` |
| 主色渐变 | `from-indigo-600 to-purple-600` | 登录按钮 | 渐变 |
| 琥珀色 | `amber-400/500` | VIP、积分、成就 | `#fbbf24` / `#f59e0b` |
| 青色 | `cyan-400/500` | 快照、AI 功能 | `#22d3ee` / `#06b6d4` |
| 紫色 | `purple-500/600` | 配对、渐变 | `#a855f7` / `#9333ea` |
| 绿色 | `green-400/500` | 在线状态、成功 | `#22c55e` |
| 橙色 | `orange-500` | 警告、未连接 | `#f97316` |
| 红色 | `red-500` | 错误、删除 | `#ef4444` |

#### 背景色彩

| 背景类型 | CSS 类名 | 样式 |
|----------|----------|------|
| 浅蓝背景 | `bg-[#f0f9ff]` | 登录/注册页背景 |
| 透明背景 | `bg-transparent` | 首页、聊天页 |
| 深色背景 | `dark:bg-slate-950` | 深色模式 |
| 浅色背景 | `bg-slate-50` | 聊天详情 |
| 毛玻璃背景 | `bg-white/10 backdrop-blur-md` | GlassPanel |

#### 文字色彩

| 文字类型 | CSS 类名 | 用途 |
|----------|----------|------|
| 主要文字 | `text-slate-900` / `dark:text-slate-100` | 标题 |
| 次要文字 | `text-slate-500` / `dark:text-slate-400` | 描述 |
| 浅色文字 | `text-white` | 深色背景上的文字 |
| 强调文字 | `text-amber-400` | VIP、积分数字 |

### 1.2 间距系统

使用 Tailwind CSS 间距类：

| 间距类 | 像素值 | 常用场景 |
|--------|--------|----------|
| `p-2` | 8px | 紧凑间距 |
| `p-4` | 16px | 标准间距 |
| `p-6` | 24px | 区块间距 |
| `px-4` | 水平16px | 页面左右边距 |
| `py-4` | 垂直16px | 区块上下间距 |
| `gap-2` | 8px | 元素间隙 |
| `gap-4` | 16px | 卡片间隙 |

### 1.3 圆角系统

| 圆角类 | 像素值 | 用途 |
|--------|--------|------|
| `rounded-lg` | 8px | 小元素 |
| `rounded-xl` | 12px | 卡片 |
| `rounded-2xl` | 16px | 大卡片 |
| `rounded-full` | 9999px | 圆形、胶囊按钮 |
| `rounded-3xl` | 24px | 大容器 |

### 1.4 阴影系统

| 阴影类 | 样式 | 用途 |
|--------|------|------|
| `shadow-sm` | 小阴影 | 轻微悬浮效果 |
| `shadow-md` | 中等阴影 | 标准卡片 |
| `shadow-lg` | 大阴影 | 弹窗、模态框 |
| `shadow-xl` | 更大阴影 | 底部导航 |
| `shadow-[0_0_20px_rgba(251,191,36,0.5)]` | 自定义发光 | VIP 效果 |

### 1.5 动画系统

- **Framer Motion**: 页面转场、列表动画、模态框动画
- **Tailwind animate**:
  - `animate-spin`: 旋转加载
  - `animate-pulse`: 脉冲效果
  - `animate-bounce`: 弹跳效果
  - `animate-scan`: 扫描线效果
- **自定义 CSS 动画**:
  - `glow-pulse`: 发光脉冲
  - `scan`: 扫描线移动

---

## 登录页面 (Login)

### 2.1 页面结构

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│     ┌─────────────────────────────────────────┐     │
│     │     装饰性模糊光晕 (Blob Shapes)        │     │
│     │                                         │     │
│     │    -top-[10%] -right-[10%] 青色       │     │
│     │    top-[20%] -left-[20%] 黄色          │     │
│     └─────────────────────────────────────────┘     │
│                                                     │
│           ┌───────────────────────────┐             │
│           │       欢迎回来            │             │
│           │  TRIX  探索无限 3D 世界   │             │
│           └───────────────────────────┘             │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ 👤  邮箱                                       │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ 🔒  密码                                       │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │              登 录                          │   │
│  │         [渐变: indigo→purple]               │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│           ─── 第三方登录 ───                      │
│                                                     │
│            ┌──────┐   ┌──────┐                   │
│            │  W   │   │  A   │                   │
│            │ 微信  │   │Apple │                   │
│            └──────┘   └──────┘                   │
│                                                     │
│        还没有账号？立即注册                         │
└─────────────────────────────────────────────────────┘
```

### 2.2 详细样式

#### 页面容器
```css
/* 背景 */
className: "h-screen w-full bg-[#f0f9ff] relative overflow-hidden flex flex-col justify-between px-8 py-10"

/* 装饰性光晕 */
.absolute -top-[10%] -right-[10%] w-[500px] h-[500px] bg-cyan-300/30 rounded-full blur-[100px]
.absolute top-[20%] -left-[20%] w-[400px] h-[400px] bg-yellow-200/50 rounded-full blur-[90px]
```

#### 标题区域
```css
/* 欢迎文字 */
text-4xl font-extrabold text-slate-800 tracking-tight mb-3

/* 副标题 */
text-slate-500 text-base font-medium tracking-wide
```

#### 输入框组 (GlassPanel)
```css
/* 基础样式 */
className: "flex items-center px-5 py-4 !bg-white/40 !rounded-2xl transition-all focus-within:!bg-white/60 focus-within:!border-white/90 group"

/* 图标 */
<User/Lock> className: "text-gray-400 group-focus-within:text-indigo-600 transition-colors" size={24}

/* 输入框 */
className: "w-full bg-transparent border-none p-0 pl-4 text-slate-700 placeholder:text-slate-400 focus:ring-0 text-[17px] font-medium"
```

#### 登录按钮
```css
/* 按钮样式 */
className: "w-full py-4 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white font-bold text-lg tracking-widest shadow-xl shadow-indigo-500/30 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"

/* 加载状态 */
<Loader2 className="w-5 h-5 animate-spin" /> 登录中...
```

#### 第三方登录按钮
```css
/* 微信按钮 */
className: "w-12 h-12 rounded-full bg-white/60 flex items-center justify-center text-green-600 shadow-sm border border-white hover:scale-105 transition-transform"

/* Apple 按钮 */
className: "w-12 h-12 rounded-full bg-white/60 flex items-center justify-center text-slate-800 shadow-sm border border-white hover:scale-105 transition-transform"
```

#### 链接文字
```css
/* 注册链接 */
className: "text-[13px] text-slate-500 font-medium"
/* "立即注册" 部分 */
className: "text-indigo-600 font-bold hover:text-indigo-500"
```

---

## 注册页面 (Register)

### 3.1 页面结构

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│     ┌─────────────────────────────────────────┐     │
│     │     装饰性模糊光晕                       │     │
│     └─────────────────────────────────────────┘     │
│                                                     │
│           ┌───────────────────────────┐             │
│           │       欢迎加入             │             │
│           │   开启你的 3D 探索之旅      │             │
│           └───────────────────────────┘             │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ 👤 用户名                                    │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ 📱 邮箱                                      │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ 🔒 设置密码 (至少 6 位)                     │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │              立即注册                        │   │
│  │         [渐变: cyan→blue]                   │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│        已有账号？立即登录                           │
└─────────────────────────────────────────────────────┘
```

### 3.2 详细样式

#### 页面容器
```css
className: "h-screen w-full bg-[#f0f9ff] relative overflow-hidden flex flex-col justify-between px-8 py-10"

/* 装饰光晕 */
.absolute -top-[10%] -right-[10%] w-[500px] h-[500px] bg-cyan-300/20 rounded-full blur-[100px]
.absolute top-[30%] -left-[20%] w-[400px] h-[400px] bg-yellow-200/40 rounded-full blur-[80px]
```

#### 标题区域
```css
/* 欢迎文字 */
className: "text-3xl font-bold text-slate-800"

/* 副标题 */
className: "text-slate-500 text-base font-medium"
```

#### 输入框组
```css
/* 输入框容器 - 比登录页更紧凑 */
className: "flex items-center px-4 py-3.5 !bg-white/40 !rounded-2xl transition-all focus-within:!bg-white/60 group"

/* 用户名输入 */
className: "w-full bg-transparent border-none p-0 pl-3 text-slate-700 placeholder:text-slate-400 focus:ring-0 text-base font-medium h-6"
```

#### 注册按钮
```css
className: "w-full py-4 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-500 text-white font-bold text-lg shadow-lg shadow-cyan-400/30 active:scale-[0.98] transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
```

---

## 首页 (Home)

### 4.1 页面结构

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │                                               │  │
│  │           HeroBackground                      │  │
│  │         (动态 3D 背景 + 视频源)              │  │
│  │                                               │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│                                    ┌────────────┐  │
│                                    │TRIX Bot    │  │
│                                    │气泡消息    │  │
│                                    └────────────┘  │
│                                                     │
│                                                     │
│                                                     │
│                                                     │
│                                                     │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │   🗺️    📚    📷    💬    👤              │  │
│  │   地图  学习  快照  聊天  我的              │  │
│  │              GlassDock 导航栏                │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### 4.2 详细样式

#### 页面容器
```css
className: "relative h-screen w-full flex flex-col overflow-hidden"
style: { background: 'transparent' }
```

#### 弹出面板 (Todo, Schedule, etc.)

**通用弹窗容器样式**:
```css
className: "fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"

/* 弹窗内容 */
className: "relative w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-2xl bg-slate-900/95 border border-white/10 shadow-2xl backdrop-blur-xl"

/* 关闭按钮 */
className: "absolute top-4 right-4 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white"
```

---

## 底部导航栏 (GlassDock)

### 5.1 导航栏结构

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│   地图    学习    [📷]    聊天    我的             │
│                                                     │
│   🗺️    📚      ●      💬    👤                  │
│                                                     │
│   ────  ────   52px   ────  ────                 │
│       间距     圆形     间距    间距               │
│                 按钮                               │
└─────────────────────────────────────────────────────┘
```

### 5.2 详细样式

#### 导航栏容器
```css
/* 位置: 固定在底部 */
style: {
  position: "fixed",
  left: "1.5rem",
  right: "1.5rem",
  margin: "0 auto",
  bottom: "2rem",
  maxWidth: "380px",
  height: "68px",
  zIndex: 50,
}

/* 毛玻璃背景 */
backgroundColor: "rgba(255, 255, 255, 0.75)",
backdropFilter: "blur(20px) saturate(180%)",
borderRadius: "2rem",
border: "0.5px solid rgba(255, 255, 255, 0.6)",
boxShadow: `
  0 12px 40px rgba(0, 0, 0, 0.15),
  0 4px 12px rgba(0, 0, 0, 0.08),
  inset 0 1px 0 rgba(255, 255, 255, 0.8)
`
```

#### 核心按钮 (Camera - 中间圆形)
```css
/* 渐变背景 */
background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"

/* 发光阴影 */
boxShadow: `
  0 0 20px rgba(102, 126, 234, 0.6),
  0 0 40px rgba(118, 75, 162, 0.4),
  0 4px 16px rgba(0, 0, 0, 0.2),
  inset 0 1px 0 rgba(255, 255, 255, 0.3)
`

/* 尺寸 */
width: "52px",
height: "52px",
borderRadius: "50%",

/* 动画 */
animation: "glow-pulse 3s ease-in-out infinite",

/* 图标 */
<Camera size={24} color="white" strokeWidth={2.5} />
```

#### 普通导航项
```css
/* 激活状态图标 */
color: "#374151"  // 深灰色
strokeWidth: 2.4
transform: "scale(1.1)"

/* 未激活状态 */
color: "#9CA3AF"  // 浅灰色
strokeWidth: 2
transform: "scale(1)"

/* 选中指示点 */
className: "absolute bottom-[10px] w-[6px] h-[6px] rounded-full bg-[#374151] boxShadow: '0 0 6px rgba(55, 65, 81, 0.4)'"
```

---

## TRIX Bot 气泡 (HomeBotBubble)

### 6.1 气泡结构

```
           ┌──────────────────┐
           │ ✨ TRIX Bot     │
           │ "你好，XXX！    │
           │ 今天想学什么？" │
           └──────────────────┘
              ↘ 气泡小尾巴
```

### 6.2 详细样式

#### 气泡容器
```css
className: "fixed top-[15%] right-[5%] z-50 cursor-pointer"

/* 气泡主体 */
className: "relative max-w-[180px] sm:max-w-[200px]"
```

#### 气泡内容
```css
/* 气泡背景 */
className: "relative bg-white/15 backdrop-blur-xl rounded-2xl rounded-br-none border border-white/25 shadow-lg p-3 hover:shadow-xl hover:scale-[1.02] transition-transform duration-200"

/* 发光装饰 */
className: "absolute -bottom-2 -right-2 w-6 h-6 bg-yellow-400/20 rounded-full blur-lg pointer-events-none"

/* 小尾巴 */
className: "absolute -bottom-1 right-0 w-3 h-3 bg-white/15 backdrop-blur-xl border-r border-b border-white/25 transform rotate-45 origin-top-left pointer-events-none"
```

#### 气泡文字
```css
/* Sparkles 图标 */
<Sparkles className="w-4 h-4 text-yellow-400 animate-glow-pulse" />

/* 文字内容 */
className: "text-white text-xs font-medium leading-relaxed line-clamp-2"
```

#### 思考中状态 (Typing Indicator)
```css
/* 三个点的弹跳动画 */
className: "flex items-center gap-1 py-0.5"
<span className="h-1.5 w-1.5 rounded-full bg-white/90 animate-bounce" />
/* 动画延迟: 0ms, 120ms, 240ms */
```

---

## 聊天列表页面 (Chat)

### 7.1 页面结构

```
┌─────────────────────────────────────────────────────┐
│                    🔍 搜索栏                        │
│  ┌─────────────────────────────────────────────┐    │
│  │ 🔍  搜索                               ✕  │    │
│  └─────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ─── Quick Add ───                                │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐           │
│  │头像 │ │头像 │ │头像 │ │头像 │ │ +  │           │
│  │小明 │ │小红 │ │小华 │ │小东 │ │添加 │           │
│  │[+] │ │[+] │ │[+] │ │[+] │ │    │           │
│  └────┘ └────┘ └────┘ └────┘ └────┘           │
│  (横向滚动)                                        │
│                                                     │
├─────────────────────────────────────────────────────┤
│  ════════════ Friends ════════════               │
│                                                     │
│  ┌────┐                                           │
│  │头像●│  TRIX Bot              [📷/○]          │
│  │    │  AI 助手已就绪                         │
│  └────┘                                           │
│                                                     │
│  ┌────┐                                           │
│  │头像●│  好友名称                 [9] 📷        │
│  │    │  最后消息...                             │
│  └────┘                                           │
│                                                     │
│                              [+添加好友] →         │
└─────────────────────────────────────────────────────┘
```

### 7.2 详细样式

#### 页面容器
```css
className: "h-screen w-full relative overflow-hidden"
style: { background: 'transparent' }

/* 背景层 */
className: "fixed inset-0 w-full h-full"
style: { zIndex: 0, pointerEvents: 'none' }
<img className="w-full h-full object-cover" style={{ filter: 'brightness(0.2)' }} />
<div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/40" />
```

#### 搜索栏 (Snapchat 风格)
```css
/* 搜索框容器 */
className: "bg-white/5 border border-white/10 backdrop-blur-sm h-11 rounded-full flex items-center px-4 mx-auto max-w-md transition-all hover:bg-white/10"

/* 搜索图标 */
<Search size={18} className="text-white/60 flex-shrink-0" />

/* 输入框 */
className: "flex-1 bg-transparent border-none outline-none text-white placeholder-white/50 ml-3 text-sm"

/* 清除按钮 */
className: "text-white/60 hover:text-white flex-shrink-0 w-8 h-8 flex items-center justify-center"
```

#### Quick Add 区域
```css
/* 标题 */
className: "text-white/80 font-bold text-sm uppercase tracking-wide"

/* 横向滚动容器 */
className: "flex overflow-x-auto gap-3 px-4 pb-4"

/* 推荐用户卡片 */
className: "bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4 min-w-[130px] flex flex-col items-center relative flex-shrink-0"

/* 添加按钮 - 明黄色 */
className: "bg-amber-400 hover:bg-amber-500 text-black font-bold text-xs px-6 py-1.5 rounded-full mt-2 transition-all shadow-[0_0_10px_rgba(250,204,21,0.3)] hover:shadow-[0_0_15px_rgba(250,204,21,0.5)]"
```

#### 好友列表项

**TRIX Bot 特殊样式**:
```css
/* 连接状态指示器 */
.isConnected && isPaired ?
  <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-400 rounded-full border-2 border-black/30 shadow-lg shadow-green-400/50" />
:
  <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-gray-400 rounded-full border-2 border-black/30" />

/* 状态文字 */
<MessageSquare size={14} className={isConnected && isPaired ? "text-green-400" : "text-gray-500"} strokeWidth={2.5} />

/* 右侧图标 - 已连接 */
className: "w-10 h-10 rounded-full bg-green-500/20 border border-green-400/30 flex items-center justify-center"
/* 未连接 */
className: "w-10 h-10 rounded-full bg-orange-500/20 border border-orange-400/30 flex items-center justify-center"
```

**普通好友列表项**:
```css
/* 列表项容器 */
className: "flex items-center py-4 border-b border-white/5 cursor-pointer hover:bg-white/5 transition-colors"

/* 头像容器 */
className: "relative mr-4 flex-shrink-0 flex items-center justify-center"

/* 在线状态 */
className: "absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-400 rounded-full border-2 border-black/30 shadow-lg shadow-green-400/50"

/* 名字 */
className: "text-white font-bold text-base leading-tight mb-0.5"

/* 消息内容 */
className: "text-sm text-gray-400 truncate"
.hasUnread ? "text-white font-medium" : "text-gray-400"

/* 未读计数徽章 */
className: "w-6 h-6 rounded-full bg-amber-400 flex items-center justify-center shadow-[0_0_10px_rgba(250,204,21,0.3)]"
<span className="text-xs font-bold text-black">
  {unread_count > 9 ? '9+' : unread_count}
</span>
```

#### 添加好友按钮
```css
className: "absolute top-[5.5rem] right-4 w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center hover:bg-white/20 hover:scale-110 transition-all z-20"

<Plus size={18} className="text-white/80" />
```

---

## 聊天详情页面 (ChatDetail)

### 8.1 页面结构

```
┌─────────────────────────────────────────────────────┐
│ [<]  [头像]  好友名称/状态          [更多选项]     │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│                                                     │
│           ┌──────────────────────┐                  │
│           │ 🤖                  │                  │
│           │ 消息内容...         │                  │
│           │              10:30  │                  │
│           └──────────────────────┘                  │
│                                                     │
│                      ┌──────────────────────┐      │
│                      │  我的消息内容...    │      │
│                      │              10:31  │      │
│                      └──────────────────────┘      │
│                                                     │
│                                                     │
├─────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────┐  │
│  │ [附件] [输入框................] [🎤] [发送]  │  │
│  └─────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### 8.2 详细样式

#### 页面容器
```css
className: "flex h-screen w-full flex-col bg-slate-50 font-sans dark:bg-slate-950"
```

#### 头部导航
```css
/* 头部容器 */
className: "z-40 flex shrink-0 items-center justify-between border-b border-slate-200 bg-white/90 px-4 pb-4 pt-16 shadow-sm backdrop-blur-xl transition-all duration-300 dark:border-slate-700 dark:bg-slate-900/90"

/* 返回按钮 */
className: "flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white transition-colors duration-200 hover:bg-slate-100 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"

/* 头像 - Bot 特殊样式 */
className: "flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 shadow-md shadow-cyan-200/50"

/* 状态指示点 */
className: "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white dark:border-slate-900"
/* 颜色根据状态: CONNECTED=green, CONNECTING=yellow(animate-pulse), ERROR=red, DISCONNECTED=gray */
```

#### 更多菜单 (弹窗)
```css
/* 菜单遮罩 */
className: "fixed inset-0 z-40"

/* 菜单内容 */
className: "absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"

/* 菜单项 */
className: "flex w-full items-center gap-3 px-4 py-3 text-left text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
```

#### 消息列表区域
```css
className: "flex-1 space-y-6 overflow-y-auto bg-slate-50/60 px-4 py-6 pb-6 dark:bg-slate-900/40"

/* 日期分隔 */
className: "my-4 text-center text-xs text-slate-400 dark:text-slate-500"
/* 内容: "Today" 或具体日期 */
```

#### 消息气泡

**对方消息 (左侧)**:
```css
className: "relative px-4 py-3 text-sm leading-relaxed shadow-sm transition-all duration-200 rounded-2xl rounded-tl-sm bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100"
```

**自己消息 (右侧)**:
```css
className: "relative px-4 py-3 text-sm leading-relaxed shadow-sm transition-all duration-200 rounded-2xl rounded-tr-sm bg-gradient-to-br from-blue-600 to-indigo-600 text-white"
```

**消息时间**:
```css
className: "px-1 text-[10px] text-slate-400 dark:text-slate-500"
msg.sender === 'user' ? 'text-right' : 'text-left'
```

#### AI 思考中动画
```css
/* 三个点弹跳 */
className: "flex items-center gap-1"
<span className="h-1.5 w-1.5 rounded-full bg-slate-500 animate-bounce dark:bg-slate-300"
style={{ animationDelay: `${index * 120}ms` }}
```

#### 输入区域
```css
/* 输入框容器 */
className: "shrink-0 border-t border-slate-200 bg-white px-4 pb-6 pt-3 dark:border-slate-700 dark:bg-slate-900"

/* 实际输入框 wrapper */
className: "rounded-2xl bg-slate-100 p-2 dark:bg-slate-800"

/* 文件选择按钮 */
className: "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white transition-colors hover:bg-slate-100 dark:bg-slate-700 dark:hover:bg-slate-600"

/* 文本输入 */
className: "flex-1 rounded-xl border-0 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-400"

/* 语音按钮 */
className: "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all"
/* 激活: bg-slate-300 text-slate-700 */
/* 未激活: bg-white text-slate-600 hover:bg-slate-100 */

/* 发送按钮 */
className: "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all disabled:cursor-not-allowed disabled:opacity-50"
/* 可发送: bg-black text-white hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 */
/* 不可发送: bg-slate-300 text-slate-400 dark:bg-slate-700 dark:text-slate-500 */
```

#### 附件预览
```css
/* 附件预览容器 */
className: "flex flex-wrap gap-2"

/* 附件缩略图 */
className: "h-[80px] w-[80px] overflow-hidden rounded-lg border-2 border-slate-300 shadow-lg dark:border-slate-600"

/* 删除按钮 */
className: "absolute -right-1.5 -top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-white text-black shadow-md transition-colors hover:bg-slate-100 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
```

---

## 个人资料页面 (Profile)

### 9.1 页面结构

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │              背景图片                          │  │
│  │         + 渐变叠加层                          │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│                    ┌─────────┐                      │
│                 ╭──│         │──╮                   │
│                 │  │   头像   │  │                   │
│                 │  │  [VIP]  │  │                   │
│                 ╰──│         │──╯                   │
│                    └─────────┘                      │
│                    (旋转装饰环)                     │
│                                                     │
│                   Username                         │
│                   email@example.com                 │
│                                                     │
│              [🎯 积分: 1000]                       │
│                                                     │
│    天数: 30    │    积分: 1000    │    互动: 50    │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  我的衣橱                                            │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐            │
│  │巫师│ │披风│ │魔杖│ │ +  │                          │
│  │ 帽 │ │    │ │    │ │    │                          │
│  └────┘ └────┘ └────┘ └────┘                         │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  外观与个性化                                        │
│  ┌─────────────────────────────────────────────┐  │
│  │ 🌙 深色模式                        [开关]    │  │
│  └─────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────┐  │
│  │ 🌐 语言                            中文   >  │  │
│  └─────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────┐  │
│  │ 🔊 语音沉浸模式                    [开关]    │  │
│  └─────────────────────────────────────────────┘  │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  通用设置                                            │
│  ┌─────────────────────────────────────────────┐  │
│  │ 🔒 隐私设置                              >  │  │
│  └─────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────┐  │
│  │ ℹ️ 关于                              v1.2.0 > │  │
│  └─────────────────────────────────────────────┘  │
│                                                     │
│              [ 退出登录 ]                          │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 9.2 详细样式

#### 页面容器
```css
className: "h-screen w-full relative overflow-hidden"
style: { background: 'transparent' }

/* 背景层 */
className: "fixed inset-0 w-full h-full"
/* 亮度调整 */
style={{ filter: isDark ? 'brightness(0.3)' : 'brightness(0.65)' }}
```

#### 头像区域

**旋转装饰环**:
```css
className: "absolute -inset-4 rounded-full border border-amber-500/20 animate-[spin_10s_linear_infinite]"
/* 内部虚线环 */
className: "absolute inset-0 rounded-full border border-dashed border-amber-400/30 animate-[spin_15s_linear_infinite_reverse]"
```

**发光神环**:
```css
className: "absolute -inset-2 rounded-full"
/* 渐变背景 */
className: "absolute inset-0 rounded-full bg-gradient-to-r from-amber-400/20 via-yellow-500/30 to-amber-400/20 blur-md animate-pulse"
/* 边框 */
className: "absolute inset-0 rounded-full border-2 border-amber-400/40 shadow-[0_0_40px_rgba(251,191,36,0.4)]"
```

**核心头像**:
```css
className: "relative w-32 h-32 rounded-full overflow-hidden bg-black/30 backdrop-blur-sm shadow-[0_0_30px_rgba(251,191,36,0.3)] border-2 border-amber-300/50"
/* 头像图片 */
className: "w-full h-full bg-cover bg-center transform transition-transform group-hover:scale-110 duration-700"
/* 内发光 */
className: "absolute inset-0 rounded-full shadow-[inset_0_0_20px_rgba(251,191,36,0.2)]"
```

**VIP 徽章**:
```css
className: "absolute -bottom-2 -right-2 bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 text-amber-950 text-[10px] font-black px-3 py-1 rounded-full shadow-lg border-2 border-white/20 flex items-center gap-1 shadow-[0_0_20px_rgba(251,191,36,0.5)]"
<Verified size={12} fill="currentColor" className="text-amber-700" /> VIP
```

#### 用户信息区域
```css
/* 用户名 */
className: "text-2xl font-black tracking-tight capitalize drop-shadow-md"
/* 暗色模式 */
className: "text-white"
/* 亮色模式 */
className: "text-slate-900"

/* 邮箱 */
className: "text-xs mt-1"
/* 暗色: text-gray-400 */
/* 亮色: text-slate-600 */

/* 积分显示 */
className: "inline-flex items-center gap-2 px-4 py-1.5 rounded-full backdrop-blur-md cursor-pointer"
/* 暗色: bg-white/10 border border-white/20 hover:bg-white/15 */
/* 亮色: bg-white/75 border border-slate-200 hover:bg-white */
```

#### 统计行
```css
/* 容器 */
className: "flex items-center justify-center gap-0 mt-6 w-full divide-x"
/* 暗色: divide-white/10 */
/* 亮色: divide-slate-300/70 */

/* 统计项 */
className: "text-center cursor-pointer hover:scale-105 transition-transform active:scale-95 px-6"

/* 数值 */
className: "text-xl font-black"
/* 暗色: text-white */
/* 亮色: text-slate-900 */

/* 标签 */
className: "text-[10px] font-bold uppercase tracking-wider"
/* 暗色: text-gray-500 */
/* 亮色: text-slate-500 */
```

#### 衣橱区域

**装扮卡片**:
```css
/* 卡片容器 */
className: "flex-shrink-0 w-32 h-44 !rounded-xl p-3 flex flex-col items-center gap-2 cursor-pointer group transition-all duration-300 hover:-translate-y-1 relative border"
/* 暗色: border-white/20 hover:bg-white/15 */
/* 亮色: border-slate-200/80 hover:bg-white */

/* 已装备红点 */
className: "absolute top-4 right-4 w-2 h-2 rounded-full bg-rose-500 shadow-sm z-10 ring-2 ring-white/20 animate-pulse"

/* 图片容器 */
className: "w-full aspect-square rounded-xl flex items-center justify-center group-hover:scale-[1.02] transition-transform duration-500 overflow-hidden relative"
/* 暗色: bg-white/10 */
/* 亮色: bg-slate-100/80 */

/* 添加更多按钮 */
className: "flex-shrink-0 w-32 h-44 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-all group active:scale-95"
/* 暗色: border-white/20 hover:border-amber-500/50 hover:bg-white/10 */
/* 亮色: border-slate-300 hover:border-amber-500/60 hover:bg-white/70 */
```

#### 设置项

**设置项容器 (GlassPanel)**:
```css
className: "p-4 !rounded-xl flex items-center justify-between cursor-pointer group transition-all duration-300 active:scale-95 border"
/* 暗色: border-white/20 hover:bg-white/15 */
/* 亮色: border-slate-200/80 hover:bg-white */
```

**图标容器**:
```css
className: "w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg transform group-hover:scale-105 transition-transform duration-300"
/* 深色模式: bg-gradient-to-br from-amber-400 to-yellow-500 text-white shadow-amber-500/30 */
/* 亮色模式: 类似 */
```

**开关控件**:
```css
className: "relative w-12 h-7 rounded-full p-1 transition-colors"
/* 开启: bg-amber-500 */
/* 关闭: bg-slate-300 */

/* 滑块 */
className: "w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform"
/* 开启: translate-x-5 */
/* 关闭: translate-x-0 */
```

**语言选择**:
```css
className: "flex items-center gap-2"
<span className="text-xs font-medium">简体中文</span>
<ChevronRight size={16} />
```

---

## 学习页面 (Study)

### 10.1 主页面结构 (非计时模式)

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │              背景图片                          │  │
│  │         + 渐变 + 粒子效果                     │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │  🧠 专注学习              💎100    👥        │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│                                                     │
│                    ╭──────────────╮                  │
│                    │              │                  │
│                    │    25:00    │                  │
│                    │              │                  │
│                    │   ⏱️ 计时器  │                  │
│                    │              │                  │
│                    ╰──────────────╯                  │
│                                                     │
│           [25分钟]  [45分钟]  [60分钟]             │
│                                                     │
│                    [ 开始专注 ]                      │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │  今日专注: 120 分钟                            │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### 10.2 详细样式

#### 页面容器
```css
className: "h-screen w-full relative overflow-hidden"
style: { background: 'transparent' }

/* 动态背景 */
<DynamicBackground
  type="both"
  primaryColor="rgba(139, 92, 246, 0.12)"
  secondaryColor="rgba(236, 72, 153, 0.12)"
  particleCount={30}
/>
```

#### 学习头部 (StudyHeader)
```css
/* 包含积分和好友按钮 */
className: "flex items-center justify-between"
```

#### 时钟选择器 (DurationSelector)
```css
/* 圆环容器 */
className: "relative w-64 h-64 mx-auto flex items-center justify-center"

/* 圆环边框 */
className: "absolute inset-0 rounded-full border-4 border-white/10"

/* 时间文字 */
className: "text-6xl font-black text-white drop-shadow-lg"
```

#### 时间预设按钮
```css
className: "px-6 py-2 rounded-full font-bold transition-all active:scale-95"
/* 选中: bg-white text-purple-600 shadow-lg */
/* 未选中: bg-white/10 text-white/80 border border-white/20 hover:bg-white/20 */
```

#### 开始按钮
```css
className: "px-12 py-4 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold text-lg shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 hover:scale-105 transition-all active:scale-95"
```

---

## 积分商城页面 (PointsMall)

### 11.1 页面结构

```
┌─────────────────────────────────────────────────────┐
│  [←] 积分商城                                       │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │  💎 我的积分: 1000          累计消费: 500     │  │
│  │                                               │  │
│  │    [琥珀色渐变背景卡片]                        │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  [全部] [服装] [配饰] [道具]  (胶囊按钮)            │
│                                                     │
│  ┌─────────┐  ┌─────────┐                          │
│  │         │  │         │                          │
│  │  商品   │  │  商品   │                          │
│  │  图片   │  │  图片   │                          │
│  │         │  │         │                          │
│  │ 💎 100  │  │ 💎 200  │                          │
│  │         │  │         │                          │
│  │[立即兑换]│  │[立即兑换]│                          │
│  └─────────┘  └─────────┘                          │
│                                                     │
│  ┌─────────┐  ┌─────────┐                          │
│  │  商品   │  │  商品   │  ...                     │
│  │   ...   │  │   ...   │                          │
│  └─────────┘  └─────────┘                          │
└─────────────────────────────────────────────────────┘
```

### 11.2 详细样式

#### 积分头部卡片 (GlassPanel)
```css
className: "p-4 !rounded-2xl mb-4"
/* 暗色: bg-white/10 border-white/20 hover:bg-white/15 */
/* 亮色: bg-white/75 border-slate-200/80 hover:bg-white */

/* 积分图标 */
className: "w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-amber-400 to-yellow-500 shadow-lg shadow-amber-500/30"

/* 积分数字 */
className: "text-2xl font-black"
/* 暗色: text-amber-300 */
/* 亮色: text-amber-700 */
```

#### 分类标签
```css
className: "flex gap-2 overflow-x-auto pb-2 -mx-2 px-2 scroll-smooth"

/* 标签按钮 */
className: "flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all duration-300 active:scale-95"
/* 选中: bg-amber-500 text-white shadow-lg shadow-amber-500/30 */
/* 未选中-暗: bg-white/10 text-gray-300 border border-white/20 hover:bg-white/20 */
/* 未选中-亮: bg-white/75 text-slate-600 border border-slate-200 hover:bg-white */
```

#### 商品卡片
```css
/* 卡片容器 */
className: "!rounded-xl overflow-hidden cursor-pointer group transition-all duration-300 hover:-translate-y-1"
/* 已拥有: opacity-75 */

/* 商品图片区域 */
className: "relative aspect-square overflow-hidden"
/* 暗色: bg-white/5 */
/* 亮色: bg-slate-100/80 */

/* 商品图片 */
className: "w-full h-full object-contain p-4 transform group-hover:scale-105 transition-transform duration-500"

/* 已拥有标签 */
className: "absolute top-2 right-2 bg-green-500/90 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-lg"

/* 价格标签 */
className: "absolute bottom-2 left-2 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold"
/* 暗色: bg-black/50 text-amber-300 backdrop-blur-sm */
/* 亮色: bg-white/90 text-amber-700 shadow-sm */
```

#### 购买按钮
```css
className: "mt-3 w-full py-2 rounded-lg text-xs font-bold transition-all duration-300 active:scale-95"
/* 已拥有-暗: bg-green-500/20 text-green-400 cursor-default */
/* 已拥有-亮: bg-green-100 text-green-600 cursor-default */
/* 购买中: bg-amber-500/50 text-white cursor-wait */
/* 可购买-暗: bg-amber-500 hover:bg-amber-400 text-white shadow-lg shadow-amber-500/30 */
/* 可购买-亮: bg-amber-500 hover:bg-amber-400 text-white shadow-lg shadow-amber-500/20 */
```

---

## 衣柜页面 (Wardrobe)

### 12.1 页面结构

```
┌─────────────────────────────────────────────────────┐
│  [<] 我的衣柜                                        │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │  已拥有: 5 件           已装备: 3 件            │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │         [头像预览 + 已装备装扮]                 │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  [全部] [帽子] [披风] [魔杖] [背景]                │
│                                                     │
│  ┌────┐ ┌────┐ ┌────┐                             │
│  │    │ │ ✓  │ │    │                             │
│  │ ○  │ │装备│ │ ○  │                             │
│  │    │ │    │ │    │                             │
│  └────┘ └────┘ └────┘                             │
│                                                     │
│  ┌────┐ ┌────┐ ┌────┐                             │
│  │ ○  │ │ ○  │ │ ○  │  ...                        │
│  └────┘ └────┘ └────┘                             │
└─────────────────────────────────────────────────────┘
```

### 12.2 详细样式

#### 页面容器
```css
className: "min-h-screen pb-20"
style: { backgroundColor: 'var(--bg-primary)' }
```

#### 统计卡片
```css
className: "mx-4 mt-4 p-4 rounded-xl"
style: { backgroundColor: 'var(--card-bg)' }

/* 统计文字 */
className: "text-sm" style: { color: 'var(--text-secondary)' }
className: "text-2xl font-bold" style: { color: 'var(--text-primary)' }
```

#### 分类标签
```css
className: "flex gap-2 px-4 mt-4 overflow-x-auto pb-2"

/* 标签按钮 */
className: "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all"
/* 选中: ring-2, var(--color-primary), bg var(--color-primary), text white */
/* 未选中: bg var(--card-bg), text var(--text-secondary) */
```

#### 装扮卡片网格
```css
className: "grid grid-cols-3 gap-3"

/* 卡片容器 */
className: "aspect-square rounded-xl overflow-hidden cursor-pointer relative"
style: { backgroundColor: 'var(--card-bg)' }

/* 装备状态标记 */
.isEquipped ?
  <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
    <Check size={14} className="text-white" />
  </div>
:
  /* 无 -标记 未装备 */

/* 装扮图片 */
className: "w-full h-full object-contain p-2"
```

---

## 配对页面 (Pairing)

### 13.1 页面结构

```
┌─────────────────────────────────────────────────────┐
│  [<] 设备配对                                       │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │        ⚠️ 正在连接服务器...                     │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │                                               │  │
│  │     ┌─────────────────────────────┐          │  │
│  │     │                             │          │  │
│  │     │      QR 扫描框区域           │          │  │
│  │     │      [扫描线动画]            │          │  │
│  │     │                             │          │  │
│  │     │      ┌┐ ┌┐ ┌┐ ┌┐           │          │  │
│  │     │      └┘ └┘ └┘ └┘           │          │  │
│  │     │                             │          │  │
│  │     └─────────────────────────────┘          │  │
│  │                                               │  │
│  │       扫描电脑端展示的配对二维码              │  │
│  │                                               │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  [ 手动输入配对码 ]  (胶囊按钮)                     │
│                                                     │
│  [ 开启摄像头 ]  (紫色渐变按钮)                      │
└─────────────────────────────────────────────────────┘
```

### 13.2 详细样式

#### 页面容器
```css
className: "relative h-screen w-full flex flex-col bg-gradient-to-br from-cyan-100 via-indigo-100 to-pink-100 overflow-hidden"
```

#### 头部
```css
className: "flex items-center p-4 pt-12 pb-2 justify-between z-20"

/* 返回按钮 */
className: "flex w-10 h-10 shrink-0 items-center justify-center rounded-full bg-white/30 hover:bg-white/40 transition-colors backdrop-blur-sm text-slate-800 border border-white/20"

/* 标题 */
className: "text-slate-800 text-lg font-bold flex-1 text-center pr-10"
```

#### 连接状态提示
```css
className: "mb-4 flex items-center gap-2 px-4 py-2 bg-orange-500/20 backdrop-blur-sm rounded-full border border-orange-500/30"
<span className="text-orange-700 text-sm font-medium">正在连接服务器...</span>
```

#### QR 扫描框
```css
/* 外框 */
className: "relative w-full max-w-[300px] md:max-w-sm aspect-square rounded-[2rem] bg-white/10 backdrop-blur-xl border border-white/30 shadow-[0_8px_32px_rgba(127,19,236,0.15)] overflow-hidden mb-6"

/* 扫描线动画 */
.absolute inset-0 pointer-events-none
<div className="absolute left-0 w-full h-[2px] bg-purple-600 shadow-[0_0_10px_#9333ea] animate-scan" />

/* 四角装饰 */
.top-6.left-6 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-xl opacity-80
/* 右上、右下、左下类似 */
```

#### 输入模式
```css
/* 配对码输入框 */
className: "w-full px-4 py-3 text-center text-2xl font-mono font-bold tracking-wider text-slate-900 placeholder:text-slate-400 bg-white/90 border-2 border-purple-200 rounded-xl focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 transition-all"

/* 验证按钮 */
className: "w-full max-w-[300px] py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-full font-medium transition-colors flex items-center justify-center gap-2"
```

#### 状态显示
```css
/* 等待中 */
className: "w-20 h-20 mb-6 rounded-full bg-purple-100 flex items-center justify-center"
<Loader2 size={40} className="text-purple-600 animate-spin" />

/* 成功 */
className: "w-20 h-20 mb-6 rounded-full bg-green-100 flex items-center justify-center"
<Check size={40} className="text-green-600" />
```

---

## 快照页面 (Snapshot)

### 14.1 相机预览模式结构

```
┌─────────────────────────────────────────────────────┐
│  [←] 快照                        [📷] [⟲]          │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │                                               │  │
│  │              相机预览画面                      │  │
│  │                                               │  │
│  │         ┌─────────────────────┐               │  │
│  │         │   ┌┐ ┌┐ ┌┐ ┌┐     │               │  │
│  │         │   └┘ └┘ └┘ └┘     │  ← 取景框    │  │
│  │         │                   │               │  │
│  │         └─────────────────────┘               │  │
│  │                    │                            │  │
│  │                    ●                            │  │
│  │               实时指示器                       │  │
│  │                                               │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│                    ┌───┐                           │
│                    │ ● │  ← 拍照按钮               │
│                    └───┘                           │
│               (渐变圆形 + 发光)                     │
│                                                     │
│            点击拍摄以分析                          │
└─────────────────────────────────────────────────────┘
```

### 14.2 详细样式

#### 页面容器
```css
className: "relative h-screen w-full overflow-hidden flex flex-col bg-black"
```

#### 头部导航
```css
className: "mx-2 bg-black/20 backdrop-blur-md rounded-full px-4 py-3 flex items-center justify-between border border-white/20"

/* 返回按钮 */
className: "w-10 h-10 flex items-center justify-center rounded-full bg-white/20 text-white"

/* 标题 + 状态 */
className: "flex items-center gap-2"
<h1 className="text-white text-xl font-bold">快照</h1>

/* 实时状态 */
.isReady && (
  <div className="flex items-center gap-1 bg-green-500/30 px-2 py-1 rounded-full">
    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
    <span className="text-xs text-green-100">实时</span>
  </div>
)
```

#### 取景框
```css
/* 取景框容器 */
className: "relative w-64 h-64 border-2 border-white/0"

/* 四角装饰 */
.absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-lg
/* 右上、右下、左下类似 */

/* 扫描动画 */
.isScanning && (
  <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden">
    <div className="w-full h-1 bg-cyan-400/80 shadow-[0_0_15px_#22d3ee] animate-scan absolute top-0" />
    <div className="absolute inset-0 bg-cyan-500/10 animate-pulse" />
  </div>
)

/* 中心点 */
!isScanning && !capturedPhoto && (
  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_10px_white]" />
)
```

#### 拍照按钮
```css
className: "relative group cursor-pointer active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"

/* 发光背景 */
.absolute.inset-0.rounded-full.bg-cyan-500.blur-xl.opacity-40.group-hover:opacity-60.transition-opacity

/* 按钮主体 */
.relative.w-20.h-20.rounded-full.bg-white/20.backdrop-blur-md.border-4.border-white/60.flex.items-center.justify-center

/* 内部渐变 */
.w-14.h-14.rounded-full.bg-gradient-to-tr.from-cyan-400.to-cyan-200
```

### 14.3 结果预览模式结构

```
┌─────────────────────────────────────────────────────┐
│  [<] 快照分析                     [重拍]          │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │                                               │  │
│  │              [拍摄的图片]                     │  │
│  │                                               │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  💡 点击下面按钮会自动生成对应提示词                │
│                                                     │
│  ┌──────────┐ ┌──────────┐                        │
│  │识别画面内容│ │提取图片文字│  (2x2 网格)         │
│  └──────────┘ └──────────┘                        │
│  ┌──────────┐ ┌──────────┐                        │
│  │生成学习要点│ │下一步建议 │                        │
│  └──────────┘ ┌──────────┘                        │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │  提示词输入框 (textarea)                       │  │
│  │  可编辑                                        │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  [重拍]           [发送给 Clawbot]                 │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 14.4 详细样式

#### 照片预览区域
```css
className: "mt-4 rounded-3xl bg-white/5 border border-white/10 p-4 backdrop-blur-md"

/* 图片容器 */
className: "relative overflow-hidden rounded-2xl border border-white/10 bg-black"
<img className="w-full h-56 object-cover" />
```

#### 分析按钮
```css
className: "px-3 py-2 rounded-xl text-sm border transition-colors"
/* 选中: bg-cyan-500 text-white border-cyan-400 */
/* 未选中: bg-white/10 text-white border-white/20 hover:bg-white/20 */
```

#### 提示词输入框
```css
className: "w-full min-h-[120px] rounded-xl bg-black/30 border border-white/15 text-white text-sm px-3 py-2 outline-none focus:border-cyan-400"
```

#### 发送按钮
```css
className: "flex-1 px-4 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-600 disabled:opacity-60 disabled:cursor-not-allowed text-white flex items-center justify-center gap-2"
```

---

## 地图页面 (SnapMapScreen)

### 15.1 页面结构

```
┌─────────────────────────────────────────────────────┐
│  [<]  Virtual World                                │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │ 🔍 搜索地点...                                │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  [全部] [餐饮] [娱乐] [学习] [购物] [公园]         │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │  📍 位置已开启 / 位置已关闭                    │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  ╔═══════════════════════════════════════════════╗  │
│  ║                                               ║  │
│  ║        ┌────┐                                ║  │
│  ║       /│ 📍 │                               ║  │
│  ║    ┌──┤    │──┐                             ║  │
│  ║    │  └────┘  │                             ║  │
│  ║    │  📍好友  │  ←─ 地图区域                ║  │
│  ║    └──┬────┬──┘                             ║  │
│  ║       │ 📍 │                                ║  │
│  ║       │地点│                                ║  │
│  ║       └────┘                                ║  │
│  ║                                               ║  │
│  ╚═══════════════════════════════════════════════╝  │
│                                                     │
│                              ┌────┐                 │
│                              │ ⬆️ │ ← 定位按钮      │
│                              └────┘                 │
│                                                     │
│     6 个热门地点    │    3 位好友                  │
└─────────────────────────────────────────────────────┘
```

### 15.2 详细样式

#### 顶部搜索栏
```css
/* 搜索框 */
className: "w-full px-4 py-3 rounded-xl border-none bg-white shadow-lg"
style: { borderRadius: '12px' }

/* 分类筛选 */
className: "flex gap-2 overflow-x-auto"
/* 选中按钮 */
background: selectedCategory === cat ? '#6366f1' : 'rgba(255, 255, 255, 0.9)'
```

#### 位置状态按钮
```css
className: "px-4 py-2 rounded-xl border-none"
/* 开启: background: 'rgba(34, 197, 94, 0.9)' */
/* 关闭: background: 'rgba(156, 163, 175, 0.9)' */
```

#### 地图容器
```css
<MapContainer
  center={[31.2304, 121.4737]}  // 上海陆家嘴
  zoom={15}
  style={{
    width: '100%',
    height: '100vh',
    background: '#f5f5f5',
  }}
/>
```

#### 地点标记
```css
/* 使用默认 Leaflet 标记或自定义图标 */
L.Icon.Default 或 自定义 DivIcon
```

#### 底部状态栏
```css
className: "fixed bottom-[32px] left-1/2 -translate-x-1/2 z-10 bg-white px-6 py-3 rounded-full shadow-lg flex items-center gap-5"
/* 位置: bottom: 32px, left: 50%, transform: translateX(-50%) */

/* 指示点 */
className: "w-2 h-2 rounded-full"
/* 地点: bg-blue-500 shadow-blue-500 */
/* 好友: bg-green-500 shadow-green-500 */
```

#### 定位按钮
```css
style: {
  position: 'absolute',
  bottom: '120px',
  right: '16px',
  zIndex: 1000,
  width: '48px',
  height: '48px',
  borderRadius: '50%',
  background: 'white',
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
}
```

---

## 核心组件样式参考

### 16.1 GlassPanel 毛玻璃面板

```css
/* 暗色模式 */
className: "bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/15"

/* 亮色模式 */
className: "bg-white/75 border border-slate-200/80 hover:bg-white"

/* 通用圆角 */
className: "!rounded-xl"  // 12px
className: "!rounded-2xl" // 16px
className: "!rounded-3xl" // 24px
```

### 16.2 Avatar 头像

```css
/* 头像容器 */
className: "rounded-full overflow-hidden bg-cover bg-center"

/* 尺寸变体 */
size="xs"  -> 24px
size="sm"  -> 32px
size="md"  -> 40px
size="lg"  -> 48px
size="xl"  -> 64px
size="2xl" -> 96px
```

### 16.3 Loading 加载动画

```css
/* 旋转加载 */
className: "w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"

/* 脉冲 */
className: "animate-pulse"

/* 骨架屏 */
className: "bg-slate-200 dark:bg-slate-700 animate-pulse rounded"
```

---

*文档结束 - 共 16 个章节*
