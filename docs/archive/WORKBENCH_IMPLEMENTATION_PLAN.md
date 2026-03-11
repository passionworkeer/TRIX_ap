# Home 工作台功能实现计划

> 创建时间：2026-02-28
> 状态：已调整（根据辩论反馈）
> 版本：2.0

---

## 一、功能概述

### 1.1 目标

在 Home 页面添加一个可滑动的工作台组件，提供快捷功能入口：

| 功能 | 点击后行为 | 是否需要接入 OpenClaw |
|------|-----------|---------------------|
| 📷 快拍 | 打开相机/相册（现有 Snapshot 功能） | 需要（图片识别） |
| 📍 位置 | 打开地图，选择位置分享 | ❌ TRIX 自己实现 |
| 📅 日程 | 打开日程管理，添加/查看日程 | ❌ TRIX 自己实现 |
| 📋 待办 | 打开待办列表，添加/查看任务 | ❌ TRIX 自己实现 |

### 1.2 交互流程

```
Home 页面点击空白区域
       ↓
弹出可滑动的工作台卡片
┌─────────────────────────────────────┐
│  ←  │ [📷快拍] │ [📍位置] │ [📅日程] │ [📋待办] │  →
└─────────────────────────────────────┘
       ↓
点击卡片 → 执行对应功能
```

### 1.3 与现有功能的区分

- **Home 工作台**：生活/效率工具（快拍、位置、日程、待办）
- **聊天界面 AIActionSelector**：AI 创作工具（AI聊天、AI文档、AIPPT、AI表格、AI图片、AI视频）

---

## 二、Web 端实现计划

### 2.0 Phase 0：数据库设计（必须先完成，0.5-1 天）

**⚠️ 重要：任何代码开发前，必须先完成数据库设计**

#### 2.0.1 新增表结构

```sql
-- 待办事项表
CREATE TABLE todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  completed BOOLEAN DEFAULT FALSE,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  sync_status TEXT DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending', 'conflict'))
);

-- 日程表
CREATE TABLE schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  reminder_minutes_before INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  sync_status TEXT DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending', 'conflict'))
);

-- 索引
CREATE INDEX idx_todos_user_id ON todos(user_id);
CREATE INDEX idx_todos_due_date ON todos(due_date);
CREATE INDEX idx_schedules_user_id ON schedules(user_id);
CREATE INDEX idx_schedules_start_time ON schedules(start_time);

-- RLS 策略
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own todos" ON todos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own todos" ON todos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own todos" ON todos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own todos" ON todos FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own schedules" ON schedules FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own schedules" ON schedules FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own schedules" ON schedules FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own schedules" ON schedules FOR DELETE USING (auth.uid() = user_id);
```

#### 2.0.2 TypeScript 接口

```typescript
// types/workbench.ts
export interface Todo {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  due_date?: string;
  created_at: string;
  updated_at: string;
  sync_status: 'synced' | 'pending' | 'conflict';
}

export interface Schedule {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time?: string;
  reminder_minutes_before?: number;
  created_at: string;
  updated_at: string;
  sync_status: 'synced' | 'pending' | 'conflict';
}
```

#### 2.0.3 数据层测试

```typescript
// __tests__/services/todoService.test.ts
describe('TodoService', () => {
  it('should create a todo', async () => {
    // ...
  });

  it('should sync with Supabase', async () => {
    // ...
  });
});
```

### 2.1 组件结构

```
src/
├── components/
│   ├── WorkbenchModal.tsx          # 工作台主组件（新增）
│   └── WorkbenchCard.tsx           # 单个功能卡片（新增）
├── features/
│   ├── location/                   # 位置功能（新增）
│   │   ├── components/
│   │   │   └── LocationPicker.tsx
│   │   └── hooks/
│   │       └── useLocation.ts
│   ├── schedule/                   # 日程功能（新增）
│   │   ├── components/
│   │   │   ├── ScheduleList.tsx
│   │   │   └── ScheduleForm.tsx
│   │   ├── hooks/
│   │   │   └── useSchedule.ts
│   │   └── store/
│   │       └── scheduleStore.ts
│   └── todo/                       # 待办功能（新增）
│       ├── components/
│       │   ├── TodoList.tsx
│       │   └── TodoForm.tsx
│       ├── hooks/
│       │   └── useTodo.ts
│       └── store/
│           └── todoStore.ts
```

