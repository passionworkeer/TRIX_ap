# Phase 6H Payment System Architecture

## Service Layer Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Service Layer                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐ │
│  │ StoreKitService  │  │ PaymentService   │  │ PointsService  │ │
│  ├──────────────────┤  ├──────────────────┤  ├────────────────┤ │
│  │ • Load Products  │──▶• Purchase Points │──▶• Update Balance│ │
│  │ • Process Purchse│  │ • Subscribe      │  │ • Track History│ │
│  │ • Verify Receipt │  │ • Verify Receipt │  │ • Sync Points  │ │
│  │ • Track Subscrip │  │ • Manage Orders  │  │ • Calc Rewards │ │
│  │ • Listen Updates │  │ • Handle Errors  │  │ • Cache Data   │ │
│  └──────────────────┘  └──────────────────┘  └────────────────┘ │
│           │                     │                     │         │
└───────────┼─────────────────────┼─────────────────────┼─────────┘
            │                     │                     │
            ▼                     ▼                     ▼
      ┌──────────┐          ┌──────────┐         ┌──────────┐
      │ App Store│          │  Backend │         │   Cache  │
      │   (SK2)  │          │   API    │         │(UserDef) │
      └──────────┘          └──────────┘         └──────────┘
```

## View Layer Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          View Layer                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                      StoreView                            │  │
│  │  ┌────────────────────┐  ┌────────────────────────────┐  │  │
│  │  │   Points Tab       │  │   Premium Tab              │  │  │
│  │  │  • Balance Card    │  │  • Premium Banner          │  │  │
│  │  │  • Products Grid   │  │  • Subscription Cards      │  │  │
│  │  │  • Info Section    │  │  • Benefits Section        │  │  │
│  │  └────────────────────┘  └────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           │                                     │
│              ┌────────────┼────────────┐                       │
│              ▼            ▼            ▼                       │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐          │
│  │ProductDetail │ │PointsPurchase│ │ Subscription │          │
│  │     View     │ │     View     │ │     View     │          │
│  │              │ │              │ │              │          │
│  │ • Icon       │ │ • Packages   │ │ • Plans      │          │
│  │ • Info       │ │ • Grid 2x2   │ │ • Benefits   │          │
│  │ • Features   │ │ • Bonus      │ │ • Terms      │          │
│  │ • Purchase   │ │ • Terms      │ │ • Restore    │          │
│  └──────────────┘ └──────────────┘ └──────────────┘          │
│              │            │            │                       │
│              └────────────┼────────────┘                       │
│                           ▼                                     │
│                  ┌──────────────────┐                          │
│                  │ PaymentResultView│                          │
│                  │                  │                          │
│                  │ • Success/Fail   │                          │
│                  │ • Order Details  │                          │
│                  │ • Points Added   │                          │
│                  └──────────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow Diagram

```
User Action            View               ViewModel          Service
    │                   │                    │                  │
    │──Select Product──▶│                    │                  │
    │                   │──Show Details─────▶│                  │
    │                   │                    │                  │
    │──Tap Purchase────▶│                    │                  │
    │                   │──Purchase()───────▶│                  │
    │                   │                    │──Purchase()─────▶│
    │                   │                    │                  │──▶ App Store
    │                   │                    │                  │◀──Transaction
    │                   │                    │                  │
    │                   │                    │                  │──▶ Backend API
    │                   │                    │                  │◀──Verified
    │                   │                    │◀──Result─────────│
    │                   │◀──Update State─────│                  │
    │                   │                    │                  │
    │                   │──Show Result───────│                  │
    │◀──Show Result─────│                    │                  │
```

## Product Configuration

### Subscription Products

**Monthly Premium - ¥12/月**
```
Product ID: com.trix3d.subscription.monthly
Type: Auto-Renewable Subscription
Duration: 1 Month
Price: ¥12 CNY
```

**Yearly Premium - ¥98/年 (Save 18%)**
```
Product ID: com.trix3d.subscription.yearly
Type: Auto-Renewable Subscription
Duration: 1 Year
Price: ¥98 CNY
```

### Points Products

**100 Points - ¥6**
```
Product ID: com.trix3d.points.100
Type: Consumable
Points: 100 (No Bonus)
Price: ¥6 CNY
```

**330 Points - ¥18 (Bonus +30)**
```
Product ID: com.trix3d.points.300
Type: Consumable
Points: 300 + 30 = 330 Total
Price: ¥18 CNY (18.3 pts/¥)
```

**580 Points - ¥28 (Bonus +80) ⭐ Popular**
```
Product ID: com.trix3d.points.500
Type: Consumable
Points: 500 + 80 = 580 Total
Price: ¥28 CNY (20.7 pts/¥)
```

**1200 Points - ¥50 (Bonus +200) ⭐ Best Value**
```
Product ID: com.trix3d.points.1000
Type: Consumable
Points: 1000 + 200 = 1200 Total
Price: ¥50 CNY (24.0 pts/¥)
```

## File Structure

```
ios/TRIX3DCompanion/
├── Core/Services/
│   ├── StoreKitServiceProtocol.swift       [254 lines]
│   ├── StoreKitService.swift               [450 lines]
│   ├── PaymentServiceProtocol.swift        [232 lines]
│   ├── PaymentService.swift                [487 lines]
│   ├── PointsServiceProtocol.swift         [246 lines]
│   └── PointsService.swift                 [476 lines]
│
├── Features/Store/
│   ├── ViewModels/
│   │   ├── StoreViewModel.swift            [292 lines]
│   │   ├── ProductViewModel.swift          [394 lines]
│   │   └── PaymentViewModel.swift          [412 lines]
│   │
│   └── Views/
│       ├── StoreView.swift                 [515 lines]
│       ├── ProductDetailView.swift         [379 lines]
│       ├── PointsPurchaseView.swift        [406 lines]
│       ├── SubscriptionView.swift          [502 lines]
│       └── PaymentResultView.swift         [262 lines]
│
└── Shared/Extensions/
    └── ColorGradientExtension.swift        [104 lines]

Total: 15 files, 5,411 lines of code
```

## Integration Points

### 1. App Entry
```swift
// Add to MainTabView.swift
Tab {
    StoreView()
        .tabItem {
            Image(systemName: "cart.fill")
            Text("Store")
        }
}
```

### 2. Backend API Endpoints
```
POST /payment/verify          - Verify purchase receipt
GET  /payment/orders          - Get order history
GET  /payment/orders/:id      - Get order details
POST /payment/orders/:id/cancel - Cancel order
POST /points/add              - Add points
POST /points/deduct           - Deduct points
```

### 3. App Store Connect
- Create 6 In-App Purchases (2 subscriptions + 4 consumables)
- Configure subscription group
- Set pricing and descriptions
- Submit for review

## Testing Checklist

- [ ] Products load correctly
- [ ] Purchase flow completes
- [ ] Receipt validation works
- [ ] Points balance updates
- [ ] Subscription status tracks
- [ ] Order history displays
- [ ] Error handling works
- [ ] Restore purchases works

## Production Deployment

1. Replace placeholder API endpoints
2. Configure real StoreKit products
3. Set up backend receipt validation
4. Enable production environment
5. Monitor transaction processing
6. Set up analytics tracking
