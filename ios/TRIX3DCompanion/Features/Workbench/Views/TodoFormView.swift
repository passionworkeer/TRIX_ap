//
//  TodoFormView.swift
//  TRIX3DCompanion
//
//  Form view for adding and editing todo items
//

import SwiftUI

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
                    TextField("Todo title", text: $title)
                        .font(.body)
                } header: {
                    Text("Title")
                } footer: {
                    Text("Enter a brief title for your todo")
                }

                // Description Section
                Section {
                    TextEditor(text: $description)
                        .frame(minHeight: 80)
                } header: {
                    Text("Description")
                } footer: {
                    Text("Optional: Add more details")
                }

                // Priority Section
                Section {
                    Picker("Priority", selection: $priority) {
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
                    Text("Priority")
                }

                // Due Date Section
                Section {
                    Toggle("Set due date", isOn: $hasDueDate)

                    if hasDueDate {
                        DatePicker(
                            "Due date",
                            selection: $dueDate,
                            displayedComponents: [.date, .hourAndMinute]
                        )
                    }
                } header: {
                    Text("Due Date")
                }
            }
            .navigationTitle(isEditing ? "Edit Todo" : "New Todo")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Save") {
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
