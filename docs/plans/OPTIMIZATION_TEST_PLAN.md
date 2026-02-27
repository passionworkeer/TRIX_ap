# Web 端优化与测试补充计划

> 生成时间: 2026-02-27
> 状态: **Phase 1 完成**
> 版本: 1.1

---

## 📊 当前进度 (2026-02-27 更新)

### Phase 1: 服务测试 - ✅ 完成

| 服务 | 测试数 | 状态 |
|------|--------|------|
| StorageService | 23 | ✅ 通过 |
| pointsService | 26 | ✅ 通过 |
| userStatsService | 13 | ✅ 通过 |
| projectService | 18 | ✅ 通过 |
| **总计** | **80** | **全部通过** |

### 测试覆盖率提升

| 指标 | 之前 | 之后 |
|------|------|------|
| 服务测试覆盖 | 47% (8/17) | **80%+** (12/17) |
| 测试文件数 | 27 | **31** |
| 测试用例数 | 422 | **502** |

---

## ⚠️ Phase 2: 屏幕测试 - 跳过

由于复杂屏幕（ChatDetail, Profile, Home）依赖多个 Context 和复杂组件，
测试时会导致内存溢出。建议使用以下方式测试：

1. **E2E 测试** - 使用 Playwright 进行端到端测试
2. **集成测试** - 在真实环境中测试组件交互
3. **Storybook** - 单独测试组件

---

## 📋 Phase 3 & 4: 性能与代码质量优化

建议按原计划执行性能优化和代码质量改进。

### 测试覆盖情况

| 类型 | 数量 | 测试文件 |
|------|------|---------|
| **服务 (Services)** | 17 | 8 个有测试 |
| **屏幕 (Screens)** | 15+ | 6 个有测试 |
| **组件 (Components)** | 30+ | 较少 |

### 服务测试覆盖

| 服务 | 状态 | 测试文件 |
|------|------|---------|
| mallService | ✅ | mallService.test.ts |
| wardrobeService | ✅ | wardrobeService.test.ts |
| locationService | ✅ | locationService.test.ts |
| placeService | ✅ | placeService.test.ts |
| databaseService | ✅ | databaseService.test.ts |
| uploadService | ✅ | uploadService.test.ts |
| ttsService | ✅ | ttsService.test.ts |
| voicePlaybackService | ✅ | voicePlaybackService.test.ts |
| serverOssUploadService | ✅ | serverOssUploadService.test.ts |
| ClawbotChannelBridge | ✅ | ClawbotChannelBridge.test.ts |
| **OSSService** | ❌ | - |
| **StorageService** | ❌ | - |
| **pointsService** | ❌ | - |
| **projectService** | ❌ | - |
| **userStatsService** | ❌ | - |
| **clawbotPairingService** | ❌ | - |
| **ConnectionManager** | ❌ | - |

### 屏幕测试覆盖

| 屏幕 | 状态 |
|------|------|
| Auth | ✅ |
| Chat | ✅ |
| ChatDetail | ❌ |
| PointsMall | ✅ |
| Wardrobe | ✅ |
| SnapMapScreen | ✅ |
| Study | ✅ |
| Profile | ❌ |
| Home | ❌ |
| Settings | ❌ |
| Pairing | ❌ |
| QRCodePairing | ❌ |
| Snapshot | ❌ |

---

## 🎯 优化与测试目标

### 目标覆盖率

| 目标 | 当前 | 目标 |
|------|------|------|
| 服务测试覆盖 | 47% (8/17) | 80%+ (14/17) |
| 屏幕测试覆盖 | 38% (6/16) | 60%+ (10/16) |
| 组件测试覆盖 | ~20% | 40%+ |

---

## 📋 任务清单

### Phase 1: 服务测试补充

#### Task 1.1: StorageService 测试

**预估时间**: 1h

- [ ] **T1.1.1** 创建 `src/services/StorageService.test.ts`
- [ ] **T1.1.2** 测试 `setItem()` 方法
- [ ] **T1.1.3** 测试 `getItem()` 方法
- [ ] **T1.1.4** 测试 `removeItem()` 方法
- [ ] **T1.1.5** 测试 `clear()` 方法
- [ ] **T1.1.6** 测试 `getAllKeys()` 方法
- [ ] **T1.1.7** 测试错误处理

#### Task 1.2: pointsService 测试

**预估时间**: 1h

- [ ] **T1.2.1** 创建 `src/services/pointsService.test.ts`
- [ ] **T1.2.2** 测试 `getPointsBalance()` 方法
- [ ] **T1.2.3** 测试 `getPointsHistory()` 方法
- [ ] **T1.2.4** 测试 `earnPoints()` 方法
- [ ] **T1.2.5** 测试 `spendPoints()` 方法
- [ ] **T1.2.6** 测试积分不足情况

#### Task 1.3: userStatsService 测试

**预估时间**: 1h