### 2.2 Phase 1：工作台基础组件（1-2 天）

#### 2.2.1 WorkbenchModal.tsx

```typescript
interface WorkbenchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface WorkbenchItem {
  id: string;
  label: string;
  icon: React.ComponentType;
  onClick: () => void;
}
```

**功能点：**
- 水平滑动卡片列表
- Framer Motion 动画（弹入/弹出）
- 毛玻璃背景效果
- 响应式设计

#### 2.2.2 WorkbenchCard.tsx

```typescript
interface WorkbenchCardProps {
  icon: React.ComponentType;
  label: string;
  onClick: () => void;
}
```

**功能点：**
- 图标 + 文字布局
- 点击动画效果
- 触觉反馈（移动端）

### 2.3 Phase 2：位置功能（简化版，1 天）

#### 2.3.1 LocationPicker.tsx

**功能点：**
- 集成现有 Map 组件（复用 SnapMapScreen）
- 获取当前位置
- 搜索位置
- 选择位置后复制链接或使用系统分享

#### 2.3.2 分享功能实现（简化版）

```typescript
// Web 端分享（简化版）
const shareLocation = async (location: Location) => {
  const { latitude, longitude, name } = location;
  const shareUrl = `https://map.amap.com/?lat=${latitude}&lng=${longitude}&name=${encodeURIComponent(name)}`;

  // 方案1：使用 Web Share API（推荐）
  if (navigator.share) {
    try {
      await navigator.share({
        title: `位置：${name}`,
        text: `我在 ${name}`,
        url: shareUrl
      });
      return;
    } catch (e) {
      // 用户取消或失败，fallback 到复制
    }
  }

  // 方案2：复制链接到剪贴板（Fallback）
  await navigator.clipboard.writeText(shareUrl);
  toast.success('位置链接已复制到剪贴板');
};
```

**⚠️ 简化说明：**
- 不直接集成微信 SDK（需要备案域名和企业认证）
- 不集成高德 SDK（只需要生成 URL 即可）
- 使用系统分享面板或复制链接作为主要分享方式

#### 2.3.3 iOS 端分享（简化版）

```swift
// iOS 端分享（简化版）
func shareLocation(_ location: Location) {
    // 方案1：使用系统分享菜单（推荐）
    let shareUrl = "https://map.amap.com/?lat=\(location.latitude)&lng=\(location.longitude)"
    let activityVC = UIActivityViewController(
        activityItems: [shareUrl],
        applicationActivities: nil
    )
    present(activityVC, animated: true)

    // 方案2：打开系统地图（备选）
    // let coordinate = CLLocationCoordinate2D(...)
    // MKMapItem(...).openInMaps()
}
```

**数据流：**
```
用户选择位置 → 生成高德地图 URL → 系统分享面板 / 复制链接
```

### 2.4 Phase 3：日程功能（2 天）

#### 2.4.1 数据模型

```typescript
interface Schedule {
  id: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime?: Date;
  reminder?: boolean;
  reminderMinutes?: number;
  createdAt: Date;
  updatedAt: Date;
  syncStatus: 'synced' | 'pending' | 'conflict';  // 同步状态
}
```

#### 2.4.2 组件

- **ScheduleList.tsx**：日程列表展示
- **ScheduleForm.tsx**：添加/编辑日程表单
- **ScheduleCalendar.tsx**：日历视图（可选）

#### 2.4.3 功能点
- 添加/编辑/删除日程
- 设置提醒时间
- 本地通知提醒（Web Notification API）
- 日历视图展示
- 多设备同步（Supabase）

#### 2.4.4 状态管理

```typescript
// scheduleStore.ts (Zustand)
interface ScheduleState {
  schedules: Schedule[];
  addSchedule: (schedule: Omit<Schedule, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus'>) => void;
  updateSchedule: (id: string, schedule: Partial<Schedule>) => void;
  deleteSchedule: (id: string) => void;
  syncWithServer: () => Promise<void>;  // 同步到 Supabase
}
```

#### 2.4.5 本地通知

```typescript
// hooks/useScheduleNotification.ts
const useScheduleNotification = () => {
  const requestPermission = async () => {
    if ('Notification' in window) {
      await Notification.requestPermission();
    }
  };

  const scheduleNotification = (schedule: Schedule) => {
    if (schedule.reminder && schedule.reminderMinutes) {
      const notifyTime = new Date(schedule.startTime.getTime() - schedule.reminderMinutes * 60000);
      // 使用 setTimeout 或 Service Worker 触发通知
    }
  };

  return { requestPermission, scheduleNotification };
};

### 2.5 Phase 4：待办功能（2 天）

#### 2.5.1 数据模型

```typescript
interface Todo {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  syncStatus: 'synced' | 'pending' | 'conflict';  // 同步状态
}
```

#### 2.5.2 组件

- **TodoList.tsx**：待办列表展示（支持优先级排序/筛选）
- **TodoForm.tsx**：添加/编辑待办表单
- **TodoFilter.tsx**：筛选组件（优先级/状态/日期）

#### 2.5.3 功能点
- 添加/编辑/删除待办
- 标记完成
- 优先级设置（高/中/低）+ 颜色标识
- 按优先级/状态/日期筛选
- 拖拽排序
- 多设备同步（Supabase）

#### 2.5.4 状态管理

```typescript
// todoStore.ts (Zustand)
interface TodoState {
  todos: Todo[];
  filter: {
    priority?: 'low' | 'medium' | 'high';
    completed?: boolean;
  };
  sortBy: 'priority' | 'createdAt' | 'dueDate';
  addTodo: (todo: Omit<Todo, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus'>) => void;
  updateTodo: (id: string, todo: Partial<Todo>) => void;
  deleteTodo: (id: string) => void;
  toggleComplete: (id: string) => void;
  setFilter: (filter: TodoState['filter']) => void;
  setSortBy: (sortBy: TodoState['sortBy']) => void;
  syncWithServer: () => Promise<void>;  // 同步到 Supabase
}
```

### 2.6 Phase 5：集成与测试（1 天）

#### 2.6.1 App.tsx 集成

```typescript
// 替换 SnapshotModal，使用 WorkbenchModal
<WorkbenchModal
  isOpen={isHomePage && showDockOnHome}
  onClose={() => setShowDockOnHome(false)}
/>
```

#### 2.6.2 测试用例

- WorkbenchModal 组件测试
- 位置功能测试
- 日程 CRUD 测试
- 待办 CRUD 测试
- E2E 测试

---

## 三、iOS 端实现计划

### 3.1 组件结构

```
ios/TRIX3DCompanion/
├── Features/
│   ├── Home/
│   │   ├── Views/
│   │   │   ├── HomeView.swift           # 修改现有
│   │   │   ├── WorkbenchSheet.swift     # 新增：工作台 Sheet
│   │   │   └── WorkbenchCard.swift      # 新增：工作台卡片
│   │   └── ViewModels/
│   │       └── WorkbenchViewModel.swift # 新增
│   ├── Location/
│   │   ├── Views/
│   │   │   └── LocationPickerView.swift # 新增
│   │   └── ViewModels/
│   │       └── LocationPickerViewModel.swift
│   ├── Schedule/
│   │   ├── Views/
│   │   │   ├── ScheduleListView.swift   # 新增
│   │   │   └── ScheduleFormView.swift   # 新增
│   │   ├── ViewModels/
│   │   │   └── ScheduleViewModel.swift  # 新增
│   │   └── Models/
│   │       └── Schedule.swift           # 新增
│   └── Todo/
│       ├── Views/
│       │   ├── TodoListView.swift       # 新增
│       │   └── TodoFormView.swift       # 新增
│       ├── ViewModels/
│       │   └── TodoViewModel.swift      # 新增
│       └── Models/
│           └── Todo.swift               # 新增
```

### 3.2 Phase 1：工作台基础组件（1-2 天）

#### 3.2.1 WorkbenchSheet.swift

```swift
struct WorkbenchSheet: View {
    @Binding var isPresented: Bool
    @State private var selectedIndex: Int = 0

    var body: some View {
        // ScrollView + HStack 实现滑动卡片
    }
}
```

**功能点：**
- `.sheet` 方式弹出
- TabView 或 ScrollView 实现滑动
- 毛玻璃背景 (.ultraThinMaterial)

#### 3.2.2 WorkbenchCard.swift

```swift
struct WorkbenchCard: View {
    let icon: String
    let title: String
    let action: () -> Void

    var body: some View {
        // 卡片布局
    }
}
```

### 3.3 Phase 2：位置功能（1 天）

#### 3.3.1 LocationPickerView.swift

**功能点：**
- 使用 MapKit
- 请求位置权限
- 选择位置后跳转聊天分享

**依赖：**
- LocationService.swift（已存在）

### 3.4 Phase 3：日程功能（2 天）

#### 3.4.1 数据模型

```swift
// Schedule.swift
struct Schedule: Identifiable, Codable {
    let id: UUID
    var title: String
    var description: String?
    var startTime: Date
    var endTime: Date?
    var reminder: Bool
    var reminderMinutes: Int?
    var createdAt: Date
    var updatedAt: Date
    var syncStatus: SyncStatus

    enum SyncStatus: String, Codable {
        case synced, pending, conflict
    }
}
```

#### 3.4.2 组件

- **ScheduleListView.swift**：日程列表
- **ScheduleFormView.swift**：添加/编辑表单
- **ScheduleCalendarView.swift**：日历视图（可选）

#### 3.4.3 功能点
- 添加/编辑/删除日程
- 设置提醒时间
- 本地通知提醒（UserNotifications）
- 日历视图展示
- 多设备同步（Supabase）

#### 3.4.4 本地存储

- 使用 SwiftData 或 UserDefaults
- 本地通知提醒（使用 LocalNotificationService）

### 3.5 Phase 4：待办功能（2 天）

#### 3.5.1 数据模型

```swift
// Todo.swift
struct Todo: Identifiable, Codable {
    let id: UUID
    var title: String
    var description: String?
    var completed: Bool
    var priority: Priority
    var dueDate: Date?
    var createdAt: Date
    var updatedAt: Date
    var syncStatus: SyncStatus

    enum Priority: String, Codable, CaseIterable {
        case low, medium, high

        var color: Color {
            switch self {
            case .low: return .green
            case .medium: return .orange
            case .high: return .red
            }
        }
    }

    enum SyncStatus: String, Codable {
        case synced, pending, conflict
    }
}
```

#### 3.5.2 组件

- **TodoListView.swift**：待办列表（支持筛选/排序）
- **TodoFormView.swift**：添加/编辑表单
- **TodoFilterView.swift**：筛选组件

#### 3.5.3 功能点
- 添加/编辑/删除待办
- 标记完成
- 优先级设置 + 颜色标识
- 按优先级/状态/日期筛选
- 拖拽排序
- 多设备同步（Supabase）
- 本地通知提醒（可选）

#### 3.5.4 ViewModel

```swift
@MainActor
class TodoViewModel: ObservableObject {
    @Published var todos: [Todo] = []
    @Published var filter: TodoFilter = .all
    @Published var sortBy: TodoSort = .priority

    func addTodo(_ todo: Todo) async
    func updateTodo(_ todo: Todo) async
    func deleteTodo(_ id: UUID) async
    func toggleComplete(_ id: UUID) async
    func syncWithServer() async
}

### 3.6 Phase 5：集成与测试（1 天）

#### 3.6.1 HomeView 修改

```swift
// 添加状态
@State private var showWorkbench = false

// 点击手势
.onTapGesture {
    showWorkbench = true
}

// Sheet
.sheet(isPresented: $showWorkbench) {
    WorkbenchSheet(isPresented: $showWorkbench)
}
```

---

## 四、数据存储与同步方案

### 4.1 Web 端

| 数据 | 本地存储 | 远程同步 | 说明 |
|------|---------|---------|------|
| 日程 | localStorage + Zustand | Supabase | 本地优先 + 后台同步 |
| 待办 | localStorage + Zustand | Supabase | 本地优先 + 后台同步 |
| 位置 | 无需持久化 | - | 实时获取 |

### 4.2 iOS 端

| 数据 | 本地存储 | 远程同步 | 说明 |
|------|---------|---------|------|
| 日程 | SwiftData | Supabase | 本地优先 + 后台同步 |
| 待办 | SwiftData | Supabase | 本地优先 + 后台同步 |
| 位置 | 无需持久化 | - | 实时获取 |

### 4.3 同步策略

```
┌─────────────┐     变更     ┌─────────────┐
│   本地端    │ ──────────>  │  Supabase   │
│  (Web/iOS) │  <───────── │   (云端)    │
└─────────────┘     同步     └─────────────┘

1. 每次变更 → 本地先更新 → 触发同步
2. 启动时 → 检查云端是否有更新 → 合并
3. 冲突解决 → 以最新时间戳为准
```

### 4.4 分享功能（简化版）

#### 位置分享
- **Web**：使用 `navigator.share()` API（系统分享）或复制链接到剪贴板
- **iOS**：使用 `UIActivityViewController`（系统分享面板）
- **⚠️ 不做**：微信 SDK 集成（需要备案域名和企业认证）

#### 日程/待办分享
- 导出为文本/JSON 格式
- 使用系统分享菜单分享

---

## 五、时间估算（调整后）

### 5.1 分阶段时间表

| 阶段 | Web 端 | iOS 端 | 并行开发 | 说明 |
|------|--------|--------|---------|------|
| **Phase 0**: 数据库设计 | 0.5 天 | - | - | 必须先完成 |
| **Phase 1**: 工作台基础 | 1 天 | 1 天 | ✅ | UI 框架 |
| **Phase 2**: 待办功能 + 同步 | 2-3 天 | 2-3 天 | ✅ | 核心功能 |
| **Phase 3**: 日程功能 | 2-3 天 | 2-3 天 | ✅ | 第二批 |
| **Phase 4**: 本地通知 | 1-2 天 | 1-2 天 | ✅ | 可选 |
| **Phase 5**: 位置功能 | 1 天 | 1 天 | ✅ | 简化版 |
| **Phase 6**: 集成测试 | 1 天 | 1 天 | ✅ | |
| **总计（MVP）** | **8-10 天** | **8-10 天** | **8-10 天** | Phase 0-3 |

### 5.2 风险因素

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 测试覆盖率低 (14.83%) | 任何改动可能破坏现有功能 | 先写测试再写代码 |
| 外部分享需要备案域名 | 无法实现微信分享 | 使用系统分享面板替代 |
| iOS 原生通知复杂 | 可能延期 | Web Push 优先 |
| Supabase 同步冲突 | 数据一致性风险 | 简化为"最后写入胜出" |

### 5.3 时间缓冲

每个阶段预留 10-20% 缓冲时间：
- Phase 1-2: 预留 1 天
- Phase 3-4: 预留 1-2 天
- Phase 5-6: 预留 1 天

---

## 六、优先级建议（调整后）

### 6.1 MVP（最小可行产品）- 调整版

**第一批实现（必须）：**
1. 可滑动工作台 UI 框架
2. 待办功能（最简单的数据模型）
3. Supabase 同步基础（仅当前设备 → 云端）

**第二批实现（可选）：**
4. 日程功能
5. 本地通知（Web Push / iOS 原生）

**第三批实现（后续）：**
6. 位置分享功能（外部分享复杂度高，延后）

**不做或简化：**
- 外部分享到微信（需要备案域名，暂不实现）
- 复杂的冲突解决策略（简化为"最后写入胜出"）

### 6.2 数据库设计先行原则

**重要：任何代码开发前，必须先完成数据库设计**

```
Phase 0: 数据库设计（1天）
├── 设计 todos 表结构
├── 设计 schedules 表结构
├── 编写 SQL 迁移脚本
├── 设计数据层单元测试
└── 验证 Supabase 连接
```

### 6.3 建议开发顺序

1. **先设计数据库**：确保数据模型正确
2. **再做 Web 端**：验证设计和交互
3. **再做 iOS 端**：复用设计，适配平台
4. **最后集成测试**：确保同步功能正常

---

## 七、待确认问题（已确认）

1. ~~位置分享：分享到哪里？~~ → **分享到外部（微信、高德地图等）**
2. ~~日程提醒：是否需要本地通知？~~ → **需要本地通知**
3. ~~待办优先级：是否需要按优先级排序/筛选？~~ → **需要按优先级排序/筛选**
4. ~~数据同步：是否需要多设备同步？~~ → **需要多设备同步（通过 Supabase）**
5. ~~快拍功能：是否需要修改？~~ → **保持现有行为**
6. ~~开发顺序：先做 Web 端验证，还是两端同时开始？~~ → **两端同时进行**

---

## 八、附录：设计稿

### 8.1 Web 端工作台

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                    [3D 角色/气泡]                          │
│                                                             │
│                                                             │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  [📷快拍]  [📍位置]  [📅日程]  [📋待办]  ← 滑动 →  │   │
│  │                                                     │   │
│  │  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐              │   │
│  │  │ 📷  │  │ 📍  │  │ 📅  │  │ 📋  │              │   │
│  │  │快拍 │  │位置 │  │日程 │  │待办 │              │   │
│  │  └─────┘  └─────┘  └─────┘  └─────┘              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│       🗺️        📚         🔴          💬         👤        │
└─────────────────────────────────────────────────────────────┘
```

### 8.2 iOS 端工作台

```
┌─────────────────────────────────────────┐
│                                         │
│  [📷快拍]  [📍位置]  [📅日程]  [📋待办] │
│                                         │
│  ┌────────┐  ┌────────┐  ┌────────┐   │
│  │   📷   │  │   📍   │  │   📅   │   │
│  │  快拍  │  │  位置  │  │  日程  │   │
│  └────────┘  └────────┘  └────────┘   │
│                                         │
│  ← 滑动查看更多 →                       │
│                                         │
└─────────────────────────────────────────┘
```

---

**文档版本：2.0**
**最后更新：2026-02-28**
**更新说明：根据正反方辩论结果调整，增加数据库设计先行、简化外部分享、调整时间估算**

---

## 九、辩论总结（v2.0 新增）

### 9.1 正方核心观点
1. 四个功能形成生产力闭环，与项目定位契合
2. 最大化复用现有代码（通知服务、位置服务、GlassDock）
3. 基于高复用度（>60%），时间估算合理

### 9.2 反方核心质疑
1. Zero UI 理念可能被破坏
2. 本地通知、外部分享技术复杂度高
3. 时间估算可能过于乐观（实际可能需要 22-35 天）
4. 测试覆盖率低（14.83%）是风险因素

### 9.3 调整决策

| 原计划 | 调整后 | 原因 |
|--------|--------|------|
| 外部分享到微信 | 系统分享面板 / 复制链接 | 需要备案域名，暂不实现 |
| 4个功能同时做 | 分阶段实现 | 降低风险 |
| 7-9天 | 8-10天（MVP）+ 后续迭代 | 更现实 |
| 无数据库设计 | Phase 0 数据库先行 | 确保数据模型正确 |

### 9.4 最终建议

1. **先做 Phase 0**：数据库设计和测试
2. **再做 Phase 1-2**：工作台 UI + 待办功能
3. **根据反馈迭代**：日程、通知、位置分享
