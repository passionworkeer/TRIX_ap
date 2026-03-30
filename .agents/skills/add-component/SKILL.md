---
name: add-component
description: >
  为 TRIX iOS / SwiftUI 代码添加单个组件、动画或图表。
  当用户提到“添加组件”“加一个动画”“加一个图表”“补一个 SwiftUI 组件”时触发。
---

# Add Component

这个 skill 是项目里的轻量包装层，专门把“单个 SwiftUI 组件接入”这类请求路由到现有的 `swift` skill。

## 使用方式

1. 先读取并遵循 [`../swift/SKILL.md`](../swift/SKILL.md)
2. 重点执行其中的“Add Component”工作流
3. 默认只做单组件/单动画/单图表接入，不把任务扩展成完整功能重构
4. 优先保持现有命名、目录结构和设计风格

## 适用场景

- 添加 shimmer / skeleton / loading 动画
- 添加图表、卡片、标签、提示组件
- 给现有 SwiftUI 页面补一个局部 UI 元素
