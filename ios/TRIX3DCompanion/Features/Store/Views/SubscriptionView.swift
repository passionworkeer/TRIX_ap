//
//  SubscriptionView.swift
//  TRIX3DCompanion
//
//  Subscription view - shows membership plans and benefits
//

import SwiftUI

// MARK: - Subscription View

/// View for purchasing premium subscription
struct SubscriptionView: View {

    // MARK: - State

    @StateObject private var viewModel = StoreViewModel()
    @State private var selectedPlan: SubscriptionPlan?
    @State private var showConfirmation = false
    @State private var showPaymentResult = false
    @State private var purchaseResult: PaymentResult?

    // MARK: - Environment

    @Environment(\.dismiss) private var dismiss

    // MARK: - Subscription Plans

    struct SubscriptionPlan: Identifiable, Equatable {
        let id = UUID()
        let productId: String
        let name: String
        let period: String
        let price: Double
        let monthlyPrice: Double?
        let isPopular: Bool
        let features: [String]

        var displayPrice: String {
            String(format: "¥%.0f", price)
        }

        var displayMonthlyPrice: String? {
            guard let monthly = monthlyPrice else { return nil }
            return String(format: "¥%.1f/month", monthly)
        }

        static var allPlans: [SubscriptionPlan] {
            [
                SubscriptionPlan(
                    productId: StoreProductConfiguration.monthlySubscription,
                    name: "Monthly",
                    period: "1 month",
                    price: 12,
                    monthlyPrice: 12,
                    isPopular: true,
                    features: monthlyFeatures
                ),
                SubscriptionPlan(
                    productId: StoreProductConfiguration.yearlySubscription,
                    name: "Yearly",
                    period: "1 year",
                    price: 98,
                    monthlyPrice: 98 / 12,
                    isPopular: false,
                    features: yearlyFeatures
                )
            ]
        }

        static var monthlyFeatures: [String] {
            [
                "Access to all premium features",
                "Ad-free experience",
                "Priority customer support",
                "Exclusive content and resources",
                "Cancel anytime"
            ]
        }

        static var yearlyFeatures: [String] {
            [
                "Everything in Monthly",
                "Save 18% compared to monthly",
                "Priority over monthly subscribers",
                "Early access to new features",
                "Exclusive yearly member badge"
            ]
        }
    }

