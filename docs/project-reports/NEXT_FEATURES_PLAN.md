# TRIX 3D Companion - 下一步功能实现计划

> **文档类型**: 产品规划与技术路线图
> **版本**: 1.0
> **日期**: 2026-02-25
> **作者**: 架构师 Agent
> **项目阶段**: MVP 后期优化阶段
> **⚠️ 注意**: 本文档为历史规划文档（2026-02-25），部分架构方案已变更：
> - `server/clawbot-channel/` → 已废弃，改用 `packages/trix-openclaw-native/` + TRIX Native Server (:8788)
> - Socket.IO → 原生 WebSocket（TrixNativeChannelClient）
> - `clawbotPairingService.ts` → 已删除，改用 `TrixNativeChannelClient.ts`
> - 部分 P0/P1 功能已实现，详见 CHANGELOG.md

---

## 一、项目现状诊断

### 1.1 核心功能完成度

| 功能模块 | 完成度 | 状态 |
|----------|--------|------|
| 三层布局 + 沉浸式首页 | 100% | ✅ 完成 |
| AI 对话 (WebSocket) | 95% | ⚠️ 需安全修复 |
| 扫码配对 | 100% | ✅ 完成 |
| 好友系统 | 90% | ⚠️ 需完善 |
| 实时聊天 | 90% | ⚠️ 需完善 |
| 学习计时器 (番茄钟) | 95% | ⚠️ 需优化 |
| 双向自习 (Study Room V2) | 70% | 🔄 开发中 |
| 结算弹窗 | 100% | ✅ 完成 |
| TTS 语音 | 95% | ⚠️ 需优化 |
| 地图功能 | 60% | ⚠️ 使用 mock |
| 通知系统 | 85% | ⚠️ 需完善 |

**整体完成度**: 92%

### 1.2 技术健康度

| 维度 | 评分 | 说明 |
|------|------|------|
| 功能完成度 | 92% | 核心功能基本完成 |
| 代码质量 | 75% | 存在技术债务 |
| 安全性 | 60% | 4个 P0 问题需修复 |
| 测试覆盖 | 10% | 严重不足 |
| 文档完整性 | 80% | 文档丰富但需整理 |

---

## 二、功能优先级矩阵

### P0 - 核心必需 (下一个迭代)

| 序号 | 功能 | 优先级 | 依赖 | 预估工时 |
|------|------|--------|------|----------|
| P0-1 | Socket 握手 JWT 鉴权 | 🔴 最高 | - | 4h |
| P0-2 | Webhook 鉴权空值检查 | 🔴 最高 | - | 1h |
| P0-3 | 轮换泄露密钥 + Git 清理 | 🔴 最高 | - | 2h |
| P0-4 | SQLite 数据文件迁移 | 🔴 最高 | - | 1h |
| P0-5 | 自习室 V2 房间状态同步 | 🔴 最高 | P0-1 | 3天 |

### P1 - 重要功能 (第二个迭代)

| 序号 | 功能 | 优先级 | 依赖 | 预估工时 |
|------|------|--------|------|----------|
| P1-1 | 配对状态原子化流程 | 🟠 高 | P0-1 | 2h |
| P1-2 | 消息确认链路修复 | 🟠 高 | - | 2h |
| P1-3 | sendMessage Promise 化 | 🟠 高 | - | 2h |
| P1-4 | OSS 接口鉴权 | 🟠 高 | P0-1 | 3h |
| P1-5 | 数据库脚本统一 | 🟠 高 | - | 3h |
| P1-6 | 测试基础设施修复 | 🟠 高 | - | 8h |
| P1-7 | 自习室 V2 邀请功能 | 🟠 高 | P0-5 | 2天 |
| P1-8 | 自习室 V2 房间码复制 | 🟠 高 | P0-5 | 0.5天 |

### P2 - 锦上添花 (未来迭代)

| 序号 | 功能 | 优先级 | 依赖 | 预估工时 |
|------|------|--------|------|----------|
| P2-1 | 配对接口限流 | 🟡 中 | P1-4 | 2h |
| P2-2 | QR 配对密钥优化 | 🟡 中 | - | 2h |
| P2-3 | 前端包体积优化 | 🟡 中 | - | 4h |
| P2-4 | PWA 离线支持 | 🟡 中 | - | 3天 |
| P2-5 | 推送通知 (Web Push) | 🟡 中 | P2-4 | 3天 |
| P2-6 | 专注度分析 (AI) | 🟡 中 | P1-6 | 5天 |
| P2-7 | 学习报告生成 (AI) | 🟡 中 | P2-6 | 5天 |
| P2-8 | AI 目标设定与追踪 | 🟡 中 | P2-6 | 5天 |

---

## 三、P0 功能详细规划

### 3.1 P0-1: Socket 握手 JWT 鉴权

**功能描述**:
在 Clawbot Channel Server 的 WebSocket 连接建立时，强制验证 Supabase JWT Token，防止身份伪造攻击。

