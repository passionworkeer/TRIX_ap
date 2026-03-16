//
//  DiagnosticView.swift
//  TRIX3DCompanion
//
//  Main diagnostic screen with network, API, and storage status cards
//

import SwiftUI

// MARK: - Localization Helper
private func L(_ key: String) -> String {
    NSLocalizedString(key, comment: "")
}

// MARK: - Diagnostic View

/// Main diagnostic screen showing system status
struct DiagnosticView: View {

    // MARK: - Environment

    @Environment(\.dismiss) private var dismiss

    // MARK: - State Objects

    @StateObject private var viewModel = DiagnosticViewModel()

    // MARK: - State

    @State private var showingAdvancedView = false

    // MARK: - Body

    var body: some View {
        NavigationView {
            ZStack {
                // Background
                Color.background.ignoresSafeArea()

                // Content
                contentView
            }
            .navigationTitle(L("diagnostic.title"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Close") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    HStack(spacing: 16) {
                        Button(action: {
                            Task {
                                await viewModel.refreshAll()
                            }
                        }) {
                            if viewModel.isRefreshing {
                                ProgressView()
                                    .scaleEffect(0.8)
                            } else {
                                Image(systemName: "arrow.clockwise")
                            }
                        }
                        .disabled(viewModel.isRefreshing)

                        Button(L("diagnostic.advanced")) {
                            showingAdvancedView = true
                        }
                    }
                }
            }
            .sheet(isPresented: $showingAdvancedView) {
                DiagnosticAdvancedView()
            }
            .alert("Error", isPresented: .constant(viewModel.errorMessage != nil)) {
                Button("OK") {
                    viewModel.clearMessages()
                }
            } message: {
                if let error = viewModel.errorMessage {
                    Text(error)
                }
            }
            .onAppear {
                Task {
                    await viewModel.refreshAll()
                }
            }
        }
    }

    // MARK: - View Components

    private var contentView: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Network Status Card
                networkStatusCard

                // API Test Card
                apiTestCard

                // Storage Status Card
                storageStatusCard

                // Quick Actions
                quickActionsCard
            }
            .padding()
        }
    }

    // MARK: - Network Status Card

    private var networkStatusCard: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Header
            HStack {
                Image(systemName: "wifi")
                    .font(.title2)
                    .foregroundColor(.brandPurple)

                Text(L("diagnostic.network.status"))
                    .font(.headline)
                    .fontWeight(.semibold)

                Spacer()

                statusBadge(for: viewModel.networkStatus.isConnected ? .success : .error)
            }

            // Connection Details
            HStack(spacing: 24) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(L("diagnostic.connection"))
                        .font(.caption)
                        .foregroundColor(.textSecondary)

                    Text(viewModel.networkStatus.connectionType.displayName)
                        .font(.subheadline)
                        .fontWeight(.medium)
                }

                VStack(alignment: .leading, spacing: 4) {
                    Text(L("diagnostic.quality"))
                        .font(.caption)
                        .foregroundColor(.textSecondary)

                    Text(viewModel.networkStatus.quality.displayName)
                        .font(.subheadline)
                        .fontWeight(.medium)
                }

                VStack(alignment: .leading, spacing: 4) {
                    Text(L("diagnostic.status"))
                        .font(.caption)
                        .foregroundColor(.textSecondary)

                    Text(viewModel.networkStatus.isConnected ? L("diagnostic.connected") : L("diagnostic.disconnected"))
                        .font(.subheadline)
                        .fontWeight(.medium)
                }
            }

            // Refresh Button
            Button(action: {
                Task {
                    await viewModel.runNetworkDiagnostics()
                }
            }) {
                HStack {
                    Image(systemName: "arrow.triangle.2.circlepath")
                    Text(L("diagnostic.testNetwork"))
                }
                .font(.subheadline)
                .fontWeight(.medium)
                .foregroundColor(.brandPurple)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(Color.brandPurple.opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: 10))
            }
            .disabled(viewModel.isTestingNetwork)
        }
        .padding()
        .glassPanel()
    }

    // MARK: - API Test Card

    private var apiTestCard: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Header
            HStack {
                Image(systemName: "network")
                    .font(.title2)
                    .foregroundColor(.blue)

                Text(L("diagnostic.api.connectivity"))
                    .font(.headline)
                    .fontWeight(.semibold)

                Spacer()

                if viewModel.isTestingNetwork {
                    ProgressView()
                        .scaleEffect(0.8)
                }
            }

            // API Results
            if viewModel.networkTests.isEmpty {
                Text(L("diagnostic.api.testHint"))
                    .font(.subheadline)
                    .foregroundColor(.textSecondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 20)
            } else {
                VStack(spacing: 8) {
                    ForEach(viewModel.networkTests) { result in
                        APIResultRow(result: result)
                    }
                }
            }
        }
        .padding()
        .glassPanel()
    }

    // MARK: - Storage Status Card

    private var storageStatusCard: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Header
            HStack {
                Image(systemName: "internaldrive.fill")
                    .font(.title2)
                    .foregroundColor(.orange)

                Text(L("diagnostic.storage.status"))
                    .font(.headline)
                    .fontWeight(.semibold)

                Spacer()

                statusBadge(for: .success)
            }

            // Storage Details
            if viewModel.storageResults.isEmpty {
                Text(L("diagnostic.storage.testHint"))
                    .font(.subheadline)
                    .foregroundColor(.textSecondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 20)
            } else {
                VStack(spacing: 12) {
                    ForEach(viewModel.storageResults) { result in
                        StorageResultRow(result: result)
                    }

                    Divider()
                        .padding(.vertical, 8)

                    HStack {
                        Text(L("diagnostic.storage.total"))
                            .font(.subheadline)
                            .fontWeight(.medium)

                        Spacer()

                        Text(viewModel.formattedTotalCacheSize)
                            .font(.subheadline)
                            .fontWeight(.semibold)
                            .foregroundColor(.brandPurple)
                    }
                }
            }

            // Refresh Button
            Button(action: {
                Task {
                    await viewModel.runStorageDiagnostics()
                }
            }) {
                HStack {
                    Image(systemName: "arrow.triangle.2.circlepath")
                    Text(L("diagnostic.checkStorage"))
                }
                .font(.subheadline)
                .fontWeight(.medium)
                .foregroundColor(.brandPurple)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(Color.brandPurple.opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: 10))
            }
            .disabled(viewModel.isCheckingStorage)
        }
        .padding()
        .glassPanel()
    }

    // MARK: - Quick Actions Card

    private var quickActionsCard: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(L("diagnostic.quickActions"))
                .font(.headline)
                .fontWeight(.semibold)

            HStack(spacing: 12) {
                // Clear Cache Button
                QuickActionButton(
                    icon: "trash.fill",
                    title: "Clear Cache",
                    color: .red
                ) {
                    Task {
                        await viewModel.clearAllCaches()
                    }
                }

                // View Logs Button
                QuickActionButton(
                    icon: "doc.text.fill",
                    title: "View Logs",
                    color: .blue
                ) {
                    showingAdvancedView = true
                }

                // Performance Button
                QuickActionButton(
                    icon: "speedometer",
                    title: "Performance",
                    color: .green
                ) {
                    Task {
                        await viewModel.collectPerformanceMetrics()
                    }
                }
            }
        }
        .padding()
        .glassPanel()
    }

    // MARK: - Helpers

    private func statusBadge(for status: DiagnosticStatus) -> some View {
        HStack(spacing: 4) {
            Image(systemName: status.iconName)
                .font(.caption)

            Text(status.displayName)
                .font(.caption)
                .fontWeight(.medium)
        }
        .foregroundColor(colorForStatus(status))
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(colorForStatus(status).opacity(0.15))
        .clipShape(Capsule())
    }

    private func colorForStatus(_ status: DiagnosticStatus) -> Color {
        switch status {
        case .success: return .green
        case .warning: return .yellow
        case .error: return .red
        case .testing: return .blue
        case .unknown: return .gray
        }
    }
}

