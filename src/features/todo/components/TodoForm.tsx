/**
 * TodoForm - 待办事项表单组件
 *
 * 用于创建和编辑待办事项的表单
 */

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Calendar, ChevronDown, Check, X, Flag, Save } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNotification } from '../../../hooks/useNotification';
import { useTodoStore } from '../store/todoStore';
import type { Todo, TodoPriority, CreateTodoInput, UpdateTodoInput } from '../../../types/workbench';

// 优先级配置
const priorityOptions: { value: TodoPriority; color: string }[] = [
  { value: 'high', color: 'rose' },
  { value: 'medium', color: 'orange' },
  { value: 'low', color: 'emerald' },
];

interface TodoFormProps {
  /** 编辑模式时传入的待办事项 */
  todo?: Todo | null;
  /** 关闭回调 */
  onClose: () => void;
  /** 成功回调 */
  onSuccess: () => void;
}

interface FormState {
  title: string;
  description: string;
  priority: TodoPriority;
  dueDate: string;
  errors: {
    title?: string;
  };
}

const TodoForm: React.FC<TodoFormProps> = ({ todo, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const { showError } = useNotification();
  const { addTodo, updateTodo } = useTodoStore();
  const isEditing = Boolean(todo);

  const [form, setForm] = useState<FormState>({
    title: '',
    description: '',
    priority: 'medium',
    dueDate: '',
    errors: {},
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPriorityMenu, setShowPriorityMenu] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Initialize form with todo data when editing
  useEffect(() => {
    if (todo) {
      const dueDatePart = todo.due_date?.split('T')[0] || '';
      setForm({
        title: todo.title,
        description: todo.description ?? '',
        priority: todo.priority,
        dueDate: dueDatePart,
        errors: {},
      });
    }
  }, [todo]);

  // Validation
  const validate = useCallback((): boolean => {
    const errors: FormState['errors'] = {};

    if (!form.title.trim()) {
      errors.title = t('todo.validation.titleRequired');
    } else if (form.title.length > 200) {
      errors.title = t('todo.validation.titleTooLong');
    }

    setForm((prev) => ({ ...prev, errors }));
    return Object.keys(errors).length === 0;
  }, [form.title, t]);

  // Handle input change
  const handleChange = useCallback(
    (field: keyof FormState, value: string) => {
      setForm((prev) => ({
        ...prev,
        [field]: value,
        errors: field === 'title' ? {} : prev.errors,
      }));
    },
    []
  );

  // Handle priority selection
  const handlePrioritySelect = useCallback((priority: TodoPriority) => {
    setForm((prev) => ({ ...prev, priority }));
    setShowPriorityMenu(false);
  }, []);

  // Handle due date selection
  const handleDueDateSelect = useCallback((date: string) => {
    setForm((prev) => ({ ...prev, dueDate: date }));
    setShowDatePicker(false);
  }, []);

  // Clear due date
  const handleClearDueDate = useCallback(() => {
    setForm((prev) => ({ ...prev, dueDate: '' }));
    setShowDatePicker(false);
  }, []);

  // Handle form submit
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!validate()) {
        return;
      }

      setIsSubmitting(true);

      try {
        if (isEditing && todo) {
          const input: UpdateTodoInput = {
            title: form.title.trim(),
            description: form.description.trim() || undefined,
            priority: form.priority,
            due_date: form.dueDate ? new Date(form.dueDate).toISOString() : undefined,
          };
          await updateTodo(todo.id, input);
        } else {
          const input: CreateTodoInput = {
            title: form.title.trim(),
            description: form.description.trim() || undefined,
            priority: form.priority,
            due_date: form.dueDate ? new Date(form.dueDate).toISOString() : undefined,
            completed: false,
          };
          await addTodo(input);
        }
        onSuccess();
      } catch (err) {
        showError(err instanceof Error ? err.message : t('common.error'));
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      validate,
      isEditing,
      todo,
      form.title,
      form.description,
      form.priority,
      form.dueDate,
      updateTodo,
      addTodo,
      onSuccess,
      showError,
      t,
    ]
  );

  // Get priority display info
  const selectedPriority = priorityOptions.find((p) => p.value === form.priority);

  // Generate quick date options with i18n
  const getQuickDateOptions = useCallback((): { label: string; value: string }[] => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    return [
      { label: t('todo.dueDate.quickOptions.today'), value: today.toISOString().split('T')[0] ?? '' },
      { label: t('todo.dueDate.quickOptions.tomorrow'), value: tomorrow.toISOString().split('T')[0] ?? '' },
      { label: t('todo.dueDate.quickOptions.nextWeek'), value: nextWeek.toISOString().split('T')[0] ?? '' },
    ];
  }, [t]);

  // Priority options with i18n labels
  const priorityOptionsWithLabels = useMemo(() => priorityOptions.map(p => ({
    ...p,
    label: t(`todo.priority.${p.value}`),
  })), [t]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-slate-950/90 shadow-2xl backdrop-blur-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h3 className="text-sm font-medium tracking-wide text-white/90">
            {isEditing ? t('todo.edit') : t('todo.add')}
          </h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-white/50 transition hover:bg-white/10 hover:text-white"
            aria-label={t('common.close')}
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5">
          {/* Title */}
          <div className="mb-4">
            <label
              htmlFor="todo-title"
              className="mb-2 block text-xs font-medium tracking-wide text-white/50"
            >
              {t('todo.form.title')} <span className="text-rose-400">*</span>
            </label>
            <input
              id="todo-title"
              type="text"
              value={form.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder={t('todo.form.titlePlaceholder')}
              className={`w-full rounded-xl border bg-slate-900/60 px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none transition focus:ring-1 ${
                form.errors.title
                  ? 'border-rose-400/50 focus:border-rose-400 focus:ring-rose-400/20'
                  : 'border-white/15 focus:border-white/35 focus:ring-cyan-500/20'
              }`}
              autoFocus
            />
            {form.errors.title && (
              <p className="mt-1 text-xs text-rose-400">{form.errors.title}</p>
            )}
          </div>

          {/* Description */}
          <div className="mb-4">
            <label
              htmlFor="todo-description"
              className="mb-2 block text-xs font-medium tracking-wide text-white/50"
            >
              {t('todo.form.description')}
            </label>
            <textarea
              id="todo-description"
              value={form.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder={t('todo.form.descriptionPlaceholder')}
              rows={3}
              className="w-full resize-none rounded-xl border border-white/15 bg-slate-900/60 px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-white/35 focus:ring-1 focus:ring-cyan-500/20"
            />
          </div>

          {/* Priority & Due Date Row */}
          <div className="mb-5 flex gap-3">
            {/* Priority */}
            <div className="flex-1">
              <label className="mb-2 block text-xs font-medium tracking-wide text-white/50">
                {t('todo.form.priority')}
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowPriorityMenu(!showPriorityMenu);
                    setShowDatePicker(false);
                  }}
                  className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/15 bg-slate-900/60 px-4 py-2.5 text-sm text-white transition hover:border-white/35"
                >
                  <div className="flex items-center gap-2">
                    <Flag
                      size={14}
                      className={
                        selectedPriority?.value === 'high'
                          ? 'text-rose-400'
                          : selectedPriority?.value === 'medium'
                            ? 'text-orange-400'
                            : 'text-emerald-400'
                      }
                    />
                    <span>{t(`todo.priority.${form.priority}`)}</span>
                  </div>
                  <ChevronDown size={14} className="text-white/40" />
                </button>

                {showPriorityMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowPriorityMenu(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-white/10 bg-slate-900/95 shadow-xl backdrop-blur-xl"
                    >
                      {priorityOptionsWithLabels.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => handlePrioritySelect(option.value)}
                          className={`flex w-full items-center justify-between px-4 py-2.5 text-sm transition hover:bg-white/5 ${
                            form.priority === option.value
                              ? 'text-white'
                              : 'text-white/60'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Flag
                              size={14}
                              className={
                                option.value === 'high'
                                  ? 'text-rose-400'
                                  : option.value === 'medium'
                                    ? 'text-orange-400'
                                    : 'text-emerald-400'
                              }
                            />
                            {option.label}
                          </div>
                          {form.priority === option.value && <Check size={14} />}
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </div>
            </div>

            {/* Due Date */}
            <div className="flex-1">
              <label className="mb-2 block text-xs font-medium tracking-wide text-white/50">
                {t('todo.form.dueDate')}
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowDatePicker(!showDatePicker);
                    setShowPriorityMenu(false);
                  }}
                  className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/15 bg-slate-900/60 px-4 py-2.5 text-sm text-white transition hover:border-white/35"
                >
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-white/50" />
                    <span>{form.dueDate ? new Date(form.dueDate).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }) : t('todo.form.selectDate')}</span>
                  </div>
                  {form.dueDate ? (
                    <X
                      size={14}
                      className="text-white/40 hover:text-white/80"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClearDueDate();
                      }}
                    />
                  ) : (
                    <ChevronDown size={14} className="text-white/40" />
                  )}
                </button>

                {showDatePicker && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowDatePicker(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-white/10 bg-slate-900/95 p-2 shadow-xl backdrop-blur-xl"
                    >
                      {/* Quick options */}
                      <div className="mb-2 grid grid-cols-3 gap-1">
                        {getQuickDateOptions().map((option) => (
                          <button
                            key={option.label}
                            type="button"
                            onClick={() => handleDueDateSelect(option.value)}
                            className="rounded-lg px-2 py-1.5 text-xs text-white/70 transition hover:bg-white/5 hover:text-white"
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>

                      {/* Date input */}
                      <input
                        type="date"
                        value={form.dueDate}
                        onChange={(e) => handleDueDateSelect(e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-white outline-none"
                      />
                    </motion.div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/8 hover:text-white"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-500/80 py-2.5 text-sm font-medium text-white shadow-lg shadow-cyan-900/20 transition hover:bg-cyan-500 disabled:opacity-60"
            >
              {isSubmitting ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <>
                  <Save size={14} />
                  {isEditing ? '保存' : '添加'}
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default React.memo(TodoForm);
