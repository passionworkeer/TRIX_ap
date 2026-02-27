# Web 端占位符修复计划

> 生成时间: 2026-02-27
> 平台: Web (React + TypeScript + Vite)
> 状态: 待执行
> 版本: 2.0 - 详细任务版

---

## 📊 任务总览

| 优先级 | 任务数 | 预估工时 |
|--------|--------|---------|
| P0 阻塞 | 2 | 14h |
| P1 高优先 | 2 | 6h |
| **总计** | **4** | **20h** |

---

## 🔴 P0 - 阻塞任务

### Task 1: 积分商城页面

**严重性**: 🔴 严重 - 用户无法使用积分兑换功能
**文件**: `src/screens/Profile.tsx:52-55`
**当前状态**: 只显示 toast

#### 1.1 类型定义 (1h)

- [x] **T1.1.1** 创建 `src/types/mall.ts` 文件
- [ ] **T1.1.2** 定义 `MallCategory` 枚举
  ```typescript
  export type MallCategory = 'clothing' | 'accessory' | 'prop';
  ```

- [ ] **T1.1.3** 定义 `MallItem` 接口
  ```typescript
  export interface MallItem {
    id: string;
    name: string;
    description: string;
    image: string;
    price: number;
    category: MallCategory;
    isOwned: boolean;
  }
  ```

- [ ] **T1.1.4** 定义 `MallPurchaseRequest` 接口
- [ ] **T1.1.5** 定义 `MallPurchaseResponse` 接口

#### 1.2 商城服务 (2h)

- [x] **T1.2.1** 创建 `src/services/mallService.ts` 文件
- [x] **T1.2.2** 实现 `getMallItems()` 方法
  ```typescript
  export async function getMallItems(): Promise<MallItem[]>
  ```

- [x] **T1.2.3** 实现 `getMallItemsByCategory(category)` 方法
- [x] **T1.2.4** 实现 `purchaseItem(itemId)` 方法
- [x] **T1.2.5** 实现 `getUserPointsBalance()` 方法
- [x] **T1.2.6** 实现 `getPurchaseHistory()` 方法

#### 1.3 商城页面组件 (3h)

- [x] **T1.3.1** 创建 `src/screens/PointsMall.tsx` 文件
- [ ] **T1.3.2** 实现页面布局结构
- [ ] **T1.3.3** 实现积分余额显示组件
- [ ] **T1.3.4** 实现分类筛选标签栏
- [ ] **T1.3.5** 实现商品网格列表
- [ ] **T1.3.6** 实现空状态显示

#### 1.4 商品卡片组件 (1.5h)

- [ ] **T1.4.1** 创建 `src/components/MallItemCard.tsx` 文件
- [ ] **T1.4.2** 实现商品图片显示
- [ ] **T1.4.3** 实现商品名称和描述
- [ ] **T1.4.4** 实现价格显示 (积分)
- [ ] **T1.4.5** 实现已拥有状态显示
- [ ] **T1.4.6** 实现兑换按钮

#### 1.5 兑换弹窗 (1h)

- [ ] **T1.5.1** 创建 `src/components/PurchaseConfirmModal.tsx` 文件
- [ ] **T1.5.2** 实现确认弹窗 UI
- [ ] **T1.5.3** 实现积分不足提示
- [ ] **T1.5.4** 实现确认兑换逻辑

#### 1.6 路由配置 (0.5h)

- [ ] **T1.6.1** 打开 `src/types.ts`
- [ ] **T1.6.2** 添加 `POINTS_MALL` 路由常量
  ```typescript
  POINTS_MALL = '/mall'
  ```

- [ ] **T1.6.3** 打开 `src/App.tsx`
- [ ] **T1.6.4** 添加 PointsMall 路由

#### 1.7 Profile 跳转修改 (0.5h)

- [ ] **T1.7.1** 打开 `src/screens/Profile.tsx`
- [ ] **T1.7.2** 定位 `handleGetMoreOutfits` 函数 (第 52 行)
- [ ] **T1.7.3** 修改为使用 `navigate(AppRoutes.POINTS_MALL)`
- [ ] **T1.7.4** 添加必要的 import

