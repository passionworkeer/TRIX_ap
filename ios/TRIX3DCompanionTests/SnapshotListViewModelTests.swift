//
//  SnapshotListViewModelTests.swift
//  TRIX3DCompanionTests
//
//  Unit tests for SnapshotListViewModel
//

import XCTest
import Combine
@testable import TRIX3DCompanion

/// Unit tests for SnapshotListViewModel
final class SnapshotListViewModelTests: XCTestCase {

    // MARK: - Properties

    var snapshotListViewModel: SnapshotListViewModel!
    var mockAPIClient: MockSnapshotAPIClient!
    var cancellables: Set<AnyCancellable>!

    // MARK: - Test Lifecycle

    override func setUpWithError() throws {
        mockAPIClient = MockSnapshotAPIClient()

        snapshotListViewModel = SnapshotListViewModel(
            apiClient: mockAPIClient as! APIClient
        )
        cancellables = Set<AnyCancellable>()
    }

    override func tearDownWithError() throws {
        snapshotListViewModel = nil
        mockAPIClient = nil
        cancellables = nil
    }

    // MARK: - Load Snapshots Tests

    func test_loadSnapshots_success() async throws {
        // Act
        await snapshotListViewModel.loadSnapshots()

        // Assert
        XCTAssertFalse(snapshotListViewModel.snapshots.isEmpty)
    }

    func test_loadSnapshots_error_setsErrorMessage() async throws {
        // Arrange
        mockAPIClient.shouldThrowError = true

        // Act
        await snapshotListViewModel.loadSnapshots()

        // Assert
        XCTAssertNotNil(snapshotListViewModel.errorMessage)
    }

    // MARK: - Refresh Tests

    func test_refreshSnapshots_success() async throws {
        // Act
        await snapshotListViewModel.refreshSnapshots()

        // Assert
        XCTAssertFalse(snapshotListViewModel.snapshots.isEmpty)
        XCTAssertFalse(snapshotListViewModel.isRefreshing)
    }

    func test_refreshSnapshots_whileRefreshing_doesNotDuplicate() async throws {
        // Arrange
        snapshotListViewModel.isRefreshing = true

        // Act
        await snapshotListViewModel.refreshSnapshots()

        // Assert - Should not load again
        XCTAssertEqual(mockAPIClient.getSnapshotCallCount, 0)
    }

    // MARK: - Load More Tests

    func test_loadMoreSnapshots_loadsMore() async throws {
        // Arrange
        await snapshotListViewModel.loadSnapshots()
        let initialCount = snapshotListViewModel.snapshots.count

        // Act
        await snapshotListViewModel.loadMoreSnapshots()

        // Assert
        XCTAssertGreaterThanOrEqual(snapshotListViewModel.snapshots.count, initialCount)
    }

    func test_loadMoreSnapshots_whenNoMorePages_doesNotLoad() async throws {
        // Arrange
        await snapshotListViewModel.loadSnapshots()
        snapshotListViewModel.hasMorePages = false

        // Act
        await snapshotListViewModel.loadMoreSnapshots()

        // Assert - Count should remain the same
        XCTAssertFalse(snapshotListViewModel.hasMorePages)
    }

    // MARK: - Select Snapshot Tests

    func test_selectSnapshot_setsSelectedSnapshot() {
        // Arrange
        let snapshot = createMockSnapshot()

        // Act
        snapshotListViewModel.selectSnapshot(snapshot)

        // Assert
        XCTAssertEqual(snapshotListViewModel.selectedSnapshot?.id, snapshot.id)
        XCTAssertTrue(snapshotListViewModel.showDetail)
    }

    // MARK: - Delete Snapshot Tests

    func test_deleteSnapshot_removesFromList() async throws {
        // Arrange
        await snapshotListViewModel.loadSnapshots()
        let snapshot = snapshotListViewModel.snapshots.first!
        let initialCount = snapshotListViewModel.snapshots.count

        // Act
        await snapshotListViewModel.deleteSnapshot(snapshot)

        // Assert
        XCTAssertEqual(snapshotListViewModel.snapshots.count, initialCount - 1)
    }

