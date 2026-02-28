/**
 * TodoList - 待办事项列表组件
 *
 * 显示待办事项列表，支持过滤、排序、编辑、删除、完成操作
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Check,
  ChevronDown,
  Clock,
  Edit2,
  Filter,
  MoreVertical,
  Plus,
  Trash2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotification } from '../../../hooks/useNotification';
import { useFilteredTodos, useTodoStore, type TodoFilter, type TodoSort } from '../store/todoStore';
import TodoForm from './TodoForm';
import type { Todo, TodoPriority } from '../../../types/workbench';

// 优先级配置
const priorityConfig: Record<TodoPriority, { label: string; className: string }> = {
  high: { label: '高', className: 'bg-rose-500/20 text-rose-300 border-rose-400/30' },
  medium: { label: '中', className: 'bg-orange-500/20 text-orange-300 border-orange-400/30' },
  low: { label: '低', className: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30' },
};

// 过滤选项
const filterOptions: { value: TodoFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'active', label: '进行中' },
  { value: 'completed', label: '已完成' },
  { value: 'high', label: '高优先级' },
  { value: 'medium', label: '中优先级' },
  { value: 'low', label: '低优先级' },
];

// 排序选项
const sortOptions: { value: TodoSort; label: string }[] = [
  { value: 'priority', label: '优先级' },
  { value: 'due_date', label: '截止日期' },
  { value: 'created_at', label: '创建时间' },
];

interface TodoItemProps {
  todo: Todo;
  onToggleComplete: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onEdit: (todo: Todo) => void;
}

const TodoItem = React.memo<TodoItemProps>(({ todo, onToggleComplete, onDelete, onEdit }) => {
  const [showMenu, setShowMenu] = useState(false);

  const handleToggle = useCallback(async () => {
    try {
      await onToggleComplete(todo.id);
    } catch {
      // Error handled by store
    }
  }, [onToggleComplete, todo.id]);

  const handleDelete = useCallback(async () => {
    try {
      await onDelete(todo.id);
    } catch {
      // Error handled by store
    }
    setShowMenu(false);
  }, [onDelete, todo.id]);

  const handleEdit = useCallback(() => {
    onEdit(todo);
    setShowMenu(false);
  }, [onEdit, todo]);

  const formatDueDate = (dueDate: string | undefined) => {
    if (!dueDate) return null;
    const date = new Date(dueDate);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

    if (days < 0) {
      return { text: '已过期', className: 'text-rose-400' };
    }
    if (days === 0) {
      return { text: '今天', className: 'text-amber-400' };
    }
    if (days === 1) {
      return { text: '明天', className: 'text-amber-400' };
    }
    if (days <= 7) {
      return { text: `${days}天后`, className: 'text-white/60' };
    }
    return { text: date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }), className: 'text-white/40' };
  };

  const dueInfo = formatDueDate(todo.due_date);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className={`group relative flex items-start gap-3 rounded-2xl border bg-slate-900/40 p-4 backdrop-blur-md transition-colors ${
        todo.completed
          ? 'border-white/5 opacity-60'
          : 'border-white/10 hover:border-white/20'
      }`}
    >
      {/* Checkbox */}
      <button
        onClick={handleToggle}
        className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border-2 transition-all ${
          todo.completed
            ? 'border-emerald-400 bg-emerald-500/20 text-emerald-400'
            : 'border-white/30 hover:border-white/50'
        }`}
        aria-label={todo.completed ? '标记为未完成' : '标记为已完成'}
      >
        {todo.completed && <Check size={12} strokeWidth={3} />}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <span
            className={`text-sm font-normal transition-all ${
              todo.completed ? 'text-white/40 line-through' : 'text-white/90'
            }`}
          >
            {todo.title}
          </span>
        </div>

        {todo.description && (
          <p className={`mt-1 text-xs text-white/40 line-clamp-2 ${todo.completed ? 'line-through' : ''}`}>
            {todo.description}
          </p>
        )}

        <div className="mt-2 flex items-center gap-2">
          {/* Priority Badge */}
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
              priorityConfig[todo.priority].className
            }`}
          >
            {priorityConfig[todo.priority].label}
          </span>

          {/* Due Date */}
          {dueInfo && (
            <span className={`flex items-center gap-1 text-[10px] ${dueInfo.className}`}>
              <Clock size={10} />
              {dueInfo.text}
            </span>
          )}
        </div>
      </div>

      {/* Actions Menu */}
      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-white/40 opacity-0 transition hover:bg-white/10 hover:text-white/70 group-hover:opacity-100"
          aria-label="更多操作"
        >
          <MoreVertical size={14} />
        </button>

        <AnimatePresence>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="absolute right-0 top-8 z-20 min-w-[100px] overflow-hidden rounded-xl border border-white/10 bg-slate-900/95 shadow-xl backdrop-blur-xl"
              >
                <button
                  onClick={handleEdit}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-white/70 hover:bg-white/5 hover:text-white"
                >
                  <Edit2 size={12} />
                  编辑
                </button>
                <button
                  onClick={handleDelete}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/10"
                >
                  <Trash2 size={12} />
                  删除
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
});

TodoItem.displayName = 'TodoItem';

