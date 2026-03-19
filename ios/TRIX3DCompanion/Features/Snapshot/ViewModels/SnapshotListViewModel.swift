//
//  SnapshotListViewModel.swift
//  TRIX3DCompanion
//
//  Snapshot list ViewModel - manages photo gallery state
//

import Foundation
import UIKit
import Combine

// MARK: - Snapshot List ViewModel

/// Snapshot list view model managing photo gallery with pagination
@MainActor
final class SnapshotListViewModel: ObservableObject {

    // MARK: - Published Properties

    /// List of snapshots
    @Published var snapshots: [Snapshot] = []

    /// Whether currently loading
    @Published var isLoading: Bool = false

    /// Whether more pages are available
    @Published var hasMorePages: Bool = true

    /// Error message to display
    @Published var errorMessage: String?

    /// Whether refresh is in progress
    @Published var isRefreshing: Bool = false

    /// Selected snapshot for detail view
    @Published var selectedSnapshot: Snapshot?

    /// Whether to show detail sheet
    @Published var showDetail: Bool = false

    /// Search query
    @Published var searchQuery: String = ""

    // MARK: - Private Properties

    /// Current page number
    private var currentPage: Int = 1

    /// Page size
    private let pageSize: Int = 20

    /// Total count from server
    private var totalCount: Int = 0

    /// API client
    private let apiClient: APIClient

    /// Cancellables
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Initialization

    /// Initialize SnapshotListViewModel
    /// - Parameter apiClient: API client dependency
    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient

        // Setup search debounce
        setupSearchBinding()
    }

    // MARK: - Setup

    /// Setup search binding with debounce
    private func setupSearchBinding() {
        $searchQuery
            .debounce(for: .milliseconds(500), scheduler: DispatchQueue.main)
            .sink { [weak self] _ in
                Task {
                    await self?.refreshSnapshots()
                }
            }
            .store(in: &cancellables)
    }

    // MARK: - Public Methods

    /// Load initial snapshots
    func loadSnapshots() async {
        guard !isLoading else { return }

        isLoading = true
        currentPage = 1

        do {
            let parameters: SnapshotParameters = [
                "page": 1,
                "limit": pageSize
            ]

            if let response: SnapshotsResponse = try? await apiClient.get(
                .snapshots,
                parameters: parameters
            ) {
                snapshots = response.snapshots
                totalCount = response.totalCount
                hasMorePages = response.snapshots.count >= pageSize
            } else {
                let snapshotList: [Snapshot] = try await apiClient.get(
                    .snapshots,
                    parameters: parameters
                )
                snapshots = snapshotList
                totalCount = snapshotList.count
                hasMorePages = snapshotList.count >= pageSize
            }

            errorMessage = nil

        } catch {
            errorMessage = String(format: NSLocalizedString("error.snapshot.load.failed", comment: ""), error.localizedDescription)
            snapshots = []
        }

        isLoading = false
    }

    /// Refresh snapshots (pull to refresh)
    func refreshSnapshots() async {
        guard !isRefreshing else { return }

        isRefreshing = true
        currentPage = 1

        do {
            let parameters = buildSnapshotParameters()

            if let response: SnapshotsResponse = try? await apiClient.get(
                .snapshots,
                parameters: parameters
            ) {
                snapshots = response.snapshots
                totalCount = response.totalCount
                hasMorePages = response.snapshots.count >= pageSize
            } else {
                let snapshotList: [Snapshot] = try await apiClient.get(
                    .snapshots,
                    parameters: parameters
                )
                snapshots = snapshotList
                totalCount = snapshotList.count
                hasMorePages = snapshotList.count >= pageSize
            }

            errorMessage = nil

        } catch {
            errorMessage = String(format: NSLocalizedString("error.snapshot.refresh.failed", comment: ""), error.localizedDescription)
        }

        isRefreshing = false
    }

    /// Load more snapshots (pagination)
    func loadMoreSnapshots() async {
        guard !isLoading && hasMorePages else { return }

        isLoading = true
        currentPage += 1

        do {
            let parameters = buildSnapshotParameters()

            if let response: SnapshotsResponse = try? await apiClient.get(
                .snapshots,
                parameters: parameters
            ) {
                snapshots.append(contentsOf: response.snapshots)
                hasMorePages = response.snapshots.count >= pageSize
            } else {
                let snapshotList: [Snapshot] = try await apiClient.get(
                    .snapshots,
                    parameters: parameters
                )
                let existingIDs = Set(snapshots.map(\.id))
                let newItems = snapshotList.filter { !existingIDs.contains($0.id) }
                snapshots.append(contentsOf: newItems)
                hasMorePages = newItems.count >= pageSize
            }

            errorMessage = nil

        } catch {
            // Revert page on error
            currentPage -= 1
            errorMessage = String(format: NSLocalizedString("error.snapshot.loadmore.failed", comment: ""), error.localizedDescription)
        }

        isLoading = false
    }

    /// Select a snapshot for detail view
    /// - Parameter snapshot: Snapshot to select
    func selectSnapshot(_ snapshot: Snapshot) {
        selectedSnapshot = snapshot
        showDetail = true
    }

    /// Delete a snapshot
    /// - Parameter snapshot: Snapshot to delete
    func deleteSnapshot(_ snapshot: Snapshot) async {
        // Optimistic update - remove from list immediately
        let index = snapshots.firstIndex(where: { $0.id == snapshot.id })
        guard let index = index else { return }

        let removedSnapshot = snapshots.remove(at: index)

        do {
            try await apiClient.deleteSnapshot(id: snapshot.id)
            errorMessage = nil

        } catch {
            // Revert on error
            snapshots.insert(removedSnapshot, at: index)
            errorMessage = String(format: NSLocalizedString("error.snapshot.delete.failed", comment: ""), error.localizedDescription)
        }
    }

    /// Clear error message
    func clearError() {
        errorMessage = nil
    }

    /// Check if more should be loaded
    /// - Parameter snapshot: The last visible snapshot
    func checkForLoadMore(_ snapshot: Snapshot) {
        // Load more when reaching 80% of the list
        let thresholdIndex = snapshots.index(snapshots.endIndex, offsetBy: -5)
        if let snapshotIndex = snapshots.firstIndex(where: { $0.id == snapshot.id }),
           snapshotIndex >= thresholdIndex {
            Task {
                await loadMoreSnapshots()
            }
        }
    }

    // MARK: - Computed Properties

    /// Whether list is empty
    var isEmpty: Bool {
        snapshots.isEmpty && !isLoading
    }

    /// Number of columns for grid
    var gridColumns: Int {
        2
    }

    // MARK: - Private Methods

    /// Build parameters for API call
    private func buildSnapshotParameters() -> SnapshotParameters {
        var params: SnapshotParameters = [
            "page": currentPage,
            "limit": pageSize
        ]

        // Add search query if present
        let trimmedQuery = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmedQuery.isEmpty {
            params["search"] = trimmedQuery
        }

        return params
    }
}

