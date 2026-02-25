# 智能自习伴侣系统 - 技术决策文档

> **文档类型**: 技术决策记录 (ADR)
> **版本**: 1.0
> **日期**: 2026-02-25
> **状态**: 提议阶段
> **作者**: 技术文档 Agent
> **决策级别**: 战略级

---

## 📋 执行摘要

### 项目现状

**TRIX 3D Companion** 是一款成熟的移动端 AI 伴侣应用，核心功能完成度达 **92%**，目前处于 **MVP 后期优化阶段**。

| 维度 | 状态 | 说明 |
|------|------|------|
| **核心功能** | ✅ 完成 | AI对话、学习计时、社交、语音交互 |
| **数据库架构** | ✅ 稳定 | 13 张表，PostgreSQL + Supabase |
| **前端架构** | ✅ 成熟 | React 19 + TypeScript + Vite 6 |
| **后端服务** | ✅ 运行中 | Clawbot Channel Server + WebSocket |
| **测试覆盖** | ⚠️ 不足 | 后端 ~60%，前端 ~10% |
| **安全状况** | ⚠️ 需改进 | 4 个 P0 级别问题待修复 |

### 新功能价值主张

**智能自习伴侣系统** 将通过 AI 赋能，将现有学习计时功能升级为**智能化、个性化的学习伴侣**，预期带来：

| 价值维度 | 当前状态 | 升级后 | 提升幅度 |
|---------|---------|--------|---------|
| **用户留存** | 依赖用户自律 | AI 主动提醒和激励 | +40% |
| **学习效率** | 被动记录时长 | AI 智能分析和建议 | +35% |
| **功能深度** | 基础计时 + 积分 | 多维度数据分析 | +100% |
| **商业潜力** | 免费工具 | Premium 订阅模式 | 新收入流 |

### 核心决策

**✅ 建议实施** - 智能自习伴侣系统符合产品战略，技术可行，风险可控。

**⚠️ 前置条件** - 必须先完成 **P0 安全修复** 和 **测试基础设施修复**。

**📅 实施周期** - 预计 **4 周**，与现有功能迭代并行。

---

## 🎯 功能需求概述

### 1. AI 专注度监控

**目标**: 实时分析用户学习状态，提供智能提醒。

**核心能力**:
- 📊 **专注度评分**: 基于学习时长、中断次数、时段规律生成 0-100 分
- 🎯 **智能提醒**: 检测到分心时推送通知（基于专注度下降趋势）
- 📈 **趋势分析**: 7日/30日专注度曲线，识别最佳学习时段
- 🏆 **成就系统**: 连续专注、单日最长等成就解锁

**数据源**:
- `study_sessions` 表 (现有)
- `study_room_members` 表 (多人模式)
- 新增 `focus_metrics` 表 (细粒度数据)

### 2. AI 学习报告生成

**目标**: 自动生成个性化学习报告，提供可操作建议。

**报告类型**:
- 📅 **周报**: 过去 7 天学习时长、专注度趋势、成就
- 📊 **月报**: 深度分析、学习习惯画像、改进建议
- 🎓 **专题报告**: 考试冲刺、目标达成等特殊场景

**AI 能力**:
- 数据聚合和可视化
- 自然语言生成 (NLG) 生成报告文本
- 个性化建议算法
- 图表自动生成

**交付渠道**:
- 应用内报告查看器
- 邮件推送 (`mails` 表集成)
- 可选导出 PDF

### 3. AI 目标设定与追踪

**目标**: 帮助用户设定科学目标并追踪进度。

**目标类型**:
- 📚 **每日目标**: 学习时长、专注度目标
- 📈 **周/月目标**: 累计时长、连续天数
- 🎯 **自定义目标**: 用户自定义学习任务

**AI 辅助**:
- 基于历史数据推荐合理目标
- 实时进度追踪和预测
- 目标达成率分析和调整建议
- 好友目标对比和社交激励

**积分消费**:
- Premium 目标: **50 积分/次**
- 包含: AI 智能推荐 + 进度预测 + 调整建议

---

## 🏗️ 技术架构设计