#### 1.8 单元测试 - mallService.test.ts (1.5h)

- [ ] **T1.8.1** 创建 `src/services/mallService.test.ts` 文件
- [ ] **T1.8.2** 添加 `getMallItems` 测试
  - 测试获取商品列表成功
  - 测试获取空列表

- [ ] **T1.8.3** 添加 `getMallItemsByCategory` 测试
- [ ] **T1.8.4** 添加 `purchaseItem` 测试
  - 测试兑换成功
  - 测试积分不足
  - 测试商品不存在

- [ ] **T1.8.5** 添加 `getUserPointsBalance` 测试

#### 1.9 组件测试 - PointsMall.test.tsx (1h)

- [ ] **T1.9.1** 创建 `src/screens/PointsMall.test.tsx` 文件
- [ ] **T1.9.2** 测试页面渲染
- [ ] **T1.9.3** 测试分类筛选
- [ ] **T1.9.4** 测试商品列表渲染
- [ ] **T1.9.5** 测试兑换按钮点击

#### 1.10 E2E 测试 (1h)

- [ ] **T1.10.1** 创建商城 E2E 测试文件
- [ ] **T1.10.2** 测试进入商城页面
- [ ] **T1.10.3** 测试商品浏览
- [ ] **T1.10.4** 测试兑换流程 (完整)
- [ ] **T1.10.5** 测试积分不足提示

#### 1.11 安全审计 (0.5h)

- [ ] **T1.11.1** 验证积分扣减双重检查
- [ ] **T1.11.2** 验证请求防重放 (nonce)
- [ ] **T1.11.3** 验证商品数据来源可信
- [ ] **T1.11.4** 验证错误信息不泄露敏感数据
- [ ] **T1.11.5** 验证 HTTPS 传输

---

### Task 2: 衣柜/换装页面

**严重性**: 🔴 严重 - 用户无法使用换装功能
**文件**: `src/screens/Profile.tsx:57-60, 118-121`
**当前状态**: 只显示 toast

#### 2.1 类型定义 (1h)

- [ ] **T2.1.1** 创建 `src/types/wardrobe.ts` 文件
- [ ] **T2.1.2** 定义 `OutfitCategory` 枚举
  ```typescript
  export type OutfitCategory = 'hat' | 'cape' | 'wand' | 'background';
  ```

- [ ] **T2.1.3** 定义 `Outfit` 接口
  ```typescript
  export interface Outfit {
    id: string;
    name: string;
    category: OutfitCategory;
    image: string;
    previewImage: string;
    isOwned: boolean;
    isEquipped: boolean;
  }
  ```

- [ ] **T2.1.4** 定义 `EquipRequest` 接口
- [ ] **T2.1.5** 定义 `UserOutfits` 接口

#### 2.2 衣柜服务 (1.5h)

- [ ] **T2.2.1** 创建 `src/services/wardrobeService.ts` 文件
- [ ] **T2.2.2** 实现 `getUserOutfits()` 方法
- [ ] **T2.2.3** 实现 `getOutfitsByCategory(category)` 方法
- [ ] **T2.2.4** 实现 `equipOutfit(outfitId)` 方法
- [ ] **T2.2.5** 实现 `unequipOutfit(outfitId)` 方法
- [ ] **T2.2.6** 实现 `getEquippedOutfits()` 方法

#### 2.3 衣柜页面组件 (2.5h)

- [ ] **T2.3.1** 创建 `src/screens/Wardrobe.tsx` 文件
- [ ] **T2.3.2** 实现页面布局结构
- [ ] **T2.3.3** 实现分类标签栏 (帽子/披风/魔杖/背景)
- [ ] **T2.3.4** 实现服装网格列表
- [ ] **T2.3.5** 实现已装备状态显示

#### 2.4 服装卡片组件 (1h)

