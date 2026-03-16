//
//  TodoListView.swift
//  TRIX3DCompanion
//
//  Todo list view displaying all todo items with filtering and sorting
//

import SwiftUI

// MARK: - Localization Helper

/// Helper for localizing strings in SwiftUI views
private func L(_ key: String) -> String {
    NSLocalizedString(key, comment: "")
}

// MARK: - Todo List View

/// Todo list view displaying todo items with native iOS design
struct TodoListView: View {

    // MARK: - Environment

    @Environment(\.dismiss) private var dismiss

    // MARK: - State

    @StateObject private var viewModel = TodoViewModel()

    /// Whether this view is presented as a sheet
    var showAsSheet: Bool = true

    // MARK: - Body

    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Filter and Sort Bar
                filterSortBar

                // Stats Section
                statsSection
                    .padding(.horizontal)
                    .padding(.top, 8)

                // Todo List
                todoList
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle(L("todo.title"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: navigationBarLeading(showAsSheet: showAsSheet)) {
                    if showAsSheet {
                        Button(L("action.done")) {
                            dismiss()
                        }
                    }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        viewModel.showAddForm()
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .font(.title3)
                            .foregroundColor(.purple)
                    }
                }
            }
            .sheet(isPresented: $viewModel.showForm) {
                TodoFormView(
                    viewModel: viewModel,
                    editingTodo: viewModel.editingTodo
                )
            }
            .alert(L("error.unknown"), isPresented: .init(
                get: { viewModel.errorMessage != nil },
                set: { if !$0 { viewModel.clearMessages() } }
            )) {
                Button(L("action.confirm")) {
                    viewModel.clearMessages()
                }
            } message: {
                Text(viewModel.errorMessage ?? "")
            }
        }
    }

    // MARK: - View Components

    /// Filter and sort bar
    private var filterSortBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                // Filter buttons
                ForEach(TodoFilter.allCases, id: \.self) { filter in
                    FilterChip(
                        title: filter.displayName,
                        isSelected: viewModel.filter == filter
                    ) {
                        viewModel.setFilter(filter)
                    }
                }

                Divider()
                    .frame(height: 20)

                // Sort button
                Menu {
                    ForEach(TodoSortOption.allCases, id: \.self) { option in
                        Button {
                            viewModel.setSort(option)
                        } label: {
                            HStack {
                                Text(option.displayName)
                                if viewModel.sortBy == option {
                                    Image(systemName: "checkmark")
                                }
                            }
                        }
                    }
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "arrow.up.arrow.down")
                        Text(viewModel.sortBy.displayName)
                    }
                    .font(.caption)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(Color(.tertiarySystemFill))
                    .clipShape(Capsule())
                }
            }
            .padding(.horizontal)
        }
        .padding(.vertical, 8)
    }

    /// Statistics section
    private var statsSection: some View {
        HStack(spacing: 12) {
            StatBadge(
                title: L("todo.pending"),
                value: viewModel.activeCount,
                color: .blue
            )

            StatBadge(
                title: L("todo.completed"),
                value: viewModel.completedCount,
                color: .green
            )

            StatBadge(
                title: "高优先级",
                value: viewModel.highPriorityCount,
                color: .red
            )

            if viewModel.overdueCount > 0 {
                StatBadge(
                    title: "已逾期",
                    value: viewModel.overdueCount,
                    color: .orange
                )
            }
        }
        .padding(.vertical, 8)
    }

    /// Todo list content
    private var todoList: some View {
        Group {
            if viewModel.filteredTodos.isEmpty {
                emptyState
            } else {
                List {
                    ForEach(viewModel.filteredTodos) { todo in
                        TodoRow(
                            todo: todo,
                            onToggle: {
                                viewModel.toggleComplete(todo.id)
                            },
                            onTap: {
                                viewModel.showEditForm(for: todo)
                            }
                        )
                    }
                    .onDelete { indexSet in
                        indexSet.forEach { index in
                            let todo = viewModel.filteredTodos[index]
                            viewModel.deleteTodo(todo.id)
                        }
                    }
                }
                .listStyle(.insetGrouped)
            }
        }
    }

    /// Empty state view
    private var emptyState: some View {
        ContentUnavailableView {
            Label(L("todo.empty"), systemImage: "checklist")
        } description: {
            Text(L("todo.empty.hint"))
        } actions: {
            Button(L("todo.add")) {
                viewModel.showAddForm()
            }
            .buttonStyle(.borderedProminent)
        }
    }

    // MARK: - Helper Methods

    private func navigationBarLeading(showAsSheet: Bool) -> ToolbarItemPlacement {
        return showAsSheet ? .navigationBarLeading : .principal
    }
}

// MARK: - Filter Chip

/// Filter chip component with native iOS style
struct FilterChip: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.caption)
                .fontWeight(.medium)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(isSelected ? Color.purple : Color(.tertiarySystemFill))
                .foregroundColor(isSelected ? .white : .primary)
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Stat Badge

/// Statistics badge component with native iOS style
struct StatBadge: View {
    let title: String
    let value: Int
    let color: Color

    var body: some View {
        VStack(spacing: 4) {
            Text("\(value)")
                .font(.headline)
                .fontWeight(.bold)
                .foregroundColor(color)

            Text(title)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .background(color.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

// MARK: - Todo Row

/// Single todo row component with native iOS style
struct TodoRow: View {
    let todo: Todo
    let onToggle: () -> Void
    let onTap: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            // Checkbox
            Button(action: {
                let generator = UIImpactFeedbackGenerator(style: .light)
                generator.impactOccurred()
                onToggle()
            }) {
                Image(systemName: todo.completed ? "checkmark.circle.fill" : "circle")
                    .font(.title2)
                    .foregroundColor(todo.completed ? .green : .gray)
            }
            .buttonStyle(.plain)

            // Content
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 8) {
                    // Priority indicator
                    if todo.priority == .high {
                        Circle()
                            .fill(todo.priority.color)
                            .frame(width: 8, height: 8)
                    }

                    Text(todo.title)
                        .font(.body)
                        .fontWeight(.medium)
                        .strikethrough(todo.completed)
                        .foregroundColor(todo.completed ? .secondary : .primary)
                        .lineLimit(2)
                }

                if let description = todo.description, !description.isEmpty {
                    Text(description)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                }

                if let dueDateString = todo.dueDateString {
                    HStack(spacing: 4) {
                        Image(systemName: "calendar")
                            .font(.caption2)

                        Text(dueDateString)
                            .font(.caption)
                    }
                    .foregroundColor(todo.isOverdue ? .red : .secondary)
                }
            }

            Spacer()

            // Edit indicator
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding(.vertical, 4)
        .contentShape(Rectangle())
        .onTapGesture {
            onTap()
        }
    }
}

// MARK: - Preview

#Preview("Todo List") {
    TodoListView(showAsSheet: false)
}