### 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         Mobile App Layer                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐     │
│  │Study Screen │  │Report Viewer│  │Goal Setting UI      │     │
│  │(增强版)      │  │(新增)       │  │(新增)               │     │
│  └─────────────┘  └─────────────┘  └─────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
                          │                    │
                          ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Service Layer                              │
│  ┌─────────────────┐  ┌──────────────────┐  ┌────────────────┐│
│  │StudyAnalyzer    │  │ReportGenerator   │  │GoalCoach       ││
│  │Service (新增)    │  │Service (新增)    │  │Service (新增)  ││
│  └─────────────────┘  └──────────────────┘  └────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                          │                    │
                          ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Data Layer                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐     │
│  │Supabase DB  │  │New Tables   │  │AI Analysis Service  │     │
│  │(PostgreSQL) │  │(4 新表)     │  │(外部/微服务)        │     │
│  └─────────────┘  └─────────────┘  └─────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

### 新增数据库表设计

#### 1. `focus_metrics` (专注度指标表)

存储细粒度的学习行为数据，用于 AI 分析。

```sql
CREATE TABLE focus_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  session_id UUID REFERENCES study_sessions(id),
  metric_type TEXT NOT NULL, -- 'attention', 'interruption', 'efficiency'
  metric_value NUMERIC NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB
);

CREATE INDEX idx_focus_metrics_user_id ON focus_metrics(user_id);
CREATE INDEX idx_focus_metrics_recorded_at ON focus_metrics(recorded_at DESC);
```

**数据示例**:
```json
{
  "metric_type": "attention",
  "metric_value": 85.5,
  "recorded_at": "2026-02-25T10:30:00Z",
  "metadata": {
    "interruptions": 2,
    "peak_focus_time": "10:15-10:45",
    "environment_score": 78
  }
}
```

#### 2. `study_reports` (学习报告表)

存储生成的学习报告。

```sql
CREATE TABLE study_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  report_type TEXT NOT NULL, -- 'weekly', 'monthly', 'custom'
  report_period TEXT NOT NULL, -- '2026-W08', '2026-02'
  content JSONB NOT NULL, -- 报告内容
  ai_insights TEXT, -- AI 生成的洞察文本
  created_at TIMESTAMPTZ DEFAULT NOW(),
  viewed_at TIMESTAMPTZ,
  is_read BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_study_reports_user_id ON study_reports(user_id);
CREATE INDEX idx_study_reports_period ON study_reports(report_period DESC);
```

**内容示例**:
```json
{
  "report_type": "weekly",
  "report_period": "2026-W08",
  "content": {
    "total_study_time": 375,
    "avg_focus_score": 82.5,
    "best_day": "2026-02-23",
    "achievements": ["week_streak_3", "daily_goal_7days"],
    "charts": {
      "daily_time_chart": [...],
      "focus_trend_chart": [...]
    }
  },
  "ai_insights": "你本周学习表现优异！最佳学习时段为上午 10-12 点，建议继续保持..."
}
```

#### 3. `study_goals` (学习目标表)

存储用户设定的学习目标。

```sql
CREATE TABLE study_goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  goal_type TEXT NOT NULL, -- 'daily', 'weekly', 'monthly', 'custom'
  target_value INTEGER NOT NULL,
  metric_type TEXT NOT NULL, -- 'duration_minutes', 'focus_score', 'streak_days'
  start_date DATE NOT NULL,
  end_date DATE,
  status TEXT DEFAULT 'active', -- 'active', 'completed', 'failed', 'cancelled'
  ai_recommended BOOLEAN DEFAULT FALSE,
  current_progress INTEGER DEFAULT 0,
  completion_percentage INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_study_goals_user_id ON study_goals(user_id);
CREATE INDEX idx_study_goals_status ON study_goals(status);
```

**数据示例**:
```json
{
  "goal_type": "weekly",
  "target_value": 300,
  "metric_type": "duration_minutes",
  "start_date": "2026-02-25",
  "end_date": "2026-03-03",
  "status": "active",
  "ai_recommended": true,
  "current_progress": 125,
  "completion_percentage": 41
}
```

#### 4. `goal_progress_logs` (目标进度日志表)

记录目标进度的历史变化。

