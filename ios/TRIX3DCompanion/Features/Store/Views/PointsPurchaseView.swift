//
//  PointsPurchaseView.swift
//  TRIX3DCompanion
//
//  Points purchase view - shows points packages and purchase options
//

import SwiftUI

// MARK: - Localization Helper

/// Helper for localizing strings in SwiftUI views
private func L(_ key: String) -> String {
    NSLocalizedString(key, comment: "")
}

private func L(_ key: String, _ value: String) -> String {
    String(format: NSLocalizedString(key, comment: ""), value)
}

// MARK: - Points Purchase View

/// View for purchasing points packages
struct PointsPurchaseView: View {

    // MARK: - State

    @StateObject private var viewModel = StoreViewModel()
    @State private var selectedPackage: PointsPackage?
    @State private var showConfirmation = false
    @State private var showPaymentResult = false
    @State private var purchaseResult: PaymentResult?

    // MARK: - Environment

    @Environment(\.dismiss) private var dismiss

    // MARK: - Points Packages

    struct PointsPackage: Identifiable, Equatable {
        let id = UUID()
        let productId: String
        let points: Int
        let bonus: Int?
        let price: Double
        let isPopular: Bool
        let isBestValue: Bool

        var totalPoints: Int {
            points + (bonus ?? 0)
        }

        var displayPrice: String {
            String(format: "¥%.0f", price)
        }

        static var allPackages: [PointsPackage] {
            [
                PointsPackage(
                    productId: StoreProductConfiguration.points100,
                    points: 100,
                    bonus: nil,
                    price: 6,
                    isPopular: false,
                    isBestValue: false
                ),
                PointsPackage(
                    productId: StoreProductConfiguration.points300,
                    points: 300,
                    bonus: 30,
                    price: 18,
                    isPopular: false,
                    isBestValue: false
                ),
                PointsPackage(
                    productId: StoreProductConfiguration.points500,
                    points: 500,
                    bonus: 80,
                    price: 28,
                    isPopular: true,
                    isBestValue: false
                ),
                PointsPackage(
                    productId: StoreProductConfiguration.points1000,
                    points: 1000,
                    bonus: 200,
                    price: 50,
                    isPopular: false,
                    isBestValue: true
                )
            ]
        }
    }

    // MARK: - Body

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    // Header
                    headerSection
                        .padding(.horizontal)
                        .padding(.top, 16)

                    // Current Balance
                    balanceCard
                        .padding(.horizontal)

                    // Packages Grid
                    packagesGrid
                        .padding(.horizontal)

                    // Terms and Info
                    termsSection
                        .padding(.horizontal)
                        .padding(.bottom, 20)
                }
            }
            .background(Color(UIColor.systemGroupedBackground))
            .navigationTitle(L("store.points.buy"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button(L("action.close")) {
                        dismiss()
                    }
                }
            }
            .confirmationDialog(
                L("store.points.confirm.purchase"),
                isPresented: $showConfirmation,
                presenting: selectedPackage
            ) { package in
                Button("Purchase \(package.totalPoints) points for \(package.displayPrice)?") {
                    Task {
                        await purchasePackage(package)
                    }
                }
                Button(L("action.cancel"), role: .cancel) {}
            } message: { package in
                Text(String(format: L("store.points.charged"), package.displayPrice, package.totalPoints))
            }
            .sheet(isPresented: $showPaymentResult) {
                if let result = purchaseResult {
                    PaymentResultView(
                        isSuccess: isSuccess(result),
                        productName: "Points",
                        points: selectedPackage?.totalPoints,
                        order: extractOrder(from: result)
                    )
                }
            }
        }
    }

    // MARK: - View Components

    /// Header section
    private var headerSection: some View {
        VStack(spacing: 8) {
            Image(systemName: "star.circle.fill")
                .font(.system(size: 48))
                .foregroundGradient(
                    colors: [.yellow, .orange],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )

            Text(L("store.points.purchase"))
                .font(.title2)
                .fontWeight(.bold)

            Text(L("store.points.choose.package"))
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
    }

    /// Balance card
    private var balanceCard: some View {
        HStack {
            Image(systemName: "star.fill")
                .font(.title2)
                .foregroundColor(.orange)

            VStack(alignment: .leading, spacing: 4) {
                Text(L("store.points.current.balance"))
                    .font(.subheadline)
                    .foregroundColor(.secondary)

                Text("\(viewModel.userPoints) " + L("store.points"))
                    .font(.headline)
            }

            Spacer()

            Button(L("store.points.refresh")) {
                Task {
                    await viewModel.refreshPoints()
                }
            }
            .font(.subheadline)
            .foregroundColor(.blue)
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(UIColor.secondarySystemGroupedBackground))
        )
        .overlay {
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color(UIColor.separator), lineWidth: 0.5)
        }
    }

    /// Packages grid
    private var packagesGrid: some View {
        LazyVGrid(columns: [
            GridItem(.flexible(), spacing: 12),
            GridItem(.flexible(), spacing: 12)
        ], spacing: 16) {
            ForEach(PointsPackage.allPackages) { package in
                PackageCard(
                    package: package,
                    isSelected: selectedPackage?.id == package.id
                ) {
                    selectedPackage = package
                    showConfirmation = true
                }
            }
        }
    }

    /// Terms section
    private var termsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(L("store.points.information"))
                .font(.headline)
                .foregroundColor(.primary)

            VStack(alignment: .leading, spacing: 8) {
                InfoItem(icon: "checkmark.circle.fill", text: L("store.points.info.instant"))
                InfoItem(icon: "checkmark.circle.fill", text: L("store.points.info.no.expire"))
                InfoItem(icon: "checkmark.circle.fill", text: L("store.points.info.secure"))
                InfoItem(icon: "info.circle.fill", text: L("store.points.info.no.refund"))
            }
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(UIColor.secondarySystemGroupedBackground))
        )
        .overlay {
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color(UIColor.separator), lineWidth: 0.5)
        }
    }

    // MARK: - Methods

    /// Purchase selected package
    /// - Parameter package: Package to purchase
    private func purchasePackage(_ package: PointsPackage) async {
        let result = await PaymentService.shared.purchasePoints(
            productId: package.productId,
            points: package.totalPoints
        )

        purchaseResult = result
        showPaymentResult = true
    }

    /// Check if result is success
    private func isSuccess(_ result: PaymentResult) -> Bool {
        if case .success = result {
            return true
        }
        return false
    }

    /// Extract order from result
    private func extractOrder(from result: PaymentResult) -> AppOrder? {
        if case .success(let order) = result {
            return order
        }
        return nil
    }
}

