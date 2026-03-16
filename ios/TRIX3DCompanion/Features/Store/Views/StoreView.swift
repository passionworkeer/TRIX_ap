//
//  StoreView.swift
//  TRIX3DCompanion
//
//  Points Store main view with native iOS design
//

import SwiftUI

// MARK: - Localization Helper

/// Helper for localizing strings in SwiftUI views
private func L(_ key: String) -> String {
    NSLocalizedString(key, comment: "")
}

// MARK: - Store View

/// Main store view showing products and subscription options with native iOS design
struct StoreView: View {

    // MARK: - State

    @StateObject private var viewModel = StoreViewModel()
    @State private var selectedTab: StoreTab = .points
    @State private var selectedProduct: StoreProduct?
    @State private var showProductDetail = false
    @State private var showSubscription = false

    // MARK: - Tabs

    enum StoreTab: String, CaseIterable {
        case points = "积分"
        case subscription = "高级版"

        var icon: String {
            switch self {
            case .points:
                return "star.fill"
            case .subscription:
                return "crown.fill"
            }
        }
    }

    // MARK: - Body

    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Content
                ScrollView {
                    VStack(spacing: 24) {
                        // Points Balance Card
                        pointsBalanceCard
                            .padding(.horizontal)
                            .padding(.top, 16)

                        // Tab Picker
                        tabPicker
                            .padding(.horizontal)

                        // Products based on selected tab
                        switch selectedTab {
                        case .points:
                            pointsProductsSection
                        case .subscription:
                            subscriptionProductsSection
                        }

                        // Info Section
                        infoSection
                            .padding(.horizontal)
                    }
                }
                .background(Color(.systemGroupedBackground))
            }
            .navigationTitle(L("store.title"))
            .navigationBarTitleDisplayMode(.large)
            .refreshable {
                await viewModel.refreshPoints()
            }
            .sheet(isPresented: $showProductDetail) {
                if let product = selectedProduct {
                    ProductDetailView(product: product)
                }
            }
            .sheet(isPresented: $showSubscription) {
                SubscriptionView()
            }
            .alert(L("error.unknown"), isPresented: .constant(viewModel.errorMessage != nil)) {
                Button(L("action.confirm")) {
                    viewModel.clearError()
                }
            } message: {
                if let error = viewModel.errorMessage {
                    Text(error)
                }
            }
        }
    }

    // MARK: - View Components

    /// Points balance card with native iOS style
    private var pointsBalanceCard: some View {
        VStack(spacing: 12) {
            HStack {
                Image(systemName: "star.fill")
                    .font(.title2)
                    .foregroundStyle(.orange)

                Text(L("store.points"))
                    .font(.headline)

                Spacer()

                // Refresh button
                Button {
                    Task {
                        await viewModel.refreshPoints()
                    }
                } label: {
                    Image(systemName: "arrow.clockwise")
                        .font(.body)
                        .foregroundStyle(.blue)
                }
            }

            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(viewModel.formatPoints(viewModel.userPoints))
                    .font(.system(size: 48, weight: .bold, design: .rounded))

                Text(L("store.points"))
                    .font(.title3)
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    /// Tab picker
    private var tabPicker: some View {
        Picker("", selection: $selectedTab) {
            ForEach(StoreTab.allCases, id: \.self) { tab in
                Text(tab.rawValue).tag(tab)
            }
        }
        .pickerStyle(.segmented)
    }

    /// Points products section
    private var pointsProductsSection: some View {
        VStack(spacing: 16) {
            ForEach(viewModel.pointsProducts) { product in
                ProductCard(product: product) {
                    selectedProduct = product
                    showProductDetail = true
                }
            }
        }
        .padding(.horizontal)
    }

    /// Subscription products section
    private var subscriptionProductsSection: some View {
        VStack(spacing: 16) {
            // Premium banner
            premiumBanner

            ForEach(viewModel.subscriptionProducts) { product in
                SubscriptionCard(product: product) {
                    showSubscription = true
                }
            }
        }
        .padding(.horizontal)
    }

    /// Premium banner with native iOS style
    private var premiumBanner: some View {
        VStack(spacing: 12) {
            Image(systemName: "crown.fill")
                .font(.system(size: 48))
                .foregroundStyle(.yellow)

            Text("开通高级版")
                .font(.title2)
                .fontWeight(.bold)

            Text("解锁全部功能，移除广告")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            if viewModel.hasActiveSubscription {
                VStack(spacing: 4) {
                    HStack {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundStyle(.green)
                        Text("已订阅")
                            .font(.subheadline)
                            .foregroundStyle(.green)
                    }

                    if let expiryDate = viewModel.subscriptionExpiryDate {
                        Text("有效期至 \(expiryDate, style: .date)")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                .padding()
                .background(Color.green.opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: 12))
            }
        }
        .padding()
        .frame(maxWidth: .infinity)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    /// Info section
    private var infoSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("关于积分")
                .font(.headline)

            VStack(alignment: .leading, spacing: 8) {
                InfoRow(icon: "star.fill", title: "获取积分", description: "完成学习任务获取积分")
                InfoRow(icon: "gift.fill", title: "获取奖励", description: "每日登录和连续学习获得额外积分")
                InfoRow(icon: "cart.fill", title: "消费积分", description: "使用积分解锁高级内容")
            }
        }
        .padding()
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }
}

// MARK: - Product Card

/// Product card component with native iOS style
struct ProductCard: View {
    let product: StoreProduct
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 16) {
                // Icon
                Image(systemName: "star.circle.fill")
                    .font(.system(size: 48))
                    .foregroundStyle(.orange)

                VStack(alignment: .leading, spacing: 4) {
                    // Product name
                    Text(product.name)
                        .font(.headline)

                    // Product description
                    Text(product.description)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)

                    // Bonus badge
                    if let bonus = bonusPoints {
                        Text("赠送 +\(bonus) 积分")
                            .font(.caption)
                            .foregroundStyle(.white)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Capsule().fill(Color.orange))
                    }
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 4) {
                    // Price
                    Text(product.price)
                        .font(.title3)
                        .fontWeight(.bold)
                        .foregroundStyle(.blue)

                    // Points amount
                    if let points = product.points {
                        Text("\(points) 积分")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }

                    // Best value badge
                    if isBestValue {
                        Text("超值")
                            .font(.caption)
                            .foregroundStyle(.white)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Capsule().fill(Color.green))
                    }
                }
            }
            .padding()
            .background(Color(.secondarySystemGroupedBackground))
            .clipShape(RoundedRectangle(cornerRadius: 16))
        }
        .buttonStyle(.plain)
    }

    private var bonusPoints: Int? {
        switch product.id {
        case StoreProductConfiguration.points300:
            return 30
        case StoreProductConfiguration.points500:
            return 80
        case StoreProductConfiguration.points1000:
            return 200
        default:
            return nil
        }
    }

    private var isBestValue: Bool {
        product.id == StoreProductConfiguration.points1000
    }
}