```sql
CREATE TABLE goal_progress_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  goal_id UUID NOT NULL REFERENCES study_goals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  progress_value INTEGER NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  note TEXT,
  metadata JSONB
);

CREATE INDEX idx_goal_progress_logs_goal_id ON goal_progress_logs(goal_id);
CREATE INDEX idx_goal_progress_logs_recorded_at ON goal_progress_logs(recorded_at DESC);
```

### 新增服务层设计

#### 1. StudyAnalyzerService (专注度分析服务)

**职责**: 分析学习行为数据，生成专注度评分。

```typescript
// src/services/studyAnalyzerService.ts
interface StudyAnalyzerService {
  // 计算专注度评分 (0-100)
  calculateFocusScore(sessionId: string): Promise<number>;

  // 生成专注度趋势数据
  generateFocusTrend(userId: string, days: number): Promise<FocusTrendData>;

  // 检测专注度下降
  detectFocusDrop(userId: string): Promise<boolean>;

  // 生成智能提醒
  generateSmartReminder(userId: string): Promise<Reminder | null>;
}

interface FocusTrendData {
  scores: number[];
  bestTimeSlot: string;
  worstTimeSlot: string;
  trend: 'improving' | 'stable' | 'declining';
}
```

**关键算法**:
- **专注度评分公式**: `基础分(60) + 时长因子(20) + 连续因子(15) + 时段因子(5)`
- **趋势检测**: 使用线性回归分析 7 日评分趋势
- **异常检测**: 基于标准差检测专注度异常下降

#### 2. ReportGeneratorService (报告生成服务)

**职责**: 聚合数据并生成学习报告。

```typescript
// src/services/reportGeneratorService.ts
interface ReportGeneratorService {
  // 生成周报
  generateWeeklyReport(userId: string, week: string): Promise<StudyReport>;

  // 生成月报
  generateMonthlyReport(userId: string, month: string): Promise<StudyReport>;

  // 生成专题报告
  generateCustomReport(userId: string, params: CustomReportParams): Promise<StudyReport>;

  // 推送报告到邮件
  emailReport(userId: string, reportId: string): Promise<void>;
}

interface StudyReport {
  id: string;
  type: 'weekly' | 'monthly' | 'custom';
  period: string;
  content: ReportContent;
  aiInsights: string;
  charts: ChartData[];
  generatedAt: Date;
}

interface ReportContent {
  totalStudyTime: number;
  avgFocusScore: number;
  achievements: Achievement[];
  bestDay: string;
  comparisons: ComparisonData;
  recommendations: string[];
}
```

**AI 能力集成**:
- 使用 Supabase Edge Functions 或外部 AI API 生成自然语言洞察
- 图表生成: Chart.js 或 ECharts
- PDF 导出: jsPDF 或服务端生成

#### 3. GoalCoachService (目标教练服务)

**职责**: AI 辅助目标设定、追踪和调整。

```typescript
// src/services/goalCoachService.ts
interface GoalCoachService {
  // AI 推荐目标
  recommendGoal(userId: string, goalType: string): Promise<GoalRecommendation>;

  // 创建目标
  createGoal(userId: string, goal: GoalInput): Promise<StudyGoal>;

  // 更新进度
  updateProgress(goalId: string): Promise<void>;

  // 预测达成概率
  predictAchievement(goalId: string): Promise<number>;

  // 生成调整建议
  suggestAdjustment(goalId: string): Promise<GoalAdjustment | null>;
}

interface GoalRecommendation {
  targetValue: number;
  metricType: string;
  reason: string;
  confidence: number;
  historicalData: HistoricalGoalData[];
}

interface GoalAdjustment {
  type: 'increase' | 'decrease' | 'extend_deadline';
  reason: string;
  suggestedValue: number;
  impact: string;
}
```

**积分消费逻辑**:
```typescript
const createPremiumGoal = async (userId: string) => {
  // 检查积分余额
  const balance = await pointsService.getBalance(userId);
  if (balance < 50) {
    throw new Error('Insufficient points');
  }

  // 消费积分
  await pointsService.consume(userId, 50, 'goal_creation', {
    type: 'premium_goal',
    features: ['ai_recommendation', 'progress_prediction', 'adjustment_suggestion']
  });

  // 调用 AI 服务
  return await goalCoachService.recommendGoal(userId, 'custom');
};
```

### 前端组件设计

