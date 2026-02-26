# Phase 6H Payment System - Integration Guide

## Quick Start

### 1. Add Store Feature to App

Add the Store tab to your main tab view:

```swift
// In MainTabView.swift
Tab {
    StoreView()
        .tabItem {
            Image(systemName: "cart.fill")
            Text("Store")
        }
}
```

### 2. Configure StoreKit (Testing)

Create a StoreKit Configuration File:

1. File → New → File
2. Select "StoreKit Configuration File"
3. Name it "Products.storekit"
4. Add products:

**Subscriptions:**
- Product ID: `com.trix3d.subscription.monthly`
- Reference Name: Monthly Premium
- Subscription Duration: 1 Month
- Price: ¥12

- Product ID: `com.trix3d.subscription.yearly`
- Reference Name: Yearly Premium
- Subscription Duration: 1 Year
- Price: ¥98

**Consumables:**
- Product ID: `com.trix3d.points.100`
- Reference Name: 100 Points
- Price: ¥6

- Product ID: `com.trix3d.points.300`
- Reference Name: 330 Points (with bonus)
- Price: ¥18

- Product ID: `com.trix3d.points.500`
- Reference Name: 580 Points (with bonus)
- Price: ¥28

- Product ID: `com.trix3d.points.1000`
- Reference Name: 1200 Points (with bonus)
- Price: ¥50

### 3. Enable StoreKit in Scheme

1. Product → Scheme → Edit Scheme
2. Select "Run" → "Options"
3. Set "StoreKit Configuration" to "Products.storekit"

### 4. Test Purchases

Run the app and test:
- [ ] View products in store
- [ ] Purchase points package
- [ ] Subscribe to premium
- [ ] Restore purchases
- [ ] Check subscription status

## Architecture Overview

### Service Layer

```
StoreKitService (StoreKit 2)
    ↓ handles purchases
PaymentService (Payment Management)
    ↓ manages orders
PointsService (Points Management)
    ↓ updates balance
```

### View Layer

```
StoreView (Main Store)
    ├── PointsPurchaseView (Buy Points)
    ├── SubscriptionView (Subscribe)
    ├── ProductDetailView (Product Info)
    └── PaymentResultView (Result)
```

### Data Flow

```
1. User selects product
2. ProductDetailView shows details
3. User taps "Purchase"
4. PaymentViewModel initiates payment
5. StoreKitService processes with Apple
6. PaymentService verifies with backend
7. PointsService updates balance
8. PaymentResultView shows result
```

## Configuration Checklist

### App Store Connect
- [ ] Create app ID
- [ ] Create In-App Purchases
- [ ] Configure subscription groups
- [ ] Set pricing
- [ ] Add descriptions
- [ ] Submit for review

### Backend API
- [ ] `/payment/verify` - Verify receipts
- [ ] `/payment/orders` - Get order history
- [ ] `/payment/orders/:id` - Get order details
- [ ] `/payment/orders/:id/cancel` - Cancel order
- [ ] `/points/add` - Add points
- [ ] `/points/deduct` - Deduct points

### App Configuration
- [ ] Add StoreKit configuration file
- [ ] Enable In-App Purchase capability
- [ ] Configure product IDs in StoreProductConfiguration
- [ ] Set up backend URL in APIBaseURL

## Testing Scenarios

### Points Purchase Flow
1. Open Store → Points tab
2. View available packages
3. Select a package
4. View product details
5. Tap "Purchase Now"
6. Confirm purchase
7. Verify points added
8. Check transaction history

### Subscription Flow
1. Open Store → Premium tab
2. View subscription benefits
3. Select a plan
4. View plan details
5. Tap "Subscribe"
6. Confirm subscription
7. Verify premium status
8. Check renewal date

### Edge Cases
- Network error during purchase
- User cancels purchase
- Purchase pending
- Receipt verification fails
- Insufficient balance for redemption
- Restore previous purchases

## Troubleshooting

### Products Not Loading
- Check StoreKit configuration file
- Verify product IDs match
- Check network connection
- Review console logs

### Purchase Fails
- Check Sandbox account
- Verify product configuration
- Check receipt validation
- Review error messages

### Subscription Not Updating
- Check subscription status
- Verify receipt validation
- Check expiration date
- Review renewal settings

## Performance Tips

1. **Cache Products**: Products are cached automatically
2. **Lazy Loading**: Views use LazyVGrid for performance
3. **Background Sync**: Points sync every 5 minutes
4. **Efficient Updates**: Only update when needed

## Security Notes

1. **Receipt Validation**: Always validate server-side
2. **Transaction Verification**: Verify all transactions
3. **Secure Storage**: Tokens in Keychain
4. **No Hardcoded Secrets**: Use configuration

## Monitoring & Analytics

Track these metrics:
- Purchase conversion rate
- Points purchase distribution
- Subscription conversion rate
- Subscription retention rate
- Revenue per user
- Average order value

## Support

For issues or questions:
1. Check this guide
2. Review implementation summary
3. Check console logs
4. Contact development team

---

**Phase 6H Payment System is ready for integration!**
