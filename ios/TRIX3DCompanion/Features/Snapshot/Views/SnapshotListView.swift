//
//  SnapshotListView.swift
//  TRIX3DCompanion
//
//  Snapshot gallery view with grid layout and pagination
//

import SwiftUI

// MARK: - Snapshot List View

/// Photo gallery grid view with native iOS design
struct SnapshotListView: View {

    // MARK: - State Objects

    @StateObject private var viewModel: SnapshotListViewModel

    // MARK: - Environment

    @Environment(\.dismiss) private var dismiss

    // MARK: - State

    @State private var showingDeleteConfirmation = false
    @State private var snapshotToDelete: Snapshot?

    // MARK: - Grid Layout

    private let gridColumns = [
        GridItem(.flexible(), spacing: 2),
        GridItem(.flexible(), spacing: 2),
        GridItem(.flexible(), spacing: 2)
    ]

    // MARK: - Initialization

    init(viewModel: SnapshotListViewModel? = nil) {
        _viewModel = StateObject(wrappedValue: viewModel ?? SnapshotListViewModel())
    }

    // MARK: - Body

    var body: some View {
        NavigationView {
            ZStack {
                // Background
                Color(.systemGroupedBackground)
                    .ignoresSafeArea()

                // Content
                if viewModel.isEmpty {
                    emptyStateView
                } else {
                    snapshotGrid
                }
            }
            .navigationTitle("快拍相册")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("关闭") {
                        dismiss()
                    }
                }
            }
            .task {
                await viewModel.loadSnapshots()
            }
            .refreshable {
                await viewModel.refreshSnapshots()
            }
            .sheet(isPresented: $viewModel.showDetail) {
                if let snapshot = viewModel.selectedSnapshot {
                    SnapshotDetailView(snapshot: snapshot)
                }
            }
            .confirmationDialog("删除照片", isPresented: $showingDeleteConfirmation, titleVisibility: .visible) {
                Button("删除", role: .destructive) {
                    if let snapshot = snapshotToDelete {
                        Task {
                            await viewModel.deleteSnapshot(snapshot)
                        }
                    }
                }
                Button("取消", role: .cancel) {
                    snapshotToDelete = nil
                }
            }
            .alert("错误", isPresented: .constant(viewModel.errorMessage != nil)) {
                Button("确定") {
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

    /// Empty state view with native iOS design
    private var emptyStateView: some View {
        ContentUnavailableView {
            Label("暂无照片", systemImage: "photo.on.rectangle.angled")
        } description: {
            Text("您拍摄的照片将显示在这里")
        } actions: {
            Button("拍照") {
                // Navigate to camera
            }
            .buttonStyle(.borderedProminent)
        }
    }

    /// Snapshot grid view
    private var snapshotGrid: some View {
        ScrollView {
            LazyVGrid(columns: gridColumns, spacing: 2) {
                ForEach(viewModel.snapshots) { snapshot in
                    SnapshotCell(
                        snapshot: snapshot,
                        onTap: {
                            viewModel.selectSnapshot(snapshot)
                        },
                        onLongPress: {
                            snapshotToDelete = snapshot
                            showingDeleteConfirmation = true
                        }
                    )
                    .onAppear {
                        viewModel.checkForLoadMore(snapshot)
                    }
                }
            }
            .padding(.horizontal, 2)

            // Loading indicator
            if viewModel.isLoading {
                loadingFooter
            }
        }
    }

    /// Loading footer
    private var loadingFooter: some View {
        HStack(spacing: 12) {
            ProgressView()
                .tint(.purple)

            Text("正在加载更多...")
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .padding(.vertical, 20)
    }
}

// MARK: - Snapshot Cell

/// Grid cell for snapshot thumbnail with native iOS style
struct SnapshotCell: View {
    let snapshot: Snapshot
    let onTap: () -> Void
    let onLongPress: () -> Void

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            // Image
            AsyncImage(url: URL(string: snapshot.thumbnailUrl ?? snapshot.imageUrl)) { phase in
                switch phase {
                case .empty:
                    placeholderView

                case .success(let image):
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fill)

                case .failure:
                    errorView

                @unknown default:
                    placeholderView
                }
            }
            .frame(height: 150)
            .clipped()

            // Overlay info
            VStack(alignment: .leading, spacing: 4) {
                if let locationName = snapshot.locationName {
                    HStack(spacing: 4) {
                        Image(systemName: "mappin.circle.fill")
                            .font(.caption2)
                        Text(locationName)
                            .font(.caption2)
                    }
                    .foregroundColor(.white)
                }

                Text(formatDate(snapshot.createdAt))
                    .font(.caption2)
                    .foregroundColor(.white.opacity(0.8))
            }
            .padding(8)
            .background(
                LinearGradient(
                    colors: [.black.opacity(0.6), .clear],
                    startPoint: .bottom,
                    endPoint: .top
                )
            )
        }
        .aspectRatio(1, contentMode: .fill)
        .clipped()
        .contentShape(Rectangle())
        .onTapGesture(perform: onTap)
        .onLongPressGesture(perform: onLongPress)
    }

