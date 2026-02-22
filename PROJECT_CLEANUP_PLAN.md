# TRIX 3D Companion - 项目整理计划

> 📅 创建时间：2026-02-22
> 🎯 目标：优化项目结构，提升可维护性和开发效率

---

## 📊 项目现状分析

### 当前问题概览

| 严重程度 | 问题类型 | 影响范围 |
|---------|---------|---------|
| 🔴 高 | 重复的服务实现 | server/clawbot-channel/ |
| 🔴 高 | 数据库文件被 Git 跟踪 | server/clawbot-channel/data/ |
| 🟡 中 | 测试文件分散 | src/test/, tests/, server/ |
| 🟡 中 | 组件组织混乱 | components/ (33个扁平文件) |
| 🟡 中 | 环境配置文件过多 | .env, .env.production, server/.env |
| 🟢 低 | 资产命名不一致 | src/assets/ |
| 🟢 低 | 文档分散 | docs/, root, various READMEs |

### 关键统计

- **总文件数**：400+ (不含 node_modules)
- **源文件**：120+ (.ts, .tsx, .js, .jsx)
- **组件数**：58 (33 components + 15 screens + 10 feature components)
- **配置文件**：20+
- **文档文件**：50+
- **重复代码**：多处 (pairing service, database config, deployment scripts)

---

## 🎯 整理目标

1. **统一组织结构** - 按功能/特征分组，而非按技术类型
2. **消除重复代码** - 合并重复的服务和配置
3. **规范文件位置** - 每种文件类型有明确的存放位置
4. **改进 Git 忽略** - 正确忽略临时文件和敏感数据
5. **整合文档** - 统一文档结构和位置

---

## 📋 整理计划

### 第一阶段：Git 配置修复 (🔴 最高优先级)

**问题**：数据库文件被 Git 跟踪

#### 1.1 更新 .gitignore

**位置**：`.gitignore`

**添加以下内容**：

```gitignore
# SQLite database files
*.db
*.db-shm
*.db-wal

# Production environment
.env.production

# Python virtual environment
.venv/

# Development notes (optional - uncomment if you don't want to track notes)
# notes/
```

#### 1.2 从 Git 移除已跟踪的数据库文件

```bash
# 从 Git 跟踪中移除，但保留本地文件
git rm --cached server/clawbot-channel/data/pairing.db-shm
git rm --cached server/clawbot-channel/data/pairing.db-wal

# 提交更改
git commit -m "chore: remove database files from git tracking"
```

---

### 第二阶段：源代码重构 (🔴 高优先级)

#### 2.1 重新组织组件结构

**当前问题**：
- 33 个组件扁平存放在 `src/components/`
- 组件之间没有明确的分组

**建议结构**：

```
src/components/
├── common/              # 通用 UI 组件
│   ├── Avatar.tsx
│   ├── LoadingSpinner.tsx
│   ├── ErrorBoundary.tsx
│   └── FilePicker.tsx
├── layout/              # 布局组件
│   ├── GlassPanel.tsx
│   ├── GlassDock.tsx
│   └── HeroBackground.tsx
├── modals/              # 模态框组件
│   ├── AIActionModal.tsx
│   ├── SnapshotModal.tsx
│   ├── ConfirmDialog.tsx
│   └── AddFriendModal.tsx
├── chat/                # 聊天相关组件
│   └── MediaMessage.tsx
├── study/               # 学习相关组件
│   ├── StudyRoom.tsx
│   └── StudyBuddiesList.tsx
├── settings/            # 设置相关组件
│   ├── PrivacySettings.tsx
│   ├── UserSwitcher.tsx
│   └── PointsHistory.tsx
└── map/                 # 地图相关组件 (已有)
    └── [现有的地图组件]
```

**操作清单**：
- [ ] 创建新的子目录结构
- [ ] 移动组件到对应目录
- [ ] 更新所有 import 路径
- [ ] 运行测试确保没有破坏

#### 2.2 合并重复的 Service 实现

**当前问题**：
- `server/clawbot-channel/services/pairingService.js`
- `server/clawbot-channel/services/pairingService-hybrid.js`
- `server/clawbot-channel/services/pairingService-supabase.js`
- `openclaw-skills/pairing-service.js`
- `openclaw-skills/pairing/pairing.js`

**解决方案**：
1. **确定唯一的实现** - 选择一个作为主实现
2. **创建抽象接口** - 定义统一的服务接口
3. **删除重复代码** - 移除其他实现

**建议**：
- 保留 `server/clawbot-channel/services/pairingService.js` 作为主实现
- 使用工厂模式或策略模式支持不同数据库后端
- 删除 `pairingService-hybrid.js` 和 `pairingService-supabase.js`

