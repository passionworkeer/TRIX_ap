//
//  TodoListView.swift
//  TRIX3DCompanion
//
//  Todo list view displaying all todo items with filtering and sorting
//

import SwiftUI

// MARK: - Todo List View

/// Todo list view displaying todo items
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
            .background(backgroundGradient)
            .navigationTitle("Todo List")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: navigationBarLeading(showAsSheet: showAsSheet)) {
                    if showAsSheet {
                        Button("Done") {
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
            .alert("Error", isPresented: .init(
                get: { viewModel.errorMessage != nil },
                set: { if !$0 { viewModel.clearMessages() } }
            )) {
                Button("OK") {
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
                    .background(Color.gray.opacity(0.15))
                    .clipShape(Capsule())
                }
            }
            .padding(.horizontal)
        }
        .padding(.vertical, 8)
    }

    /// Statistics section
    private var statsSection: some View {
        HStack(spacing: 16) {
            StatBadge(
                title: "Active",
                value: viewModel.activeCount,
                color: .blue
            )

            StatBadge(
                title: "Completed",
                value: viewModel.completedCount,
                color: .green
            )

            StatBadge(
                title: "High Priority",
                value: viewModel.highPriorityCount,
                color: .red
            )

            if viewModel.overdueCount > 0 {
                StatBadge(
                    title: "Overdue",
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
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                        .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16))
                    }
                    .onDelete { indexSet in
                        indexSet.forEach { index in
                            let todo = viewModel.filteredTodos[index]
                            viewModel.deleteTodo(todo.id)
                        }
                    }
                }
                .listStyle(.plain)
                .scrollContentBackground(.hidden)
            }
        }
    }

    /// Empty state view
    private var emptyState: some View {
        VStack(spacing: 16) {
            Spacer()

            Image(systemName: "checklist")
                .font(.system(size: 60))
                .foregroundColor(.gray.opacity(0.5))

            Text("No todos yet")
                .font(.headline)
                .foregroundColor(.secondary)

            Text("Tap + to add a new todo")
                .font(.subheadline)
                .foregroundColor(.secondary)

            Button {
                viewModel.showAddForm()
            } label: {
                Text("Add Todo")
                    .fontWeight(.semibold)
                    .foregroundColor(.white)
                    .padding(.horizontal, 24)
                    .padding(.vertical, 12)
                    .background(Color.purple)
                    .clipShape(Capsule())
            }
            .padding(.top, 8)

            Spacer()
        }
    }

    /// Background gradient
    private var backgroundGradient: some View {
        LinearGradient(
            colors: [
                Color.purple.opacity(0.05),
                Color.clear
            ],
            startPoint: .top,
            endPoint: .bottom
        )
        .ignoresSafeArea()
    }

    // MARK: - Helper Methods

    private func navigationBarLeading(showAsSheet: Bool) -> ToolbarItemPlacement {
        return showAsSheet ? .navigationBarLeading : .principal
    }
}

// MARK: - Filter Chip

/// Filter chip component
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
                .background(isSelected ? Color.purple : Color.gray.opacity(0.15))
                .foregroundColor(isSelected ? .white : .primary)
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Stat Badge

/// Statistics badge component
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

/// Single todo row component
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
        .padding()
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 12))
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