- [ ] **T2.4.1** 创建 `src/components/OutfitCard.tsx` 文件
- [ ] **T2.4.2** 实现服装图片显示
- [ ] **T2.4.3** 实现服装名称显示
- [ ] **T2.4.4** 实现已拥有/未拥有状态
- [ ] **T2.4.5** 实现已装备标识
- [ ] **T2.4.6** 实现装备/卸下按钮

#### 2.5 换装预览 (1h)

- [ ] **T2.5.1** 创建 `src/components/OutfitPreview.tsx` 文件
- [ ] **T2.5.2** 实现组合预览 (显示多个装备)
- [ ] **T2.5.3** 实现选中效果
- [ ] **T2.5.4** 实现预览与实际装备同步

#### 2.6 路由配置 (0.5h)

- [ ] **T2.6.1** 打开 `src/types.ts`
- [ ] **T2.6.2** 添加 `WARDROBE` 路由常量
- [ ] **T2.6.3** 打开 `src/App.tsx`
- [ ] **T2.6.4** 添加 Wardrobe 路由

#### 2.7 Profile 跳转修改 (0.5h)

- [ ] **T2.7.1** 打开 `src/screens/Profile.tsx`
- [ ] **T2.7.2** 定位 `handleOutfitChange` 函数 (第 57 行)
- [ ] **T2.7.3** 修改为实际装备逻辑调用 `wardrobeService.equipOutfit()`
- [ ] **T2.7.4** 定位 `handleViewAllOutfits` 函数 (第 118 行)
- [ ] **T2.7.5** 修改为使用 `navigate(AppRoutes.WARDROBE)`

#### 2.8 单元测试 - wardrobeService.test.ts (1h)

- [ ] **T2.8.1** 创建 `src/services/wardrobeService.test.ts` 文件
- [ ] **T2.8.2** 添加 `getUserOutfits` 测试
- [ ] **T2.8.3** 添加 `equipOutfit` 测试
  - 测试装备成功
  - 测试装备未拥有的服装

- [ ] **T2.8.4** 添加 `unequipOutfit` 测试

#### 2.9 组件测试 - Wardrobe.test.tsx (1h)

- [ ] **T2.9.1** 创建 `src/screens/Wardrobe.test.tsx` 文件
- [ ] **T2.9.2** 测试页面渲染
- [ ] **T2.9.3** 测试分类切换
- [ ] **T2.9.4** 测试装备按钮点击

#### 2.10 安全审计 (0.5h)

- [ ] **T2.10.1** 验证只能装备已拥有服装
- [ ] **T2.10.2** 验证装备状态正确保存
- [ ] **T2.10.3** 验证请求来源可信

---

## 🟡 P1 - 高优先级任务

### Task 3: 地图好友真实位置

**严重性**: 🟡 中等 - 地图使用模拟数据
**文件**: `src/screens/SnapMapScreen.tsx:46-86`
**当前状态**: 使用 `mockFriends` 模拟数据

#### 3.1 类型定义 (0.5h)

- [ ] **T3.1.1** 打开或创建 `src/types/location.ts` 文件
- [ ] **T3.1.2** 定义 `UserLocation` 接口
  ```typescript
  export interface UserLocation {
    userId: string;
    latitude: number;
    longitude: number;
    updatedAt: string;
  }
  ```

- [ ] **T3.1.3** 定义 `LocationShareSettings` 接口

#### 3.2 位置服务 (1.5h)

- [ ] **T3.2.1** 创建 `src/services/locationService.ts` 文件
- [ ] **T3.2.2** 实现 `getFriendsLocations()` 方法
- [ ] **T3.2.3** 实现 `updateMyLocation(latitude, longitude)` 方法
- [ ] **T3.2.4** 实现 `getLocationShareSettings()` 方法
- [ ] **T3.2.5** 实现 `updateLocationShareSettings(settings)` 方法
- [ ] **T3.2.6** 实现位置权限检查

#### 3.3 地图组件修改 (2h)

