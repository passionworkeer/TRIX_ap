# TRIX 3D Companion 项目投资评估报告（严厉版）

> 评估日期：2026-03-17
> 评估人：Claude Code（技术尽调视角）

---

## 一、残酷的现实

你的项目**远没有92%完成**，实际情况是：

| 模块 | 声称完成度 | 实际可用度 | 问题 |
|------|----------|----------|------|
| **iOS 端** | 90% | **< 20%** | 21个API未接入，聊天点击无反应 |
| **Web 前端** | 95% | **~50%** | 大量功能断点，测试失败 |
| **后端服务** | 80% | **~40%** | 关键功能未实现 |
| **配对功能** | 100% | **30%** | Web端GatewayContext配对是空实现 |

---

## 二、严重问题清单

### 🔴 P0 - 致命问题（必须修复）

#### 1. 安全灾难 - 密钥泄露

```
文件: .env.production

泄露的敏感凭据:
- Gateway Token: __GATEWAY_AUTH_TOKEN_REDACTED__
- Supabase ANON Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
- 豆包 TTS Token: REDACTED_DOUBAO_TTS_TOKEN
- 阿里云 OSS Key: __ALIYUN_ACCESS_KEY_ID_REDACTED__
- 阿里云 OSS Secret: __ALIYUN_ACCESS_KEY_SECRET_REDACTED__
```

**影响**：任何人克隆仓库后可完全控制你的服务

#### 2. iOS 端 - 几乎不可用

根据 `docs/ios/IOS_ISSUES.md`：

```
21个 API 模块完全未接入:
- /api/user          ❌
- /api/friends       ❌
- /api/schedules     ❌
- /api/todos         ❌
- /api/achievements  ❌
- /api/mall          ❌
- /api/wardrobe      ❌
- /api/study/*       ❌
- /api/chat          ❌
- /api/places        ❌
- /api/locations     ❌
- /api/points        ❌
... 等共 21 个
```

**附加问题**：
- 聊天界面点击无反应（可能需要真机测试）
- 配对功能只是占位实现
- 主题切换未实现
- 国际化未完成

#### 3. 测试大量失败

```
运行结果:
- 测试文件: 20 failed | 51 passed (71 total)
- 测试用例: 136 failed | 1054 passed (1190 total)
- 7 个未处理错误
- 错误原因: mock 不完整、静默吞掉异常
```

**根本原因**：
- `AuthContext.test.tsx` 中 `updateLastActive` mock 缺失
- 测试使用 `.catch(() => {})` 静默吞掉错误

#### 4. Web 端功能断点

| 功能 | 代码状态 | 实际行为 |
|------|---------|---------|
| `GatewayContext.pairWithCode()` | 返回 `success: true` | 无论输入什么 |
| `ClawbotChannelBridge` | localStorage存储敏感信息 | XSS可窃取所有令牌 |
| 消息历史 | 未实现分页 | 只能加载最近消息 |

---

### 🟠 P1 - 高严重问题

#### 5. 静默错误处理

```typescript
// AuthContext.tsx - 4处
updateLastActive().catch(() => {});  // 失败不告诉用户

// ClawbotChannelBridge.ts
localStorage.setItem('clawbot_device_id', data.deviceId);  // 明文存储

// GatewayContext.tsx:127
// TODO: Implement pairing via server  // 空实现
```

#### 6. WebSocket 重连配置乱码

```typescript
// ClawbotChannelBridge.ts:353-355
reconnectionAttempts: 10,  // 注释是乱码: "多次重连失败 原� 100 次"
reconnectionDelay: 2000,
reconnectionDelayMax: 30000  // 注释: "最大延迟 原� 60000 毫秒"
```

#### 7. iOS Socket.IO 未支持

```swift
// ClawbotChannelService.swift
// 注意: 当前使用 Starscream WebSocket 库，不支持 Socket.IO 协议
// 需要添加 Socket.IO 库或使用其他方式实现完整功能
```

---

### 🟡 P2 - 中等问题

#### 8. TypeScript 类型问题