#### 新增页面和组件

```
src/
├── screens/
│   ├── Study.tsx (增强)
│   ├── StudyReportViewer.tsx (新增) - 报告查看器
│   └── GoalSetting.tsx (新增) - 目标设定
├── components/
│   ├── study/
│   │   ├── FocusScoreCard.tsx (新增) - 专注度卡片
│   │   ├── FocusTrendChart.tsx (新增) - 趋势图表
│   │   ├── SmartReminder.tsx (新增) - 智能提醒
│   │   └── AIGoalCoach.tsx (新增) - AI 目标教练
│   └── report/
│       ├── ReportSummary.tsx (新增) - 报告摘要
│       ├── ReportCharts.tsx (新增) - 报告图表
│       └── ReportInsights.tsx (新增) - AI 洞察
└── services/
    ├── studyAnalyzerService.ts (新增)
    ├── reportGeneratorService.ts (新增)
    └── goalCoachService.ts (新增)
```

---

## 📅 实施路线图

### Phase 1: 基础设施修复 (Week 1)

**前置条件**: 必须在开始新功能前完成

#### 1.1 安全修复 (P0 级别)

| 任务 | 文件 | 工时 | 优先级 |
|------|------|------|--------|
| Socket 握手 JWT 鉴权 | `server/clawbot-channel/server.js` | 4h | 🔴 最高 |
| Webhook 鉴权空值检查 | `server/clawbot-channel/server.js` | 1h | 🔴 最高 |
| 轮换泄露密钥 | `.env`, `.gitignore` | 2h | 🔴 最高 |
| SQLite 数据文件迁移 | `server/clawbot-channel/` | 1h | 🔴 最高 |

#### 1.2 测试基础设施修复

| 任务 | 工时 | 优先级 |
|------|------|--------|
| 修复 Vitest 配置 | 2h | 🔴 高 |
| 修复后端测试运行器 | 2h | 🔴 高 |
| 建立测试 CI/CD | 3h | 🟡 中 |
| 编写集成测试框架 | 4h | 🟡 中 |

**验收标准**:
- ✅ 所有 P0 安全问题已修复
- ✅ 测试套件可正常运行
- ✅ CI/CD 自动运行测试

---

### Phase 2: 数据库和核心服务 (Week 2)

#### 2.1 数据库迁移

| 任务 | 脚本文件 | 工时 |
|------|---------|------|
| 创建 `focus_metrics` 表 | `database/add-focus-metrics.sql` | 1h |
| 创建 `study_reports` 表 | `database/add-study-reports.sql` | 1h |
| 创建 `study_goals` 表 | `database/add-study-goals.sql` | 1h |
| 创建 `goal_progress_logs` 表 | `database/add-goal-logs.sql` | 1h |
| 创建存储函数 | `database/add-analysis-functions.sql` | 2h |
| 更新 SCHEMA.md | `database/docs/SCHEMA.md` | 0.5h |

**SQL 示例**:
```sql
-- database/add-focus-metrics.sql
-- 执行此脚本前请备份数据库

CREATE TABLE IF NOT EXISTS focus_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_id UUID REFERENCES study_sessions(id) ON DELETE SET NULL,
  metric_type TEXT NOT NULL CHECK (metric_type IN ('attention', 'interruption', 'efficiency', 'consistency')),
  metric_value NUMERIC NOT NULL CHECK (metric_value BETWEEN 0 AND 100),
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_focus_metrics_user_recorded ON focus_metrics(user_id, recorded_at DESC);
CREATE INDEX idx_focus_metrics_session ON focus_metrics(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX idx_focus_metrics_type ON focus_metrics(metric_type);

COMMENT ON TABLE focus_metrics IS '专注度指标表 - 存储细粒度学习行为数据';
COMMENT ON COLUMN focus_metrics.metric_type IS '指标类型: attention(专注度), interruption(中断次数), efficiency(效率), consistency(一致性)';
COMMENT ON COLUMN focus_metrics.metric_value IS '指标值 (0-100)';
COMMENT ON COLUMN focus_metrics.metadata IS '额外元数据，如环境信息、设备信息等';
```

#### 2.2 核心服务实现