#### 2.3 整合数据库配置

**当前问题**：
- `server/clawbot-channel/config/database.js`
- `server/clawbot-channel/config/database-hybrid.js`
- `server/clawbot-channel/config/database-supabase.js`

**建议结构**：

```
server/clawbot-channel/config/
├── database/
│   ├── index.js           # 主配置导出
│   ├── sqlite.js          # SQLite 配置
│   ├── supabase.js        # Supabase 配置
│   └── hybrid.js          # 混合配置
└── app.js                 # 应用配置
```

**操作清单**：
- [ ] 创建 `config/database/` 目录
- [ ] 拆分配置文件
- [ ] 更新 `services/` 中的导入
- [ ] 更新文档说明如何切换数据库

#### 2.4 移动工具脚本到专用目录

**当前问题**：
- `server/clawbot-channel/check_schema.js`
- `server/clawbot-channel/inspect_db.js`
- `server/clawbot-channel/fix_duplicates.js`

**解决方案**：

```
scripts/
├── database/              # 数据库相关脚本 (已有)
│   ├── check_schema.js    # 移动
│   ├── inspect_db.js      # 移动
│   └── fix_duplicates.js  # 移动
├── deploy/                # 部署脚本 (已有)
├── doctor.sh              # 健康检查 (已有)
└── init-dev-env.sh        # 环境初始化 (已有)
```

**操作清单**：
- [ ] 创建 `scripts/database/` 目录
- [ ] 移动工具脚本
- [ ] 更新 package.json 中的脚本引用
- [ ] 更新文档中的脚本路径

---

### 第三阶段：测试文件整合 (🟡 中优先级)

#### 3.1 统一测试目录结构

**当前问题**：
- `src/test/` - 前端测试
- `tests/` - 根级别测试
- `server/clawbot-channel/tests/` - 服务器测试

**建议结构**：

```
tests/
├── frontend/             # 前端测试
│   ├── components/
│   ├── screens/
│   ├── hooks/
│   └── utils/
├── backend/              # 后端测试
│   ├── services/
│   ├── api/
│   └── integration/
└── e2e/                  # 端到端测试
    └── [当前根目录的 e2e 测试]
```

**操作清单**：
- [ ] 创建统一的测试目录结构
- [ ] 移动 `src/test/` → `tests/frontend/`
- [ ] 移动 `server/clawbot-channel/tests/` → `tests/backend/`
- [ ] 移动根目录测试 → `tests/e2e/`
- [ ] 更新 vite.config.ts 和 vitest.config.ts
- [ ] 更新所有测试文件的导入路径

#### 3.2 删除孤立的测试文件

**文件**：`server/clawbot-channel/test_pairing.py`

**原因**：Python 测试文件在 Node.js 项目中

**操作**：[ ] 删除此文件

---

### 第四阶段：环境配置优化 (🟡 中优先级)

#### 4.1 统一环境配置文件

**当前问题**：
- `./.env`
- `./.env.example`
- `./.env.production`
- `./server/clawbot-channel/.env`
- `./server/clawbot-channel/.env.example`

**建议结构（在根目录）**：

```
.env.example              # 主模板 (跟踪)
.env.local                # 本地开发 (gitignore)
.env.development          # 开发环境模板 (跟踪)
.env.production           # 生产环境模板 (跟踪)
server/.env.example       # 服务器特定模板 (跟踪)
```

**操作清单**：
- [ ] 整合所有环境变量到模板文件
- [ ] 创建环境变量文档说明每个变量的用途
- [ ] 更新 .gitignore
- [ ] 删除重复的环境文件

---

### 第五阶段：文档整合 (🟢 低优先级)

#### 5.1 统一文档位置

**当前问题**：文档分散在多个位置

**建议结构**：

```
docs/                     # 主文档目录
├── getting-started/      # 入门指南
│   ├── QUICK_START.md
│   └── installation.md
├── guides/               # 使用指南 (已有)
├── api/                  # API 文档 (已有)
├── deployment/           # 部署指南
│   ├── DEPLOYMENT.md
│   ├── nginx.conf
│   └── pm2.md
├── database/             # 数据库文档
│   ├── SCHEMA.md
│   └── SETUP.md
├── features/             # 功能说明 (已有 feature-implementation/)
├── development/          # 开发文档
│   ├── ARCHITECTURE.md   # 从根目录移动
│   ├── CONTRIBUTING.md
│   └── TESTING.md
└── archive/              # 归档文档 (已有)
```