- [ ] **T3.3.1** 打开 `src/screens/SnapMapScreen.tsx`
- [ ] **T3.3.2** 导入 `locationService`
- [ ] **T3.3.3** 定位 `mockFriends` 变量 (约第 46 行)
- [ ] **T3.3.4** 替换为调用 `locationService.getFriendsLocations()`
- [ ] **T3.3.5** 添加 loading 状态处理
- [ ] **T3.3.6** 添加错误处理

#### 3.4 位置更新 (1h)

- [ ] **T3.4.1** 实现定时刷新好友位置 (每 30 秒)
- [ ] **T3.4.2** 实现位置变化动画
- [ ] **T3.4.3** 添加位置更新 indicator

#### 3.5 位置共享设置 (1h)

- [ ] **T3.5.1** 在设置页面添加位置共享入口
- [ ] **T3.5.2** 实现位置共享开关
- [ ] **T3.5.3** 实现可见范围设置 (所有人/仅好友)

#### 3.6 单元测试 - locationService.test.ts (1h)

- [ ] **T3.6.1** 创建 `src/services/locationService.test.ts` 文件
- [ ] **T3.6.2** 添加 `getFriendsLocations` 测试
- [ ] **T3.6.3** 添加 `updateMyLocation` 测试
- [ ] **T3.6.4** 添加 `getLocationShareSettings` 测试

#### 3.7 组件测试 - SnapMapScreen.test.tsx (0.5h)

- [ ] **T3.7.1** 检查现有测试文件是否存在
- [ ] **T3.7.2** 添加好友标记渲染测试

#### 3.8 安全审计 (0.5h)

- [ ] **T3.8.1** 验证只显示授权好友位置
- [ ] **T3.8.2** 验证位置数据脱敏处理
- [ ] **T3.8.3** 验证位置更新频率限制
- [ ] **T3.8.4** 验证 HTTPS 传输

---

### Task 4: 地图地点数据

**严重性**: 🟡 中等 - 地图使用模拟数据
**文件**: `src/screens/SnapMapScreen.tsx:89+`
**当前状态**: 使用 `mockPlaces` 模拟数据

#### 4.1 类型定义 (0.5h)

- [ ] **T4.1.1** 创建 `src/types/place.ts` 文件
- [ ] **T4.1.2** 定义 `PlaceCategory` 枚举
  ```typescript
  export type PlaceCategory = 'dining' | 'entertainment' | 'study' | 'shopping' | 'park';
  ```

- [ ] **T4.1.3** 定义 `Place` 接口

#### 4.2 地点服务 (1h)

- [ ] **T4.2.1** 创建 `src/services/placeService.ts` 文件
- [ ] **T4.2.2** 实现 `getNearbyPlaces(lat, lng, radius)` 方法
- [ ] **T4.2.3** 实现 `searchPlaces(query)` 方法
- [ ] **T4.2.4** 实现 `getPlacesByCategory(category)` 方法

#### 4.3 地图组件修改 (1.5h)

- [ ] **T4.3.1** 打开 `src/screens/SnapMapScreen.tsx`
- [ ] **T4.3.2** 导入 `placeService`
- [ ] **T4.3.3** 定位 `mockPlaces` 变量 (约第 89 行)
- [ ] **T4.3.4** 替换为调用 `placeService.getNearbyPlaces()`
- [ ] **T4.3.5** 添加 loading 状态处理

#### 4.4 地点筛选 (1h)

- [ ] **T4.4.1** 实现分类筛选按钮栏
- [ ] **T4.4.2** 实现筛选状态管理
- [ ] **T4.4.3** 实现筛选后地点列表更新

#### 4.5 地点搜索 (1h)

- [ ] **T4.5.1** 添加搜索输入框
- [ ] **T4.5.2** 实现搜索功能
- [ ] **T4.5.3** 实现搜索结果高亮

#### 4.6 单元测试 - placeService.test.ts (0.5h)

- [ ] **T4.6.1** 创建 `src/services/placeService.test.ts` 文件
- [ ] **T4.6.2** 添加 `getNearbyPlaces` 测试
- [ ] **T4.6.3** 添加 `searchPlaces` 测试

---

## ✅ 任务清单汇总 (共 68 个子任务)

