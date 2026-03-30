---
name: explore-recipes
description: >
  浏览 ShipSwift / SwiftUI 可用 recipe、组件和模块。
  当用户提到“看看有哪些组件”“浏览 recipes”“找一个 SwiftUI 方案”时触发。
---

# Explore Recipes

这个 skill 负责把“先看看有什么可用组件/recipe”这类请求路由到项目内的 `swift` skill 的 Explore 流程。

## 使用方式

1. 先读取并遵循 [`../swift/SKILL.md`](../swift/SKILL.md)
2. 重点执行其中的“Explore”工作流
3. 先列可用 recipe / 组件，再给出最匹配当前任务的推荐
4. 不直接改代码，除非用户明确要求继续集成

## 适用场景

- 浏览可用 SwiftUI 组件
- 挑选动画、图表、模块 recipe
- 在动手开发前先找现成方案