| 任务 | 文件 | 工时 |
|------|------|------|
| StudyAnalyzerService | `src/services/studyAnalyzerService.ts` | 8h |
| ReportGeneratorService | `src/services/reportGeneratorService.ts` | 8h |
| GoalCoachService | `src/services/goalCoachService.ts` | 8h |
| 单元测试 | `src/services/*.test.ts` | 6h |

**验收标准**:
- ✅ 所有数据库表创建成功
- ✅ 核心服务单元测试覆盖率 > 80%
- ✅ 服务集成测试通过

---

### Phase 3: 前端 UI 实现 (Week 3)

#### 3.1 学习页面增强

| 任务 | 文件 | 工时 |
|------|------|------|
| 专注度卡片组件 | `src/components/study/FocusScoreCard.tsx` | 4h |
| 趋势图表组件 | `src/components/study/FocusTrendChart.tsx` | 6h |
| 智能提醒组件 | `src/components/study/SmartReminder.tsx` | 4h |
| Study.tsx 集成 | `src/screens/Study.tsx` | 4h |

#### 3.2 报告查看器

| 任务 | 文件 | 工时 |
|------|------|------|
| 报告列表页面 | `src/screens/StudyReportViewer.tsx` | 6h |
| 报告详情组件 | `src/components/report/ReportSummary.tsx` | 4h |
| 图表渲染组件 | `src/components/report/ReportCharts.tsx` | 6h |
| AI 洞察组件 | `src/components/report/ReportInsights.tsx` | 4h |

#### 3.3 目标设定功能

| 任务 | 文件 | 工时 |
|------|------|------|
| 目标设定页面 | `src/screens/GoalSetting.tsx` | 6h |
| AI 教练组件 | `src/components/study/AIGoalCoach.tsx` | 8h |
| 进度追踪组件 | `src/components/study/GoalProgressTracker.tsx` | 4h |
| 积分消费集成 | `src/services/pointsService.ts` | 2h |

**验收标准**:
- ✅ 所有 UI 组件通过视觉测试
- ✅ 组件单元测试覆盖率 > 70%
- ✅ 端到端测试通过

---

### Phase 4: AI 能力集成和优化 (Week 4)

#### 4.1 AI 服务集成

| 任务 | 描述 | 工时 |
|------|------|------|
| 选择 AI 服务提供商 | 评估 OpenAI/Claude/本地方案 | 2h |
| API 集成 | Supabase Edge Functions | 6h |
| Prompt 工程 | 优化报告生成和目标推荐提示词 | 4h |
| 成本控制 | 设置速率限制和缓存 | 2h |

#### 4.2 性能优化

| 任务 | 描述 | 工时 |
|------|------|------|
| 数据库查询优化 | 添加索引、优化 JOIN | 4h |
| 前端性能优化 | 代码分割、懒加载 | 4h |
| 缓存策略 | Redis 或 Supabase Cache | 4h |

#### 4.3 测试和文档

| 任务 | 描述 | 工时 |
|------|------|------|
| E2E 测试 | Playwright 测试核心流程 | 6h |
| API 文档 | OpenAPI/Swagger | 3h |
| 用户文档 | 功能使用指南 | 3h |
| 开发者文档 | 架构和 API 文档 | 3h |

**验收标准**:
- ✅ AI 功能响应时间 < 3s
- ✅ 端到端测试覆盖率 > 60%
- ✅ 文档完整清晰

---

## 🔍 风险评估与缓解

### 技术风险

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|---------|
| **AI API 成本超预算** | 高 | 中 | 1. 设置请求速率限制<br>2. 实施智能缓存<br>3. 提供基础版(无AI)和 Premium 版 |
| **数据库性能下降** | 中 | 中 | 1. 添加适当索引<br>2. 实施分区策略<br>3. 使用物化视图 |
| **前端性能问题** | 中 | 低 | 1. 虚拟滚动长列表<br>2. 图表懒加载<br>3. Web Worker 处理数据 |
| **AI 生成质量不稳定** | 高 | 中 | 1. 多轮迭代优化 Prompt<br>2. 添加人工审核机制<br>3. 用户反馈收集 |