// MARK: - Subscription Card

/// Subscription card component with native iOS style
struct SubscriptionCard: View {
    let product: StoreProduct
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 16) {
                // Icon
                Image(systemName: "crown.fill")
                    .font(.system(size: 48))
                    .foregroundStyle(.yellow)

                VStack(alignment: .leading, spacing: 4) {
                    // Product name
                    Text(product.name)
                        .font(.headline)

                    // Period
                    if let period = product.subscriptionPeriod {
                        Text(period.localizedDescription)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }

                    // Features
                    Text("全部功能 • 无广告 • 优先支持")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 4) {
                    // Price
                    Text(product.price)
                        .font(.title3)
                        .fontWeight(.bold)
                        .foregroundStyle(.blue)

                    // Per period
                    if let period = product.subscriptionPeriod {
                        Text(period.unit == .year ? "/年" : "/月")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }

                    // Popular badge
                    if isPopular {
                        Text("热门")
                            .font(.caption)
                            .foregroundStyle(.white)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Capsule().fill(Color.blue))
                    }
                }
            }
            .padding()
            .background(Color(.secondarySystemGroupedBackground))
            .clipShape(RoundedRectangle(cornerRadius: 16))
        }
        .buttonStyle(.plain)
    }

    private var isPopular: Bool {
        product.id == StoreProductConfiguration.monthlySubscription
    }
}

// MARK: - Info Row

/// Info row component with native iOS style
struct InfoRow: View {
    let icon: String
    let title: String
    let description: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundStyle(.blue)
                .frame(width: 32)

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline)
                    .fontWeight(.medium)

                Text(description)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()
        }
    }
}

// MARK: - Preview

#Preview {
    StoreView()
}
