//
//  TodoFormView.swift
//  TRIX3DCompanion
//
//  Form view for adding and editing todo items
//

import SwiftUI

// MARK: - Localization Helper

/// Helper for localizing strings in SwiftUI views
private func L(_ key: String) -> String {
    NSLocalizedString(key, comment: "")
}

// MARK: - Todo Form View

/// Form view for adding/editing todo items
struct TodoFormView: View {

    // MARK: - Environment

    @Environment(\.dismiss) private var dismiss

    // MARK: - Properties

    @ObservedObject var viewModel: TodoViewModel
    let editingTodo: Todo?

    // MARK: - State

    @State private var title: String = ""
    @State private var description: String = ""
    @State private var priority: Todo.Priority = .medium
    @State private var dueDate: Date = Date()
    @State private var hasDueDate: Bool = false

    // MARK: - Computed Properties

    var isEditing: Bool {
        editingTodo != nil
    }

    var isValid: Bool {
        !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    // MARK: - Initialization

    init(viewModel: TodoViewModel, editingTodo: Todo?) {
        self.viewModel = viewModel
        self.editingTodo = editingTodo

        // Initialize form fields if editing
        if let todo = editingTodo {
            _title = State(initialValue: todo.title)
            _description = State(initialValue: todo.description ?? "")
            _priority = State(initialValue: todo.priority)
            _dueDate = State(initialValue: todo.dueDate ?? Date())
            _hasDueDate = State(initialValue: todo.dueDate != nil)
        }
    }

    // MARK: - Body

    var body: some View {
        NavigationView {
            Form {
                // Title Section
                Section {
                    TextField(L("todo.title"), text: $title)
                        .font(.body)
                } header: {
                    Text(L("todo.title.label"))
                } footer: {
                    Text(L("todo.title.hint"))
                }

                // Description Section
                Section {
                    TextEditor(text: $description)
                        .frame(minHeight: 80)
                } header: {
                    Text(L("todo.description"))
                } footer: {
                    Text(L("todo.description.hint"))
                }

                // Priority Section
                Section {
                    Picker(L("todo.priority"), selection: $priority) {
                        ForEach(Todo.Priority.allCases, id: \.self) { priority in
                            HStack {
                                Circle()
                                    .fill(priority.color)
                                    .frame(width: 10, height: 10)
                                Text(priority.displayName)
                            }
                            .tag(priority)
                        }
                    }
                    .pickerStyle(.menu)
                } header: {
                    Text(L("todo.priority"))
                }

                // Due Date Section
                Section {
                    Toggle(L("todo.set.due.date"), isOn: $hasDueDate)

                    if hasDueDate {
                        DatePicker(
                            L("todo.due.date"),
                            selection: $dueDate,
                            displayedComponents: [.date, .hourAndMinute]
                        )
                    }
                } header: {
                    Text(L("todo.due.date"))
                }
            }
            .navigationTitle(isEditing ? L("todo.edit") : L("todo.new"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button(L("action.cancel")) {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(L("action.save")) {
                        saveTodo()
                    }
                    .fontWeight(.semibold)
                    .disabled(!isValid)
                }
            }
        }
    }

    // MARK: - Private Methods

    private func saveTodo() {
        let trimmedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedDescription = description.trimmingCharacters(in: .whitespacesAndNewlines)

        if let existingTodo = editingTodo {
            // Update existing todo
            var updatedTodo = existingTodo
            updatedTodo.title = trimmedTitle
            updatedTodo.description = trimmedDescription.isEmpty ? nil : trimmedDescription
            updatedTodo.priority = priority
            updatedTodo.dueDate = hasDueDate ? dueDate : nil

            viewModel.updateTodo(updatedTodo)
        } else {
            // Create new todo
            let newTodo = Todo(
                title: trimmedTitle,
                description: trimmedDescription.isEmpty ? nil : trimmedDescription,
                completed: false,
                priority: priority,
                dueDate: hasDueDate ? dueDate : nil
            )

            viewModel.addTodo(newTodo)
        }

        dismiss()
    }
}

// MARK: - Preview

#Preview("Add Todo") {
    TodoFormView(viewModel: TodoViewModel(), editingTodo: nil)
}

#Preview("Edit Todo") {
    TodoFormView(viewModel: TodoViewModel(), editingTodo: Todo.sampleTodos.first)
}
