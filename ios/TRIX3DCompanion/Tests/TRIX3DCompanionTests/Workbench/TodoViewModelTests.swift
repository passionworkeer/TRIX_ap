//
//  TodoViewModelTests.swift
//  TRIX3DCompanionTests
//
//  Complete test suite for TodoViewModel
//

import XCTest
import Combine
@testable import TRIX3DCompanion

// MARK: - TodoViewModel Tests

@MainActor
final class TodoViewModelTests: XCTestCase {

    // MARK: - Properties

    var sut: TodoViewModel!
    var mockTodoService: MockTodoService!
    var mockHapticProvider: MockHapticFeedbackProvider!
    var cancellables: Set<AnyCancellable>!

    // MARK: - Test Lifecycle

    override func setUp() {
        super.setUp()

        mockTodoService = MockTodoService()
        mockHapticProvider = MockHapticFeedbackProvider()

        sut = TodoViewModel(
            todoService: mockTodoService,
            hapticProvider: mockHapticProvider
        )

        cancellables = Set<AnyCancellable>()
    }

    override func tearDown() {
        sut = nil
        mockTodoService = nil
        mockHapticProvider = nil
        cancellables = nil
        super.tearDown()
    }

    // MARK: - Helpers

    private func waitForAsyncStateChange() async {
        try? await Task.sleep(nanoseconds: 250_000_000)
    }

    private func waitForInitialLoadToSettle() async {
        try? await Task.sleep(nanoseconds: 150_000_000)
        mockTodoService.resetCallTracking()
    }

    private func loadMockTodos(_ todos: [Todo]) async {
        await waitForInitialLoadToSettle()
        mockTodoService.setTodos(todos)
        sut.loadTodos()
        await waitForAsyncStateChange()
    }

    // MARK: - Initial State Tests

    func testInitialState_EmptyTodos() {
        XCTAssertTrue(sut.todos.isEmpty)
    }

    func testInitialState_DefaultFilter() {
        XCTAssertEqual(sut.filter, .all)
    }

    func testInitialState_DefaultSort() {
        XCTAssertEqual(sut.sortBy, .priority)
    }

    func testInitialState_NotLoading() {
        XCTAssertFalse(sut.isLoading)
    }

    func testInitialState_NoError() {
        XCTAssertNil(sut.errorMessage)
    }

    func testInitialState_NoSuccessMessage() {
        XCTAssertNil(sut.successMessage)
    }

    func testInitialState_FormNotShown() {
        XCTAssertFalse(sut.showForm)
    }

    func testInitialState_NoEditingTodo() {
        XCTAssertNil(sut.editingTodo)
    }

    // MARK: - Computed Properties Tests

    func testActiveCount_ReturnsCorrectCount() async {
        // Given
        let todos = [
            Todo(title: "Active 1", completed: false),
            Todo(title: "Active 2", completed: false),
            Todo(title: "Completed", completed: true)
        ]
        await loadMockTodos(todos)

        // Then
        XCTAssertEqual(sut.activeCount, 2)
    }

    func testCompletedCount_ReturnsCorrectCount() async {
        // Given
        let todos = [
            Todo(title: "Active", completed: false),
            Todo(title: "Completed 1", completed: true),
            Todo(title: "Completed 2", completed: true)
        ]
        await loadMockTodos(todos)

        // Then
        XCTAssertEqual(sut.completedCount, 2)
    }

    func testHighPriorityCount_ReturnsCorrectCount() async {
        // Given
        let todos = [
            Todo(title: "High Priority", completed: false, priority: .high),
            Todo(title: "Medium Priority", completed: false, priority: .medium),
            Todo(title: "High Completed", completed: true, priority: .high),
            Todo(title: "High Active", completed: false, priority: .high)
        ]
        await loadMockTodos(todos)

        // Then
        XCTAssertEqual(sut.highPriorityCount, 2) // Only incomplete high priority
    }

    func testOverdueCount_ReturnsCorrectCount() async {
        // Given
        let todos = [
            Todo(title: "Overdue 1", completed: false, dueDate: Date().addingTimeInterval(-3600)),
            Todo(title: "Overdue 2", completed: false, dueDate: Date().addingTimeInterval(-7200)),
            Todo(title: "Future Due", completed: false, dueDate: Date().addingTimeInterval(3600)),
            Todo(title: "Completed Overdue", completed: true, dueDate: Date().addingTimeInterval(-3600)) // Completed should not count
        ]
        await loadMockTodos(todos)

        // Then
        XCTAssertEqual(sut.overdueCount, 2)
    }