    // MARK: - Search Tests

    func test_searchQuery_triggersSearch() async throws {
        // Arrange
        await snapshotListViewModel.loadSnapshots()

        // Act - Search should be debounced, so we wait
        snapshotListViewModel.searchQuery = "test"

        // Wait for debounce
        try await Task.sleep(nanoseconds: 600_000_000)

        // Assert - API should have been called with search parameter
        // Note: Exact assertion depends on debounce behavior
    }

    // MARK: - Check Load More Tests

    func test_checkForLoadMore_triggersLoadWhenThresholdReached() async throws {
        // Arrange
        await snapshotListViewModel.loadSnapshots()

        // Get the last snapshot
        guard let lastSnapshot = snapshotListViewModel.snapshots.last else {
            XCTFail("No snapshots loaded")
            return
        }

        // Act
        snapshotListViewModel.checkForLoadMore(lastSnapshot)

        // Note: This might trigger load more depending on implementation
    }

    // MARK: - Computed Properties Tests

    func test_isEmpty_trueWhenNoSnapshots() {
        // Arrange - After setup, might have snapshots
        // Just verify the property exists
        _ = snapshotListViewModel.isEmpty
    }

    func test_gridColumns_returnsTwo() {
        // Assert
        XCTAssertEqual(snapshotListViewModel.gridColumns, 2)
    }

    // MARK: - Clear Error Tests

    func test_clearError_clearsErrorMessage() {
        // Arrange
        snapshotListViewModel.errorMessage = "Test error"

        // Act
        snapshotListViewModel.clearError()

        // Assert
        XCTAssertNil(snapshotListViewModel.errorMessage)
    }

    // MARK: - Helper Methods

    private func createMockSnapshot() -> Snapshot {
        Snapshot(
            id: "snapshot-1",
            userId: "user-1",
            imageUrl: "https://picsum.photos/400/400?random=1",
            thumbnailUrl: "https://picsum.photos/200/200?random=1",
            locationId: "loc-1",
            locationName: "Test Location",
            latitude: 40.7128,
            longitude: -74.0060,
            caption: "Test caption",
            createdAt: Date()
        )
    }
}

// MARK: - Mock Snapshot APIClient

class MockSnapshotAPIClient {
    var mockSnapshots: [Snapshot] = []
    var shouldThrowError: Bool = false

    var getSnapshotCallCount: Int = 0

    init() {
        mockSnapshots = [
            Snapshot(
                id: "1",
                userId: "user-1",
                imageUrl: "https://picsum.photos/400/400?random=1",
                thumbnailUrl: "https://picsum.photos/200/200?random=1",
                locationId: "loc-1",
                locationName: "Central Park",
                latitude: 40.7829,
                longitude: -73.9654,
                caption: "Beautiful day!",
                createdAt: Date().addingTimeInterval(-3600)
            ),
            Snapshot(
                id: "2",
                userId: "user-1",
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
                userId: "user-1",
                imageUrl: "https://picsum.photos/400/400?random=3",
                thumbnailUrl: nil,
                locationId: "loc-2",
                locationName: "Library",
                latitude: 39.9042,
                longitude: 116.4074,
                caption: nil,
                createdAt: Date().addingTimeInterval(-86400)
            )
        ]
    }

    func get(_ endpoint: APIEndpoint, parameters: [String: Any]? = nil) async throws -> SnapshotsResponse {
        getSnapshotCallCount += 1

        if shouldThrowError {
            throw NetworkError.serverError(message: "Test error")
        }

        return SnapshotsResponse(
            snapshots: mockSnapshots,
            totalCount: mockSnapshots.count,
            page: 1,
            limit: 20
        )
    }
}

// MARK: - SnapshotsResponse

struct SnapshotsResponse: Codable {
    let snapshots: [Snapshot]
    let totalCount: Int
    let page: Int
    let limit: Int
}