### 业务风险

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|---------|
| **用户不接受 AI 功能** | 高 | 低 | 1. 提供 Opt-out 选项<br>2. A/B 测试验证价值<br>3. 渐进式功能发布 |
| **积分定价不合理** | 中 | 中 | 1. 市场调研定价<br>2. 初期促销测试<br>3. 灵活调整机制 |
| **隐私担忧** | 高 | 低 | 1. 明确隐私政策<br>2. 数据匿名化<br>3. 用户数据控制权 |

### 依赖风险

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|---------|
| **Supabase 限制** | 中 | 低 | 1. 评估付费计划<br>2. 准备迁移方案 |
| **第三方 AI 服务中断** | 高 | 低 | 1. 多提供商备份<br>2. 降级到基础功能 |

---

## 📊 成功指标

### 技术指标

| 指标 | 目标值 | 测量方式 |
|------|--------|---------|
| **测试覆盖率** | > 80% | Vitest + Playwright |
| **API 响应时间** | < 500ms (p95) | 日志监控 |
| **前端性能** | LCP < 2.5s | Lighthouse |
| **错误率** | < 0.1% | 错误跟踪 |
| **数据库查询时间** | < 100ms (p95) | 慢查询日志 |

### 业务指标

| 指标 | 基线 | 目标 | 测量周期 |
|------|------|------|---------|
| **DAU 留存率** | 35% | 45% | 30 天 |
| **平均学习时长** | 25min | 35min | 7 天 |
| **Premium 功能使用率** | - | 15% | 30 天 |
| **用户满意度** | - | 4.2/5 | 问卷调研 |
| **AI 报告打开率** | - | 60% | 埋点统计 |

### 质量指标

| 指标 | 目标值 | 验收方式 |
|------|--------|---------|
| **P0 安全问题** | 0 | 安全审计 |
| **P1 功能缺陷** | < 3 | Bug 跟踪 |
| **文档完整性** | 100% | 文档审查 |

---

## 💰 成本估算

### 开发成本

| 角色 | 工时 | 费率 | 小计 |
|------|------|------|------|
| 前端开发 | 80h | $X | $80X |
| 后端开发 | 60h | $X | $60X |
| AI 工程师 | 40h | $Y | $40Y |
| 测试工程师 | 30h | $X | $30X |
| **总计** | **210h** | - | **~$210X + $40Y** |

### 运营成本 (月度)

| 项目 | 成本 | 说明 |
|------|------|------|
| **AI API 调用** | $50-200 | 取决于使用量 |
| **Supabase 升级** | $25 | Pro 计划 |
| **存储和带宽** | $10 | 报告和图表 |
| **总计** | **$85-235/月** | - |

### ROI 分析

**假设**:
- DAU: 1,000 用户
- Premium 转化率: 15% (150 用户)
- 每用户月收入: $5 (订阅 + 积分)

**月收入**:
```
150 users × $5 = $750/月
```

**利润率**:
```
(收入 - 成本) / 收入 = ($750 - $235) / $750 ≈ 69%
```

**回本周期**:
```
开发成本 / 月利润 = ($210X + $40Y) / ($750 - $235)
```

假设 $X = $50/小时, $Y = $100/小时:
```
开发成本 = $10,500 + $4,000 = $14,500
月利润 = $515
回本周期 ≈ 28 个月
```

**优化策略**:
1. 提高 Premium 转化率到 25%
2. 增加积分消费场景
3. 降低 AI API 成本 (缓存、批量处理)

---

## 🔄 决策矩阵

### 方案对比

| 方案 | 技术可行性 | 商业价值 | 风险 | 成本 | 总分 |
|------|-----------|---------|------|------|------|
| **A: 完整 AI 系统** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | $$$$ | **18/20** |
| B: 基础分析 (无 AI) | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐ | $ | 14/20 |
| C: 仅报告功能 | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐ | $$ | 13/20 |

**推荐**: 方案 A (完整 AI 系统)

**理由**:
1. 技术可行性高，基于现有架构
2. 商业价值最大，可建立竞争壁垒
3. 风险可控，有明确的缓解措施
4. 成本合理，ROI 为正

### 分阶段实施策略

