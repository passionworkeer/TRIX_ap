//
//  SnapshotListView.swift
//  TRIX3DCompanion
//
//  Snapshot gallery view with grid layout and pagination
//

import SwiftUI

// Helper function for localization
private func loc(_ key: String) -> String {
    NSLocalizedString(key, comment: "")
}

// MARK: - Snapshot List View

/// Photo gallery grid view with infinite scroll
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
                backgroundGradient

                // Content
                if viewModel.isEmpty {
                    emptyStateView
                } else {
                    snapshotGrid
                }
            }
            .navigationTitle(loc("snapshot.title"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button(loc("action.close")) {
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
            .alert("Delete Photo", isPresented: $showingDeleteConfirmation) {
                Button("Delete", role: .destructive) {
                    if let snapshot = snapshotToDelete {
                        Task {
                            await viewModel.deleteSnapshot(snapshot)
                        }
                    }
                }
                Button("Cancel", role: .cancel) {
                    snapshotToDelete = nil
                }
            } message: {
                Text("Are you sure you want to delete this photo? This action cannot be undone.")
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

    /// Background gradient
    private var backgroundGradient: some View {
        LinearGradient(
            colors: [
                Color.brandPurple.opacity(0.05),
                Color.brandPink.opacity(0.03),
                Color.clear
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
        .ignoresSafeArea()
    }

    /// Empty state view
    private var emptyStateView: some View {
        VStack(spacing: 20) {
            Image(systemName: "photo.on.rectangle.angled")
                .font(.system(size: 60))
                .foregroundColor(.textTertiary)

            VStack(spacing: 8) {
                Text("No Photos Yet")
                    .font(.title2)
                    .fontWeight(.semibold)

                Text("Your captured photos will appear here")
                    .font(.subheadline)
                    .foregroundColor(.textSecondary)
                    .multilineTextAlignment(.center)
            }
        }
        .padding()
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
            ProgressView(value: 0)
                .tint(.brandPurple)

            Text("Loading more...")
                .font(.subheadline)
                .foregroundColor(.textSecondary)
        }
        .padding(.vertical, 20)
    }
}

// MARK: - Snapshot Cell

/// Grid cell for snapshot thumbnail
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
            Color.secondaryBackground

            ProgressView(value: 0)
                .tint(.brandPurple)
        }
    }

    /// Error view
    private var errorView: some View {
        ZStack {
            Color.secondaryBackground

            VStack(spacing: 4) {
                Image(systemName: "exclamationmark.triangle")
                    .font(.title)
                    .foregroundColor(.textTertiary)

                Text("Failed to load")
                    .font(.caption2)
                    .foregroundColor(.textTertiary)
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
            return "Yesterday"
        } else {
            let formatter = DateFormatter()
            formatter.dateStyle = .short
            return formatter.string(from: date)
        }
    }
}

// MARK: - Snapshot Detail View

/// Detail view for single snapshot
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
                            ProgressView(value: 0)
                                .frame(height: 300)

                        case .success(let image):
                            image
                                .resizable()
                                .aspectRatio(contentMode: .fit)

                        case .failure:
                            Image(systemName: "exclamationmark.triangle")
                                .font(.system(size: 60))
                                .foregroundColor(.textTertiary)
                                .frame(height: 300)

                        @unknown default:
                            ProgressView(value: 0)
                                .frame(height: 300)
                        }
                    }

                    // Info section
                    VStack(alignment: .leading, spacing: 16) {
                        // Caption
                        if let caption = snapshot.caption {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Caption")
                                    .font(.caption)
                                    .foregroundColor(.textSecondary)

                                Text(caption)
                                    .font(.body)
                            }
                        }

                        // Location
                        if let locationName = snapshot.locationName {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Location")
                                    .font(.caption)
                                    .foregroundColor(.textSecondary)

                                HStack(spacing: 6) {
                                    Image(systemName: "mappin.circle.fill")
                                        .foregroundColor(.brandPurple)
                                    Text(locationName)
                                        .font(.body)
                                }
                            }
                        }

                        // Date
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Date")
                                .font(.caption)
                                .foregroundColor(.textSecondary)

                            Text(snapshot.createdAt.formatted(date: .long, time: .shortened))
                                .font(.body)
                        }
                    }
                    .padding(.horizontal)
                    .frame(maxWidth: .infinity, alignment: .leading)

                    Spacer()
                }
            }
            .navigationTitle("Photo Details")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Close") {
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

#Preview("Dark Mode") {
    SnapshotListView(viewModel: .preview)
        .preferredColorScheme(.dark)
}
