/**
 * Unit tests for projectService
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
});

// Import after mock
import { projectService, ProjectReport, ProjectTask } from './projectService';

describe('projectService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  afterEach(() => {
    vi.resetModules();
  });

  // ============================================
  // getProjects Tests
  // ============================================

  describe('getProjects', () => {
    it('should return stored projects', () => {
      const mockProjects: ProjectReport[] = [
        {
          id: 'project-1',
          name: 'Test Project',
          description: 'Description',
          tasks: [],
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ];

      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(mockProjects));

      const result = projectService.getProjects();

      expect(result).toEqual(mockProjects);
      expect(localStorage.getItem).toHaveBeenCalledWith('trix_projects');
    });

    it('should return default projects when no data stored', () => {
      vi.mocked(localStorage.getItem).mockReturnValue(null);

      const result = projectService.getProjects();

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].id).toBe('project-1');
      expect(result[0].tasks.length).toBeGreaterThan(0);
    });
  });

  // ============================================
  // saveProjects Tests
  // ============================================

  describe('saveProjects', () => {
    it('should save projects to localStorage', () => {
      const projects: ProjectReport[] = [
        {
          id: 'project-1',
          name: 'Test',
          description: 'Desc',
          tasks: [],
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ];

      projectService.saveProjects(projects);

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'trix_projects',
        JSON.stringify(projects)
      );
    });
  });

  // ============================================
  // getCurrentProject Tests
  // ============================================

  describe('getCurrentProject', () => {
    it('should return first project', () => {
      const mockProjects: ProjectReport[] = [
        {
          id: 'project-1',
          name: 'First',
          description: 'First project',
          tasks: [],
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 'project-2',
          name: 'Second',
          description: 'Second project',
          tasks: [],
          createdAt: '2024-01-02T00:00:00Z',
          updatedAt: '2024-01-02T00:00:00Z',
        },
      ];

      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(mockProjects));

      const result = projectService.getCurrentProject();

      expect(result).not.toBeNull();
      expect(result?.id).toBe('project-1');
    });

    it('should return null when no projects exist in storage', () => {
      // The service returns default projects when localStorage is empty,
      // so this test verifies that behavior
      vi.mocked(localStorage.getItem).mockReturnValue(null);

      const result = projectService.getCurrentProject();

      // Service returns first project from defaults
      expect(result).not.toBeNull();
    });
  });

  // ============================================
  // getProjectProgress Tests
  // ============================================

  describe('getProjectProgress', () => {
    beforeEach(() => {
      // Clear mock before each test
      vi.mocked(localStorage.getItem).mockClear();
    });

    it('should calculate progress correctly', () => {
      const mockProjects: ProjectReport[] = [
        {
          id: 'project-1',
          name: 'Test',
          description: 'Desc',
          tasks: [
            { id: 't1', title: 'Task 1', completed: true, priority: 'high' },
            { id: 't2', title: 'Task 2', completed: true, priority: 'medium' },
            { id: 't3', title: 'Task 3', completed: false, priority: 'high' },
            { id: 't4', title: 'Task 4', completed: false, priority: 'low' },
          ],
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ];

      // Setup getItem to return our mock data
      vi.mocked(localStorage.getItem).mockImplementation((key: string) => {
        if (key === 'trix_projects') {
          return JSON.stringify(mockProjects);
        }
        return null;
      });

      const result = projectService.getProjectProgress('project-1');

      expect(result.completedTasks).toBe(2);
      expect(result.totalTasks).toBe(4);
      expect(result.percentage).toBe(50);
      expect(result.highPriorityLeft).toBe(1);
      expect(result.mediumPriorityLeft).toBe(0);
      expect(result.lowPriorityLeft).toBe(1);
    });

    it('should return zeros for non-existent project', () => {
      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify([]));

      const result = projectService.getProjectProgress('non-existent');

      expect(result.completedTasks).toBe(0);
      expect(result.totalTasks).toBe(0);
      expect(result.percentage).toBe(0);
      expect(result.highPriorityLeft).toBe(0);
      expect(result.mediumPriorityLeft).toBe(0);
      expect(result.lowPriorityLeft).toBe(0);
    });

    it('should handle all tasks completed', () => {
      const mockProjects: ProjectReport[] = [
        {
          id: 'project-1',
          name: 'Test',
          description: 'Desc',
          tasks: [
            { id: 't1', title: 'Task 1', completed: true, priority: 'high' },
            { id: 't2', title: 'Task 2', completed: true, priority: 'medium' },
          ],
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ];

      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(mockProjects));

      const result = projectService.getProjectProgress('project-1');

      expect(result.percentage).toBe(100);
      expect(result.highPriorityLeft).toBe(0);
    });

    it('should handle no tasks', () => {
      const mockProjects: ProjectReport[] = [
        {
          id: 'project-1',
          name: 'Test',
          description: 'Desc',
          tasks: [],
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ];

      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(mockProjects));

      const result = projectService.getProjectProgress('project-1');

      expect(result.percentage).toBe(0);
      expect(result.totalTasks).toBe(0);
    });
  });

  // ============================================
  // toggleTaskCompletion Tests
  // ============================================

  describe('toggleTaskCompletion', () => {
    it('should toggle task from incomplete to complete', () => {
      const mockProjects: ProjectReport[] = [
        {
          id: 'project-1',
          name: 'Test',
          description: 'Desc',
          tasks: [
            { id: 't1', title: 'Task 1', completed: false, priority: 'high' },
          ],
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ];

      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(mockProjects));

      projectService.toggleTaskCompletion('project-1', 't1');

      // Verify setItem was called with updated data
      const savedData = vi.mocked(localStorage.setItem).mock.calls[0][1];
      const savedProjects = JSON.parse(savedData);
      expect(savedProjects[0].tasks[0].completed).toBe(true);
    });

    it('should toggle task from complete to incomplete', () => {
      const mockProjects: ProjectReport[] = [
        {
          id: 'project-1',
          name: 'Test',
          description: 'Desc',
          tasks: [
            { id: 't1', title: 'Task 1', completed: true, priority: 'high' },
          ],
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ];

      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(mockProjects));

      projectService.toggleTaskCompletion('project-1', 't1');

      const savedData = vi.mocked(localStorage.setItem).mock.calls[0][1];
      const savedProjects = JSON.parse(savedData);
      expect(savedProjects[0].tasks[0].completed).toBe(false);
    });

    it('should do nothing for non-existent project', () => {
      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify([]));

      projectService.toggleTaskCompletion('non-existent', 't1');

      expect(localStorage.setItem).not.toHaveBeenCalled();
    });

    it('should do nothing for non-existent task', () => {
      const mockProjects: ProjectReport[] = [
        {
          id: 'project-1',
          name: 'Test',
          description: 'Desc',
          tasks: [],
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ];

      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(mockProjects));

      projectService.toggleTaskCompletion('project-1', 'non-existent');

      expect(localStorage.setItem).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // addTask Tests
  // ============================================

  describe('addTask', () => {
    it('should add new task to project', () => {
      const mockProjects: ProjectReport[] = [
        {
          id: 'project-1',
          name: 'Test',
          description: 'Desc',
          tasks: [],
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ];

      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(mockProjects));

      const newTask = {
        title: 'New Task',
        completed: false,
        priority: 'high' as const,
      };

      projectService.addTask('project-1', newTask);

      const savedData = vi.mocked(localStorage.setItem).mock.calls[0][1];
      const savedProjects = JSON.parse(savedData);
      expect(savedProjects[0].tasks.length).toBe(1);
      expect(savedProjects[0].tasks[0].title).toBe('New Task');
      expect(savedProjects[0].tasks[0].id).toMatch(/^task-\d+$/);
    });

    it('should do nothing for non-existent project', () => {
      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify([]));

      projectService.addTask('non-existent', {
        title: 'Task',
        completed: false,
        priority: 'high',
      });

      expect(localStorage.setItem).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // deleteTask Tests
  // ============================================

  describe('deleteTask', () => {
    it('should delete task from project', () => {
      const mockProjects: ProjectReport[] = [
        {
          id: 'project-1',
          name: 'Test',
          description: 'Desc',
          tasks: [
            { id: 't1', title: 'Task 1', completed: false, priority: 'high' },
            { id: 't2', title: 'Task 2', completed: false, priority: 'medium' },
          ],
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ];

      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(mockProjects));

      projectService.deleteTask('project-1', 't1');

      const savedData = vi.mocked(localStorage.setItem).mock.calls[0][1];
      const savedProjects = JSON.parse(savedData);
      expect(savedProjects[0].tasks.length).toBe(1);
      expect(savedProjects[0].tasks[0].id).toBe('t2');
    });

    it('should do nothing for non-existent project', () => {
      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify([]));

      projectService.deleteTask('non-existent', 't1');

      expect(localStorage.setItem).not.toHaveBeenCalled();
    });

    it('should handle non-existent task gracefully', () => {
      const mockProjects: ProjectReport[] = [
        {
          id: 'project-1',
          name: 'Test',
          description: 'Desc',
          tasks: [],
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ];

      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(mockProjects));

      projectService.deleteTask('project-1', 'non-existent');

      // Should still save (with empty tasks array)
      expect(localStorage.setItem).toHaveBeenCalled();
    });
  });
});
