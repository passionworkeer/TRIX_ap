# TRIX 3D Companion - 项目现状分析报告

> 生成时间: 2026-02-10
> 对比文档: `TRIX-OpenClaw MVP 技术实现文档.md`

---

## 一、项目概述

### 1.1 当前实现状态总览

| 层级 | 完成度 | 状态 |
|------|--------|------|
| 前端 UI | ~95% | 🟢 基本完成 |
| 数据库集成 | ~80% | 🟡 核心完成 |
| WebSocket Bot | 100% | 🟢 完全实现 |
| 认证系统 | 90% | 🟡 单用户模式 |
| **3D 角色系统** | **10%** | 🔴 **仅静态展示** |
| **PC Agent 控制** | **5%** | 🔴 **仅 UI 占位** |
| **LBS 社交** | **20%** | 🔴 **缺少实时位置** |

**总体完成度**: 约 45%（核心交互功能缺失）

---

## 二、功能模块对比分析

### 2.1 首页：伴侣空间 (Home)

| 功能需求 | 当前实现 | 差距 |
|---------|---------|------|
| 全屏 3D 角色 | ✅ 静态图片展示 | 🔴 需真实 3D 渲染 |
| Zero UI 隐藏状态栏 | ✅ 点击隐藏/显示 Dock | 🟡 缺少 5 秒自动隐藏 |
| 角色待机态闲逛 | ❌ 未实现 | 🔴 需状态机 + 动画 |
| 时间段问候 | ❌ 未实现 | 🟡 需时间逻辑 |
| 触摸互动 | ❌ 未实现 | 🟡 需点击检测 + 反馈 |

**核心问题**: [HeroBackground.tsx](src/components/HeroBackground.tsx) 仅显示静态背景图，无 3D 角色渲染引擎（Three.js/React Three Fiber）

---

### 2.2 模块一：真实生活地图 (Map)

| 功能需求 | 当前实现 | 差距 |
|---------|---------|------|
| 3D 矢量地图 | ✅ Leaflet 实现 | 🟢 完成 |
| Clawbot 化身跟随 | ❌ 仅显示默认标记 | 🔴 需自定义 3D Avatar 组件 |
| 好友实时位置显示 | ❌ 未实现 | 🔴 需 WebSocket + GPS 集成 |
| 偶遇机制 (<50米) | ❌ 未实现 | 🔴 需距离计算 + 触发动画 |
| POI 热门地点 | ❌ 未实现 | 🟡 需 POI 数据 API |
| 用户状态映射（电量/耳机） | ❌ 未实现 | 🔴 需设备 API 集成 |

**核心问题**:
- [Map.tsx](src/screens/Map.tsx:18) 使用静态图标，无角色状态同步
- 无 GPS 实时位置更新逻辑
- 无好友位置订阅

---

### 2.3 模块二：虚拟自习室 (Study)

| 功能需求 | 当前实现 | 差距 |
|---------|---------|------|
| 专注计时器 | ✅ 番茄钟实现 | 🟢 完成 |
| 3D 室内场景 | ❌ 仅 Modal UI | 🔴 需 3D 场景渲染 |
| 入场动画（推门入座） | ❌ 未实现 | 🔴 需相机动画系统 |
| 多人好友座位显示 | ❌ Mock 数据 | 🔴 需实时房间状态 |
| 拍一拍/送咖啡互动 | ❌ 未实现 | 🟡 需互动消息协议 |

**数据库状态**: `study_rooms` 和 `study_room_members` 表已存在，但未在 UI 中使用

**核心问题**: [StudyRoom.tsx](src/components/StudyRoom.tsx:21) 仅显示静态 UI，无真实房间逻辑

---

### 2.4 模块三：交互中枢（核心按钮）

| 功能需求 | 当前实现 | 差距 |
|---------|---------|------|
| 长按语音指令 | ❌ 未实现 | 🔴 需长按手势 + 语音识别 |
| 声波纹效果 | ❌ 未实现 | 🟡 需动画组件 |
| 角色倾听姿态 | ❌ 未实现 | 🔴 需 3D 角色状态切换 |
| 单击跳转聊天 | ✅ 已实现 | 🟢 完成 |

**核心问题**: [GlassDock.tsx](src/components/GlassDock.tsx:49) 中心按钮仅处理点击，无长按逻辑

---

### 2.5 模块四：聊天与控制台 (Chat)

