//
//  DiagnosticAdvancedView.swift
//  TRIX3DCompanion
//
//  Advanced diagnostic view with log viewer, performance dashboard, and cache management
//

import SwiftUI

// MARK: - Diagnostic Advanced View

/// Advanced diagnostic screen with logs, performance metrics, and cache management
struct DiagnosticAdvancedView: View {

    // MARK: - Environment

    @Environment(\.dismiss) private var dismiss

    // MARK: - State Objects

    @StateObject private var viewModel = DiagnosticViewModel()

    // MARK: - State

    @State private var selectedTab: DiagnosticTab = .logs

    // MARK: - Body

    var body: some View {
        NavigationView {
            ZStack {
                // Background
                Color.background.ignoresSafeArea()

                // Content
                VStack(spacing: 0) {
                    // Tab Picker
                    tabPicker
                        .padding()

                    // Tab Content
                    TabView(selection: $selectedTab) {
                        LogViewerView(viewModel: viewModel)
                            .tag(DiagnosticTab.logs)

                        PerformanceDashboardView(viewModel: viewModel)
                            .tag(DiagnosticTab.performance)

                        CacheManagerView(viewModel: viewModel)
                            .tag(DiagnosticTab.cache)
                    }
                    .tabViewStyle(.page(indexDisplayMode: .never))
                }
            }
            .navigationTitle("Advanced Diagnostics")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Close") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
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
                }
            }
            .onAppear {
                viewModel.loadLogs()
                Task {
                    await viewModel.collectPerformanceMetrics()
                    await viewModel.runStorageDiagnostics()
                }
            }
        }
    }

    // MARK: - Tab Picker

    private var tabPicker: some View {
        HStack(spacing: 0) {
            ForEach(DiagnosticTab.allCases) { tab in
                Button(action: {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        selectedTab = tab
                    }
                }) {
                    VStack(spacing: 8) {
                        Image(systemName: tab.icon)
                            .font(.title3)

                        Text(tab.title)
                            .font(.caption)
                            .fontWeight(.medium)
                    }
                    .foregroundColor(selectedTab == tab ? .brandPurple : .secondary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(
                        selectedTab == tab ?
                        Color.brandPurple.opacity(0.1) : Color.clear
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(4)
        .background(Color.secondary.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }
}

// MARK: - Diagnostic Tab

enum DiagnosticTab: String, CaseIterable, Identifiable {
    case logs = "Logs"
    case performance = "Performance"
    case cache = "Cache"

    var id: String { rawValue }

    var title: String { rawValue }

    var icon: String {
        switch self {
        case .logs: return "doc.text.fill"
        case .performance: return "speedometer"
        case .cache: return "internaldrive.fill"
        }
    }
}

// MARK: - Log Viewer View

struct LogViewerView: View {
    @ObservedObject var viewModel: DiagnosticViewModel

    var body: some View {
        VStack(spacing: 0) {
            // Filter Bar
            filterBar
                .padding()

            // Log List
            if viewModel.filteredLogs.isEmpty {
                emptyLogsView
            } else {
                logList
            }
        }
    }

    // MARK: - Filter Bar

    private var filterBar: some View {
        HStack {
            // Level Filter
            Menu {
                Button("All Levels") {
                    viewModel.selectedLogLevel = nil
                }
                ForEach(DiagnosticLogLevel.allCases, id: \.self) { level in
                    Button(action: {
                        viewModel.selectedLogLevel = level
                    }) {
                        HStack {
                            Image(systemName: level.iconName)
                            Text(level.rawValue)
                        }
                    }
                }
            } label: {
                HStack {
                    Image(systemName: "line.3.horizontal.decrease.circle")
                    Text(viewModel.selectedLogLevel?.rawValue ?? "All Levels")
                }
                .font(.subheadline)
                .foregroundColor(.brandPurple)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Color.brandPurple.opacity(0.1))
                .clipShape(Capsule())
            }

            Spacer()

            // Clear Button
            Button(action: {
                viewModel.clearLogs()
            }) {
                Image(systemName: "trash")
                    .foregroundColor(.red)
            }
        }
    }

    // MARK: - Log List

    private var logList: some View {
        ScrollView {
            LazyVStack(spacing: 8) {
                ForEach(viewModel.filteredLogs) { entry in
                    LogEntryRow(entry: entry)
                }
            }
            .padding(.horizontal)
        }
    }

    // MARK: - Empty View

    private var emptyLogsView: some View {
        VStack(spacing: 16) {
            Spacer()

            Image(systemName: "doc.text")
                .font(.system(size: 48))
                .foregroundColor(.secondary)

            Text("No logs available")
                .font(.headline)
                .foregroundColor(.secondary)

            Text("Logs will appear here when available")
                .font(.subheadline)
                .foregroundColor(.textSecondary)

            Spacer()
        }
    }
}

// MARK: - Log Entry Row

struct LogEntryRow: View {
    let entry: LogEntry

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            // Level Icon
            Image(systemName: entry.level.iconName)
                .font(.caption)
                .foregroundColor(colorForLevel(entry.level))
                .frame(width: 20)

            // Content
            VStack(alignment: .leading, spacing: 4) {
                Text(entry.message)
                    .font(.subheadline)
                    .lineLimit(2)

                HStack {
                    Text(entry.source)
                        .font(.caption)
                        .foregroundColor(.textSecondary)

                    Spacer()

                    Text(entry.formattedTime)
                        .font(.caption)
                        .foregroundColor(.textTertiary)
                }
            }
        }
        .padding()
        .background(Color.secondary.opacity(0.05))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    private func colorForLevel(_ level: DiagnosticLogLevel) -> Color {
        switch level {
        case .debug: return .gray
        case .info: return .blue
        case .warning: return .yellow
        case .error: return .red
        }
    }
}

// MARK: - Performance Dashboard View

struct PerformanceDashboardView: View {
    @ObservedObject var viewModel: DiagnosticViewModel

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Performance Metrics Grid
                metricsGrid

                // Health Summary
                healthSummary
            }
            .padding()
        }
    }

    // MARK: - Metrics Grid

    private var metricsGrid: some View {
        VStack(spacing: 16) {
            ForEach(viewModel.performanceMetrics) { metric in
                PerformanceMetricCard(metric: metric)
            }
        }
    }

    // MARK: - Health Summary

    private var healthSummary: some View {
        let healthyCount = viewModel.performanceMetrics.filter { $0.isHealthy }.count
        let totalCount = viewModel.performanceMetrics.count
        let allHealthy = healthyCount == totalCount && totalCount > 0

        return HStack {
            Image(systemName: allHealthy ? "checkmark.circle.fill" : "exclamationmark.triangle.fill")
                .font(.title2)
                .foregroundColor(allHealthy ? .green : .yellow)

            VStack(alignment: .leading, spacing: 2) {
                Text(allHealthy ? "System Healthy" : "Attention Needed")
                    .font(.headline)

                Text("\(healthyCount)/\(totalCount) metrics are healthy")
                    .font(.caption)
                    .foregroundColor(.textSecondary)
            }

            Spacer()
        }
        .padding()
        .glassPanel()
    }
}

