/**
 * Todo Store - 待办事项状态管理
 *
 * 使用 React Context 管理待办事项的本地状态
 */

import React, { createContext, useCallback, useContext, useState } from 'react';
import type { Todo, TodoPriority, CreateTodoInput, UpdateTodoInput } from '../../../types/workbench';
import * as todoService from '../../../services/todoService';

export type TodoFilter = 'all' | 'active' | 'completed' | TodoPriority;
export type TodoSort = 'priority' | 'due_date' | 'created_at';

interface TodoContextState {
  // Data
  todos: Todo[];
  isLoading: boolean;
  error: string | null;

  // Filter & Sort
  filter: TodoFilter;
  sortBy: TodoSort;

  // Actions
  fetchTodos: () => Promise<void>;
  addTodo: (input: CreateTodoInput) => Promise<Todo>;
  updateTodo: (id: string, input: UpdateTodoInput) => Promise<Todo>;
  deleteTodo: (id: string) => Promise<void>;
  toggleComplete: (id: string) => Promise<Todo>;
  setFilter: (filter: TodoFilter) => void;
  setSortBy: (sortBy: TodoSort) => void;
  clearError: () => void;
}

/**
 * 排序函数
 */
function sortTodos(todos: Todo[], sortBy: TodoSort): Todo[] {
  const priorityOrder: Record<TodoPriority, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };

  return [...todos].sort((a, b) => {
    switch (sortBy) {
      case 'priority':
        if (a.completed !== b.completed) {
          return a.completed ? 1 : -1;
        }
        return priorityOrder[a.priority] - priorityOrder[b.priority];

      case 'due_date':
        if (a.completed !== b.completed) {
          return a.completed ? 1 : -1;
        }
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();

      case 'created_at':
      default:
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
  });
}

/**
 * 过滤函数
 */
function filterTodos(todos: Todo[], filter: TodoFilter): Todo[] {
  switch (filter) {
    case 'active':
      return todos.filter((todo) => !todo.completed);
    case 'completed':
      return todos.filter((todo) => todo.completed);
    case 'high':
    case 'medium':
    case 'low':
      return todos.filter((todo) => todo.priority === filter);
    case 'all':
    default:
      return todos;
  }
}

const TodoContext = createContext<TodoContextState | null>(null);

export const TodoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TodoFilter>('all');
  const [sortBy, setSortBy] = useState<TodoSort>('priority');

  const fetchTodos = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await todoService.getTodos();
      setTodos(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取待办事项失败');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addTodo = useCallback(async (input: CreateTodoInput): Promise<Todo> => {
    setIsLoading(true);
    setError(null);
    try {
      const newTodo = await todoService.createTodo(input);
      setTodos((prev) => [newTodo, ...prev]);
      setIsLoading(false);
      return newTodo;
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建待办事项失败');
      setIsLoading(false);
      throw err;
    }
  }, []);

  const updateTodo = useCallback(async (id: string, input: UpdateTodoInput): Promise<Todo> => {
    setError(null);
    try {
      const updatedTodo = await todoService.updateTodo(id, input);
      setTodos((prev) => prev.map((todo) => (todo.id === id ? updatedTodo : todo)));
      return updatedTodo;
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新待办事项失败');
      throw err;
    }
  }, []);

  const deleteTodo = useCallback(async (id: string): Promise<void> => {
    setError(null);
    try {
      await todoService.deleteTodo(id);
      setTodos((prev) => prev.filter((todo) => todo.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除待办事项失败');
      throw err;
    }
  }, []);

  const toggleComplete = useCallback(async (id: string): Promise<Todo> => {
    setError(null);
    try {
      const updatedTodo = await todoService.toggleTodoComplete(id);
      setTodos((prev) => prev.map((todo) => (todo.id === id ? updatedTodo : todo)));
      return updatedTodo;
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新待办事项失败');
      throw err;
    }
  }, []);

  const handleSetFilter = useCallback((newFilter: TodoFilter) => {
    setFilter(newFilter);
  }, []);

  const handleSetSortBy = useCallback((newSortBy: TodoSort) => {
    setSortBy(newSortBy);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value: TodoContextState = {
    todos,
    isLoading,
    error,
    filter,
    sortBy,
    fetchTodos,
    addTodo,
    updateTodo,
    deleteTodo,
    toggleComplete,
    setFilter: handleSetFilter,
    setSortBy: handleSetSortBy,
    clearError,
  };

  return <TodoContext.Provider value={value}>{children}</TodoContext.Provider>;
};

/**
 * Hook to use the todo store
 */
export function useTodoStore(): TodoContextState {
  const context = useContext(TodoContext);
  if (!context) {
    throw new Error('useTodoStore must be used within a TodoProvider');
  }
  return context;
}

/**
 * 选择器：获取过滤和排序后的待办事项
 */
export function useFilteredTodos(): Todo[] {
  const todos = useTodoStore().todos;
  const filter = useTodoStore().filter;
  const sortBy = useTodoStore().sortBy;

  const filtered = filterTodos(todos, filter);
  return sortTodos(filtered, sortBy);
}

/**
 * 选择器：获取待办统计信息
 */
export function useTodoStats() {
  const todos = useTodoStore().todos;

  return {
    total: todos.length,
    completed: todos.filter((t) => t.completed).length,
    pending: todos.filter((t) => !t.completed).length,
    highPriority: todos.filter((t) => t.priority === 'high' && !t.completed).length,
  };
}