**用户价值**:
- 安全性: 防止恶意用户冒充他人身份
- 信任: 保障用户数据隐私和通信安全

**技术方案**:

```typescript
// server/clawbot-channel/server.js
// 1. Socket 握手时解析 JWT
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication required'));
  }

  try {
    // 验证 Supabase JWT
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return next(new Error('Invalid token'));
    }
    socket.userId = user.id;
    next();
  } catch (err) {
    next(new Error('Authentication failed'));
  }
});
```

**预估工时**: 4小时
**依赖**: 无
**风险**: 中 - 需测试多种 Token 过期场景

---

### 3.2 P0-2: Webhook 鉴权空值检查

**功能描述**:
修复 Webhook 回调鉴权逻辑，当 `CLAWBOT_WEBHOOK_SECRET` 未配置时拒绝处理请求。

**用户价值**:
- 防止伪造 Bot 回调注入恶意消息

**技术方案**:

```javascript
// server/clawbot-channel/server.js
// 启动时强制校验配置
if (!process.env.CLAWBOT_WEBHOOK_SECRET) {
  throw new Error('CLAWBOT_WEBHOOK_SECRET is required');
}

// webhook 处理函数增加显式检查
app.post('/webhook', async (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  if (!signature || !crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(computeSignature(req.body))
  )) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  // 处理请求...
});
```

**预估工时**: 1小时
**依赖**: P0-3 (密钥轮换后)
**风险**: 低

---

### 3.3 P0-3: 轮换泄露密钥 + Git 清理

**功能描述**:
轮换已暴露在 Git 仓库中的敏感密钥，并从 Git 历史中彻底清理。

**用户价值**:
- 消除安全风险
- 符合合规要求

**技术方案**:

```bash
# 1. 轮换所有已泄露的密钥
# - CLAWBOT_WEBHOOK_SECRET
# - OSS_ACCESS_KEY_ID
# - OSS_ACCESS_KEY_SECRET
# - VITE_GATEWAY_AUTH_TOKEN

# 2. 使用 git-filter-repo 清理历史
git filter-repo --path .env --invert-paths
git filter-repo --path server/clawbot-channel/.env --invert-paths
git filter-repo --path server/clawbot-channel/data/ --invert-paths

# 3. 更新 .gitignore
echo ".env" >> .gitignore
echo "server/clawbot-channel/data/" >> .gitignore
```

**预估工时**: 2小时
**依赖**: 无
**风险**: 高 - 需谨慎操作 Git 历史

---

### 3.4 P0-4: SQLite 数据文件迁移

**功能描述**:
将运行时数据库文件从版本控制中移除，并迁移到项目外部目录。

**用户价值**:
- 防止用户/设备数据泄露
- 避免环境间数据串扰

**技术方案**:

```javascript
// server/clawbot-channel/server.js
const path = require('path');
const os = require('os');

// 迁移到用户目录
const dataDir = path.join(os.homedir(), '.trix-companion', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'pairing.db');
// 更新 better-sqlite3 配置
const db = new Database(dbPath);
```

**预估工时**: 1小时
**依赖**: P0-3
**风险**: 低

---

### 3.5 P0-5: 自习室 V2 房间状态同步

**功能描述**:
完成自习室 V2 的核心功能 - 房间状态实时同步，包括：
- StudyRoomContext 状态管理
- 本地计时器与房间状态联动
- 房主控制权限控制
- 断线降级策略

**用户价值**:
- 多人同时自习，状态实时同步
- 房主可统一控制专注/休息
- 良好的离线体验

**技术方案**:

```
┌─────────────────────────────────────────────────────────────┐
│                    StudyRoomContext (状态中心)              │
│  - currentRoom: StudyRoomState | null                      │
│  - isRoomHost: boolean                                      │
│  - joinRoom() / leaveRoom() / hostAction()                 │
└─────────────────────────────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
    ┌───────────┐  ┌──────────────┐  ┌──────────┐
    │本地计时器 │  │   WebSocket  │  │ Supabase │
    │   UI     │  │   推送事件    │  │  持久化  │
    └───────────┘  └──────────────┘  └──────────┘
```

**分步实施**:

| 阶段 | 任务 | 工时 |
|------|------|------|
| Phase 1 | 创建 StudyRoomContext，集成 WebSocket | 1天 |
| Phase 2 | UI 组件集成（状态指示器、快速加入） | 1天 |
| Phase 3 | 本地计时器联动（权限控制、同步） | 0.5天 |
| Phase 4 | 数据持久化与清理（beforeunload） | 0.5天 |

**预估工时**: 3天
**依赖**: P0-1 (Socket 鉴权)
**风险**: 中 - 需处理多种竞态条件

---

## 四、技术债务清单

### 4.1 必须重构的部分