**根目录保留的文档**：
- `README.md` - 项目主文档
- `CHANGELOG.md` - 变更日志
- `LICENSE` - 许可证

**操作清单**：
- [ ] 移动 `ARCHITECTURE.md` → `docs/development/`
- [ ] 移动 `database/` 下的 .md 文件 → `docs/database/`
- [ ] 整合 `deploy/`, `bridge/` 的文档 → `docs/deployment/`
- [ ] 更新所有文档中的相对链接
- [ ] 创建 `docs/INDEX.md` 作为文档索引

#### 5.2 处理笔记目录

**当前状态**：
- `notes/2026-02-22-summary.md`
- `notes/daily/2026-02-22.md`

**建议**：
1. **归档有价值的笔记** → `docs/development/notes/`
2. **删除临时笔记**
3. **或者** - 将整个 `notes/` 添加到 `.gitignore`

**操作清单**：
- [ ] 决定如何处理 notes 目录
- [ ] 如果归档，创建 `docs/development/notes/`
- [ ] 如果忽略，更新 `.gitignore`

---

### 第六阶段：资产文件整理 (🟢 低优先级)

#### 6.1 统一资产命名规范

**当前问题**：
- 混合命名：camelCase, PascalCase, lowercase

**建议规范**：
- 图片文件：kebab-case (例：`avatar-head.png`, `study-room-bg.png`)
- 视频文件：kebab-case (例：`role-video.mp4`)
- 数据/JSON 文件：camelCase (例：`roleConfig.json`)

**需要重命名的文件**：
```
src/assets/roles/role1/
├── AvatarHead.png        → avatar-head.png
├── hero_render.png       → hero-render.png
├── Saying.mp4            → saying.mp4
└── role_video.mp4        → role-video.mp4

src/assets/roles/role2/
├── hero_render.png       → hero-render.png
└── role_video.mp4        → role-video.mp4
```

**操作清单**：
- [ ] 创建命名规范文档
- [ ] 重命名资产文件
- [ ] 更新所有导入这些文件的代码
- [ ] 验证构建没有错误

#### 6.2 清理重复的资产文件

**发现的重复**：
- `src/assets/StudyRoomBG.png`
- `src/assets/roles/role2/StudyRoomBG.png`

**操作**：[ ] 确认是否为同一文件，删除重复

---

### 第七阶段：Server 代码重构 (🔴 高优先级)

#### 7.1 拆分大型 Server 文件

**问题**：`server/clawbot-channel/server.js` 有 949 行

**建议结构**：

```
server/clawbot-channel/
├── server.js             # 主入口 (精简到 ~100 行)
├── routes/               # 路由定义
│   ├── health.js
│   ├── pairing.js
│   └── messages.js
├── middleware/           # 中间件
│   ├── auth.js
│   ├── errorHandler.js
│   └── logger.js
├── socket/               # Socket.io 处理器
│   ├── connection.js
│   ├── events.js
│   └── handlers/
│       ├── pairing.js
│       ├── messages.js
│       └── index.js
├── services/             # 业务逻辑 (已有)
└── config/               # 配置 (已有)
```

**操作清单**：
- [ ] 创建新的目录结构
- [ ] 提取路由处理器到 `routes/`
- [ ] 提取 Socket.io 事件处理器到 `socket/`
- [ ] 提取中间件到 `middleware/`
- [ ] 更新主 server.js 导入所有模块
- [ ] 测试服务器功能

---

## 📁 整理后的目标目录结构