    // MARK: - Body

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 24) {
                    // Header
                    headerSection
                        .padding(.horizontal)
                        .padding(.top, 16)

                    // Current Status
                    if viewModel.hasActiveSubscription {
                        activeSubscriptionCard
                            .padding(.horizontal)
                    }

                    // Plans
                    plansSection
                        .padding(.horizontal)

                    // Benefits
                    benefitsSection
                        .padding(.horizontal)

                    // Terms
                    termsSection
                        .padding(.horizontal)
                        .padding(.bottom, 20)
                }
            }
            .background(Color(UIColor.systemGroupedBackground))
            .navigationTitle("Premium")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Close") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Restore") {
                        Task {
                            await restorePurchases()
                        }
                    }
                    .font(.subheadline)
                }
            }
            .confirmationDialog(
                "Confirm Subscription",
                isPresented: $showConfirmation,
                presenting: selectedPlan
            ) { plan in
                Button("Subscribe for \(plan.displayPrice)/\(plan.period)") {
                    Task {
                        await subscribeTo(plan)
                    }
                }
                Button("Cancel", role: .cancel) {}
            } message: { plan in
                Text("You will be charged \(plan.displayPrice) for \(plan.period). Auto-renews until cancelled.")
            }
            .sheet(isPresented: $showPaymentResult) {
                if let result = purchaseResult {
                    PaymentResultView(
                        isSuccess: isSuccess(result),
                        productName: "Premium Subscription",
                        points: nil,
                        order: extractOrder(from: result)
                    )
                }
            }
        }
    }

    // MARK: - View Components

    /// Header section
    private var headerSection: some View {
        VStack(spacing: 12) {
            Image(systemName: "crown.fill")
                .font(.system(size: 56))
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
        }
    }

    /// Active subscription card
    private var activeSubscriptionCard: some View {
        VStack(spacing: 12) {
            HStack {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundColor(.green)
                Text("Active Subscription")
                    .font(.headline)
                    .foregroundColor(.green)
            }

            if let expiryDate = viewModel.subscriptionExpiryDate {
                Text("Renews on \(expiryDate, style: .date)")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }

            if viewModel.willAutoRenew {
                HStack {
                    Image(systemName: "arrow.clockwise")
                        .font(.caption)
                    Text("Auto-renew enabled")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            Divider()

            Button("Manage Subscription") {
                // Open subscription management in iOS settings
                if let url = URL(string: "https://apps.apple.com/account/subscriptions") {
                    UIApplication.shared.open(url)
                }
            }
            .font(.subheadline)
            .foregroundColor(.blue)
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.green.opacity(0.1))
        )
        .overlay {
            RoundedRectangle(cornerRadius: 16)
                .stroke(Color.green.opacity(0.3), lineWidth: 1)
        }
    }

    /// Plans section
    private var plansSection: some View {
        VStack(spacing: 16) {
            Text("Choose Your Plan")
                .font(.headline)
                .frame(maxWidth: .infinity, alignment: .leading)

            ForEach(SubscriptionPlan.allPlans) { plan in
                PlanCard(
                    plan: plan,
                    isSelected: selectedPlan?.id == plan.id
                ) {
                    selectedPlan = plan
                    showConfirmation = true
                }
            }
        }
    }

    /// Benefits section
    private var benefitsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Premium Benefits")
                .font(.headline)
                .foregroundColor(.primary)

            VStack(alignment: .leading, spacing: 8) {
                BenefitRow(icon: "star.fill", title: "Unlimited Access", description: "Access all premium features")
                BenefitRow(icon: "nodisk", title: "Ad-Free", description: "Enjoy without interruptions")
                BenefitRow(icon: "bolt.fill", title: "Priority Support", description: "Get help faster")
                BenefitRow(icon: "gift.fill", title: "Exclusive Content", description: "Premium-only resources")
                BenefitRow(icon: "sparkles", title: "Early Access", description: "Try new features first")
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

    /// Terms section
    private var termsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Terms & Privacy")
                .font(.headline)
                .foregroundColor(.primary)

            VStack(alignment: .leading, spacing: 8) {
                Text("• Subscription auto-renews unless cancelled at least 24 hours before the end of the current period.")
                Text("• Payment will be charged to your Apple ID account at confirmation of purchase.")
                Text("• Manage or cancel your subscription in your Apple ID account settings.")
                Text("• Any unused portion of a free trial period will be forfeited when purchasing a subscription.")
            }
            .font(.caption)
            .foregroundColor(.secondary)
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

    /// Subscribe to plan
    /// - Parameter plan: Plan to subscribe to
    private func subscribeTo(_ plan: SubscriptionPlan) async {
        let result = await PaymentService.shared.subscribe(productId: plan.productId)
        purchaseResult = result
        showPaymentResult = true
    }

    /// Restore purchases
    private func restorePurchases() async {
        let result = await StoreKitService.shared.restorePurchases()

        switch result {
        case .success:
            // Check subscription status
            await viewModel.checkSubscriptionStatus()
        case .failure:
            break
        }
    }

    /// Check if result is success
    private func isSuccess(_ result: PaymentResult) -> Bool {
        if case .success = result {
            return true
        }
        return false
    }

    /// Extract order from result
    private func extractOrder(from result: PaymentResult) -> Order? {
        if case .success(let order) = result {
            return order
        }
        return nil
    }
}

// MARK: - Plan Card

/// Subscription plan card component
struct PlanCard: View {
    let plan: SubscriptionView.SubscriptionPlan
    let isSelected: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: 12) {
                // Header with badge
                HStack {
                    Text(plan.name)
                        .font(.headline)
                        .foregroundColor(.primary)

                    Spacer()

                    if plan.isPopular {
                        Badge(text: "Popular", color: .blue)
                    }
                }

                // Price
                HStack(alignment: .firstTextBaseline, spacing: 4) {
                    Text(plan.displayPrice)
                        .font(.system(size: 32, weight: .bold, design: .rounded))
                        .foregroundColor(.blue)

                    Text("/\(plan.period)")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }

                // Monthly equivalent
                if let monthlyPrice = plan.displayMonthlyPrice {
                    Text(monthlyPrice)
                        .font(.caption)
                        .foregroundColor(.green)
                }

                // Features
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(plan.features, id: \.self) { feature in
                        HStack(spacing: 8) {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.caption)
                                .foregroundColor(.green)
                                .frame(width: 16)

                            Text(feature)
                                .font(.caption)
                                .foregroundColor(.primary)

                            Spacer()
                        }
                    }
                }

                // Subscribe button
                Text("Subscribe")
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(
                        RoundedRectangle(cornerRadius: 10)
                            .fill(
                                LinearGradient(
                                    colors: [.blue, .purple],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                    )
            }
            .padding()
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

// MARK: - Benefit Row

/// Benefit row component
struct BenefitRow: View {
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

// MARK: - Badge Component (reused)

/// Badge component
struct Badge: View {
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

// MARK: - Preview

#Preview {
    SubscriptionView()
}