// MARK: - Performance Metric Card

struct PerformanceMetricCard: View {
    let metric: PerformanceMetrics

    var body: some View {
        HStack(spacing: 16) {
            // Icon
            Image(systemName: metric.type.icon)
                .font(.title2)
                .foregroundColor(.brandPurple)
                .frame(width: 44, height: 44)
                .background(Color.brandPurple.opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: 10))

            // Content
            VStack(alignment: .leading, spacing: 4) {
                Text(metric.type.rawValue)
                    .font(.subheadline)
                    .foregroundColor(.textSecondary)

                Text(metric.formattedValue)
                    .font(.title2)
                    .fontWeight(.semibold)
            }

            Spacer()

            // Status
            Image(systemName: metric.isHealthy ? "checkmark.circle.fill" : "exclamationmark.triangle.fill")
                .font(.title2)
                .foregroundColor(metric.isHealthy ? .green : .red)
        }
        .padding()
        .glassPanel()
    }
}

// MARK: - Cache Manager View

struct CacheManagerView: View {
    @ObservedObject var viewModel: DiagnosticViewModel
    @State private var showClearConfirmation = false

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Cache Overview
                cacheOverview

                // Cache Items
                cacheItemsList

                // Clear All Button
                clearAllButton
            }
            .padding()
        }
        .alert("Clear All Caches", isPresented: $showClearConfirmation) {
            Button("Cancel", role: .cancel) { }
            Button("Clear", role: .destructive) {
                Task {
                    await viewModel.clearAllCaches()
                }
            }
        } message: {
            Text("This will clear all cached data. The app will re-download necessary data as needed.")
        }
    }

    // MARK: - Cache Overview

    private var cacheOverview: some View {
        HStack(spacing: 16) {
            Image(systemName: "internaldrive.fill")
                .font(.largeTitle)
                .foregroundColor(.brandPurple)

            VStack(alignment: .leading, spacing: 4) {
                Text("Total Cache Size")
                    .font(.subheadline)
                    .foregroundColor(.textSecondary)

                Text(viewModel.formattedTotalCacheSize)
                    .font(.title)
                    .fontWeight(.bold)
            }

            Spacer()

            Button(action: {
                Task {
                    await viewModel.runStorageDiagnostics()
                }
            }) {
                Image(systemName: "arrow.clockwise")
                    .font(.title2)
                    .foregroundColor(.brandPurple)
            }
        }
        .padding()
        .glassPanel()
    }

    // MARK: - Cache Items List

    private var cacheItemsList: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Cache Types")
                .font(.headline)
                .fontWeight(.semibold)
                .padding(.horizontal, 4)

            ForEach(DiagnosticCacheType.allCases) { cacheType in
                CacheItemRow(
                    cacheType: cacheType,
                    info: viewModel.cacheInfo.first { $0.type == cacheType }
                ) {
                    Task {
                        await viewModel.clearCache(type: cacheType)
                    }
                }
            }
        }
    }

    // MARK: - Clear All Button

    private var clearAllButton: some View {
        Button(action: {
            showClearConfirmation = true
        }) {
            HStack {
                Image(systemName: "trash.fill")
                Text("Clear All Caches")
            }
            .font(.headline)
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .padding()
            .background(
                LinearGradient(
                    colors: [.red.opacity(0.8), .red.opacity(0.6)],
                    startPoint: .leading,
                    endPoint: .trailing
                )
            )
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
        .disabled(viewModel.isRefreshing)
    }
}

// MARK: - Cache Item Row

struct CacheItemRow: View {
    let cacheType: DiagnosticCacheType
    let info: CacheInfo?
    let onClear: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: cacheType.icon)
                .font(.title3)
                .foregroundColor(.blue)
                .frame(width: 40, height: 40)
                .background(Color.blue.opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: 8))

            VStack(alignment: .leading, spacing: 2) {
                Text(cacheType.rawValue)
                    .font(.subheadline)
                    .fontWeight(.medium)

                if let info = info {
                    Text("\(info.entryCount) items - Last cleared: \(info.formattedLastCleared)")
                        .font(.caption)
                        .foregroundColor(.textSecondary)
                }
            }

            Spacer()

            if let info = info {
                Text(info.formattedSize)
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .foregroundColor(.brandPurple)
            }

            Button(action: onClear) {
                Image(systemName: "trash")
                    .font(.subheadline)
                    .foregroundColor(.red)
                    .padding(8)
                    .background(Color.red.opacity(0.1))
                    .clipShape(Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("清除 \(cacheType.rawValue) 缓存")
        }
        .padding()
        .background(Color.secondary.opacity(0.05))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

// MARK: - Preview

#Preview("Advanced Diagnostics") {
    DiagnosticAdvancedView()
}