- [ ] **T1.3.1** 创建 `src/services/userStatsService.test.ts`
- [ ] **T1.3.2** 测试 `getUserStats()` 方法
- [ ] **T1.3.3** 测试 `updateStudyTime()` 方法
- [ ] **T1.3.4** 测试 `updateFocusSession()` 方法
- [ ] **T1.3.5** 测试 `getLeaderboard()` 方法

#### Task 1.4: projectService 测试

**预估时间**: 1h

- [ ] **T1.4.1** 创建 `src/services/projectService.test.ts`
- [ ] **T1.4.2** 测试 `getProjects()` 方法
- [ ] **T1.4.3** 测试 `createProject()` 方法
- [ ] **T1.4.4** 测试 `updateProject()` 方法
- [ ] **T1.4.5** 测试 `deleteProject()` 方法
- [ ] **T1.4.6** 测试 `getProjectProgress()` 方法

---

### Phase 2: 屏幕测试补充

#### Task 2.1: ChatDetailScreen 测试

**预估时间**: 1.5h

- [ ] **T2.1.1** 创建 `src/screens/ChatDetail.test.tsx`
- [ ] **T2.1.2** 测试消息列表渲染
- [ ] **T2.1.3** 测试消息输入
- [ ] **T2.1.4** 测试发送消息
- [ ] **T2.1.5** 测试 AI 回复
- [ ] **T2.1.6** 测试语音输入切换

#### Task 2.2: ProfileScreen 测试

**预估时间**: 1.5h

- [ ] **T2.2.1** 创建 `src/screens/Profile.test.tsx`
- [ ] **T2.2.2** 测试用户信息显示
- [ ] **T2.2.3** 测试设置入口
- [ ] **T2.2.4** 测试积分显示
- [ ] **T2.2.5** 测试登出功能

#### Task 2.3: HomeScreen 测试

**预估时间**: 1h

- [ ] **T2.3.1** 创建 `src/screens/Home.test.tsx`
- [ ] **T2.3.2** 测试导航渲染
- [ ] **T2.3.3** 测试好友列表
- [ ] **T2.3.4** 测试快速开始按钮

---

### Phase 3: 性能优化

#### Task 3.1: 首屏加载优化

**预估时间**: 2h

- [ ] **T3.1.1** 分析首屏加载性能瓶颈
- [ ] **T3.1.2** 实现路由懒加载 (React.lazy)
- [ ] **T3.1.3** 优化图片加载 (lazy loading)
- [ ] **T3.1.4** 添加 loading skeleton

#### Task 3.2: 状态管理优化

**预估时间**: 1.5h

- [ ] **T3.2.1** 检查 Zustand store 结构
- [ ] **T3.2.2** 优化 re-render 次数
- [ ] **T3.2.3** 添加状态持久化

#### Task 3.3: 网络请求优化

**预估时间**: 1h

- [ ] **T3.3.1** 实现请求缓存
- [ ] **T3.3.2** 添加请求去重
- [ ] **T3.3.3** 优化 WebSocket 重连

---

### Phase 4: 代码质量优化

#### Task 4.1: 错误处理增强

**预估时间**: 1h

- [ ] **T4.1.1** 审查现有错误处理
- [ ] **T4.1.2** 统一错误提示样式
- [ ] **T4.1.3** 添加错误边界 (Error Boundary)

#### Task 4.2: TypeScript 严格模式

**预估时间**: 1h

- [ ] **T4.2.1** 检查 tsconfig 严格设置
- [ ] **T4.2.2** 修复类型错误
- [ ] **T4.2.3** 添加必要的类型注解

#### Task 4.3: 组件优化

**预估时间**: 1.5h

- [ ] **T4.3.1** 提取重复组件
- [ ] **T4.3.2** 优化 Props 传递
- [ ] **T4.3.3** 添加必要的 memo/useCallback

---

## 📅 预计时间

| Phase | 任务 | 预计时间 |
|------|------|---------|
| Phase 1 | 服务测试补充 | 4h |
| Phase 2 | 屏幕测试补充 | 4h |
| Phase 3 | 性能优化 | 4.5h |
| Phase 4 | 代码质量优化 | 3.5h |
| **总计** | | **16h** |

---

## 📁 需要创建的文件

### 测试文件 (11 个)

```
src/
├── services/
│   ├── StorageService.test.ts
│   ├── pointsService.test.ts
│   ├── userStatsService.test.ts
│   └── projectService.test.ts
└── screens/
    ├── ChatDetail.test.tsx
    ├── Profile.test.tsx
    └── Home.test.tsx
```

---

## ✅ 验收标准

### 测试验收

- [ ] 服务测试覆盖率 > 80%
- [ ] 屏幕测试覆盖率 > 60%
- [ ] 所有测试通过 (npm test)
- [ ] 无 TypeScript 错误

### 性能验收

- [ ] 首屏加载时间 < 3s
- [ ] 路由懒加载生效
- [ ] 无明显卡顿

### 代码质量验收

- [ ] 错误处理统一
- [ ] 无 any 类型（除非必要）
- [ ] 组件结构清晰

---

**最后更新**: 2026-02-27
