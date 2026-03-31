---
name: build-feature
description: >
  为 TRIX iOS / SwiftUI 代码构建完整功能模块。
  当用户提到“构建功能”“做一个 Swift 功能”“实现 iOS 模块”时触发。
---

# Build Feature

这个 skill 把“完整 SwiftUI 功能开发”请求稳定路由到项目内的 `swift` skill，避免因为旧链接失效而漏触发。

## 使用方式

1. 先读取并遵循 [`../swift/SKILL.md`](../swift/SKILL.md)
2. 重点执行其中的“Build Feature”工作流
3. 先拆清需求、所需 recipe / 组件，再落代码
4. 如果需求其实只是单个组件，降级回 `add-component`

## 适用场景

- 构建登录、聊天、设置、订阅等完整 iOS 功能
- 将多个 SwiftUI 组件组合成一个可交付模块
- 需要同时处理 UI、状态、数据流的 iOS 任务
