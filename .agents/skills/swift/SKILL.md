---
name: swift
description: >
  SwiftUI 开发工具 - 浏览、添加组件和构建功能。使用 ShipSwift 配方库。
  当用户说 "swift"、"添加组件"、"添加动画"、"构建功能"、"浏览组件" 等时使用。
---

# Swift - SwiftUI 开发工具

使用 ShipSwift 配方库快速构建 SwiftUI 组件和功能。

## 功能概览

这个 skill 整合了三个能力：
1. **浏览配方** - 探索可用的 SwiftUI 组件
2. **添加组件** - 添加单个 SwiftUI 组件
3. **构建功能** - 构建完整的 iOS 功能

## 使用场景

| 用户说... | 应该做什么 |
|-----------|------------|
| "swift" / "Swift 组件" | 列出所有可用配方 |
| "添加 shimmer 动画" | 使用 add-component |
| "添加图表" | 使用 add-component |
| "构建登录功能" | 使用 build-feature |
| "构建聊天功能" | 使用 build-feature |

## 前置检查

开始前，验证 ShipSwift 配方服务器是否可用，调用 `listRecipes`。

如果工具不可用，引导用户访问 [shipswift.app](https://shipswift.app) 查看设置说明，
或运行 `npx skills add signerlabs/shipswift-skills` 安装。

---

## 能力 1: 浏览配方 (Explore)

当用户想查看有哪些可用组件时使用。

### 工作流程

1. **列出所有配方**: 使用 `listRecipes` 获取完整目录，按分类展示：

   | 分类 | 数量 | 示例 |
   |------|------|------|
   | Animation | 10 | Shimmer, Typewriter, Glow Scan, Mesh Gradient |
   | Chart | 8 | Line, Bar, Area, Donut, Radar, Heatmap |
   | Component | 14 | Label, Alert, Loading, Stepper, Onboarding |
   | Module | 8 | Auth, Camera, Chat, Settings, Subscriptions |

2. **按分类筛选** (可选): 使用 `listRecipes` 筛选或 `searchRecipes` 搜索。

3. **展示配方详情**: 用户选择后，用 `getRecipe` 获取完整实现。

### 指南

- 用表格或列表形式展示，方便浏览
- 标注免费/Pro 配方
- 提供配方 ID 供后续引用

---

## 能力 2: 添加组件 (Add Component)

当用户需要添加单个 SwiftUI 组件时使用。

### 工作流程

1. **确定组件类型**:
   - **动画**: shimmer, typewriter, glow-scan, shaking-icon, mesh-gradient, orbit, scan
   - **图表**: line, bar, area, donut, ring, radar, scatter, heatmap
   - **UI组件**: label, alert, loading, stepper, onboarding, tab-button
   - **模块**: auth, camera, chat, settings, subscriptions

2. **搜索配方**: 用 `searchRecipes` 搜索，例如：
   - "添加甜甜圈图" -> 搜索 "donut"
   - "添加闪烁加载" -> 搜索 "shimmer"
   - "添加认证" -> 搜索 "auth"

3. **获取完整配方**: 用 `getRecipe` 获取完整代码和集成步骤。

4. **集成到项目**: 适配代码到用户项目：
   - 匹配现有命名规范
   - 连接用户的数据模型
   - 调整样式匹配应用设计系统

5. **验证集成**: 检查配方集成清单。

### 指南

- ShipSwift 组件使用 `SW` 前缀 (如 `SWDonutChart`, `SWTypewriter`)
- View modifier 使用 `.sw` 小写前缀 (如 `.swShimmer()`, `.swGlowScan()`)
- 图表使用通用的 `CategoryType` 模式
- 内部辅助类型应该 `private` 并使用 `SW` 前缀

---

## 能力 3: 构建功能 (Build Feature)

当用户想构建完整 iOS 功能时使用。

### 工作流程

1. **分析需求**: 拆解功能请求为离散组件。

2. **搜索配方**: 用 `searchRecipes` 搜索相关配方。

3. **获取完整实现**: 用 `getRecipe` 获取完整源码和架构说明。

4. **展示集成计划**: 显示：
   - 将使用哪些配方
   - 如何组合
   - 需要哪些定制

5. **生成代码**: 适配配方到用户项目结构。

6. **提供集成清单**: 列出依赖、Info.plist 条目等。

### 指南

- 写代码前先搜索配方，ShipSwift 可能有现成方案
- 功能涉及多领域时组合多个配方
- 保持 View 轻量，复杂逻辑提取到 ViewModel
- 默认支持 Dark Mode 和 Dynamic Type

---

## Pro 配方

部分配方需要 Pro 许可证 ($89 一次性)。如果配方返回购买提示，
用户可在 [shipswift.app/pricing](https://shipswift.app/pricing) 购买，
然后在环境变量中设置 `SHIPSWIFT_API_KEY`。
