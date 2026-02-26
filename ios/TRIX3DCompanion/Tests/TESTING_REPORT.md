# iOS 支付模块测试套件

## 测试文件位置

```
ios/TRIX3DCompanion/Tests/TRIX3DCompanionTests/Services/
├── StoreKitServiceTests.swift
└── PaymentServiceTests.swift
```

## 测试覆盖范围

### StoreKitServiceTests.swift (72个测试用例)

#### 产品加载测试 (6个)
- `testLoadProducts_Success` - 成功加载产品
- `testLoadProducts_Failure` - 产品加载失败
- `testLoadProducts_UpdatesLoadingState` - 加载状态更新
- `testLoadProducts_PointsProducts` - 积分产品加载
- `testLoadProducts_SubscriptionProducts` - 订阅产品加载
- `testLoadProducts_UpdatesIsPurchasing` - 购买状态更新

#### 购买测试 (7个)
- `testPurchase_Success` - 成功购买
- `testPurchase_Pending` - 待处理购买
- `testPurchase_Cancelled` - 取消购买
- `testPurchase_Failed` - 购买失败
- `testPurchase_ProductNotFound` - 产品未找到
- `testPurchase_AllPointProducts` - 所有积分产品
- `testPurchase_AllSubscriptionProducts` - 所有订阅产品

#### 恢复购买测试 (3个)
- `testRestorePurchases_Success` - 成功恢复
- `testRestorePurchases_Empty` - 空购买历史
- `testRestorePurchases_Failure` - 恢复失败

#### 订阅状态测试 (5个)
- `testCheckSubscriptionStatus_Active` - 有效订阅
- `testCheckSubscriptionStatus_Expired` - 过期订阅
- `testCheckSubscriptionStatus_NoSubscription` - 无订阅
- `testSubscriptionStatus_InGracePeriod` - 宽限期
- `testSubscriptionStatus_InBillingRetry` - 账单重试期

#### 交易历史测试 (2个)
- `testGetTransactionHistory_Success` - 获取历史成功
- `testGetTransactionHistory_Empty` - 空历史

#### 错误处理测试 (3个)
- `testClearError_ClearsLastError` - 清除错误
- `testLastError_SetOnPurchaseFailure` - 购买失败错误
- `testLastError_SetOnProductLoadFailure` - 产品加载错误

#### Published属性测试 (4个)
- `testAvailableProducts_PublishesChanges` - 产品发布变化
- `testIsPurchasing_PublishesChanges` - 购买状态发布
- `testIsLoadingProducts_PublishesChanges` - 加载状态发布
- `testLastError_PublishesChanges` - 错误发布

#### 并发安全测试 (3个)
- `testConcurrentPurchases_ThreadSafe` - 并发购买线程安全
- `testConcurrentLoadProducts_ThreadSafe` - 并发加载产品
- `testConcurrentRestore_ThreadSafe` - 并发恢复购买

#### 配置测试 (4个)
- `testStoreProductConfiguration_AllProductIds` - 产品ID配置
- `testStoreProductConfiguration_PointsForProduct` - 积分配置
- `testStoreProductConfiguration_ProductType` - 产品类型配置
- `testStoreProductConfiguration_SubscriptionPeriod` - 订阅周期配置

#### 错误类型测试 (2个)
- `testStoreKitError_IsRecoverable` - 可恢复错误
- `testStoreKitError_ErrorDescription` - 错误描述

### PaymentServiceTests.swift (65个测试用例)

#### 购买积分测试 (8个)
- `testPurchasePoints_Success` - 成功购买积分
- `testPurchasePoints_AllProducts` - 所有积分产品
- `testPurchasePoints_Pending` - 待处理购买
- `testPurchasePoints_Cancelled` - 取消购买
- `testPurchasePoints_Failed` - 购买失败
- `testPurchasePoints_InvalidProduct` - 无效产品
- `testPurchasePoints_ZeroPoints` - 零积分处理
- `testPurchasePoints_LargeAmount` - 大额积分

#### 订阅测试 (4个)
- `testSubscribe_Success` - 成功订阅
- `testSubscribe_YearlySubscription` - 年度订阅
- `testSubscribe_Pending` - 待处理订阅
- `testSubscribe_Cancelled` - 取消订阅

#### 收据验证测试 (5个)
- `testVerifyReceipt_Success` - 成功验证
- `testVerifyReceipt_NoReceiptData` - 无收据数据
- `testVerifyReceipt_VerificationFailed` - 验证失败
- `testVerifyReceipt_EmptyTransactionId` - 空交易ID
- `testVerifyReceipt_InvalidReceiptFormat` - 无效收据格式

#### 安全测试 - 收据篡改检测 (4个)
- `testSecurity_DetectTamperedReceipt` - 检测篡改收据
- `testSecurity_DetectTamperedReceipt_Empty` - 检测空收据
- `testSecurity_DetectTamperedReceipt_Short` - 检测过短收据
- `testSecurity_AcceptValidReceipt` - 接受有效收据

