# iOS 架构

## 正式链路

```text
SwiftUI Views
   ▼
ClawbotChannelViewModel
   ▼
ClawbotChannelService
   ├─ claim pairing
   ├─ user websocket
   ├─ messages
   └─ uploads
        ▼
    https://trix.love
```

## 当前保留的核心文件

- `ios/TRIX3DCompanion/App/ClawbotChannelViewModel.swift`
- `ios/TRIX3DCompanion/Core/Services/ClawbotChannelService.swift`
- `ios/TRIX3DCompanion/Features/Pairing/Views/PairingView.swift`
- `ios/TRIX3DCompanion/Features/Pairing/Views/QRScannerView.swift`

## 已删除的旧方案

- 旧 relay 客户端
- 旧独立配对服务
- 旧 Gateway 私有协议层
- token-only pairing
- 旧私有二维码格式

## 配对格式

iOS 现在只接受：

- `https://trix.love/pair?...`
- JSON `claimUrl/url/code`
- `CODE:SECRET`
- 纯配对码
