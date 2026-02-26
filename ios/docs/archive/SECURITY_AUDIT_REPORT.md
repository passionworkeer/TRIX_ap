# Phase 5 安全审查报告

## 执行摘要

- **审查日期**: 2026-02-26
- **审查范围**: Phase 5 实现的所有服务层和 API 扩展代码
- **总体安全评分**: C (良好，但存在改进空间)

### 审查文件清单

| 文件 | 路径 |
|------|------|
| LocationService | `ios/TRIX3DCompanion/Core/Services/LocationService.swift` |
| LocationServiceProtocol | `ios/TRIX3DCompanion/Core/Services/LocationServiceProtocol.swift` |
| CameraService | `ios/TRIX3DCompanion/Core/Services/CameraService.swift` |
| CameraServiceProtocol | `ios/TRIX3DCompanion/Core/Services/CameraServiceProtocol.swift` |
| ImageUploadService | `ios/TRIX3DCompanion/Core/Services/ImageUploadService.swift` |
| APIClient | `ios/TRIX3DCompanion/Core/Network/APIClient.swift` |
| APIEndpoints | `ios/TRIX3DCompanion/Core/Network/APIEndpoints.swift` |

---

## 发现的问题

### 严重 (Critical)

#### 1. 开发环境使用不安全协议 (M1 - OWASP M1: 客户端代码质量)

**文件**: `APIEndpoints.swift` 第12行, 第27行

```swift
// 不安全的开发环境配置
static let development = "http://47.243.55.130:8765"  // 第12行
static let development = "ws://47.243.55.130:8765"    // 第27行
```

**问题描述**:
- 开发环境 API 使用 HTTP 而非 HTTPS，WebSocket 使用 WS 而非 WSS
- 攻击者可以拦截、篡改传输中的数据
- Token 和敏感数据可能在网络上明文传输

**风险评估**: 高 - 可能导致用户凭证泄露和中间人攻击

**修复建议**:
```swift
// 建议修改为
static let development = "https://47.243.55.130:8765"
static let development = "wss://47.243.55.130:8765"

// 或使用单独的测试环境域名
```

---

#### 2. APIClient 缺少 Token 自动刷新机制

**文件**: `APIClient.swift` 第125-169行

**问题描述**:
- 虽然 `AuthService` 实现了 Token 刷新逻辑 (`AuthService.swift` 第272-306行)
- 但 `APIClient` 没有使用 Alamofire 拦截器来自动处理 401 响应和 Token 刷新
- 当 Token 过期时，需要手动调用 `refreshTokenIfNeeded()`，容易遗漏

**风险评估**: 高 - Token 过期后请求会失败，可能导致用户体验问题和安全风险

**修复建议**:
```swift
// 创建认证拦截器
final class AuthInterceptor: RequestInterceptor {
    func adapt(_ urlRequest: URLRequest, for session: Session, completion: @escaping (Result<URLRequest, Error>) -> Void) {
        // 添加 Token 到请求头
    }

    func retry(_ request: Request, for session: Session, dueTo error: Error, completion: @escaping (RetryResult) -> Void) {
        // 处理 401，自动刷新 Token
    }
}
```

---

### 高危 (High)

#### 3. 位置数据未加密存储

**文件**: `LocationService.swift` 第25行

```swift
@Published private(set) var currentLocation: CLLocation?
```

**问题描述**:
- 位置数据以明文形式存储在内存中 (`currentLocation`, `nearbyLocations`)
- 如果设备被恶意软件感染或被攻击，位置数据可能被提取
- iOS 设备丢失或被盗时，敏感位置数据可能泄露

**风险评估**: 高 - 违反隐私最小化原则，泄露用户位置隐私

**修复建议**:
- 考虑不在本地持久化位置数据
- 如果需要缓存，使用 iOS Keychain 或加密存储
- 考虑使用 `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`

---

#### 4. 照片数据未加密处理

**文件**: `ImageUploadService.swift` 第149-157行

```swift
// 转换为 Base64 - 明文传输
let base64String = imageData.base64EncodedString()
let request = ImageUploadRequest(
    image: base64String,
    filename: generateFilename(),
    mimeType: "image/jpeg"
)
```

**问题描述**:
- 照片数据转换为 Base64 后直接传输
- 虽然使用 HTTPS 传输，但内存中仍保留明文数据
- 没有端到端加密保护

**风险评估**: 中 - 照片可能包含敏感信息

