//
//  ProductDetailView.swift
//  TRIX3DCompanion
//
//  Product detail view - shows product information and purchase button
//

import SwiftUI

// MARK: - Localization Helper

/// Helper for localizing strings in SwiftUI views
private func L(_ key: String) -> String {
    NSLocalizedString(key, comment: "")
}

// MARK: - Product Detail View

/// Detailed view for a single product with purchase option
struct ProductDetailView: View {

    // MARK: - State

    @StateObject private var viewModel: ProductViewModel
    @Environment(\.dismiss) private var dismiss

    // MARK: - Initialization

    init(product: StoreProduct) {
        _viewModel = StateObject(wrappedValue: ProductViewModel(product: product))
    }

    // MARK: - Body

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 24) {
                    // Product Icon
                    productIcon
                        .padding(.top, 20)

                    // Product Info
                    productInfo
                        .padding(.horizontal)

                    // Features List
                    if !viewModel.features.isEmpty {
                        featuresSection
                            .padding(.horizontal)
                    }

                    // Value Indicator
                    if viewModel.isOnSale {
                        saleIndicator
                            .padding(.horizontal)
                    }

                    // Warning (for subscriptions)
                    if let warning = viewModel.warningText {
                        warningCard(warning)
                            .padding(.horizontal)
                    }

                    // Purchase Button
                    purchaseButton
                        .padding(.horizontal)
                        .padding(.bottom, 20)
                }
            }
            .background(Color(UIColor.systemGroupedBackground))
            .navigationTitle(L("store.product.details"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button(L("action.close")) {
                        dismiss()
                    }
                }
            }
            .disabled(viewModel.isPurchasing)
            .overlay {
                if viewModel.isPurchasing {
                    loadingOverlay
                }
            }
            .sheet(isPresented: $viewModel.showPaymentResult) {
                PaymentResultView(
                    isSuccess: viewModel.purchaseState == .success,
                    productName: viewModel.displayName,
                    points: viewModel.pointsValue,
                    order: nil
                )
            }
        }
        .alert(L("store.error"), isPresented: .constant(viewModel.errorMessage != nil)) {
            Button(L("action.confirm")) {
                viewModel.clearError()
            }
        } message: {
            if let error = viewModel.errorMessage {
                Text(error)
            }
        }
    }

    // MARK: - View Components

    /// Product icon
    private var productIcon: some View {
        ZStack {
            Circle()
                .fill(
                    LinearGradient(
                        colors: iconGradientColors,
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: 120, height: 120)

            Image(systemName: iconName)
                .font(.system(size: 56))
                .foregroundColor(.white)
        }
    }

    /// Product information
    private var productInfo: some View {
        VStack(spacing: 12) {
            // Product name
            Text(viewModel.displayName)
                .font(.title2)
                .fontWeight(.bold)
                .multilineTextAlignment(.center)

            // Product description
            Text(viewModel.productDescription)
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)

            // Price
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(viewModel.productPrice)
                    .font(.system(size: 36, weight: .bold, design: .rounded))
                    .foregroundColor(.blue)

                if let points = viewModel.pointsValue {
                    Text(String(format: L("store.for.points"), points))
                        .font(.title3)
                        .foregroundColor(.secondary)
                }
            }

            // Benefit description
            Text(viewModel.benefitDescription)
                .font(.subheadline)
                .foregroundColor(.blue)
                .multilineTextAlignment(.center)
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

    /// Features section
    private var featuresSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(L("store.whats.included"))
                .font(.headline)
                .foregroundColor(.primary)

            VStack(alignment: .leading, spacing: 8) {
                ForEach(viewModel.features, id: \.self) { feature in
                    ProductFeatureRow(icon: "checkmark.circle.fill", text: feature)
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

    /// Sale indicator
    private var saleIndicator: some View {
        HStack(spacing: 12) {
            Image(systemName: "tag.fill")
                .font(.title2)
                .foregroundColor(.orange)

            VStack(alignment: .leading, spacing: 4) {
                Text(L("store.limited.time.offer"))
                    .font(.subheadline)
                    .fontWeight(.semibold)

                if let bonus = viewModel.bonusPoints {
                    Text(String(format: L("store.get.bonus"), bonus))
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            Spacer()

            if let value = viewModel.valuePerYuan {
                VStack(alignment: .trailing, spacing: 2) {
                    Text(String(format: L("store.points.per.yuan"), value))
                        .font(.subheadline)
                        .fontWeight(.bold)
                        .foregroundColor(.orange)

                    if viewModel.isBestValue {
                        Text(L("store.best.value"))
                            .font(.caption)
                            .foregroundColor(.green)
                    }
                }
            }
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.orange.opacity(0.1))
        )
        .overlay {
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.orange.opacity(0.3), lineWidth: 1)
        }
    }

    /// Warning card
    private func warningCard(_ message: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "info.circle.fill")
                .font(.title3)
                .foregroundColor(.blue)

            Text(message)
                .font(.caption)
                .foregroundColor(.secondary)

            Spacer()
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.blue.opacity(0.1))
        )
        .overlay {
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.blue.opacity(0.3), lineWidth: 1)
        }
    }

    /// Purchase button
    private var purchaseButton: some View {
        Button(action: {
            Task {
                await viewModel.purchase()
            }
        }) {
            HStack {
                if viewModel.isPurchasing {
                    ProgressView()
                        .tint(.white)
                } else {
                    Text(buttonTitle)
                        .font(.headline)
                        .foregroundColor(.white)

                    Image(systemName: "chevron.right")
                        .font(.body)
                        .foregroundColor(.white)
                }
            }
            .frame(maxWidth: .infinity)
            .padding()
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(
                        LinearGradient(
                            colors: [.blue, .purple],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
            )
        }
        .disabled(viewModel.isPurchasing)
    }

    /// Loading overlay
    private var loadingOverlay: some View {
        ZStack {
            Color.black.opacity(0.3)
                .ignoresSafeArea()

            VStack(spacing: 16) {
                ProgressView()
                    .scaleEffect(1.5)

                Text(L("store.processing"))
                    .font(.subheadline)
                    .foregroundColor(.white)
            }
            .padding(24)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color(UIColor.systemBackground))
            )
        }
    }

    // MARK: - Helper Properties

    private var iconName: String {
        switch viewModel.productType {
        case .points:
            return "star.fill"
        case .subscription:
            return "crown.fill"
        }
    }

    private var iconGradientColors: [Color] {
        switch viewModel.productType {
        case .points:
            return [.yellow, .orange]
        case .subscription:
            return [.purple, .pink]
        }
    }

    private var buttonTitle: String {
        switch viewModel.productType {
        case .points:
            return L("store.purchase.now")
        case .subscription:
            return L("store.subscribe.now")
        }
    }
}

// MARK: - Feature Row

/// Feature row component for product details
struct ProductFeatureRow: View {
    let icon: String
    let text: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.body)
                .foregroundColor(.green)
                .frame(width: 24)

            Text(text)
                .font(.subheadline)
                .foregroundColor(.primary)

            Spacer()
        }
    }
}

// MARK: - Preview

#Preview {
    ProductDetailView(product: ProductViewModel.mockPointsProduct())
}
