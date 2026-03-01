/**
 * Unit tests for todoService
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// Mock supabase
vi.mock('../config/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  },
}));

// Mock logger
vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock performance monitor
vi.mock('../utils/performance', () => ({
  perfMonitor: {
    measureAPICall: vi.fn(() => ({
      start: vi.fn(),
      end: vi.fn(),
    })),
  },
}));

// Import after mocks
import { supabase } from '../config/supabase';
import {
  getTodos,
  createTodo,
  updateTodo,
  deleteTodo,
  toggleTodoComplete,
  syncWithServer,
  getTodoStats,
} from './todoService';

describe('todoService', () => {
  const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com',
  };

  const mockTodoRecord = {
    id: 'todo-1',
    user_id: 'test-user-id',
    title: 'Test Todo',
    description: 'Test description',
    completed: false,
    priority: 'medium',
    due_date: '2024-12-31T23:59:59.000Z',
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
    sync_status: 'synced',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('getTodos', () => {
    it('should return empty array when user is not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const todos = await getTodos();
      expect(todos).toEqual([]);
    });

    it('should return todos when user is authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [mockTodoRecord],
              error: null,
            }),
          }),
        }),
      } as any);

      const todos = await getTodos();
      expect(Array.isArray(todos)).toBe(true);
      expect(todos.length).toBe(1);
      expect(todos[0].id).toBe('todo-1');
      expect(todos[0].title).toBe('Test Todo');
    });

    it('should throw error when database query fails', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' },
            }),
          }),
        }),
      } as any);

      await expect(getTodos()).rejects.toThrow('获取待办事项失败');
    });
  });

  describe('createTodo', () => {
    it('should throw error when user is not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      await expect(
        createTodo({ title: 'New Todo' })
      ).rejects.toThrow('请先登录');
    });

    it('should create todo successfully', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockTodoRecord,
              error: null,
            }),
          }),
        }),
      } as any);

      const todo = await createTodo({
        title: 'New Todo',
        description: 'Test description',
        priority: 'high',
      });

      expect(todo.id).toBe('todo-1');
      expect(todo.title).toBe('Test Todo');
    });

    it('should throw error when database insert fails', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Insert failed' },
            }),
          }),
        }),
      } as any);

      await expect(
        createTodo({ title: 'New Todo' })
      ).rejects.toThrow('创建待办事项失败');
    });
  });

  describe('updateTodo', () => {
    it('should throw error when user is not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      await expect(
        updateTodo('todo-1', { title: 'Updated Todo' })
      ).rejects.toThrow('请先登录');
    });

    it('should update todo successfully', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const updatedRecord = {
        ...mockTodoRecord,
        title: 'Updated Todo',
        updated_at: '2024-01-02T00:00:00.000Z',
      };

      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: updatedRecord,
                  error: null,
                }),
              }),
            }),
          }),
        }),
      } as any);

      const todo = await updateTodo('todo-1', { title: 'Updated Todo' });
      expect(todo.title).toBe('Updated Todo');
    });

    it('should throw error when todo not found', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: null,
                }),
              }),
            }),
          }),
        }),
      } as any);

      await expect(
        updateTodo('todo-1', { title: 'Updated Todo' })
      ).rejects.toThrow('待办事项不存在或无权限修改');
    });
  });

  describe('deleteTodo', () => {
    it('should throw error when user is not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      await expect(deleteTodo('todo-1')).rejects.toThrow('请先登录');
    });

    it('should delete todo successfully', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              error: null,
            }),
          }),
        }),
      } as any);

      await expect(deleteTodo('todo-1')).resolves.toBeUndefined();
    });

    it('should throw error when database delete fails', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              error: { message: 'Delete failed' },
            }),
          }),
        }),
      } as any);

      await expect(deleteTodo('todo-1')).rejects.toThrow('删除待办事项失败');
    });
  });

  describe('toggleTodoComplete', () => {
    it('should throw error when user is not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      await expect(toggleTodoComplete('todo-1')).rejects.toThrow('请先登录');
    });

    it('should toggle todo completion status', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // First call to get current status
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { completed: false },
                error: null,
              }),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { ...mockTodoRecord, completed: true },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      } as any);

      const todo = await toggleTodoComplete('todo-1');
      expect(todo.completed).toBe(true);
    });

    it('should throw error when todo not found', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Not found' },
              }),
            }),
          }),
        }),
      } as any);

      await expect(toggleTodoComplete('todo-1')).rejects.toThrow(
        '待办事项不存在或无权限修改'
      );
    });
  });

  describe('syncWithServer', () => {
    it('should return error when user is not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const result = await syncWithServer();
      expect(result.success).toBe(false);
      expect(result.error).toBe('请先登录');
    });

    it('should return success with zero synced when no pending todos', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      } as any);

      const result = await syncWithServer();
      expect(result.success).toBe(true);
      expect(result.syncedCount).toBe(0);
      expect(result.conflicts).toEqual([]);
    });
  });

  describe('getTodoStats', () => {
    it('should return default stats when getTodos fails', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const stats = await getTodoStats();
      expect(stats.total).toBe(0);
      expect(stats.completed).toBe(0);
      expect(stats.pending).toBe(0);
      expect(stats.highPriority).toBe(0);
    });

    it('should return correct stats for empty todos', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      } as any);

      const stats = await getTodoStats();
      expect(stats.total).toBe(0);
      expect(stats.completed).toBe(0);
      expect(stats.pending).toBe(0);
      expect(stats.highPriority).toBe(0);
    });
  });
});