// MARK: - API Result Row

struct APIResultRow: View {
    let result: NetworkDiagnosticResult

    var body: some View {
        HStack {
            Image(systemName: result.status.iconName)
                .foregroundColor(colorForStatus(result.status))
                .frame(width: 20)

            Text(result.endpoint)
                .font(.subheadline)

            Spacer()

            if let latency = result.latencyMs {
                Text(String(format: "%.0f ms", latency))
                    .font(.caption)
                    .foregroundColor(.textSecondary)
            } else if let error = result.errorMessage {
                Text(error)
                    .font(.caption)
                    .foregroundColor(.red)
                    .lineLimit(1)
            }

            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding(.vertical, 4)
    }

    private func colorForStatus(_ status: DiagnosticStatus) -> Color {
        switch status {
        case .success: return .green
        case .warning: return .yellow
        case .error: return .red
        case .testing: return .blue
        case .unknown: return .gray
        }
    }
}

// MARK: - Storage Result Row

struct StorageResultRow: View {
    let result: StorageDiagnosticResult

    var body: some View {
        HStack {
            Image(systemName: result.type.icon)
                .foregroundColor(.blue)
                .frame(width: 24)

            VStack(alignment: .leading, spacing: 2) {
                Text(result.type.rawValue)
                    .font(.subheadline)
                    .fontWeight(.medium)

                if let details = result.details {
                    Text(details)
                        .font(.caption)
                        .foregroundColor(.textSecondary)
                }
            }

            Spacer()

            Text(result.formattedSize)
                .font(.subheadline)
                .fontWeight(.medium)

            Image(systemName: result.status.iconName)
                .foregroundColor(colorForStatus(result.status))
        }
    }

    private func colorForStatus(_ status: DiagnosticStatus) -> Color {
        switch status {
        case .success: return .green
        case .warning: return .yellow
        case .error: return .red
        case .testing: return .blue
        case .unknown: return .gray
        }
    }
}

// MARK: - Quick Action Button

struct QuickActionButton: View {
    let icon: String
    let title: String
    let color: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.title3)

                Text(title)
                    .font(.caption)
                    .fontWeight(.medium)
            }
            .foregroundColor(color)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(color.opacity(0.1))
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Preview

#Preview("Diagnostic View") {
    DiagnosticView()
}