    /// Placeholder view
    private var placeholderView: some View {
        ZStack {
            Color(.secondarySystemBackground)

            ProgressView()
                .tint(.purple)
        }
    }

    /// Error view
    private var errorView: some View {
        ZStack {
            Color(.secondarySystemBackground)

            VStack(spacing: 4) {
                Image(systemName: "exclamationmark.triangle")
                    .font(.title)
                    .foregroundColor(.secondary)

                Text("加载失败")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        }
    }

    /// Format date for display
    private func formatDate(_ date: Date) -> String {
        let calendar = Calendar.current

        if calendar.isDateInToday(date) {
            let formatter = DateFormatter()
            formatter.timeStyle = .short
            return formatter.string(from: date)
        } else if calendar.isDateInYesterday(date) {
            return "昨天"
        } else {
            let formatter = DateFormatter()
            formatter.dateStyle = .short
            return formatter.string(from: date)
        }
    }
}

// MARK: - Snapshot Detail View

/// Detail view for single snapshot with native iOS design
struct SnapshotDetailView: View {
    let snapshot: Snapshot

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 20) {
                    // Image
                    AsyncImage(url: URL(string: snapshot.imageUrl)) { phase in
                        switch phase {
                        case .empty:
                            ProgressView()
                                .frame(height: 300)

                        case .success(let image):
                            image
                                .resizable()
                                .aspectRatio(contentMode: .fit)

                        case .failure:
                            Image(systemName: "exclamationmark.triangle")
                                .font(.system(size: 60))
                                .foregroundColor(.secondary)
                                .frame(height: 300)

                        @unknown default:
                            ProgressView()
                                .frame(height: 300)
                        }
                    }

                    // Info section
                    VStack(alignment: .leading, spacing: 16) {
                        // Caption
                        if let caption = snapshot.caption {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("描述")
                                    .font(.caption)
                                    .foregroundColor(.secondary)

                                Text(caption)
                                    .font(.body)
                            }
                        }

                        // Location
                        if let locationName = snapshot.locationName {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("位置")
                                    .font(.caption)
                                    .foregroundColor(.secondary)

                                HStack(spacing: 6) {
                                    Image(systemName: "mappin.circle.fill")
                                        .foregroundColor(.purple)
                                    Text(locationName)
                                        .font(.body)
                                }
                            }
                        }

                        // Date
                        VStack(alignment: .leading, spacing: 4) {
                            Text("日期")
                                .font(.caption)
                                .foregroundColor(.secondary)

                            Text(snapshot.createdAt.formatted(date: .long, time: .shortened))
                                .font(.body)
                        }
                    }
                    .padding(.horizontal)
                    .frame(maxWidth: .infinity, alignment: .leading)

                    Spacer()
                }
            }
            .navigationTitle("照片详情")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("关闭") {
                        dismiss()
                    }
                }
            }
        }
    }
}

// MARK: - Preview

#Preview("Snapshot List") {
    SnapshotListView(viewModel: .preview)
}

#Preview("Empty State") {
    SnapshotListView()
}
