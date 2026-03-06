//
//  TodoService.swift
//  TRIX3DCompanion
//
//  Todo service for task management
//

import Foundation
import Combine

// MARK: - Todo Service Error

enum TodoServiceError: Error, LocalizedError {
    case fetchFailed(underlying: Error)
    case createFailed(underlying: Error)
    case updateFailed(underlying: Error)
    case deleteFailed(underlying: Error)
    case toggleFailed(underlying: Error)
    case unknown(underlying: Error?)

    var errorDescription: String? {
        switch self {
        case .fetchFailed(let error):
            return "Failed to fetch todos: \(error.localizedDescription)"
        case .createFailed(let error):
            return "Failed to create todo: \(error.localizedDescription)"
        case .updateFailed(let error):
            return "Failed to update todo: \(error.localizedDescription)"
        case .deleteFailed(let error):
            return "Failed to delete todo: \(error.localizedDescription)"
        case .toggleFailed(let error):
            return "Failed to toggle todo: \(error.localizedDescription)"
        case .unknown(let error):
            return error?.localizedDescription ?? "Unknown error"
        }
    }
}

// MARK: - Todo Service Protocol

protocol TodoServiceProtocol {
    var todos: [Todo] { get }
    var isLoading: Bool { get }

    func fetchTodos() async throws -> [Todo]
    func createTodo(_ request: CreateTodoRequest) async throws -> Todo
    func updateTodo(id: String, request: UpdateTodoRequest) async throws -> Todo
    func deleteTodo(id: String) async throws
    func toggleTodo(id: String) async throws -> Todo
}

// MARK: - Todo Service

@MainActor
final class TodoService: ObservableObject, TodoServiceProtocol {

    static let shared = TodoService()

    // MARK: - Published Properties

    @Published private(set) var todos: [Todo] = []
    @Published private(set) var isLoading: Bool = false
    @Published private(set) var lastError: TodoServiceError?

    // MARK: - Dependencies

    private let apiClient: APIClient

    // MARK: - Initialization

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    // MARK: - Public Methods

    /// Fetch all todos
    func fetchTodos() async throws -> [Todo] {
        isLoading = true
        lastError = nil

        do {
            let response: [Todo] = try await apiClient.get(.todoList)
            self.todos = response
            isLoading = false
            return response
        } catch {
            let serviceError = TodoServiceError.fetchFailed(underlying: error)
            lastError = serviceError
            isLoading = false
            throw serviceError
        }
    }

    /// Create a new todo
    func createTodo(_ request: CreateTodoRequest) async throws -> Todo {
        isLoading = true
        lastError = nil

        do {
            let apiRequest = APICreateTodoRequest(
                title: request.title,
                description: request.description,
                dueDate: request.dueDate,
                priority: priorityToInt(request.priority),
                tags: nil
            )
            let response: APITodo = try await apiClient.post(.todoCreate, body: apiRequest)
            let todo = convertToLocal(response)
            self.todos.append(todo)
            isLoading = false
            return todo
        } catch {
            let serviceError = TodoServiceError.createFailed(underlying: error)
            lastError = serviceError
            isLoading = false
            throw serviceError
        }
    }

    /// Update an existing todo
    func updateTodo(id: String, request: UpdateTodoRequest) async throws -> Todo {
        isLoading = true
        lastError = nil

        do {
            let apiRequest = APIUpdateTodoRequest(
                title: request.title,
                description: request.description,
                isCompleted: request.completed,
                dueDate: request.dueDate,
                priority: request.priority.map { priorityToInt($0) },
                tags: nil
            )
            let response: APITodo = try await apiClient.put(.todoUpdate(id: id), body: apiRequest)
            let todo = convertToLocal(response)
            if let uuid = UUID(uuidString: id),
               let index = self.todos.firstIndex(where: { $0.id == uuid }) {
                self.todos[index] = todo
            }
            isLoading = false
            return todo
        } catch {
            let serviceError = TodoServiceError.updateFailed(underlying: error)
            lastError = serviceError
            isLoading = false
            throw serviceError
        }
    }

    /// Delete a todo
    func deleteTodo(id: String) async throws {
        isLoading = true
        lastError = nil

        do {
            let _: EmptyResponse = try await apiClient.delete(.todoDelete(id: id))
            if let uuid = UUID(uuidString: id) {
                self.todos.removeAll { $0.id == uuid }
            }
            isLoading = false
        } catch {
            let serviceError = TodoServiceError.deleteFailed(underlying: error)
            lastError = serviceError
            isLoading = false
            throw serviceError
        }
    }

    /// Toggle todo completion status
    func toggleTodo(id: String) async throws -> Todo {
        isLoading = true
        lastError = nil

        do {
            let response: APITodo = try await apiClient.post(.todoToggle(id: id))
            let todo = convertToLocal(response)
            if let uuid = UUID(uuidString: id),
               let index = self.todos.firstIndex(where: { $0.id == uuid }) {
                self.todos[index] = todo
            }
            isLoading = false
            return todo
        } catch {
            let serviceError = TodoServiceError.toggleFailed(underlying: error)
            lastError = serviceError
            isLoading = false
            throw serviceError
        }
    }

    // MARK: - Helper Methods

    /// Convert API todo to local todo
    private func convertToLocal(_ apiTodo: APITodo) -> Todo {
        return Todo(
            id: UUID(uuidString: apiTodo.id) ?? UUID(),
            title: apiTodo.title,
            description: apiTodo.description,
            completed: apiTodo.isCompleted,
            priority: Todo.Priority(rawValue: ["low", "medium", "high"][apiTodo.priority]) ?? .medium,
            dueDate: apiTodo.dueDate,
            createdAt: apiTodo.createdAt,
            updatedAt: apiTodo.updatedAt,
            syncStatus: .synced
        )
    }

    /// Convert local priority to API priority integer
    private func priorityToInt(_ priority: Todo.Priority) -> Int {
        switch priority {
        case .low: return 0
        case .medium: return 1
        case .high: return 2
        }
    }

    // MARK: - Helper Methods

    /// Get todo by ID
    func todo(byId id: String) -> Todo? {
        guard let uuid = UUID(uuidString: id) else { return nil }
        return todos.first { $0.id == uuid }
    }

    /// Get pending todos (not completed)
    func pendingTodos() -> [Todo] {
        return todos.filter { !$0.completed }
    }

    /// Get completed todos
    func completedTodos() -> [Todo] {
        return todos.filter { $0.completed }
    }

    /// Get overdue todos
    func overdueTodos() -> [Todo] {
        let now = Date()
        return todos.filter { !$0.completed && ($0.dueDate ?? Date.distantFuture) < now }
    }

    /// Get incomplete todos count
    var incompleteCount: Int {
        return pendingTodos().count
    }
}