- 16 个文件使用 `any` 绕过类型检查
- 编译时无法发现类型错误

#### 9. console.log 泛滥

- 141 处 console.log
- 生产环境应删除或使用日志框架

---

## 三、功能真实性检查

### 声称完成但实际有问题的功能

| 功能 | 声称 | 实际 |
|------|------|------|
| 配对功能 | 100% | Web端GatewayContext是空实现 |
| 好友系统 | 90% | iOS端 API 未接入 |
| 日程管理 | 100% | iOS端 API 未接入 |
| 待办事项 | 100% | iOS端 API 未接入 |
| 积分商城 | 70% | iOS端 API 未接入 |
| 衣柜系统 | 60% | iOS端 API 未接入 |
| 位置功能 | 60% | iOS端 API 未接入 |
| AI对话 | 95% | iOS端 Socket.IO 未支持 |
| 消息历史 | - | 未实现分页 |
| 学习房间 | - | Web端状态同步不完整 |

### 真正可用的功能

| 平台 | 真正可用功能 |
|------|-------------|
| **Web 前端** | 登录、基础聊天（WebSocket）、地图展示、任务列表 |
| **iOS** | 基础 UI 框架、登录 UI、Todo UI、Mock 数据展示 |
| **后端** | 配对码生成/认领、消息转发、文件上传到OSS |

---

## 四、投资价值重估

### 修正后的估值

| 评估方法 | 原估值 | 修正后 | 修正原因 |
|----------|--------|--------|----------|
| 代码量法 | ¥3000-5000万 | **¥800-1500万** | 大量代码不可用 |
| 完成度法 | ¥5000-8000万 | **¥1500-2500万** | 实际完成度<40% |
| 赛道法 | ¥8000万-1.5亿 | **¥2000-4000万** | 功能断点太多 |

### 投资建议

> **不建议投资（当前状态）**

**核心理由**：
1. 🔴 **安全灾难** - 密钥已泄露，必须全部轮换
2. 🔴 **iOS 不可用** - 21个API未接入，相当于重写
3. 🔴 **测试失败** - 136个测试失败，无法保证质量
4. 🟠 **功能断点** - 多处"看起来完成但跑不通"
5. 🟠 **无商业验证** - 没有任何用户数据

---

## 五、必须修复的清单

### 立即执行（7天内）

- [ ] **轮换所有泄露的密钥**（Gateway Token、Supabase Key、OSS Key、TTS Token）
- [ ] 从 Git 历史中删除 `.env.production`
- [ ] 修复 AuthContext test mock 问题
- [ ] 修复/删除 136 个失败测试

### 高优先级（30天内）

- [ ] 实现 GatewayContext 配对功能
- [ ] 接入 iOS 端 21 个 API 模块
- [ ] 修复 iOS 聊天点击无反应问题
- [ ] 移除 localStorage 中的敏感数据
- [ ] 实现消息历史分页

### 中优先级（60天内）

- [ ] 添加 Socket.IO 支持到 iOS
- [ ] 完善 iOS 主题切换
- [ ] 完成 iOS 国际化
- [ ] 测试覆盖率提升到 50%+
- [ ] 移除所有 `.catch(() => {})`

---

## 六、总结

### 真实项目状态

| 维度 | 评分 | 说明 |
|------|------|------|
| **安全** | ❌ F | 密钥泄露，localStorage 风险 |
| **iOS 可用性** | ❌ F | 21个API未接入 |
| **Web 功能** | 🟡 C | 存在功能断点 |
| **测试** | ❌ F | 136个失败 |
| **商业模式** | ❓ ? | 未验证 |

### 投资结论

> **不建议投资**
>
> 项目需要大量额外工作才能达到"可演示"状态：
> - iOS 端需要重写 50%+
> - Web 端需要修复多处功能断点
> - 安全问题必须先修复
>
> 建议：修复所有 P0 问题后再评估

---

*报告生成时间：2026-03-17*
*分析工具：Claude Code + Vitest + 代码审查*