| 债务项 | 位置 | 严重程度 | 重构方案 |
|--------|------|----------|----------|
| 硬编码 API URL | ClawbotChannelContext.tsx | 🔴 高 | 提取到配置文件 |
| 中文注释乱码 | databaseService.ts 多处 | 🟢 低 | 统一 UTF-8 |
| localStorage 滥用 | Clawbot 历史存储 | 🟡 中 | 迁移到 IndexedDB |
| 轮询 + Realtime 冗余 | Study.tsx | 🟡 中 | 统一使用 Realtime |

### 4.2 性能优化点

| 优化项 | 位置 | 当前状态 | 目标 |
|--------|------|----------|------|
| 前端包体积 | dist/assets/index-*.js | 1204 KB | < 800 KB |
| WebSocket 延迟 | TrixNativeChannelClient | < 500ms | < 200ms |
| 数据库查询 | study_sessions | 无索引 | 添加复合索引 |
| 图片加载 | Avatar 组件 | 无优化 | 懒加载 + WebP |

### 4.3 测试补充清单

| 测试类型 | 当前覆盖 | 目标覆盖 | 关键文件 |
|----------|----------|----------|----------|
| 单元测试 | 10% | 80% | services/, components/ |
| 集成测试 | 0% | 50% | API, DB |
| E2E 测试 | Smoke | 核心流程 | 配对、聊天、学习 |
| 安全测试 | 0% | 100% | 鉴权、输入验证 |

---

## 五、风险评估

### 5.1 技术风险

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| Socket 鉴权导致现有连接中断 | 高 | 中 | 渐进式部署，后向兼容 |
| Git 历史清理导致仓库损坏 | 高 | 低 | 完整备份，先在副本测试 |
| 房间状态同步竞态条件 | 中 | 中 | 使用版本号乐观锁 |
| AI 功能 API 成本超支 | 高 | 中 | 设置请求限额，基础版无 AI |

### 5.2 时间风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| P0 安全问题修复延迟 | 高 | 优先处理，每日进度同步 |
| 测试基础设施修复复杂 | 中 | 预留额外 50% 时间 |
| AI 功能迭代周期长 | 中 | MVP 定义最小可用功能 |

### 5.3 资源风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 密钥轮换需要外部协调 | 高 | 提前沟通，准备备用方案 |
| AI 服务商选择不确定 | 中 | 评估多个供应商，准备降级方案 |

---

## 六、实施路线图

### 第一阶段: 安全修复 (Week 1)

```
Day 1-2: P0-3 密钥轮换 + Git 清理
    ↓
Day 3: P0-4 SQLite 数据迁移
    ↓
Day 4: P0-2 Webhook 鉴权修复
    ↓
Day 5: P0-1 Socket JWT 鉴权
```

**验收标准**:
- ✅ 所有 P0 安全问题已修复
- ✅ 无敏感信息泄露风险
- ✅ 现有功能正常运行

### 第二阶段: 核心功能完善 (Week 2-3)

```
Week 2: P0-5 自习室 V2 房间状态同步
    ├── Phase 1: StudyRoomContext
    ├── Phase 2: UI 组件集成
    ├── Phase 3: 计时器联动
    └── Phase 4: 数据持久化

Week 3: P1 功能修复
    ├── P1-1 配对状态原子化
    ├── P1-2 消息确认链路
    ├── P1-3 sendMessage Promise 化
    └── P1-4 OSS 接口鉴权
```

**验收标准**:
- ✅ 自习室 V2 多人同步功能可用
- ✅ 消息发送失败正确处理
- ✅ OSS 接口安全

### 第三阶段: 质量提升 (Week 4)

```
Week 4: 测试 + 优化
    ├── P1-6 测试基础设施修复
    ├── P2-3 前端包体积优化
    └── P2-1 配对接口限流
```

**验收标准**:
- ✅ 单元测试覆盖率 > 50%
- ✅ 核心流程 E2E 测试通过
- ✅ 前端性能达标

### 第四阶段: 未来迭代 (Week 5+)

```
Week 5-6: P2 功能
    ├── PWA 离线支持
    ├── Web Push 通知
    └── 初步 AI 功能 (MVP)
```

---

## 七、下一步行动

### 立即行动 (今天)

- [ ] 确认 P0 安全问题修复优先级
- [ ] 备份当前 Git 仓库
- [ ] 准备密钥轮换方案
- [ ] 通知相关方维护窗口

### 本周任务

- [ ] 完成 P0-3: 密钥轮换 + Git 清理
- [ ] 完成 P0-4: SQLite 数据迁移
- [ ] 开始 P0-2: Webhook 鉴权修复

### 验收检查点

- [ ] 无敏感信息在 Git 仓库中
- [ ] 数据库文件在版本控制外
- [ ] Socket 连接验证 JWT
- [ ] Webhook 拒绝空配置

---

## 八、相关文档

| 文档 | 说明 |
|------|------|
| [requirements/PRD.md](../requirements/PRD.md) | 现有产品需求文档 |

---

**文档版本**: 1.0
**最后更新**: 2026-03-21
**维护者**: 架构师 Agent
**审核状态**: 待技术评审