// MARK: - SnapshotParameters Type Alias

/// Type alias for snapshot parameters
typealias SnapshotParameters = [String: Any]

// MARK: - Preview Helpers

#if DEBUG
extension SnapshotListViewModel {
    /// Create preview view model with sample data
    static var preview: SnapshotListViewModel {
        let vm = SnapshotListViewModel()
        vm.snapshots = [
            Snapshot(
                id: "1",
                userId: "user1",
                imageUrl: "https://picsum.photos/400/400?random=1",
                thumbnailUrl: "https://picsum.photos/200/200?random=1",
                locationId: "loc1",
                locationName: "Central Park",
                latitude: 40.7829,
                longitude: -73.9654,
                caption: "Beautiful day at the park!",
                createdAt: Date().addingTimeInterval(-3600)
            ),
            Snapshot(
                id: "2",
                userId: "user1",
                imageUrl: "https://picsum.photos/400/400?random=2",
                thumbnailUrl: "https://picsum.photos/200/200?random=2",
                locationId: nil,
                locationName: nil,
                latitude: nil,
                longitude: nil,
                caption: "Morning coffee",
                createdAt: Date().addingTimeInterval(-7200)
            ),
            Snapshot(
                id: "3",
                userId: "user1",
                imageUrl: "https://picsum.photos/400/400?random=3",
                thumbnailUrl: "https://picsum.photos/200/200?random=3",
                locationId: "loc2",
                locationName: "Library",
                latitude: 39.9042,
                longitude: 116.4074,
                caption: "Study session",
                createdAt: Date().addingTimeInterval(-86400)
            ),
            Snapshot(
                id: "4",
                userId: "user1",
                imageUrl: "https://picsum.photos/400/400?random=4",
                thumbnailUrl: nil,
                locationId: nil,
                locationName: nil,
                latitude: nil,
                longitude: nil,
                caption: nil,
                createdAt: Date().addingTimeInterval(-172800)
            )
        ]
        return vm
    }
}
#endif