| 功能需求 | 当前实现 | 差距 |
|---------|---------|------|
| 情感对话（Bot） | ✅ WebSocket 实现 | 🟢 完成 |
| 好友聊天（DB） | ✅ Supabase 实现 | 🟢 完成 |
| 任务卡片（截图/文件） | ❌ 仅文本消息 | 🔴 需自定义消息类型 |
| PC 状态栏显示 | ❌ Mock 数据 | 🔴 需真实 PC 状态订阅 |
| AR 相机识别 | ✅ Snapshot 页面存在 | 🟡 需与聊天集成 |
| 控制确认卡片 | ❌ 未实现 | 🔴 需交互式消息组件 |

**核心问题**: [ChatDetail.tsx](src/screens/ChatDetail.tsx:80) 消息类型单一，无任务卡片渲染

---

### 2.6 模块五：个人中心 (Profile)

| 功能需求 | 当前实现 | 差距 |
|---------|---------|------|
| 衣橱系统 | ❌ TODO (仅 alert) | 🔴 需装备数据 + 更换逻辑 |
| 数据统计 | ❌ 未实现 | 🟡 需数据聚合查询 |
| PC 连接管理 | ✅ QR 扫码 UI | 🟡 需后端配对逻辑 |
| 深色模式切换 | ❌ TODO | 🟡 需主题系统 |

**TODO 列表** (来自 [Profile.tsx](src/screens/Profile.tsx)):
- L14: 实现装备更换逻辑
- L20: 实现深色模式切换
- L31: 导航到隐私设置页面
- L36: 导航到关于页面
- L56: 导航到装备商店页面
- L60: 导航到装备获取页面

---

## 三、后端逻辑缺失清单

### 3.1 PC Agent 控制逻辑（核心缺失）

**当前状态**: WebSocket 连接仅用于聊天，无控制指令

**需要实现**:

| 功能 | 优先级 | 说明 |
|------|--------|------|
| 截屏指令 | 🔴 P0 | `{"type": "screenshot"}` → 返回 base64 图片 |
| 文件传输 | 🔴 P0 | WebSocket 二进制流或 HTTP 上传 |
| 系统控制 | 🔴 P0 | 关机/重启/锁屏/音量控制 |
| PC 状态订阅 | 🟡 P1 | CPU/内存/电量实时上报 |
| 指令确认机制 | 🟡 P1 | 敏感操作需二次确认 |

**建议协议扩展**:
```typescript
// Client -> PC
type PCControlMessage =
  | { type: "screenshot", id: string }
  | { type: "shutdown", confirm: boolean }
  | { type: "file_transfer", file_id: string }

// PC -> Client
type PCStatusMessage =
  | { type: "status", cpu: number, memory: number, battery: number }
  | { type: "screenshot_result", id: string, data: string }
```

---

### 3.2 LBS 位置服务逻辑

**当前状态**: 无位置数据采集和存储

**需要实现**:

| 功能 | 技术方案 |
|------|---------|
| 用户位置上报 | 每 30 秒通过 `navigator.geolocation` 上传到 `user_locations` 表 |
| 好友位置订阅 | Supabase Realtime 订阅 `user_locations` 表变更 |
| 距离计算 | PostgreSQL `ST_Distance` 或前端 Haversine 公式 |
| 偶遇触发 | 当距离 <50m 时触发动画 + 存入 `encounters` 表 |

**数据库扩展需求**:
```sql
-- 需新增表
CREATE TABLE user_locations (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  heading DECIMAL(5, 2), -- 朝向（度）
  activity TEXT, -- 'walking' | 'stationary' | 'driving'
  device_battery INTEGER,
  device_headphones BOOLEAN,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_locations_coords ON user_locations USING GIST (point(longitude, latitude));
```

---

### 3.3 虚拟自习室逻辑

**当前状态**: 表结构存在，无实时逻辑

**需要实现**:

| 功能 | 技术方案 |
|------|---------|
| 房间加入/离开 | Supabase RPC `join_room(room_id)` / `leave_room()` |
| 成员状态同步 | Realtime 订阅 `study_room_members` |
| 互动消息 | `room_interactions` 表存储拍一拍/送咖啡 |
| 专注计时上报 | 定时 RPC 调用更新 `focus_minutes` |

**RPC 函数建议**:
```sql
CREATE OR REPLACE FUNCTION join_room(room_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO study_room_members (room_id, user_id, status)
  VALUES (room_id, CURRENT_USER_ID, 'focusing')
  ON CONFLICT (room_id, user_id) DO UPDATE
  SET updated_at = NOW();
END;
$$ LANGUAGE plpgsql;
```

---

### 3.4 用户装备系统

**当前状态**: UI 占位，无数据模型

**需要实现**:

| 功能 | 技术方案 |
|------|---------|
| 装备数据模型 | `user_outfits` 表 + `outfit_items` 表 |
| 装备更换逻辑 | RPC `equip_item(item_id)` |
| 装备商店 | `outfit_shop` 表 + 虚拟货币系统 |