// MARK: - Package Card

/// Points package card component
struct PackageCard: View {
    let package: PointsPurchaseView.PointsPackage
    let isSelected: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(spacing: 12) {
                // PointsBadges
                HStack {
                    Spacer()

                    if package.isPopular {
                        PointsBadge(text: L("store.popular"), color: .blue)
                    }

                    if package.isBestValue {
                        PointsBadge(text: L("store.best.value"), color: .green)
                    }
                }

                // Points amount
                VStack(spacing: 4) {
                    Text("\(package.totalPoints)")
                        .font(.system(size: 32, weight: .bold, design: .rounded))
                        .foregroundColor(.primary)

                    Text(L("store.points"))
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }

                // Bonus indicator
                if let bonus = package.bonus {
                    HStack(spacing: 4) {
                        Image(systemName: "gift.fill")
                            .font(.caption)
                        Text("+\(bonus) bonus")
                            .font(.caption)
                    }
                    .foregroundColor(.orange)
                }

                // Divider
                Rectangle()
                    .fill(Color(UIColor.separator))
                    .frame(height: 1)

                // Price
                Text(package.displayPrice)
                    .font(.title3)
                    .fontWeight(.bold)
                    .foregroundColor(.blue)

                // Points per yuan
                Text(String(format: L("store.points.per.yuan"), Double(package.totalPoints) / package.price))
                    .font(.caption)
                        .foregroundColor(.secondary)
            }
            .padding()
            .frame(height: 180)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color(UIColor.secondarySystemGroupedBackground))
            )
            .overlay {
                RoundedRectangle(cornerRadius: 16)
                    .stroke(isSelected ? Color.blue : Color(UIColor.separator), lineWidth: isSelected ? 2 : 0.5)
            }
            .shadow(color: .black.opacity(isSelected ? 0.1 : 0), radius: isSelected ? 8 : 0)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - PointsBadge

/// PointsBadge component
struct PointsBadge: View {
    let text: String
    let color: Color

    var body: some View {
        Text(text)
            .font(.caption)
            .fontWeight(.semibold)
            .foregroundColor(.white)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(
                Capsule()
                    .fill(color)
            )
    }
}

// MARK: - Info Item

/// Info item component
struct InfoItem: View {
    let icon: String
    let text: String

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .font(.caption)
                .foregroundColor(.blue)
                .frame(width: 16)

            Text(text)
                .font(.caption)
                .foregroundColor(.secondary)

            Spacer()
        }
    }
}

// MARK: - Preview

#Preview {
    PointsPurchaseView()
}