**修复建议**:
- 考虑在上传前对图片数据进行额外加密
- 使用 iOS 的 Data Protection 机制
- 确保照片数据在内存中被处理后及时清零

---

#### 5. 日志输出泄露精确位置信息

**文件**: `LocationService.swift` 第494-502行

```swift
var locationDescription: String? {
    guard let location = currentLocation else { return nil }

    let lat = String(format: "%.6f", location.coordinate.latitude)   // 精确到米
    let lon = String(format: "%.6f", location.coordinate.longitude)  // 精确到米
    let acc = String(format: "%.1f", location.horizontalAccuracy)

    return "纬度: \(lat), 经度: \(lon), 精度: \(acc)米"
}
```

**问题描述**:
- 精确到小数点后6位的坐标可以直接定位到具体位置
- 如果日志被记录到文件系统或第三方服务，可能泄露用户位置

**风险评估**: 中 - 违反隐私保护原则

**修复建议**:
```swift
// 只输出模糊位置或精度信息
return "精度: \(acc)米"
// 或
return "纬度: \(String(format: "%.2f", lat)), 经度: \(String(format: "%.2f", lon))"
```

---

### 中危 (Medium)

#### 6. 缺少 API 参数注入验证

**文件**: `LocationService.swift` 第258-263行

```swift
// 只检查是否为空，没有验证格式
guard !companionId.isEmpty else {
    let error = LocationError.networkError(NSError(domain: "Validation", code: -1))
    lastError = error
    return .failure(error)
}
```

**问题描述**:
- `companionId` 只检查非空，没有验证格式
- 缺少对特殊字符的过滤，可能存在注入风险
- `radius` 参数没有验证范围限制

**风险评估**: 中 - 可能导致服务端注入攻击

**修复建议**:
```swift
// 验证 companionId 格式
guard companionId.count <= 64,
      companionId.range(of: "^[a-zA-Z0-9_-]+$", options: .regularExpression) != nil else {
    return .failure(LocationError.invalidParameters)
}

// 验证 radius 范围
guard radius > 0, radius <= 50000 else {  // 最大 50km
    return .failure(LocationError.invalidParameters)
}
```

---

#### 7. 缺少用户数据删除功能

**文件**: 整个 Phase 5 代码

**问题描述**:
- 没有发现用户请求删除个人数据的接口
- GDPR 和 CCPA 要求提供数据删除功能
- 登出时只清除 Token，没有清除服务器端数据

**风险评估**: 中 - 不符合隐私法规要求

**修复建议**:
- 实现 `deleteAccount()` 方法
- 在 `APIClient` 中添加删除用户数据的 API
- 在登出流程中提示用户数据删除选项

---

#### 8. Keychain 访问控制不够严格

**文件**: `APIClient.swift` 第260-274行

```swift
let query: [String: Any] = [
    kSecClass as String: kSecClassGenericPassword,
    kSecAttrService as String: serviceName,
    kSecAttrAccount as String: key,
    kSecValueData as String: data
]
```

**问题描述**:
- 没有设置 `kSecAttrAccessible` 属性
- 默认行为可能在设备解锁前就允许访问
- 没有设置 `kSecAttrSynchronizable` 防止数据同步到 iCloud

**风险评估**: 中 - 数据可能在不安全的情况下被访问

**修复建议**:
```swift
let query: [String: Any] = [
    kSecClass as String: kSecClassGenericPassword,
    kSecAttrService as String: serviceName,
    kSecAttrAccount as String: key,
    kSecValueData as String: data,
    kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly  // 只在设备解锁时访问
]
```

---

#### 9. 缺少临时文件清理机制

**文件**: `ImageUploadService.swift`

**问题描述**:
- 照片处理过程中可能产生临时文件
- 没有清理临时图片数据的逻辑
- 可能导致临时文件残留在设备上

**风险评估**: 中 - 敏感数据可能残留

**修复建议**:
- 使用 `@autoreleasepool` 确保临时对象及时释放
- 考虑使用 `FileManager` 清理临时目录

---

### 低危 (Low)

#### 10. 缺少证书验证配置

**文件**: `APIClient.swift` 第28-32行

```swift
let configuration = URLSessionConfiguration.default
configuration.timeoutIntervalForRequest = 30
configuration.timeoutIntervalForResource = 60

self.session = Session(configuration: configuration)
```

**问题描述**:
- 没有显式配置证书验证
- 虽然 Alamofire 默认启用证书验证，但应该明确配置

**风险评估**: 低 - 依赖框架默认行为