    func testFilteredTodos_AllFilter() async {
        // Given
        let todos = [
            Todo(title: "Active", completed: false),
            Todo(title: "Completed", completed: true)
        ]
        await loadMockTodos(todos)

        // When
        sut.setFilter(.all)

        // Then
        XCTAssertEqual(sut.filteredTodos.count, 2)
    }

    func testFilteredTodos_ActiveFilter() async {
        // Given
        let todos = [
            Todo(title: "Active 1", completed: false),
            Todo(title: "Active 2", completed: false),
            Todo(title: "Completed", completed: true)
        ]
        await loadMockTodos(todos)

        // When
        sut.setFilter(.active)

        // Then
        XCTAssertEqual(sut.filteredTodos.count, 2)
        XCTAssertTrue(sut.filteredTodos.allSatisfy { !$0.completed })
    }

    func testFilteredTodos_CompletedFilter() async {
        // Given
        let todos = [
            Todo(title: "Active", completed: false),
            Todo(title: "Completed 1", completed: true),
            Todo(title: "Completed 2", completed: true)
        ]
        await loadMockTodos(todos)

        // When
        sut.setFilter(.completed)

        // Then
        XCTAssertEqual(sut.filteredTodos.count, 2)
        XCTAssertTrue(sut.filteredTodos.allSatisfy { $0.completed })
    }

    // MARK: - Sorting Tests

    func testSortTodos_ByPriority() async {
        // Given
        let todos = [
            Todo(title: "Low", priority: .low),
            Todo(title: "High", priority: .high),
            Todo(title: "Medium", priority: .medium)
        ]
        await loadMockTodos(todos)

        // When
        sut.setSort(.priority)

        // Then
        let sorted = sut.filteredTodos
        XCTAssertEqual(sorted[0].priority, .high)
        XCTAssertEqual(sorted[1].priority, .medium)
        XCTAssertEqual(sorted[2].priority, .low)
    }

    func testSortTodos_ByTitle() async {
        // Given
        let todos = [
            Todo(title: "Zebra"),
            Todo(title: "Apple"),
            Todo(title: "Mango")
        ]
        await loadMockTodos(todos)

        // When
        sut.setSort(.title)

        // Then
        let sorted = sut.filteredTodos
        XCTAssertEqual(sorted[0].title, "Apple")
        XCTAssertEqual(sorted[1].title, "Mango")
        XCTAssertEqual(sorted[2].title, "Zebra")
    }

    func testSortTodos_ByDueDate() async {
        // Given
        let now = Date()
        let todos = [
            Todo(title: "Later", dueDate: now.addingTimeInterval(86400 * 3)),
            Todo(title: "Soon", dueDate: now.addingTimeInterval(86400)),
            Todo(title: "No Due Date", dueDate: nil)
        ]
        await loadMockTodos(todos)

        // When
        sut.setSort(.dueDate)

        // Then
        let sorted = sut.filteredTodos
        XCTAssertEqual(sorted[0].title, "Soon")
        XCTAssertEqual(sorted[1].title, "Later")
        // No due date items come last
    }

    func testSortTodos_ByCreatedAt() async {
        // Given
        let now = Date()
        let todos = [
            Todo(title: "Newest", createdAt: now),
            Todo(title: "Oldest", createdAt: now.addingTimeInterval(-86400 * 2)),
            Todo(title: "Middle", createdAt: now.addingTimeInterval(-86400))
        ]
        await loadMockTodos(todos)

        // When
        sut.setSort(.createdAt)

        // Then
        let sorted = sut.filteredTodos
        XCTAssertEqual(sorted[0].title, "Newest")
        XCTAssertEqual(sorted[1].title, "Middle")
        XCTAssertEqual(sorted[2].title, "Oldest")
    }

    // MARK: - CRUD Operations Tests

