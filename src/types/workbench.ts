/**
 * Workbench types - Home dashboard functionality
 *
 * Features: Todo, Schedule, Location sharing
 */

// ============================================
// Todo types
// ============================================

export type TodoPriority = 'low' | 'medium' | 'high';
export type SyncStatus = 'synced' | 'pending' | 'conflict';

export interface Todo {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  completed: boolean;
  priority: TodoPriority;
  due_date?: string;
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
}

export type CreateTodoInput = Omit<Todo, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'sync_status'>;
export type UpdateTodoInput = Partial<Omit<Todo, 'id' | 'user_id' | 'created_at'>>;

// ============================================
// Schedule types
// ============================================

export interface Schedule {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time?: string;
  location?: string;
  reminder_minutes_before?: number;
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
}

export type CreateScheduleInput = Omit<Schedule, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'sync_status'>;
export type UpdateScheduleInput = Partial<Omit<Schedule, 'id' | 'user_id' | 'created_at'>>;

// ============================================
// Workbench item types
// ============================================

export type WorkbenchItemId = 'snapshot' | 'location' | 'schedule' | 'todo';

export interface WorkbenchItem {
  id: WorkbenchItemId;
  label: string;
  labelKey: string; // i18n key
  icon: string; // lucide icon name
  color: string; // tailwind color class
  onClick: () => void;
}

// Default workbench items (used before dynamic loading)
export const DEFAULT_WORKBENCH_ITEMS: WorkbenchItem[] = [
  {
    id: 'snapshot',
    label: '快拍',
    labelKey: 'workbench.snapshot',
    icon: 'Camera',
    color: 'from-pink-500 to-rose-500',
    onClick: () => {}, // Will be replaced by actual handler
  },
  {
    id: 'location',
    label: '位置',
    labelKey: 'workbench.location',
    icon: 'MapPin',
    color: 'from-green-500 to-emerald-500',
    onClick: () => {}, // Will be replaced by actual handler
  },
  {
    id: 'schedule',
    label: '日程',
    labelKey: 'workbench.schedule',
    icon: 'Calendar',
    color: 'from-blue-500 to-indigo-500',
    onClick: () => {}, // Will be replaced by actual handler
  },
  {
    id: 'todo',
    label: '待办',
    labelKey: 'workbench.todo',
    icon: 'CheckSquare',
    color: 'from-orange-500 to-amber-500',
    onClick: () => {}, // Will be replaced by actual handler
  },
];

// ============================================
// Location types (simplified for workbench)
// ============================================

export interface LocationShare {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}
