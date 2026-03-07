# 项目代码审查报告

> 生成时间: 2026-03-07

---

## 一、前端未实现按钮/无法点击

### 1. WorkbenchModal.tsx - 三个功能卡片未实现

| 行号 | 问题 | 状态 |
|------|------|------|
| 76 | `// TODO: Open location picker` 点击位置卡片无实际功能 | 🔴 未实现 |
| 80 | `// TODO: Open schedule manager` 点击日程卡片无实际功能 | 🔴 未实现 |
| 84 | `// TODO: Open todo list` 点击待办卡片无实际功能 | 🔴 未实现 |

### 2. Home.tsx - 位置选择未发送

| 行号 | 问题 | 状态 |
|------|------|------|
| 177 | `// TODO: Handle location selection` 选择位置后没有发送到聊天 | 🔴 未实现 |

### 3. LocationPicker.tsx - 搜索功能是占位符

| 行号 | 问题 | 状态 |
|------|------|------|
| 218-223 | 搜索功能只是占位符，注释说明需要集成地理编码服务 | 🟡 占位符 |

### 4. workbench.ts - 默认 onClick 是空函数

| 行号 | 问题 | 状态 |
|------|------|------|
| 74, 82, 90, 98 | 默认工作台项目的 `onClick` 都是空函数 `() => {}` | 🔴 未实现 |

### 5. achievementService.ts - 硬编码返回 0

| 行号 | 问题 | 状态 |
|------|------|------|
| 129-130 | `early_bird_count` 和 `night_owl_count` 返回硬编码的 0，注释 `// TODO: 实现` | 🔴 未实现 |

### 6. 路由硬编码问题

| 文件 | 行号 | 问题 |
|------|------|------|
| StudyBuddiesList.tsx | 177 | 使用硬编码 `/study/timer` |
| StudyRoom.tsx | 301 | 使用硬编码 `/study/timer` |
| Study.tsx | 151 | 使用硬编码 `/study/timer` |
| types.ts | - | `AppRoutes` 枚举中缺少 `/study/timer` 定义 |

---

## 二、后端逻辑冲突

### 1. 严重问题 - profile 变量未定义

| 文件 | 行号 | 问题 |
|------|------|------|
| `routes\mvp.js` | 220 | 变量 `profile` 未定义就被使用 |

```javascript
// 第 220 行 - profile 未定义
{ user_id: friendId, friend_id: req.userId, name: profile?.full_name || profile?.username, ... }
```

### 2. Socket.io 事件别名（建议优化）

| 文件 | 行号 | 问题描述 |
|------|------|----------|
| server.js | 986-989 | `pair_with_code` 和 `app_pair_with_code` 使用同一处理函数 |
| server.js | 1211-1214 | `app_message` 和 `user_message` 都调用 `handleAppToBotMessage` |

> 说明：这些是事件别名，不是真正的冲突，但可能导致日志追踪困难

### 3. 数据库事务问题

| 文件 | 行号 | 问题 |
|------|------|------|
| services\messageService.js | 23-32 | `saveMessage` 没有使用事务，多并发写入可能导致数据不一致 |

### 4. SQLite 配置

| 文件 | 行号 | 状态 |
|------|------|------|
| config\database.js | 13-20 | 已启用 WAL 模式和 `synchronous = NORMAL`，配置良好 ✅ |

---

## 三、前端美化建议

### 高优先级 - 缺少动画

| 组件 | 问题 | 建议 |
|------|------|------|
| AddFriendModal.tsx | 缺少弹窗动画 | 使用 AnimatePresence 添加淡入淡出 |
| MailPanel.tsx | 缺少滑入动画 | 使用 framer-motion 添加入场动画 |
| NotificationPanel.tsx | 缺少入场动画 | 添加依次入场动画 (stagger) |

### 中优先级 - 样式单调

| 组件 | 问题 | 建议 |
|------|------|------|
| StudyStats.tsx | 背景简单 | 添加渐变边框和发光效果 |
| OutfitPreview.tsx | 缺少悬停动画 | 添加图片放大动画 |
| AchievementModal.tsx | 动画类未定义 | 使用 framer-motion 替代 |

### 低优先级 - 体验优化

| 组件 | 问题 | 建议 |
|------|------|------|
| Wardrobe.tsx | 加载状态简单 | 使用骨架屏 |
| Chat.tsx | 空状态简单 | 添加插图 |
| PointsMall.tsx | 空状态简单 | 添加引导提示 |

---

## 四、修复优先级

### P0 - 必须修复

| 序号 | 问题 | 文件 |
|------|------|------|
| 1 | profile 变量未定义 | routes\mvp.js:220 |
| 2 | WorkbenchModal 三个卡片未实现 | WorkbenchModal.tsx |
| 3 | achievementService 硬编码 0 | achievementService.ts |

### P1 - 应该修复

| 序号 | 问题 | 文件 |
|------|------|------|
| 4 | Home 位置选择未发送 | Home.tsx |
| 5 | messageService 缺少事务 | messageService.js |
| 6 | 路由硬编码统一 | types.ts |

### P2 - 建议优化

| 序号 | 问题 | 文件 |
|------|------|------|
| 7 | AddFriendModal 添加动画 | AddFriendModal.tsx |
| 8 | MailPanel 添加动画 | MailPanel.tsx |
| 9 | NotificationPanel 添加动画 | NotificationPanel.tsx |

---

## 五、总结

| 分类 | 数量 |
|------|------|
| 🔴 未实现按钮/功能 | 7 处 |
| 🟡 占位符 | 1 处 |
| 🔴 后端严重问题 | 1 处 |
| 🟡 后端建议优化 | 3 处 |
| 🎨 美化建议 | 9+ 处 |