### Task 1: 积分商城 (26 个子任务)

- [x] T1.1.1 创建 mall.ts
- [ ] T1.1.2 定义 MallCategory
- [ ] T1.1.3 定义 MallItem
- [ ] T1.1.4 定义请求/响应接口
- [x] T1.2.1 创建 mallService.ts
- [x] T1.2.2 getMallItems
- [x] T1.2.3 getMallItemsByCategory
- [x] T1.2.4 purchaseItem
- [x] T1.2.5 getUserPointsBalance
- [x] T1.2.6 getPurchaseHistory
- [ ] T1.2.4 purchaseItem
- [ ] T1.2.5 getUserPointsBalance
- [ ] T1.2.6 getPurchaseHistory
- [x] T1.3.1 创建 PointsMall.tsx
- [ ] T1.3.2 页面布局
- [ ] T1.3.3 积分余额显示
- [ ] T1.3.4 分类筛选
- [ ] T1.3.5 商品列表
- [ ] T1.3.6 空状态
- [ ] T1.4.1 创建 MallItemCard.tsx
- [ ] T1.4.2 商品图片
- [ ] T1.4.3 名称描述
- [ ] T1.4.4 价格显示
- [ ] T1.4.5 已拥有状态
- [ ] T1.4.6 兑换按钮
- [ ] T1.5.1 创建 PurchaseConfirmModal.tsx
- [ ] T1.5.2 弹窗 UI
- [ ] T1.5.3 积分不足提示
- [ ] T1.5.4 确认逻辑
- [ ] T1.6.1 打开 types.ts
- [ ] T1.6.2 添加路由常量
- [ ] T1.6.3 打开 App.tsx
- [ ] T1.6.4 添加路由
- [ ] T1.7.1 打开 Profile.tsx
- [ ] T1.7.2 定位 handleGetMoreOutfits
- [ ] T1.7.3 修改为 navigate
- [ ] T1.7.4 添加 import
- [ ] T1.8.1 创建 mallService.test.ts
- [ ] T1.8.2 测试 getMallItems
- [ ] T1.8.3 测试分类筛选
- [ ] T1.8.4 测试 purchaseItem
- [ ] T1.8.5 测试 getUserPointsBalance
- [ ] T1.9.1 创建 PointsMall.test.tsx
- [ ] T1.9.2 测试渲染
- [ ] T1.9.3 测试筛选
- [ ] T1.9.4 测试列表
- [ ] T1.9.5 测试兑换
- [ ] T1.10.1 创建 E2E 测试
- [ ] T1.10.2 测试进入商城
- [ ] T1.10.3 测试浏览
- [ ] T1.10.4 测试兑换流程
- [ ] T1.10.5 测试积分不足
- [ ] T1.11.1 验证扣减检查
- [ ] T1.11.2 验证防重放
- [ ] T1.11.3 验证数据可信
- [ ] T1.11.4 验证错误信息
- [ ] T1.11.5 验证 HTTPS

### Task 2: 衣柜/换装 (21 个子任务)