**数据库扩展**:
```sql
CREATE TABLE outfit_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL, -- 'hair' | 'top' | 'bottom' | 'accessory'
  asset_url TEXT NOT NULL,
  price INTEGER DEFAULT 0
);

CREATE TABLE user_outfits (
  user_id UUID REFERENCES users(id),
  item_id UUID REFERENCES outfit_items(id),
  equipped_at TIMESTAMP,
  PRIMARY KEY (user_id, item_id)
);
```

---

### 3.5 认证与授权完善

**当前状态**: 单用户模式（硬编码 `CURRENT_USER_ID`）

**需要实现**:

| 问题 | 解决方案 |
|------|---------|
| 多用户支持 | 移除硬编码 ID，从 `authContext` 获取 |
| 路由守卫 | 创建 `ProtectedRoute` 组件包裹需登录页面 |
| RLS 策略收紧 | 生产环境启用严格行级安全策略 |
| 角色权限 | 添加 `user_roles` 表 + 权限检查 |

**关键文件修改**:
- [databaseService.ts](src/services/databaseService.ts:9): 移除 `CURRENT_USER_ID`
- [App.tsx](src/App.tsx:80): 添加路由守卫

---

### 3.6 好友系统逻辑

**当前状态**: 好友列表已存在，但无请求流程

**需要实现**:

| 功能 | 状态 |
|------|------|
| 好友请求发送 | ❌ 缺少 UI + RPC |
| 请求接受/拒绝 | ❌ 缺少 RPC |
| 好友删除 | ❌ 缺少 UI + RPC |
| 在线状态同步 | ❌ 缺少 `last_seen` 字段 |

---

### 3.7 通知系统增强

**当前状态**: 静态通知数据

**需要实现**:

| 功能 | 技术方案 |
|------|---------|
| 实时推送 | Supabase Realtime 订阅 `notifications` 表 |
| 推送触发器 | 数据库触发器在插入时自动推送 |
| 推送权限 | Web Push API + Service Worker |

---

## 四、隐藏问题与风险

### 4.1 架构层面

| 问题 | 严重性 | 说明 |
|------|--------|------|
| **3D 引擎缺失** | 🔴 Critical | 所有 3D 场景（首页/地图/自习室）均为静态图 |
| **状态管理混乱** | 🟡 Medium | Context + LocalStorage + Database 并存，无统一状态源 |
| **错误处理缺失** | 🟡 Medium | WebSocket/Database 调用无统一错误边界 |

### 4.2 安全层面

| 问题 | 严重性 | 说明 |
|------|--------|------|
| RLS 策略过于宽松 | 🔴 Critical | 所有表允许任意操作 |
| 无 CORS 限制 | 🟡 Medium | Supabase 默认配置 |
| WebSocket 无认证重试 | 🟡 Medium | Token 失效后无刷新机制 |

### 4.3 性能层面

| 问题 | 严重性 | 说明 |
|------|--------|------|
| 地图未懒加载 | 🟡 Medium | Leaflet 在非地图页面也初始化 |
| 无图片优化 | 🟡 Medium | 大量背景图无 WebP/懒加载 |
| Realtime 过度订阅 | 🟡 Medium | 可能重复订阅导致资源泄漏 |

### 4.4 用户体验层面

| 问题 | 严重性 | 说明 |
|------|--------|------|
| 无加载状态 | 🟡 Medium | 数据请求时无骨架屏/Spinner |
| 离线处理缺失 | 🔴 High | 无网络时整个应用不可用 |
| 无操作引导 | 🟡 Medium | 首次使用无 onboarding 流程 |

---

## 五、推荐下一步实施计划

### 阶段一：核心体验补全（优先级 P0）

**目标**: 让产品"能用"——实现文档描述的核心交互

1. **3D 角色渲染引擎** (预计 2-3 周)
   - 集成 React Three Fiber
   - 实现 Clawbot 待机态 3D 模型导入
   - 添加基础动画（闲逛/点击反馈）

2. **PC Agent 控制逻辑** (预计 1-2 周)
   - 扩展 WebSocket 协议支持控制指令
   - 实现截屏功能（最高优先级）
   - 添加 PC 状态订阅（CPU/电量）

3. **长按语音指令** (预计 1 周)
   - 核心按钮添加长按手势检测
   - 集成 Web Speech API 语音识别
   - 实现声波纹动画效果

**里程碑**: 用户可通过语音/聊天控制 PC 截图，角色有基本交互反馈

---

### 阶段二：社交与位置（优先级 P1）

