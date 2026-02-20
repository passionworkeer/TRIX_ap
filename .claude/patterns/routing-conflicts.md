# 路由配置冲突问题

## 问题
Study 路由出现冲突，导致页面无法正确导航

## 根因
使用枚举常量定义路由，与动态路由模式冲突

## 标准解决方案

```typescript
// ❌ 错误：使用枚举
enum AppRoutes {
  TIMER = '/study/timer'
}

// ✅ 正确：使用字面路径
const studyPaths = {
  root: '/study',
  timer: '/study/timer'
}
```

## 完整修复

```typescript
// src/App.tsx
<Route path="/study" element={<Study />} />

// src/pages/Study.tsx
import { useLocation } from 'react-router-dom'

export const Study = () => {
  const location = useLocation()

  // 根据路径决定显示内容
  const showTimer = location.pathname === '/study/timer'

  return (
    <div>
      {showTimer ? <StudyTimer /> : <StudyList />}
    </div>
  )
}
```

## 验证步骤

1. 访问 /study → 显示学习列表
2. 访问 /study/timer → 显示计时器
3. 刷新页面 → 路由保持不变

## 相关文件
- `src/App.tsx`
- `src/pages/Study.tsx`
- `src/types.ts` (移除枚举)

## Commit 示例
```
fix(routing): resolve study route conflict with literal paths

Problem: Enum-based routes conflict with dynamic routing
Solution: Use string literals for paths, handle routing in component

Fixes: #125
```