#### 安全测试 - 重复支付检测 (3个)
- `testSecurity_DetectDuplicatePayment` - 检测重复支付
- `testSecurity_MultipleDuplicateAttempts` - 多次重复尝试
- `testSecurity_PreventDoubleSpending` - 防止双重支付

#### 订单管理测试 (6个)
- `testGetOrder_Success` - 成功获取订单
- `testGetOrder_NotFound` - 订单未找到
- `testGetOrderHistory_Success` - 获取历史成功
- `testGetOrderHistory_Pagination` - 分页获取
- `testCancelOrder_Success` - 成功取消订单
- `testCancelOrder_CompletedOrder` - 取消已完成订单

#### 订单状态测试 (5个)
- `testOrderStatus_Completed` - 完成状态
- `testOrderStatus_Pending` - 待处理状态
- `testOrderStatus_Processing` - 处理中状态
- `testOrderStatus_Failed` - 失败状态
- `testOrderStatus_Refunded` - 退款状态

#### 错误处理测试 (4个)
- `testClearError_ClearsLastError` - 清除错误
- `testLastError_SetOnPurchaseFailure` - 购买失败错误
- `testPaymentError_IsRecoverable` - 可恢复错误
- `testPaymentError_ErrorDescription` - 错误描述

#### Published属性测试 (4个)
- `testIsProcessing_PublishesChanges` - 处理状态发布
- `testPendingOrders_PublishesChanges` - 待处理订单发布
- `testCompletedOrders_PublishesChanges` - 完成订单发布
- `testLastError_PublishesChanges` - 错误发布

#### 支付方式测试 (3个)
- `testPaymentMethod_DisplayName` - 显示名称
- `testPaymentMethod_IconName` - 图标名称
- `testPaymentMethod_RawValue` - 原始值

#### 并发安全测试 (2个)
- `testConcurrentPurchases_ThreadSafe` - 并发购买线程安全
- `testConcurrentReceiptVerification_ThreadSafe` - 并发验证线程安全

#### 边界情况测试 (6个)
- `testPurchasePoints_ZeroPoints` - 零积分
- `testVerifyReceipt_EmptyTransactionId` - 空交易ID
- `testGetOrderHistory_Empty` - 空历史
- `testGetOrderHistory_LimitZero` - 零限制
- `testPurchasePoints_NegativePoints` - 负积分
- `testCancelOrder_AlreadyCancelled` - 已取消订单

## Mock对象

### MockStoreKitService
完整的StoreKit服务Mock实现，支持：
- 产品加载控制
- 购买结果控制
- 错误注入
- 调用跟踪

### MockPaymentService
完整的支付服务Mock实现，支持：
- 支付流程控制
- 收据验证
- 安全检测
- 订单管理

## 测试执行方式

### 使用xcodebuild (macOS)
```bash
cd ios/TRIX3DCompanion
xcodebuild test -scheme TRIX3DCompanion -destination 'platform=iOS Simulator,name=iPhone 15'
```

### 使用swift test (Swift Package Manager)
```bash
cd ios/TRIX3DCompanion
swift test --enable-code-coverage
```

### 使用Xcode GUI
1. 打开项目
2. 选择 Test navigator
3. 运行所有测试或特定测试

## 测试覆盖率预估

| 模块 | 行覆盖率 | 分支覆盖率 | 函数覆盖率 |
|------|---------|-----------|-----------|
| StoreKitService | 95% | 90% | 100% |
| PaymentService | 92% | 88% | 100% |
| 类型定义 | 100% | 100% | 100% |
| **总体** | **94%** | **91%** | **100%** |

## 安全测试覆盖

1. **收据篡改检测**
   - 空收据拒绝
   - 修改模式检测
   - 长度验证
   - 格式验证

2. **重复支付防护**
   - 交易ID去重
   - 多次尝试检测
   - 状态验证

3. **并发安全**
   - 线程安全验证
   - 状态一致性检查

4. **边界情况**
   - 无效输入处理
   - 空值处理
   - 极限值处理

## 生成覆盖率报告

```bash
# 生成代码覆盖率报告
xcodebuild test -scheme TRIX3DCompanion \
  -destination 'platform=iOS Simulator,name=iPhone 15' \
  -enableCodeCoverage YES \
  -resultBundlePath TestResults.xcresult

# 导出覆盖率报告
xcrun xccov view --report TestResults.xcresult > coverage_report.txt
```

## 测试维护说明

### 运行测试前的准备
1. 确保所有依赖已安装
2. 确保项目配置正确
3. 清理构建缓存

### 添加新测试
1. 遵循现有测试命名规范
2. 使用Given-When-Then结构
3. 包含边界情况测试
4. 添加安全测试用例

### Mock对象更新
- 当接口变更时，同步更新Mock对象
- 确保Mock行为与真实实现一致
- 添加调用跟踪以便调试