**目标**: 实现 LBS 核心闭环

1. **位置上报与好友位置** (预计 2 周)
   - 实现 `user_locations` 表 + GPS 定期上报
   - 地图显示好友实时位置
   - 添加距离计算与偶遇动画

2. **虚拟自习室实时化** (预计 1 周)
   - 实现房间加入/离开 RPC
   - Realtime 同步成员状态
   - 添加拍一拍互动

3. **装备系统基础** (预计 1 周)
   - 创建 `outfit_items` 表
   - 实现基础更换逻辑
   - 完成 Profile 页面 TODO

**里程碑**: 地图可看到好友位置，自习室可多人互动

---

### 阶段三：体验优化（优先级 P2）

**目标**: 生产级打磨

1. **认证系统完善**
   - 移除单用户模式
   - 添加路由守卫
   - 收紧 RLS 策略

2. **性能优化**
   - 实现图片懒加载
   - 添加骨架屏
   - 优化 Realtime 订阅

3. **错误处理**
   - 统一错误边界
   - 离线降级方案
   - 友好错误提示

**里程碑**: 可作为 MVP 发布

---

### 阶段四：增强功能（优先级 P3）

1. POI 数据集成
2. AR 相机与聊天集成
3. 文件传输功能
4. 推送通知
5. 数据统计看板

---

## 六、技术债务清单

### 必须解决

- [ ] 移除 [databaseService.ts:9](src/services/databaseService.ts#L9) 硬编码 `CURRENT_USER_ID`
- [ ] 实现 [Profile.tsx](src/screens/Profile.tsx) 所有 TODO
- [ ] 添加 `/profile/settings` 路由组件
- [ ] 实现 ProtectedRoute 路由守卫
- [ ] 收紧所有表 RLS 策略
- [ ] WebSocket 添加 Token 刷新机制

### 建议解决

- [ ] 统一状态管理（考虑 Zustand/Jotai）
- [ ] 添加错误边界组件
- [ ] 实现离线检测与降级
- [ ] 优化地图组件懒加载
- [ ] 添加单元测试

---

## 七、关键文件索引

### 需要重点修改的文件

| 文件 | 修改内容 | 优先级 |
|------|---------|--------|
| [src/components/HeroBackground.tsx](src/components/HeroBackground.tsx) | 集成 3D 渲染引擎 | P0 |
| [src/contexts/WebSocketContext.tsx](src/contexts/WebSocketContext.tsx) | 扩展控制协议 | P0 |
| [src/components/GlassDock.tsx](src/components/GlassDock.tsx) | 添加长按逻辑 | P0 |
| [src/screens/Map.tsx](src/screens/Map.tsx) | 集成 GPS + 好友位置 | P1 |
| [src/components/StudyRoom.tsx](src/components/StudyRoom.tsx) | 实时房间逻辑 | P1 |
| [src/screens/Profile.tsx](src/screens/Profile.tsx) | 完成 TODO | P1 |
| [src/services/databaseService.ts](src/services/databaseService.ts) | 移除硬编码 ID | P0 |
| [src/App.tsx](src/App.tsx) | 添加路由守卫 | P1 |

### 需要新建的文件

| 文件 | 用途 |
|------|------|
| `src/components/ProtectedRoute.tsx` | 路由守卫 |
| `src/components/ErrorBoundary.tsx` | 错误边界 |
| `src/services/locationService.ts` | GPS 上报服务 |
| `src/services/pcControlService.ts` | PC 控制指令封装 |
| `src/hooks/useGeolocation.ts` | GPS 定位 Hook |
| `src/types/pcControl.ts` | PC 控制消息类型定义 |

---

## 八、总结

### 当前项目优势

1. ✅ **架构清晰**: 三层布局、组件化良好
2. ✅ **数据库完善**: 表结构完整，基础服务齐全
3. ✅ **聊天稳定**: Bot WebSocket + 好友 DB 均可用
4. ✅ **移动优先**: viewport 适配到位

### 核心差距

1. 🔴 **3D 缺位**: 核心卖点"3D 角色"未实现
2. 🔴 **PC 控制缺失**: "生产力 OS" 无控制逻辑
3. 🔴 **社交空洞**: LBS 功能仅地图壳子

### 优先建议

**短期（2-4 周）**: 集成 Three.js + PC 截屏控制 + 语音长按

**中期（1-2 月）**: 位置服务 + 自习室实时化 + 装备系统

**长期（3 月+）**: 性能优化 + 测试 + 生产部署

---

**报告生成**: Claude Code
**分析基准**: 技术实现文档 v1.0
**代码库版本**: main branch (commit 281c9ed)
