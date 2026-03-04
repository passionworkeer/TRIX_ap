//
//  PaymentResultView.swift
//  TRIX3DCompanion
//
//  Payment result view - shows success or failure of payment
//

import SwiftUI

// MARK: - Payment Result View

/// View displaying payment completion result
struct PaymentResultView: View {

    // MARK: - Properties

    let isSuccess: Bool
    let productName: String
    let points: Int?
    let order: AppOrder?

    // MARK: - Environment

    @Environment(\.dismiss) private var dismiss

    // MARK: - Body

    var body: some View {
        VStack(spacing: 32) {
            Spacer()

            // Icon
            icon
                .font(.system(size: 80))

            // Status
            Text(statusTitle)
                .font(.title2)
                .fontWeight(.bold)

            // Message
            Text(statusMessage)
                .font(.body)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)

            // Order Details
            if let order = order {
                orderDetailsCard(order)
                    .padding(.horizontal)
            }

            // Points added
            if let points = points {
                pointsAddedCard(points)
                    .padding(.horizontal)
            }

            Spacer()

            // Action Button
            actionButton
                .padding(.horizontal)
                .padding(.bottom, 20)
        }
        .background(Color(UIColor.systemGroupedBackground))
    }

    // MARK: - View Components

    /// Status icon
    private var icon: some View {
        Group {
            if isSuccess {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundColor(.green)
            } else {
                Image(systemName: "xmark.circle.fill")
                    .foregroundColor(.red)
            }
        }
    }

    /// Status title
    private var statusTitle: String {
        isSuccess ? "Payment Successful!" : "Payment Failed"
    }

    /// Status message
    private var statusMessage: String {
        if isSuccess {
            if let points = points {
                return "You've successfully purchased \(points) points!"
            } else {
                return "You've successfully subscribed to \(productName)!"
            }
        } else {
            return "We couldn't process your payment. Please try again."
        }
    }

    /// Order details card
    private func orderDetailsCard(_ order: AppOrder) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Order Details")
                .font(.headline)
                .foregroundColor(.primary)

            Divider()

            OrderRow(label: "Order ID", value: order.id.prefix(8) + "...")
            OrderRow(label: "Amount", value: String(format: "¥%.2f", order.amount))
            OrderRow(label: "Date", value: formatDate(order.createdAt))

            if let transactionId = order.transactionId {
                OrderRow(label: "Transaction", value: transactionId.prefix(8) + "...")
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

    /// Points added card
    private func pointsAddedCard(_ points: Int) -> some View {
        HStack(spacing: 16) {
            Image(systemName: "star.fill")
                .font(.title2)
                .foregroundColor(.orange)

            VStack(alignment: .leading, spacing: 4) {
                Text("Points Added")
                    .font(.subheadline)
                    .foregroundColor(.secondary)

                Text("+\(points) points")
                    .font(.title3)
                    .fontWeight(.bold)
                    .foregroundColor(.primary)
            }

            Spacer()

            Button("View") {
                // Navigate to store or profile
                dismiss()
            }
            .font(.subheadline)
            .foregroundColor(.blue)
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.yellow.opacity(0.1))
        )
        .overlay {
            RoundedRectangle(cornerRadius: 16)
                .stroke(Color.yellow.opacity(0.3), lineWidth: 1)
        }
    }

    /// Action button
    private var actionButton: some View {
        Button(action: {
            dismiss()
        }) {
            Text(buttonTitle)
                .font(.headline)
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding()
                .background(
                    RoundedRectangle(cornerRadius: 16)
                        .fill(
                            isSuccess ?
                                LinearGradient(colors: [.green, .mint], startPoint: .leading, endPoint: .trailing) :
                                LinearGradient(colors: [.blue, .purple], startPoint: .leading, endPoint: .trailing)
                        )
                )
        }
    }

    /// Button title
    private var buttonTitle: String {
        isSuccess ? "Done" : "Try Again"
    }

    // MARK: - Helpers

    /// Format date for display
    /// - Parameter date: Date to format
    /// - Returns: Formatted date string
    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        formatter.locale = Locale(identifier: "zh_CN")
        return formatter.string(from: date)
    }
}

// MARK: - Order Row

/// Order detail row component
struct OrderRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label)
                .font(.subheadline)
                .foregroundColor(.secondary)

            Spacer()

            Text(value)
                .font(.subheadline)
                .foregroundColor(.primary)
        }
    }
}

// MARK: - Preview

#Preview("Success") {
    PaymentResultView(
        isSuccess: true,
        productName: "580 Points",
        points: 580,
        order: AppOrder(
            id: UUID().uuidString,
            userId: "user123",
            productId: "points_500",
            productType: .points,
            amount: 28.0,
            currency: "CNY",
            status: .completed,
            paymentMethod: .applePay,
            transactionId: "txn_123456",
            points: 580,
            createdAt: Date(),
            updatedAt: Date()
        )
    )
}

#Preview("Failure") {
    PaymentResultView(
        isSuccess: false,
        productName: "Points",
        points: nil,
        order: nil
    )
}
