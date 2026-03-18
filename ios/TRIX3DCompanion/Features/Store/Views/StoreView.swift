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
        case points
        case subscription

        var icon: String {
            switch self {
            case .points:
                return "star.fill"
            case .subscription:
                return "crown.fill"
            }
        }

        var title: String {
            switch self {
            case .points:
                return L("store.tab.points")
            case .subscription:
                return L("store.tab.subscription")
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
                        if viewModel.isLoadingProducts {
                            loadingView
                        } else {
                            switch selectedTab {
                            case .points:
                                pointsProductsSection
                            case .subscription:
                                subscriptionProductsSection
                            }
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

    /// Loading skeleton view
    private var loadingView: some View {
        VStack(spacing: 16) {
            // Points products skeleton
            ForEach(0..<3, id: \.self) { _ in
                skeletonProductCard
            }

            // Subscription section skeleton
            VStack(spacing: 12) {
                // Premium banner skeleton
                VStack(spacing: 12) {
                    Circle()
                        .fill(.gray.opacity(0.2))
                        .frame(width: 48, height: 48)
                        .shimmer(cornerRadius: 24)

                    RoundedRectangle(cornerRadius: 6)
                        .fill(.gray.opacity(0.2))
                        .frame(width: 160, height: 20)
                        .shimmer(cornerRadius: 6)

                    RoundedRectangle(cornerRadius: 6)
                        .fill(.gray.opacity(0.2))
                        .frame(width: 240, height: 14)
                        .shimmer(cornerRadius: 6)
                }
                .padding()
                .frame(maxWidth: .infinity)
                .background(Color(.secondarySystemGroupedBackground))
                .clipShape(RoundedRectangle(cornerRadius: 16))

                // Subscription cards skeleton
                ForEach(0..<2, id: \.self) { _ in
                    skeletonSubscriptionCard
                }
            }
        }
        .padding(.horizontal)
    }

    /// Skeleton for product card
    private var skeletonProductCard: some View {
        HStack(spacing: 16) {
            Circle()
                .fill(.gray.opacity(0.2))
                .frame(width: 48, height: 48)
                .shimmer(cornerRadius: 24)

            VStack(alignment: .leading, spacing: 6) {
                RoundedRectangle(cornerRadius: 6)
                    .fill(.gray.opacity(0.2))
                    .frame(width: 120, height: 16)
                    .shimmer(cornerRadius: 6)

                RoundedRectangle(cornerRadius: 6)
                    .fill(.gray.opacity(0.2))
                    .frame(width: 180, height: 14)
                    .shimmer(cornerRadius: 6)

                RoundedRectangle(cornerRadius: 6)
                    .fill(.gray.opacity(0.2))
                    .frame(width: 80, height: 12)
                    .shimmer(cornerRadius: 6)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 6) {
                RoundedRectangle(cornerRadius: 6)
                    .fill(.gray.opacity(0.2))
                    .frame(width: 50, height: 18)
                    .shimmer(cornerRadius: 6)

                RoundedRectangle(cornerRadius: 6)
                    .fill(.gray.opacity(0.2))
                    .frame(width: 70, height: 14)
                    .shimmer(cornerRadius: 6)
            }
        }
        .padding()
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    /// Skeleton for subscription card
    private var skeletonSubscriptionCard: some View {
        HStack(spacing: 16) {
            Circle()
                .fill(.gray.opacity(0.2))
                .frame(width: 48, height: 48)
                .shimmer(cornerRadius: 24)

            VStack(alignment: .leading, spacing: 6) {
                RoundedRectangle(cornerRadius: 6)
                    .fill(.gray.opacity(0.2))
                    .frame(width: 140, height: 16)
                    .shimmer(cornerRadius: 6)

                RoundedRectangle(cornerRadius: 6)
                    .fill(.gray.opacity(0.2))
                    .frame(width: 100, height: 14)
                    .shimmer(cornerRadius: 6)

                RoundedRectangle(cornerRadius: 6)
                    .fill(.gray.opacity(0.2))
                    .frame(width: 80, height: 12)
                    .shimmer(cornerRadius: 6)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 6) {
                RoundedRectangle(cornerRadius: 6)
                    .fill(.gray.opacity(0.2))
                    .frame(width: 50, height: 18)
                    .shimmer(cornerRadius: 6)

                RoundedRectangle(cornerRadius: 6)
                    .fill(.gray.opacity(0.2))
                    .frame(width: 40, height: 12)
                    .shimmer(cornerRadius: 6)
            }
        }
        .padding()
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

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
                Text(tab.title).tag(tab)
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

            Text(L("store.premium.title"))
                .font(.title2)
                .fontWeight(.bold)

            Text(L("store.premium.description"))
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            if viewModel.hasActiveSubscription {
                VStack(spacing: 4) {
                    HStack {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundStyle(.green)
                        Text(L("store.premium.subscribed"))
                            .font(.subheadline)
                            .foregroundStyle(.green)
                    }

                    if let expiryDate = viewModel.subscriptionExpiryDate {
                        Text("\(L("store.premium.expiry")) \(expiryDate, style: .date)")
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
            Text(L("store.about.title"))
                .font(.headline)

            VStack(alignment: .leading, spacing: 8) {
                InfoRow(icon: "star.fill", title: L("store.about.get.points"), description: L("store.about.get.points.desc"))
                InfoRow(icon: "gift.fill", title: L("store.about.get.reward"), description: L("store.about.get.reward.desc"))
                InfoRow(icon: "cart.fill", title: L("store.about.spend.points"), description: L("store.about.spend.points.desc"))
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
                        Text(String(format: L("store.bonus.with.points"), bonus))
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
                        Text("\(points) " + L("store.points.amount"))
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }

                    // Best value badge
                    if isBestValue {
                        Text(L("store.best.value"))
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
                    Text(L("store.all.features"))
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
                        Text(period.unit == .year ? L("store.per.year") : L("store.per.month"))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }

                    // Popular badge
                    if isPopular {
                        Text(L("store.popular"))
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