```
trix-3d-companion/
├── .github/               # GitHub Actions
├── .vscode/               # VS Code 配置
├── archive/               # 归档文件
├── database/              # 数据库迁移和 SQL
├── deploy/                # 部署配置
├── docs/                  # 📚 统一的文档目录
│   ├── getting-started/
│   ├── guides/
│   ├── api/
│   ├── deployment/
│   ├── database/
│   ├── features/
│   ├── development/
│   └── archive/
├── openclaw-skills/       # OpenClaw 技能模块
│   ├── pairing/
│   ├── trix-channel/
│   └── trix-channel-manager/
├── public/                # 公共静态资源
├── scripts/               # 🛠️ 工具脚本
│   ├── database/
│   ├── deploy/
│   └── [其他脚本]
├── server/                # 后端服务器
│   └── clawbot-channel/
│       ├── config/
│       ├── middleware/
│       ├── routes/
│       ├── services/
│       ├── socket/
│       ├── tests/
│       ├── server.js
│       └── package.json
├── src/                   # 前端源代码
│   ├── components/        # 🎨 按功能分组的组件
│   │   ├── common/
│   │   ├── layout/
│   │   ├── modals/
│   │   ├── chat/
│   │   ├── study/
│   │   ├── settings/
│   │   └── map/
│   ├── screens/           # 页面组件
│   ├── features/          # 功能模块
│   │   ├── chat/
│   │   └── study/
│   ├── hooks/             # 自定义 Hooks
│   ├── services/          # 服务层
│   ├── contexts/          # React Context
│   ├── utils/             # 工具函数
│   ├── config/            # 配置
│   ├── types/             # TypeScript 类型
│   ├── assets/            # 静态资产
│   │   └── roles/         # 角色资源
│   ├── i18n/              # 国际化
│   └── [主文件]
├── tests/                 # 🧪 统一的测试目录
│   ├── frontend/
│   ├── backend/
│   └── e2e/
├── .env.example           # 环境变量模板
├── .env.local             # 本地开发 (gitignore)
├── .gitignore             # Git 忽略规则
├── CHANGELOG.md           # 变更日志
├── CLAUDE.md              # Claude 协作配置
├── LICENSE                # 许可证
├── PROJECT_CLEANUP_PLAN.md # 本文档
├── package.json           # 项目配置
├── tsconfig.json          # TypeScript 配置
└── vite.config.ts         # Vite 配置
```

---

## ✅ 执行检查清单

### 准备阶段
- [ ] 备份当前项目 (git commit 或创建分支)
- [ ] 阅读完整计划
- [ ] 确认理解和同意所有更改

### 第一阶段：Git 配置
- [ ] 更新 .gitignore
- [ ] 移除数据库文件跟踪
- [ ] 提交更改

### 第二阶段：源代码重构
- [ ] 重组组件目录
- [ ] 合并重复服务
- [ ] 整合数据库配置
- [ ] 移动工具脚本
- [ ] 运行测试验证

### 第三阶段：测试整合
- [ ] 创建统一测试目录
- [ ] 移动所有测试文件
- [ ] 更新测试配置
- [ ] 运行测试验证

### 第四阶段：环境配置
- [ ] 整合环境文件
- [ ] 创建环境文档
- [ ] 更新 .gitignore
- [ ] 测试所有环境

### 第五阶段：文档整合
- [ ] 移动文档到 docs/
- [ ] 创建文档索引
- [ ] 更新所有链接
- [ ] 处理 notes 目录

### 第六阶段：资产整理
- [ ] 重命名资产文件
- [ ] 删除重复资产
- [ ] 更新导入路径
- [ ] 验证构建

### 第七阶段：Server 重构
- [ ] 拆分 server.js
- [ ] 创建模块目录
- [ ] 测试服务器功能
- [ ] 更新部署文档

### 验收阶段
- [ ] 运行所有测试
- [ ] 构建前端
- [ ] 启动服务器
- [ ] 手动测试核心功能
- [ ] 提交所有更改
- [ ] 更新项目文档

---

## 🚨 注意事项

### 执行前必读

1. **创建备份分支**：
   ```bash
   git checkout -b backup-before-cleanup
   git push origin backup-before-cleanup
   ```

2. **分阶段执行**：不要一次完成所有阶段，每个阶段完成后：
   - 运行测试
   - 提交代码
   - 验证功能

3. **频繁测试**：每次移动文件后立即测试，不要积累太多更改

4. **保留 .git 历史**：使用 `git mv` 而非直接文件系统移动

### 风险评估

| 阶段 | 风险等级 | 说明 |
|-----|---------|-----|
| 第一阶段 | 🟢 低 | 仅修改 Git 配置，不影响代码 |
| 第二阶段 | 🟠 中 | 涉及代码移动和导入更新 |
| 第三阶段 | 🟠 中 | 测试配置可能需要调整 |
| 第四阶段 | 🟡 中 | 环境变量可能影响运行时 |
| 第五阶段 | 🟢 低 | 仅移动文档 |
| 第六阶段 | 🟠 中 | 需要更新所有导入路径 |
| 第七阶段 | 🔴 高 | 大型重构，可能引入 bug |

---

## 📊 预期收益

完成整理后，项目将获得：

✅ **更清晰的结构** - 新开发者可以快速找到文件
✅ **更好的可维护性** - 减少重复代码和混淆
✅ **更快的开发速度** - 标准化的组织模式
✅ **更小的 Git 仓库** - 正确忽略临时文件
✅ **更好的测试覆盖** - 统一的测试组织
✅ **更完善的文档** - 集中化的知识库

---

**创建时间**：2026-02-22
**预计工作量**：2-3 天 (分阶段执行)
**建议执行顺序**：阶段 1 → 7 → 2 → 3 → 4 → 5 → 6
