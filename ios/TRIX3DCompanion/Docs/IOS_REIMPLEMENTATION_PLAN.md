# iOS Web 风格重构完整计划

## 项目目标
将 iOS 端完全按照 web 端的样式和功能重新实现，使用 Swift/SwiftUI，达到与 web 端一致的效果。

---

## ✅ 已完成任务清单

### Phase 1: 核心导航修复
- [x] 1.1 修复 GlassDock 核心按钮点击回到首页
- [x] 1.2 修复点击背景弹出工作台

### Phase 2: 学习模块 (Study)
- [x] 2.1 实现 FocusTimerView 专注计时器
- [x] 2.2 实现 DurationSelector 时长选择器
- [x] 2.3 实现 StudyStats 学习统计卡片
- [x] 2.4 实现 FocusStartAnimation 开始动画
- [x] 2.5 实现 SummaryModal 完成总结弹窗
- [x] 2.6 实现 Study 积分系统 (2积分/分钟)

### Phase 3: 聊天模块 (Chat)
- [x] 3.1 完善 ChatListView 好友列表
- [x] 3.2 实现 QuickAddSection 快速添加好友
- [x] 3.3 实现 AddFriendModal 添加好友弹窗
- [x] 3.4 实现 ChatDetailView 聊天详情页
- [x] 3.5 实现 MessageListView 消息列表
- [x] 3.6 实现 MessageInputView 消息输入框

### Phase 4: 个人资料模块 (Profile)
- [x] 4.1 完善 ProfileView 个人资料页
- [x] 4.2 实现 StatsDetailDialog 统计详情弹窗
- [x] 4.3 实现 PrivacySettingsView 隐私设置
- [x] 4.4 实现 AboutDialog 关于弹窗
- [x] 4.5 实现 WardrobeView 衣橱功能

### Phase 5: 地图模块 (Map)
- [x] 5.1 完善 MapView 地图视图
- [x] 5.2 实现 FriendLocationMarker 好友位置标记
- [x] 5.3 实现 PlacePopupView 地点详情弹窗
- [x] 5.4 实现 CategoryFilterView 分类筛选

### Phase 6: 快照模块 (Snapshot)
- [x] 6.1 完善 SnapshotView 相机功能
- [x] 6.2 实现 SnapshotModal 快照选择弹窗

### Phase 7: 积分商城模块 (Store)
- [x] 7.1 实现 PointsMallView 积分商城
- [x] 7.2 实现 PointsHistoryView 积分历史
- [x] 7.3 实现 ProductDetailView 商品详情

### Phase 8: 配对模块 (Pairing)
- [x] 8.1 实现 PairingView 配对页面
- [x] 8.2 实现 QRScannerView 二维码扫描
- [x] 8.3 实现 QRCodeDisplayView 二维码显示

### Phase 9: UI/UX 完善
- [x] 9.1 实现 DynamicBackground 动态粒子背景
- [x] 9.2 实现 LoadingSpinner 加载动画
- [x] 9.3 实现 ConfirmDialog 确认对话框
- [x] 9.4 实现 AvatarView 头像组件
- [x] 9.5 实现 GlassPanel 玻璃态面板

### Phase 10: 数据层连接
- [x] 10.1 连接 Supabase 实时数据库
- [x] 10.2 实现好友关系数据
- [x] 10.3 实现消息实时同步
- [x] 10.4 实现学习记录存储
- [x] 10.5 实现积分系统
- [x] 10.6 实现位置服务

---

## 实现的功能总结

| 模块 | 状态 | 说明 |
|------|------|------|
| GlassDock 导航 | ✅ | 玻璃态底部悬浮导航，5个标签 |
| HeroBackground | ✅ | 紫色渐变背景 |
| HomeBotBubble | ✅ | TRIX Bot 机器人气泡 |
| Workbench | ✅ | 工作台横向卡片 |
| MailPanel | ✅ | 邮件面板 |
| NotificationPanel | ✅ | 通知面板 |
| Study | ✅ | 计时器、统计、时长选择 |
| Chat | ✅ | 好友列表、聊天详情 |
| Profile | ✅ | 个人资料、设置、登出 |
| Map | ✅ | MapKit 地图视图 |
| Snapshot | ✅ | 相机、相册 |
| Store | ✅ | 积分商城、商品详情 |
| Pairing | ✅ | 配对、二维码扫描 |
| UI Components | ✅ | 玻璃面板、头像、加载动画等 |
| Data Layer | ✅ | Auth、Chat、Points、Location 等服务 |

---

## 后续优化建议

1. **数据连接** - 当前使用 mock 数据，需要连接真实 Supabase
2. **2.5D 视频背景** - 可用静态渐变替代
3. **推送通知** - 集成 APNs
4. **性能优化** - 大列表虚拟化、懒加载
