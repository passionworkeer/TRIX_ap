//
//  TodoViewModel.swift
//  TRIX3DCompanion
//
//  Todo ViewModel for managing todo items with CRUD operations and local storage
//

import Foundation
import Combine

// MARK: - Todo View Model

/// Todo view model managing todo items state and operations
@MainActor
final class TodoViewModel: ObservableObject {

    // MARK: - Published Properties

    /// All todo items
    @Published private(set) var todos: [Todo] = []

    /// Current filter
    @Published var filter: TodoFilter = .all

    /// Current sort option
    @Published var sortBy: TodoSortOption = .priority

    /// Whether currently loading
    @Published private(set) var isLoading: Bool = false

    /// Error message to display
    @Published var errorMessage: String?

    /// Success message to display
    @Published var successMessage: String?

    /// Whether showing add/edit form
    @Published var showForm: Bool = false

    /// Todo being edited (nil for new todo)
    @Published var editingTodo: Todo?

    // MARK: - Private Properties

    private let userDefaultsKey = "workbench_todos"
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Computed Properties

    /// Filtered and sorted todos
    var filteredTodos: [Todo] {
        let filtered: [Todo]

        switch filter {
        case .all:
            filtered = todos
        case .active:
            filtered = todos.filter { !$0.completed }
        case .completed:
            filtered = todos.filter { $0.completed }
        }

        return sortTodos(filtered)
    }

    /// Active (incomplete) todos count
    var activeCount: Int {
        todos.filter { !$0.completed }.count
    }

    /// Completed todos count
    var completedCount: Int {
        todos.filter { $0.completed }.count
    }

    /// High priority todos count
    var highPriorityCount: Int {
        todos.filter { $0.priority == .high && !$0.completed }.count
    }

    /// Overdue todos count
    var overdueCount: Int {
        todos.filter { $0.isOverdue }.count
    }

    // MARK: - Initialization

    init() {
        loadTodos()
    }

    // MARK: - Public Methods - CRUD

    /// Add a new todo
    /// - Parameter todo: Todo to add
    func addTodo(_ todo: Todo) {
        var newTodo = todo
        newTodo.syncStatus = .pending
        todos.append(newTodo)
        saveTodos()
        successMessage = "Todo added successfully"
        triggerHapticFeedback()
    }

    /// Update an existing todo
    /// - Parameter todo: Todo with updated values
    func updateTodo(_ todo: Todo) {
        guard let index = todos.firstIndex(where: { $0.id == todo.id }) else {
            errorMessage = "Todo not found"
            return
        }

        var updatedTodo = todo
        updatedTodo.updatedAt = Date()
        updatedTodo.syncStatus = .pending
        todos[index] = updatedTodo
        saveTodos()
        successMessage = "Todo updated successfully"
        triggerHapticFeedback()
    }

    /// Delete a todo
    /// - Parameter id: Todo ID to delete
    func deleteTodo(_ id: UUID) {
        todos.removeAll { $0.id == id }
        saveTodos()
        successMessage = "Todo deleted"
        triggerHapticFeedback()
    }

    /// Toggle todo completion status
    /// - Parameter id: Todo ID to toggle
    func toggleComplete(_ id: UUID) {
        guard let index = todos.firstIndex(where: { $0.id == id }) else { return }

        var todo = todos[index]
        todo.completed.toggle()
        todo.updatedAt = Date()
        todo.syncStatus = .pending
        todos[index] = todo
        saveTodos()
        triggerHapticFeedback()
    }

    /// Batch delete completed todos
    func deleteCompletedTodos() {
        todos.removeAll { $0.completed }
        saveTodos()
        successMessage = "Completed todos cleared"
        triggerHapticFeedback()
    }

    // MARK: - Public Methods - Form

    /// Show form for adding new todo
    func showAddForm() {
        editingTodo = nil
        showForm = true
    }

    /// Show form for editing existing todo
    /// - Parameter todo: Todo to edit
    func showEditForm(for todo: Todo) {
        editingTodo = todo
        showForm = true
    }

    /// Dismiss form
    func dismissForm() {
        showForm = false
        editingTodo = nil
    }

    // MARK: - Public Methods - Filter & Sort

    /// Set filter
    /// - Parameter newFilter: New filter value
    func setFilter(_ newFilter: TodoFilter) {
        filter = newFilter
        triggerHapticFeedback()
    }

    /// Set sort option
    /// - Parameter newSort: New sort option
    func setSort(_ newSort: TodoSortOption) {
        sortBy = newSort
        triggerHapticFeedback()
    }

    // MARK: - Public Methods - Messages

    /// Clear messages
    func clearMessages() {
        errorMessage = nil
        successMessage = nil
    }

    // MARK: - Private Methods

    /// Sort todos based on current sort option
    /// - Parameter todos: Todos to sort
    /// - Returns: Sorted todos
    private func sortTodos(_ todos: [Todo]) -> [Todo] {
        switch sortBy {
        case .createdAt:
            return todos.sorted { $0.createdAt > $1.createdAt }
        case .dueDate:
            return todos.sorted { todo1, todo2 in
                guard let date1 = todo1.dueDate else { return false }
                guard let date2 = todo2.dueDate else { return true }
                return date1 < date2
            }
        case .priority:
            return todos.sorted { todo1, todo2 in
                let priorityOrder: [Todo.Priority: Int] = [.high: 0, .medium: 1, .low: 2]
                return (priorityOrder[todo1.priority] ?? 2) < (priorityOrder[todo2.priority] ?? 2)
            }
        case .title:
            return todos.sorted { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending }
        }
    }

    /// Save todos to UserDefaults
    private func saveTodos() {
        do {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            let data = try encoder.encode(todos)
            UserDefaults.standard.set(data, forKey: userDefaultsKey)
        } catch {
            SecureLogger.shared.error("Failed to save todos: \(error)")
            errorMessage = "Failed to save todos"
        }
    }

    /// Load todos from UserDefaults
    private func loadTodos() {
        guard let data = UserDefaults.standard.data(forKey: userDefaultsKey) else {
            // No saved data, start with empty array
            return
        }

        do {
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            todos = try decoder.decode([Todo].self, from: data)
        } catch {
            SecureLogger.shared.error("Failed to load todos: \(error)")
            // Start fresh if data is corrupted
            todos = []
        }
    }

    /// Trigger haptic feedback
    private func triggerHapticFeedback() {
        let generator = UIImpactFeedbackGenerator(style: .light)
        generator.impactOccurred()
    }
}

// MARK: - Preview Helpers

#if DEBUG
extension TodoViewModel {
    /// Create view model with sample data
    static var preview: TodoViewModel {
        let vm = TodoViewModel()
        vm.todos = Todo.sampleTodos
        return vm
    }
}
#endif