    func testAddTodo_Success() async {
        await waitForInitialLoadToSettle()

        // Given
        let todo = Todo(
            title: "New Task",
            description: "Task description",
            priority: .high,
            dueDate: Date().addingTimeInterval(3600)
        )

        // When
        sut.addTodo(todo)

        // Wait for async operation
        await waitForAsyncStateChange()

        // Then
        XCTAssertTrue(mockTodoService.createTodoCalled)
        XCTAssertEqual(sut.todos.count, 1)
        XCTAssertEqual(sut.todos.first?.title, "New Task")
        XCTAssertEqual(sut.successMessage, NSLocalizedString("todo.add.success", comment: ""))
    }

    func testAddTodo_ServiceFailure() async {
        await waitForInitialLoadToSettle()

        // Given
        mockTodoService.shouldFailCreate = true
        mockTodoService.mockError = TodoServiceError.createFailed(underlying: NSError(domain: "Test", code: 500))

        let todo = Todo(title: "New Task")

        // When
        sut.addTodo(todo)

        // Wait for async operation
        await waitForAsyncStateChange()

        // Then
        XCTAssertNotNil(sut.errorMessage)
        XCTAssertTrue(sut.todos.isEmpty)
    }

    func testUpdateTodo_Success() async {
        // Given
        let todo = Todo(
            id: UUID(),
            title: "Original Title",
            priority: .medium,
            syncStatus: .synced
        )
        await loadMockTodos([todo])

        // When
        let updated = Todo(
            id: todo.id,
            title: "Updated Title",
            description: todo.description,
            completed: todo.completed,
            priority: .high,
            dueDate: todo.dueDate,
            createdAt: todo.createdAt,
            updatedAt: Date(),
            syncStatus: .synced
        )
        sut.updateTodo(updated)

        // Wait for async operation
        await waitForAsyncStateChange()

        // Then
        XCTAssertTrue(mockTodoService.updateTodoCalled)
        XCTAssertEqual(sut.successMessage, NSLocalizedString("todo.edit.success", comment: ""))
    }

    func testUpdateTodo_ServiceFailure() async {
        // Given
        mockTodoService.shouldFailUpdate = true
        mockTodoService.mockError = TodoServiceError.updateFailed(underlying: NSError(domain: "Test", code: 500))

        let todo = Todo(id: UUID(), title: "Test")
        await loadMockTodos([todo])

        // When
        sut.updateTodo(todo)

        // Wait for async operation
        await waitForAsyncStateChange()

        // Then
        XCTAssertNotNil(sut.errorMessage)
    }

    func testDeleteTodo_Success() async {
        // Given
        let todoId = UUID()
        let todo = Todo(id: todoId, title: "To Delete")
        await loadMockTodos([todo])

        // When
        sut.deleteTodo(todoId)

        // Wait for async operation
        await waitForAsyncStateChange()

        // Then
        XCTAssertTrue(mockTodoService.deleteTodoCalled)
        XCTAssertEqual(sut.todos.count, 0)
        XCTAssertEqual(sut.successMessage, NSLocalizedString("todo.delete.success", comment: ""))
    }

    func testDeleteTodo_ServiceFailure() async {
        // Given
        mockTodoService.shouldFailDelete = true
        mockTodoService.mockError = TodoServiceError.deleteFailed(underlying: NSError(domain: "Test", code: 500))

        let todoId = UUID()
        let todo = Todo(id: todoId, title: "Test")
        await loadMockTodos([todo])

        // When
        sut.deleteTodo(todoId)

        // Wait for async operation
        await waitForAsyncStateChange()

        // Then
        XCTAssertNotNil(sut.errorMessage)
        XCTAssertEqual(sut.todos.count, 1) // Should not be deleted
    }

    func testToggleComplete_Success() async {
        // Given
        let todoId = UUID()
        let todo = Todo(id: todoId, title: "Toggle Me", completed: false)
        await loadMockTodos([todo])

        // When
        sut.toggleComplete(todoId)

        // Wait for async operation
        await waitForAsyncStateChange()

        // Then
        XCTAssertTrue(mockTodoService.toggleTodoCalled)
    }

    func testToggleComplete_ServiceFailure() async {
        // Given
        mockTodoService.shouldFailToggle = true
        mockTodoService.mockError = TodoServiceError.toggleFailed(underlying: NSError(domain: "Test", code: 500))

        let todoId = UUID()
        let todo = Todo(id: todoId, title: "Test", completed: false)
        await loadMockTodos([todo])

        // When
        sut.toggleComplete(todoId)

        // Wait for async operation
        await waitForAsyncStateChange()

        // Then
        XCTAssertNotNil(sut.errorMessage)
    }