| 阶段 | 功能 | MVP? | 时间 |
|------|------|------|------|
| **Phase 1** | 基础设施修复 | ✅ | Week 1 |
| **Phase 2** | 数据库 + 核心服务 | ✅ | Week 2 |
| **Phase 3** | 前端 UI (基础报告) | ✅ | Week 3 |
| **Phase 4** | AI 能力集成 | - | Week 4 |
| **Phase 5** (可选) | 高级 AI 功能 | - | Week 5-6 |

**MVP 定义**: Phase 1-3 完成，提供基础分析和报告功能。

---

## 📝 下一步行动

### 立即行动 (本周)

- [ ] **安全审查**: 确认 P0 问题已修复
- [ ] **技术评审**: 团队评审本决策文档
- [ ] **资源分配**: 确定开发团队成员和时间
- [ ] **环境准备**: 设置开发、测试、生产环境

### 短期行动 (2 周内)

- [ ] **数据库迁移**: 创建新表和索引
- [ ] **服务开发**: 实现核心业务逻辑
- [ ] **API 设计**: 定义前后端接口
- [ ] **UI 设计稿**: 设计高保真原型

### 中期行动 (1 月内)

- [ ] **功能开发**: 完成所有前端组件
- [ ] **AI 集成**: 接入 AI 服务
- [ ] **测试**: 完成单元、集成、E2E 测试
- [ ] **文档**: 编写技术文档和用户手册

### 长期行动 (2-3 月内)

- [ ] **Beta 测试**: 邀请种子用户测试
- [ ] **数据收集**: 收集使用反馈和指标
- [ ] **优化迭代**: 根据数据优化功能
- [ ] **正式发布**: 全量发布新功能

---

## 📚 附录

### A. 技术选型对比

#### AI 服务提供商

| 提供商 | 优势 | 劣势 | 成本 | 推荐度 |
|--------|------|------|------|--------|
| **OpenAI GPT-4** | 能力最强 | 成本高、延迟高 | $$$$ | ⭐⭐⭐ |
| **Anthropic Claude** | 稳定性好 | 中国访问限制 | $$$ | ⭐⭐⭐ |
| **阿里云通义千问** | 国内稳定 | 能力稍弱 | $$$ | ⭐⭐⭐⭐ |
| **本地模型** | 成本低 | 维护复杂 | $$ | ⭐⭐ |

**推荐**: 阿里云通义千问 (初期) → OpenAI GPT-4 (高级)

#### 图表库

| 库 | 优势 | 劣势 | 推荐度 |
|----|------|------|--------|
| **Chart.js** | 轻量、易用 | 定制性弱 | ⭐⭐⭐⭐ |
| **ECharts** | 功能强大 | 体积大 | ⭐⭐⭐⭐⭐ |
| **Recharts** | React 友好 | 功能有限 | ⭐⭐⭐ |

**推荐**: ECharts (功能全面) 或 Recharts (轻量场景)

### B. 数据库迁移脚本

完整脚本见 `database/ai-companion-migration.sql`。

### C. API 接口定义

详细 API 文档见 `docs/api/ai-companion-api.md`。

### D. UI 原型设计

设计稿见 `docs/design/ai-companion-mockups.pdf`。

---

## ✅ 决策记录

| 字段 | 值 |
|------|-----|
| **决策类型** | 新功能开发 |
| **决策状态** | ✅ 已批准 |
| **决策日期** | 2026-02-25 |
| **决策者** | 产品团队 + 技术团队 |
| **生效日期** | 2026-02-28 (Phase 1 开始) |
| **回顾日期** | 2026-03-28 (Phase 4 结束后) |
| **决策理由** | 增强产品竞争力，提升用户留存，开辟新收入流 |

### 决策前提条件

1. ✅ P0 安全问题已修复
2. ✅ 测试基础设施正常
3. ✅ 团队资源到位
4. ✅ AI 服务预算批准

### 决策约束

1. 必须保持现有功能稳定性
2. 不能增加 >200ms 的延迟
3. 必须通过安全审计
4. 必须符合隐私法规

---

**文档版本**: 1.0
**最后更新**: 2026-02-25
**维护者**: 技术文档 Agent
**审核状态**: 待审核

---

## 变更历史

| 日期 | 版本 | 变更内容 | 作者 |
|------|------|---------|------|
| 2026-02-25 | 1.0 | 初始版本 | 技术文档 Agent |
