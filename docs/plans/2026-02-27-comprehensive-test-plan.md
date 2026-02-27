# TRIX 3D Companion 全面测试计划

> 测试日期：2026-02-27
> 测试范围：Web + iOS 完整功能验证
> 策略：完整覆盖 + 严格审查

---

## 📋 测试执行摘要

### 🎯 测试目标
1. **Web 端**：使用 Playwright 进行 E2E 测试，验证所有页面和功能
2. **单元测试**：运行 Vitest 单元测试，确保核心服务正常工作
3. **iOS 端**：代码完整性审查，验证 Swift 代码与 Web 端的一致性
4. **安全审查**：检查数据流向和潜在安全漏洞
5. **性能检查**：验证页面加载和响应时间

---

## 🧪 测试阶段

### 阶段 1：Web E2E 冒烟测试（Playwright）

#### 1.1 基础冒烟测试
```
测试文件：tests/e2e/app.test.ts
验证内容：
- [ ] T0.1: 首页加载（/）
- [ ] T0.2: 登录页加载（/login）
- [ ] T0.3: 注册页加载（/register）
- [ ] T0.4: Chat 页面加载（/chat）
- [ ] T0.5: Study 页面加载（/study）
```

#### 1.2 核心功能 E2E 测试
```
测试文件：src/e2e/points-mall.spec.ts
验证内容：
- [ ] T1.1: 进入积分商城页面
- [ ] T1.2: 商品浏览（至少显示 1 个商品）
- [ ] T1.3: 分类筛选（全部/服装/配饰/道具）
- [ ] T1.4: 兑换流程
- [ ] T1.5: 积分不足提示
- [ ] T1.6: 积分余额显示
- [ ] T1.7: 返回上一页
```

#### 1.3 路由测试（新增）
```
验证内容：
- [ ] T2.1: / → Home
- [ ] T2.2: /login → Login
- [ ] T2.3: /register → Register
- [ ] T2.4: /snapshot → Snapshot
- [ ] T2.5: /study → Study
- [ ] T2.6: /chat → Chat
- [ ] T2.7: /chat/detail → ChatDetail
- [ ] T2.8: /profile → Profile
- [ ] T2.9: /pairing → Pairing
- [ ] T2.10: /qr-pairing → QRCodePairing
- [ ] T2.11: /map → Map (SnapMapScreen)
- [ ] T2.12: /points-mall → PointsMall
- [ ] T2.13: /wardrobe → Wardrobe
- [ ] T2.14: /diagnostic → Diagnostic
- [ ] T2.15: /diagnostic-advanced → DiagnosticAdvanced
```

#### 1.4 新功能详细测试

**Map（地图功能）**
```
验证内容：
- [ ] T3.1: 地图页面加载
- [ ] T3.2: 位置标记显示
- [ ] T3.3: 地图交互（缩放/拖动）
- [ ] T3.4: 筛选功能
- [ ] T3.5: 搜索功能
- [ ] T3.6: 好友位置显示
```

**Wardrobe（衣柜/换装）**
```
验证内容：
- [ ] T4.1: 衣柜页面加载
- [ ] T4.2: 服装列表显示
- [ ] T4.3: 服装分类筛选
- [ ] T4.4: 服装详情查看
- [ ] T4.5: 服装更换/装备
```

**Profile（个人资料）**
```
验证内容：
- [ ] T5.1: 用户信息显示
- [ ] T5.2: 积分余额显示
- [ ] T5.3: 设置页面访问
- [ ] T5.4: 头像显示
```

---

### 阶段 2：单元测试（Vitest）

#### 2.1 核心服务测试
```
命令：npm run test:unit

服务测试覆盖：
- [ ] databaseService.test.ts
- [ ] uploadService.test.ts
- [ ] mallService.test.ts
- [ ] wardrobeService.test.ts
- [ ] locationService.test.ts
- [ ] placeService.test.ts

覆盖率要求：80%+
```

#### 2.2 组件测试
```
验证内容：
- [ ] Auth.test.tsx - 登录/注册组件
- [ ] Chat.test.tsx - 聊天组件
- [ ] Study.test.tsx - 学习组件
- [ ] PointsMall.test.tsx - 积分商城组件
- [ ] Wardrobe.test.tsx - 衣柜组件
- [ ] SnapMapScreen.test.tsx - 地图组件
```

#### 2.3 工具函数测试
```
验证内容：
- [ ] dateFormat.test.ts
- [ ] env.test.ts
- [ ] aiPrompt.test.ts
- [ ] logger.test.ts
- [ ] errorHandler.test.ts
```

---

### 阶段 3：iOS 代码完整性审查

#### 3.1 项目结构检查
```
验证内容：
- [ ] iOS 项目文件结构完整
- [ ] Package.swift 依赖正确
- [ ] 所有主要功能模块存在
```