    // MARK: - Batch Delete Tests

    func testDeleteCompletedTodos_DeletesOnlyCompleted() async {
        // Given
        let completedId1 = UUID()
        let completedId2 = UUID()
        let activeId = UUID()

        let todos = [
            Todo(id: completedId1, title: "Completed 1", completed: true),
            Todo(id: completedId2, title: "Completed 2", completed: true),
            Todo(id: activeId, title: "Active", completed: false)
        ]
        await loadMockTodos(todos)

        // When
        sut.deleteCompletedTodos()

        // Wait for async operations
        try? await Task.sleep(nanoseconds: 600_000_000)

        // Then
        XCTAssertEqual(sut.todos.count, 1)
        XCTAssertEqual(sut.todos.first?.id, activeId)
        XCTAssertEqual(sut.successMessage, NSLocalizedString("todo.completed.cleared", comment: ""))
    }

    func testDeleteCompletedTodos_NoCompletedTodos() async {
        // Given
        let todos = [
            Todo(title: "Active 1", completed: false),
            Todo(title: "Active 2", completed: false)
        ]
        await loadMockTodos(todos)

        // When
        sut.deleteCompletedTodos()

        // Wait for async operations
        try? await Task.sleep(nanoseconds: 600_000_000)

        // Then
        XCTAssertEqual(sut.todos.count, 2) // All still present
    }

    // MARK: - Form Methods Tests

    func testShowAddForm_SetsCorrectState() {
        // When
        sut.showAddForm()

        // Then
        XCTAssertTrue(sut.showForm)
        XCTAssertNil(sut.editingTodo)
    }

    func testShowEditForm_SetsCorrectState() {
        // Given
        let todo = Todo(title: "Test")

        // When
        sut.showEditForm(for: todo)

        // Then
        XCTAssertTrue(sut.showForm)
        XCTAssertEqual(sut.editingTodo, todo)
    }

    func testDismissForm_ResetsState() {
        // Given
        let todo = Todo(title: "Test")
        sut.showEditForm(for: todo)
        XCTAssertTrue(sut.showForm)
        XCTAssertNotNil(sut.editingTodo)

        // When
        sut.dismissForm()

        // Then
        XCTAssertFalse(sut.showForm)
        XCTAssertNil(sut.editingTodo)
    }

    // MARK: - Filter Tests

    func testSetFilter_UpdatesFilter() {
        // When
        sut.setFilter(.active)

        // Then
        XCTAssertEqual(sut.filter, .active)
    }

    func testSetFilter_EachCase() {
        let cases: [TodoFilter] = [.all, .active, .completed]

        for filterCase in cases {
            sut.setFilter(filterCase)
            XCTAssertEqual(sut.filter, filterCase)
        }
    }

    // MARK: - Sort Tests

    func testSetSort_UpdatesSort() {
        // When
        sut.setSort(.title)

        // Then
        XCTAssertEqual(sut.sortBy, .title)
    }

    func testSetSort_EachCase() {
        let cases: [TodoSortOption] = [.createdAt, .dueDate, .priority, .title]

        for sortCase in cases {
            sut.setSort(sortCase)
            XCTAssertEqual(sut.sortBy, sortCase)
        }
    }

    // MARK: - Message Handling Tests

    func testClearMessages_ClearsBoth() {
        // Given
        sut.errorMessage = "Error"
        sut.successMessage = "Success"

        // When
        sut.clearMessages()

        // Then
        XCTAssertNil(sut.errorMessage)
        XCTAssertNil(sut.successMessage)
    }

    // MARK: - Haptic Feedback Tests

    func testTriggerHaptic_CallsProvider() {
        // When
        sut.triggerHaptic()

        // Then
        XCTAssertTrue(mockHapticProvider.triggerCalled)
        XCTAssertEqual(mockHapticProvider.triggerCount, 1)
    }

    func testTriggerHaptic_MultipleCalls() {
        // When
        sut.triggerHaptic()
        sut.triggerHaptic()

        // Then
        XCTAssertEqual(mockHapticProvider.triggerCount, 2)
    }

    // MARK: - Load and Refresh Tests