- [ ] T2.1.1 创建 wardrobe.ts
- [ ] T2.1.2 定义 OutfitCategory
- [ ] T2.1.3 定义 Outfit
- [ ] T2.1.4 定义请求接口
- [ ] T2.2.1 创建 wardrobeService.ts
- [ ] T2.2.2 getUserOutfits
- [ ] T2.2.3 getOutfitsByCategory
- [ ] T2.2.4 equipOutfit
- [ ] T2.2.5 unequipOutfit
- [ ] T2.2.6 getEquippedOutfits
- [ ] T2.3.1 创建 Wardrobe.tsx
- [ ] T2.3.2 页面布局
- [ ] T2.3.3 分类标签栏
- [ ] T2.3.4 服装列表
- [ ] T2.3.5 装备状态显示
- [ ] T2.4.1 创建 OutfitCard.tsx
- [ ] T2.4.2 服装图片
- [ ] T2.4.3 服装名称
- [ ] T2.4.4 已拥有状态
- [ ] T2.4.5 装备标识
- [ ] T2.4.6 装备按钮
- [ ] T2.5.1 创建 OutfitPreview.tsx
- [ ] T2.5.2 组合预览
- [ ] T2.5.3 选中效果
- [ ] T2.5.4 同步逻辑
- [ ] T2.6.1 打开 types.ts
- [ ] T2.6.2 添加路由常量
- [ ] T2.6.3 打开 App.tsx
- [ ] T2.6.4 添加路由
- [ ] T2.7.1 打开 Profile.tsx
- [ ] T2.7.2 修改 handleOutfitChange
- [ ] T2.7.3 调用 wardrobeService
- [ ] T2.7.4 修改 handleViewAllOutfits
- [ ] T2.7.5 添加 navigate
- [ ] T2.8.1 创建 wardrobeService.test.ts
- [ ] T2.8.2 测试 getUserOutfits
- [ ] T2.8.3 测试 equipOutfit
- [ ] T2.8.4 测试 unequipOutfit
- [ ] T2.9.1 创建 Wardrobe.test.tsx
- [ ] T2.9.2 测试渲染
- [ ] T2.9.3 测试分类切换
- [ ] T2.9.4 测试装备按钮
- [ ] T2.10.1 验证装备权限
- [ ] T2.10.2 验证状态保存
- [ ] T2.10.3 验证请求可信

### Task 3: 地图好友位置 (14 个子任务)

- [ ] T3.1.1 创建/打开 location.ts
- [ ] T3.1.2 定义 UserLocation
- [ ] T3.1.3 定义 LocationShareSettings
- [ ] T3.2.1 创建 locationService.ts
- [ ] T3.2.2 getFriendsLocations
- [ ] T3.2.3 updateMyLocation
- [ ] T3.2.4 getLocationShareSettings
- [ ] T3.2.5 updateLocationShareSettings
- [ ] T3.2.6 权限检查
- [ ] T3.3.1 打开 SnapMapScreen.tsx
- [ ] T3.3.2 导入 service
- [ ] T3.3.3 定位 mockFriends
- [ ] T3.3.4 替换为真实调用
- [ ] T3.3.5 loading 处理
- [ ] T3.3.6 错误处理
- [ ] T3.4.1 定时刷新
- [ ] T3.4.2 位置动画
- [ ] T3.4.3 更新 indicator
- [ ] T3.5.1 设置入口
- [ ] T3.5.2 共享开关
- [ ] T3.5.3 可见范围
- [ ] T3.6.1 创建 locationService.test.ts
- [ ] T3.6.2 测试 getFriendsLocations
- [ ] T3.6.3 测试 updateMyLocation
- [ ] T3.6.4 测试 settings
- [ ] T3.7.1 检查测试文件
- [ ] T3.7.2 好友标记测试
- [ ] T3.8.1 验证授权检查
- [ ] T3.8.2 验证数据脱敏
- [ ] T3.8.3 验证频率限制
- [ ] T3.8.4 验证 HTTPS

### Task 4: 地图地点数据 (13 个子任务)

- [ ] T4.1.1 创建 place.ts
- [ ] T4.1.2 定义 PlaceCategory
- [ ] T4.1.3 定义 Place
- [ ] T4.2.1 创建 placeService.ts
- [ ] T4.2.2 getNearbyPlaces
- [ ] T4.2.3 searchPlaces
- [ ] T4.2.4 getPlacesByCategory
- [ ] T4.3.1 打开 SnapMapScreen.tsx
- [ ] T4.3.2 导入 service
- [ ] T4.3.3 定位 mockPlaces
- [ ] T4.3.4 替换为真实调用
- [ ] T4.3.5 loading 处理
- [ ] T4.4.1 分类筛选按钮
- [ ] T4.4.2 筛选状态
- [ ] T4.4.3 列表更新
- [ ] T4.5.1 搜索输入框
- [ ] T4.5.2 搜索功能
- [ ] T4.5.3 结果高亮
- [ ] T4.6.1 创建 placeService.test.ts
- [ ] T4.6.2 测试 getNearbyPlaces
- [ ] T4.6.3 测试 searchPlaces

