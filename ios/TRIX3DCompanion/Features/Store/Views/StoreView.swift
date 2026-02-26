//
//  StoreView.swift
//  TRIX3DCompanion
//
//  Points Store main view - product listings and navigation
//

import SwiftUI

// MARK: - Store View

/// Main store view showing products and subscription options
struct StoreView: View {

    // MARK: - State

    @StateObject private var viewModel = StoreViewModel()
    @State private var selectedTab: StoreTab = .points
    @State private var selectedProduct: StoreProduct?
    @State private var showProductDetail = false
    @State private var showSubscription = false

    // MARK: - Tabs

    enum StoreTab: String, CaseIterable {
        case points = "Points"
        case subscription = "Premium"

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
                            .padding(.bottom, 100)
                    }
                }
                .background(Color(UIColor.systemGroupedBackground))
            }
            .navigationTitle("Store")
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
            .alert("Error", isPresented: .constant(viewModel.errorMessage != nil)) {
                Button("OK") {
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

    /// Points balance card
    private var pointsBalanceCard: some View {
        VStack(spacing: 12) {
            HStack {
                Image(systemName: "star.fill")
                    .font(.title2)
                    .foregroundColor(.yellow)

                Text("My Points")
                    .font(.headline)
                    .foregroundColor(.primary)

                Spacer()

                // Refresh button
                Button {
                    Task {
                        await viewModel.refreshPoints()
                    }
                } label: {
                    Image(systemName: "arrow.clockwise")
                        .font(.body)
                        .foregroundColor(.blue)
                }
            }

            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(viewModel.formatPoints(viewModel.userPoints))
                    .font(.system(size: 48, weight: .bold, design: .rounded))
                    .foregroundColor(.primary)

                Text("points")
                    .font(.title3)
                    .foregroundColor(.secondary)
            }

            // Level progress
            if let balance = viewModel.balance {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("Level \(balance.level)")
                            .font(.subheadline)
                            .foregroundColor(.secondary)

                        Spacer()

                        Text("\(Int(balance.progressToNextLevel() * 100))%")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }

                    ProgressView(value: balance.progressToNextLevel())
                        .tint(.blue)

                    Text("\(balance.pointsForNextLevel()) points to next level")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color(UIColor.secondarySystemGroupedBackground))
        )
        .overlay {
            RoundedRectangle(cornerRadius: 16)
                .stroke(Color(UIColor.separator), lineWidth: 0.5)
        }
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

    /// Premium banner
    private var premiumBanner: some View {
        VStack(spacing: 12) {
            Image(systemName: "crown.fill")
                .font(.system(size: 48))
                .foregroundGradient(
                    colors: [.yellow, .orange],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )

            Text("Go Premium")
                .font(.title2)
                .fontWeight(.bold)

            Text("Unlock all features and remove ads")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)

            if viewModel.hasActiveSubscription {
                VStack(spacing: 4) {
                    HStack {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(.green)
                        Text("Active Subscription")
                            .font(.subheadline)
                            .foregroundColor(.green)
                    }

                    if let expiryDate = viewModel.subscriptionExpiryDate {
                        Text("Renews \(expiryDate, style: .date)")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
                .padding()
                .background(
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color.green.opacity(0.1))
                )
            }
        }
        .padding()
        .frame(maxWidth: .infinity)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(
                    LinearGradient(
                        colors: [Color.yellow.opacity(0.2), Color.orange.opacity(0.2)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
        )
        .overlay {
            RoundedRectangle(cornerRadius: 16)
                .stroke(Color.orange.opacity(0.3), lineWidth: 1)
        }
    }

    /// Info section
    private var infoSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("About Points")
                .font(.headline)
                .foregroundColor(.primary)

            VStack(alignment: .leading, spacing: 8) {
                InfoRow(icon: "star.fill", title: "Earn Points", description: "Complete study sessions to earn points")
                InfoRow(icon: "gift.fill", title: "Get Bonuses", description: "Daily login and streaks reward extra points")
                InfoRow(icon: "cart.fill", title: "Spend Points", description: "Use points to unlock premium content")
            }
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color(UIColor.secondarySystemGroupedBackground))
        )
        .overlay {
            RoundedRectangle(cornerRadius: 16)
                .stroke(Color(UIColor.separator), lineWidth: 0.5)
        }
    }
}

// MARK: - Product Card

/// Product card component
struct ProductCard: View {
    let product: StoreProduct
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 16) {
                // Icon
                Image(systemName: "star.circle.fill")
                    .font(.system(size: 48))
                    .foregroundColor(.yellow)

                VStack(alignment: .leading, spacing: 4) {
                    // Product name
                    Text(product.name)
                        .font(.headline)
                        .foregroundColor(.primary)

                    // Product description
                    Text(product.description)
                        .font(.subheadline)
                        .foregroundColor(.secondary)

                    // Bonus badge
                    if let bonus = bonusPoints {
                        Text("Bonus +\(bonus) points")
                            .font(.caption)
                            .foregroundColor(.white)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(
                                Capsule()
                                    .fill(Color.orange)
                            )
                    }
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 4) {
                    // Price
                    Text(product.price)
                        .font(.title3)
                        .fontWeight(.bold)
                        .foregroundColor(.blue)

                    // Points amount
                    if let points = product.points {
                        Text("\(points) pts")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }

                    // Best value badge
                    if isBestValue {
                        Text("Best Value")
                            .font(.caption)
                            .foregroundColor(.white)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(
                                Capsule()
                                    .fill(Color.green)
                            )
                    }
                }
            }
            .padding()
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color(UIColor.secondarySystemGroupedBackground))
            )
            .overlay {
                RoundedRectangle(cornerRadius: 16)
                    .stroke(Color(UIColor.separator), lineWidth: 0.5)
            }
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

/// Subscription card component
struct SubscriptionCard: View {
    let product: StoreProduct
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 16) {
                // Icon
                Image(systemName: "crown.fill")
                    .font(.system(size: 48))
                    .foregroundGradient(
                        colors: [.yellow, .orange],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )

                VStack(alignment: .leading, spacing: 4) {
                    // Product name
                    Text(product.name)
                        .font(.headline)
                        .foregroundColor(.primary)

                    // Period
                    if let period = product.subscriptionPeriod {
                        Text(period.localizedDescription)
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }

                    // Features
                    Text("Full access • Ad-free • Priority support")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 4) {
                    // Price
                    Text(product.price)
                        .font(.title3)
                        .fontWeight(.bold)
                        .foregroundColor(.blue)

                    // Per period
                    if let period = product.subscriptionPeriod {
                        Text(period.unit == .year ? "/year" : "/month")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }

                    // Popular badge
                    if isPopular {
                        Text("Popular")
                            .font(.caption)
                            .foregroundColor(.white)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(
                                Capsule()
                                    .fill(Color.blue)
                            )
                    }
                }
            }
            .padding()
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color(UIColor.secondarySystemGroupedBackground))
            )
            .overlay {
                RoundedRectangle(cornerRadius: 16)
                    .stroke(Color.blue.opacity(0.3), lineWidth: 1)
            }
        }
        .buttonStyle(.plain)
    }

    private var isPopular: Bool {
        product.id == StoreProductConfiguration.monthlySubscription
    }
}

// MARK: - Info Row

/// Info row component
struct InfoRow: View {
    let icon: String
    let title: String
    let description: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundColor(.blue)
                .frame(width: 32)

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline)
                    .fontWeight(.medium)

                Text(description)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Spacer()
        }
    }
}

// MARK: - Preview

#Preview {
    StoreView()
}