    func testLoadTodos_Success() async {
        await waitForInitialLoadToSettle()

        // Given
        let todos = [
            Todo(title: "Todo 1"),
            Todo(title: "Todo 2")
        ]
        mockTodoService.setTodos(todos)

        // When
        sut.loadTodos()

        // Wait for async operation
        await waitForAsyncStateChange()

        // Then
        XCTAssertTrue(mockTodoService.fetchTodosCalled)
        XCTAssertEqual(sut.todos.count, 2)
    }

    func testLoadTodos_Failure() async {
        await waitForInitialLoadToSettle()

        // Given
        mockTodoService.shouldFailFetch = true
        mockTodoService.mockError = TodoServiceError.fetchFailed(underlying: NSError(domain: "Test", code: 500))

        // When
        sut.loadTodos()

        // Wait for async operation
        await waitForAsyncStateChange()

        // Then
        XCTAssertNotNil(sut.errorMessage)
    }

    func testLoadSampleTodos_LoadsData() {
        // When
        sut.loadSampleTodos()

        // Then
        XCTAssertFalse(sut.todos.isEmpty)
    }

    func testRefresh_CallsLoadTodos() async {
        await waitForInitialLoadToSettle()

        // Given
        mockTodoService.setTodos([Todo(title: "Test")])

        // When
        sut.refresh()

        // Wait for async operation
        await waitForAsyncStateChange()

        // Then
        XCTAssertTrue(mockTodoService.fetchTodosCalled)
    }

    // MARK: - Loading State Tests

    func testLoadingState_ChangesDuringOperation() async {
        await waitForInitialLoadToSettle()

        // Given
        let expectation = expectation(description: "Loading state changes")
        var loadingStates: [Bool] = []

        sut.$isLoading
            .dropFirst()
            .sink { isLoading in
                loadingStates.append(isLoading)
                if loadingStates.suffix(2) == [true, false] {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)

        // When
        sut.loadTodos()

        // Then
        await fulfillment(of: [expectation], timeout: 2.0)
        XCTAssertEqual(Array(loadingStates.suffix(2)), [true, false])
    }

    // MARK: - Filtered Todos Combined with Sort Tests

    func testFilteredTodos_SortAndFilterWorkTogether() async {
        // Given
        let todos = [
            Todo(title: "High Active", completed: false, priority: .high),
            Todo(title: "Low Completed", completed: true, priority: .low),
            Todo(title: "Medium Active", completed: false, priority: .medium)
        ]
        await loadMockTodos(todos)

        // When - Active filter with priority sort
        sut.setFilter(.active)
        sut.setSort(.priority)

        // Then
        let filtered = sut.filteredTodos
        XCTAssertEqual(filtered.count, 2)
        XCTAssertTrue(filtered.allSatisfy { !$0.completed })
        XCTAssertEqual(filtered.first?.priority, .high)
        XCTAssertEqual(filtered.last?.priority, .medium)
    }

    func testFilteredTodos_EmptyAfterFilter() async {
        // Given
        let todos = [
            Todo(title: "Active", completed: false)
        ]
        await loadMockTodos(todos)

        // When
        sut.setFilter(.completed)

        // Then
        XCTAssertTrue(sut.filteredTodos.isEmpty)
    }

    // MARK: - Error State Tests

    func testErrorMessage_PreservedBetweenOperations() async {
        // Given
        mockTodoService.shouldFailFetch = true
        mockTodoService.mockError = TodoServiceError.fetchFailed(underlying: NSError(domain: "Test", code: 500))

        // When
        sut.loadTodos()

        // Wait
        try? await Task.sleep(nanoseconds: 200_000_000)

        // Then
        XCTAssertNotNil(sut.errorMessage)
        XCTAssertTrue(sut.errorMessage!.contains("fetch"))
    }

    func testMultipleFailures_UpdatesErrorMessage() async {
        // Given
        mockTodoService.shouldFailCreate = true
        mockTodoService.mockError = TodoServiceError.createFailed(underlying: NSError(domain: "Test", code: 500))

        // When
        sut.addTodo(Todo(title: "New"))

        // Wait
        try? await Task.sleep(nanoseconds: 200_000_000)

        // Then
        XCTAssertNotNil(sut.errorMessage)
        XCTAssertTrue(sut.errorMessage!.contains("create"))
    }
}