---

## 📁 新增文件清单

### 页面组件 (2 个)

| 文件 | 用途 |
|------|------|
| `src/screens/PointsMall.tsx` | 积分商城页面 |
| `src/screens/Wardrobe.tsx` | 衣柜页面 |

### 服务文件 (4 个)

| 文件 | 用途 |
|------|------|
| `src/services/mallService.ts` | 商城服务 |
| `src/services/wardrobeService.ts` | 衣柜服务 |
| `src/services/locationService.ts` | 位置服务 |
| `src/services/placeService.ts` | 地点服务 |

### 组件文件 (4 个)

| 文件 | 用途 |
|------|------|
| `src/components/MallItemCard.tsx` | 商品卡片 |
| `src/components/PurchaseConfirmModal.tsx` | 购买确认弹窗 |
| `src/components/OutfitCard.tsx` | 服装卡片 |
| `src/components/OutfitPreview.tsx` | 换装预览 |

### 类型文件 (4 个)

| 文件 | 用途 |
|------|------|
| `src/types/mall.ts` | 商城类型 |
| `src/types/wardrobe.ts` | 衣柜类型 |
| `src/types/location.ts` | 位置类型 |
| `src/types/place.ts` | 地点类型 |

### 测试文件 (9 个)

| 文件 | 用途 |
|------|------|
| `src/services/mallService.test.ts` | 商城服务测试 |
| `src/services/wardrobeService.test.ts` | 衣柜服务测试 |
| `src/services/locationService.test.ts` | 位置服务测试 |
| `src/services/placeService.test.ts` | 地点服务测试 |
| `src/screens/PointsMall.test.tsx` | 商城页面测试 |
| `src/screens/Wardrobe.test.tsx` | 衣柜页面测试 |
| `src/screens/SnapMapScreen.test.tsx` | 地图页面测试 |
| `src/e2e/points-mall.spec.ts` | 商城 E2E 测试 |

---

## 🔗 后端 API 依赖

| API | 方法 | 用途 | 状态 |
|-----|------|------|------|
| `/api/mall/items` | GET | 获取商品列表 | 需提供 |
| `/api/mall/purchase` | POST | 兑换商品 | 需提供 |
| `/api/points/balance` | GET | 获取积分余额 | 需提供 |
| `/api/wardrobe/outfits` | GET | 获取用户服装 | 需提供 |
| `/api/wardrobe/equip` | POST | 装备服装 | 需提供 |
| `/api/wardrobe/unequip` | POST | 卸下服装 | 需提供 |
| `/api/locations/friends` | GET | 获取好友位置 | 需提供 |
| `/api/locations/update` | POST | 更新自己位置 | 需提供 |
| `/api/locations/settings` | GET/PUT | 位置共享设置 | 需提供 |
| `/api/places/nearby` | GET | 获取附近地点 | 需提供 |
| `/api/places/search` | GET | 搜索地点 | 需提供 |

---

## 📋 执行顺序

```
Week 1: P0 任务
├── Day 1-2: Task 1 (积分商城)
│   ├── T1.1 类型定义
│   ├── T1.2 服务
│   ├── T1.3 页面组件
│   ├── T1.4 卡片组件
│   └── T1.5 弹窗
├── Day 3: T1.6 路由 + T1.7 Profile 修改
├── Day 4: T1.8 测试
├── Day 5: T1.9 组件测试 + T1.10 E2E
└── Day 6: T1.11 安全审计 + 休息

Week 2: P0 任务 + P1 开始
├── Day 7-8: Task 2 (衣柜)
├── Day 9: Task 2 测试 + 安全审计
├── Day 10: Task 3 开始 (位置服务)
└── Day 11: Task 3 继续

Week 3: P1 任务完成
├── Day 12: Task 3 完成
├── Day 13: Task 4 (地点数据)
├── Day 14: Task 4 测试
└── Day 15: 整体回顾 + 清理
```

---

**最后更新**: 2026-02-27