**修复建议**:
```swift
let evaluators: [String: ServerTrustEvaluating] = [
    "api.trix3d.com": PinnedCertificatesTrustEvaluator()
]
let serverTrustManager = ServerTrustManager(evaluators: evaluators)
self.session = Session(configuration: configuration, serverTrustManager: serverTrustManager)
```

---

#### 11. 权限请求时机不够明确

**文件**: `LocationService.swift` 第150-167行, `CameraService.swift` 第134-174行

**问题描述**:
- 权限检查是隐式进行的，用户可能不知道需要授权
- `getCurrentLocation()` 内部隐式检查权限，不够透明

**风险评估**: 低 - 可能导致用户困惑

**修复建议**:
- 在调用位置/相机功能前，先明确提示用户需要授权
- 提供清晰的权限请求 UI

---

## 详细分析

### 1. 权限安全 - 评分: 良好

**通过项**:
- LocationService 在访问 GPS 前检查权限 (第111-144行)
- CameraService 在访问相机前检查权限 (第100-124行)
- 权限被拒绝时有优雅的降级处理 (返回错误枚举)
- 使用 `whenInUse` 而非 `always` 权限，遵循最小权限原则

**问题项**:
- 权限请求是隐式的，用户体验不够清晰

---

### 2. 数据安全 - 评分: 需要改进

**通过项**:
- Token 使用 Keychain 存储 (安全)
- 登出时清除 Token (`clearSession()`)
- 文件大小有限制 (5MB)

**问题项**:
- 位置数据未加密
- 照片数据未加密
- 缺少临时文件清理
- 日志输出泄露位置信息

---

### 3. 网络安全 - 评分: 需要改进

**通过项**:
- 生产环境使用 HTTPS
- 使用 Bearer Token 认证
- 有超时配置 (30秒请求超时)

**问题项**:
- 开发环境使用 HTTP
- 缺少 Token 自动刷新拦截器
- 缺少证书固定 (Certificate Pinning)

---

### 4. 输入验证 - 评分: 良好

**通过项**:
- 位置坐标验证范围 (纬度 -90~90, 经度 -180~180)
- 图片数据验证
- 邮箱格式验证
- 密码长度验证

**问题项**:
- API 参数验证不够充分

---

### 5. 隐私保护 - 评分: 需要改进

**通过项**:
- 使用 whenInUse 而非 always 权限
- 错误消息不泄露敏感信息
- 后台位置更新默认禁用

**问题项**:
- 日志输出精确位置
- 缺少用户数据删除功能

---

### 6. 错误处理 - 评分: 良好

**通过项**:
- 所有错误都正确捕获
- 用户友好的错误消息
- 有错误恢复机制
- 使用 Result 类型处理错误

---

## 修复优先级

### P0 (立即修复)
1. 开发环境使用 HTTPS 而非 HTTP
2. APIClient 集成 Token 自动刷新拦截器

### P1 (本周修复)
3. 日志输出脱敏处理
4. Keychain 访问控制加强
5. API 参数验证完善

### P2 (计划中)
6. 位置/照片数据加密存储
7. 实现用户数据删除功能
8. 添加证书固定

---

## 合规性检查

### GDPR (通用数据保护条例)
- [ ] 数据最小化 - 部分符合 (位置数据未加密)
- [ ] 目的限制 - 符合
- [ ] 存储限制 - 不符合 (没有数据过期机制)
- [ ] 数据可携带性 - 不符合 (没有导出接口)
- [ ] 删除权 - 不符合 (没有删除功能)

### CCPA (加州消费者隐私法)
- [ ] 知情权 - 部分符合
- [ ] 删除权 - 不符合
- [ ] 退出销售 - 不适用 (非销售用途)

### Apple App Store 审核指南
- [ ] 数据收集透明度 - 符合
- [ ] 权限使用说明 - 符合
- [ ] 最小权限原则 - 符合

---

## 总结

Phase 5 代码整体质量良好，权限管理、网络认证、错误处理等方面都遵循了安全最佳实践。但存在几个需要立即修复的安全问题：

1. **开发环境使用 HTTP** - 这是最严重的问题，必须在发布前修复
2. **Token 刷新机制** - 需要与 APIClient 集成
3. **数据加密** - 敏感数据应该加密存储
4. **隐私合规** - 需要添加用户数据删除功能

建议按照修复优先级逐项解决，确保应用在上线前达到安全标准。

---

*报告生成时间: 2026-02-26*
*审查者: Claude Code 安全专家*