const TodoList: React.FC = () => {
  const { showError, showSuccess } = useNotification();
  const {
    isLoading,
    error,
    filter,
    sortBy,
    fetchTodos,
    toggleComplete,
    deleteTodo,
    setFilter,
    setSortBy,
  } = useTodoStore();

  const filteredTodos = useFilteredTodos();

  const [showForm, setShowForm] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showSort, setShowSort] = useState(false);

  // Load todos on mount
  useEffect(() => {
    void fetchTodos();
  }, [fetchTodos]);

  // Show error notification
  useEffect(() => {
    if (error) {
      showError(error);
    }
  }, [error, showError]);

  const handleToggleComplete = useCallback(
    async (id: string) => {
      try {
        await toggleComplete(id);
        showSuccess('状态已更新');
      } catch (err) {
        showError(err instanceof Error ? err.message : '更新失败');
      }
    },
    [toggleComplete, showSuccess, showError]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteTodo(id);
        showSuccess('已删除');
      } catch (err) {
        showError(err instanceof Error ? err.message : '删除失败');
      }
    },
    [deleteTodo, showSuccess, showError]
  );

  const handleEdit = useCallback((todo: Todo) => {
    setEditingTodo(todo);
    setShowForm(true);
  }, []);

  const handleAddNew = useCallback(() => {
    setEditingTodo(null);
    setShowForm(true);
  }, []);

  const handleFormClose = useCallback(() => {
    setShowForm(false);
    setEditingTodo(null);
  }, []);

  const handleFormSuccess = useCallback(() => {
    setShowForm(false);
    setEditingTodo(null);
    showSuccess(editingTodo ? '已更新' : '已添加');
  }, [editingTodo, showSuccess]);

  // Get current filter label
  const currentFilterLabel = filterOptions.find((f) => f.value === filter)?.label ?? '全部';
  const currentSortLabel = sortOptions.find((s) => s.value === sortBy)?.label ?? '优先级';

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h2 className="text-sm font-medium tracking-wide text-white/90">待办事项</h2>
        <div className="flex items-center gap-2">
          {/* Filter Button */}
          <div className="relative">
            <button
              onClick={() => {
                setShowFilters(!showFilters);
                setShowSort(false);
              }}
              className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs text-white/60 transition hover:bg-white/8 hover:text-white/90"
            >
              <Filter size={12} />
              <span>{currentFilterLabel}</span>
              <ChevronDown size={10} />
            </button>

            <AnimatePresence>
              {showFilters && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowFilters(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="absolute right-0 top-full z-20 mt-1 min-w-[100px] overflow-hidden rounded-xl border border-white/10 bg-slate-900/95 shadow-xl backdrop-blur-xl"
                  >
                    {filterOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setFilter(option.value);
                          setShowFilters(false);
                        }}
                        className={`flex w-full items-center justify-between px-3 py-2 text-xs transition hover:bg-white/5 ${
                          filter === option.value
                            ? 'text-cyan-400 bg-cyan-500/10'
                            : 'text-white/60'
                        }`}
                      >
                        {option.label}
                        {filter === option.value && <Check size={10} />}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Sort Button */}
          <div className="relative">
            <button
              onClick={() => {
                setShowSort(!showSort);
                setShowFilters(false);
              }}
              className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs text-white/60 transition hover:bg-white/8 hover:text-white/90"
            >
              <span>排序: {currentSortLabel}</span>
              <ChevronDown size={10} />
            </button>

            <AnimatePresence>
              {showSort && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowSort(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="absolute right-0 top-full z-20 mt-1 min-w-[100px] overflow-hidden rounded-xl border border-white/10 bg-slate-900/95 shadow-xl backdrop-blur-xl"
                  >
                    {sortOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setSortBy(option.value);
                          setShowSort(false);
                        }}
                        className={`flex w-full items-center justify-between px-3 py-2 text-xs transition hover:bg-white/5 ${
                          sortBy === option.value
                            ? 'text-cyan-400 bg-cyan-500/10'
                            : 'text-white/60'
                        }`}
                      >
                        {option.label}
                        {sortBy === option.value && <Check size={10} />}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Todo List */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading && filteredTodos.length === 0 ? (
          <div className="flex h-32 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-cyan-500" />
          </div>
        ) : filteredTodos.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.02]">
              <Check size={20} className="text-white/30" />
            </div>
            <p className="text-sm text-white/40">
              {filter === 'all' ? '暂无待办事项' : '没有符合条件的待办'}
            </p>
            {filter === 'all' && (
              <button
                onClick={handleAddNew}
                className="mt-3 flex items-center gap-1 rounded-full bg-cyan-500/20 px-4 py-1.5 text-xs text-cyan-400 transition hover:bg-cyan-500/30"
              >
                <Plus size={12} />
                添加待办
              </button>
            )}
          </div>
        ) : (
          <motion.div layout className="space-y-2">
            <AnimatePresence mode="popLayout">
              {filteredTodos.map((todo) => (
                <TodoItem
                  key={todo.id}
                  todo={todo}
                  onToggleComplete={handleToggleComplete}
                  onDelete={handleDelete}
                  onEdit={handleEdit}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* Add Button (floating) */}
      {filteredTodos.length > 0 && (
        <div className="border-t border-white/10 p-4">
          <button
            onClick={handleAddNew}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500/80 py-2.5 text-sm font-medium text-white shadow-lg shadow-cyan-900/20 transition hover:bg-cyan-500"
          >
            <Plus size={16} />
            添加待办
          </button>
        </div>
      )}

      {/* Todo Form Modal */}
      <AnimatePresence>
        {showForm && (
          <TodoForm
            todo={editingTodo}
            onClose={handleFormClose}
            onSuccess={handleFormSuccess}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default React.memo(TodoList);