#### 3.2 功能模块对应检查

| Web 模块 | iOS 模块 | 状态 |
|---------|---------|------|
| Home | HomeView | [ ] |
| Auth | LoginView | [ ] |
| Chat | MessageCell, VoiceMessageView | [ ] |
| Study | StudyRoomView, StudyStatsView | [ ] |
| Map | MapView, LocationDetailView | [ ] |
| Snapshot | CameraViewModel, SnapshotListView | [ ] |
| Profile | ProfileScreen, SettingsScreen | [ ] |
| Store | StoreView, ProductDetailView | [ ] |
| Voice | TTSViewModel, VoicePlayerViewModel | [ ] |

#### 3.3 数据模型一致性检查
```
验证内容：
- [ ] User 模型（Web vs iOS）
- [ ] ChatMessage 模型
- [ ] StudySession 模型
- [ ] Location 模型
- [ ] Points 模型
```

#### 3.4 服务层对应检查
```
验证内容：
- [ ] AuthService
- [ ] StudyService
- [ ] LocationService
- [ ] CameraService
- [ ] PointsService
- [ ] TTSService
- [ ] VoicePlaybackService
```

#### 3.5 测试文件覆盖检查
```
验证内容：
- [ ] LocationServiceTests
- [ ] CameraServiceTests
- [ ] ImageUploadServiceTests
- [ ] MapViewModelTests
- [ ] CameraViewModelTests
- [ ] AuthServiceTests
- [ ] StudyServiceTests
- [ ] APIClientTests
- [ ] WebSocketManagerTests
```

---

### 阶段 4：安全审查

#### 4.1 API 安全检查
```
验证内容：
- [ ] 无硬编码 API Key
- [ ] 无硬编码密码/Token
- [ ] 使用环境变量
- [ ] SQL 注入防护（参数化查询）
```

#### 4.2 数据安全检查
```
验证内容：
- [ ] 用户敏感信息加密存储
- [ ] 密码传输使用 HTTPS
- [ ] 无敏感信息泄露到日志

最近提交相关：
- [ ] mallService 安全审计（提交 24414d0）
```

#### 4.3 认证/授权检查
```
验证内容：
- [ ] 登录态验证
- [ ] 路由保护（ProtectedRoute）
- [ ] API 请求授权
```

---

### 阶段 5：性能检查

#### 5.1 页面加载性能
```
验证内容：
- [ ] 首页首次加载 < 3s
- [ ] 路由切换响应 < 1s
- [ ] 无阻塞性渲染
```

#### 5.2 资源加载检查
```
验证内容：
- [ ] 图片懒加载
- [ ] 代码分割（lazy loading）
- [ ] 无大型 bundle
```

---

## 📊 测试执行顺序

```
Phase 1: 快速冒烟
  ├── 1.1 启动开发服务器
  ├── 1.2 运行 Web 基础冒烟测试
  └── 1.3 运行 Vitest 单元测试

Phase 2: 核心功能测试
  ├── 2.1 E2E 测试（PointsMall, Wardrobe, Map）
  ├── 2.2 路由测试
  └── 2.3 安全审查

Phase 3: iOS 审查
  ├── 3.1 代码结构检查
  ├── 3.2 功能模块对应检查
  └── 3.3 数据模型一致性

Phase 4: 报告生成
  ├── 4.1 汇总所有测试结果
  ├── 4.2 列出问题清单
  └── 4.3 提供修复建议
```

---

## 🔧 执行命令

```bash
# 1. 启动开发服务器（后台运行）
npm run dev

# 2. Web E2E 测试
npm run test:e2e

# 3. 单元测试
npm run test:unit

# 4. 完整测试（包含冒烟）
npm run test:all

# 5. 带覆盖率测试
npm run test:unit:coverage
```

---

## ⚠️ 预期结果

### 通过标准
- [ ] 所有 E2E 测试通过
- [ ] 所有单元测试通过
- [ ] 覆盖率 >= 80%
- [ ] 无安全漏洞
- [ ] 无控制台 Error 级别错误

### 需要关注的问题
- [ ] 列出所有失败的测试
- [ ] 列出所有警告
- [ ] 记录性能问题
- [ ] 记录 iOS 代码不一致问题

---

## 📝 交付物

1. **测试执行报告** - 详细记录每个测试的执行结果
2. **问题清单** - 发现的所有问题及严重程度
3. **修复建议** - 针对每个问题的解决方案
4. **iOS 审查报告** - iOS 代码完整性评估
5. **安全审查报告** - 安全漏洞及风险评估

---

**版本**：1.0
**创建日期**：2026-02-27
**测试类型**：全面功能验证 + 代码审查
