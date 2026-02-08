// 项目进度管理服务

export interface ProjectTask {
  id: string;
  title: string;
  completed: boolean;
  dueDate?: string;
  priority: 'high' | 'medium' | 'low';
}

export interface ProjectReport {
  id: string;
  name: string;
  description: string;
  tasks: ProjectTask[];
  createdAt: string;
  updatedAt: string;
}

class ProjectService {
  private readonly PROJECTS_KEY = 'trix_projects';

  // 获取所有项目
  getProjects(): ProjectReport[] {
    const data = localStorage.getItem(this.PROJECTS_KEY);
    return data ? JSON.parse(data) : this.getDefaultProjects();
  }

  // 保存项目
  saveProjects(projects: ProjectReport[]): void {
    localStorage.setItem(this.PROJECTS_KEY, JSON.stringify(projects));
  }

  // 获取当前项目（第一个项目）
  getCurrentProject(): ProjectReport | null {
    const projects = this.getProjects();
    return projects.length > 0 ? projects[0] : null;
  }

  // 计算项目进度
  getProjectProgress(projectId: string) {
    const projects = this.getProjects();
    const project = projects.find(p => p.id === projectId);
    
    if (!project) {
      return {
        completedTasks: 0,
        totalTasks: 0,
        percentage: 0,
        highPriorityLeft: 0,
        mediumPriorityLeft: 0,
        lowPriorityLeft: 0,
      };
    }

    const completedTasks = project.tasks.filter(t => t.completed).length;
    const totalTasks = project.tasks.length;
    const percentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    
    const incompleteTasks = project.tasks.filter(t => !t.completed);
    const highPriorityLeft = incompleteTasks.filter(t => t.priority === 'high').length;
    const mediumPriorityLeft = incompleteTasks.filter(t => t.priority === 'medium').length;
    const lowPriorityLeft = incompleteTasks.filter(t => t.priority === 'low').length;

    return {
      completedTasks,
      totalTasks,
      percentage,
      highPriorityLeft,
      mediumPriorityLeft,
      lowPriorityLeft,
    };
  }

  // 切换任务完成状态
  toggleTaskCompletion(projectId: string, taskId: string): void {
    const projects = this.getProjects();
    const project = projects.find(p => p.id === projectId);
    
    if (project) {
      const task = project.tasks.find(t => t.id === taskId);
      if (task) {
        task.completed = !task.completed;
        project.updatedAt = new Date().toISOString();
        this.saveProjects(projects);
      }
    }
  }

  // 添加新任务
  addTask(projectId: string, task: Omit<ProjectTask, 'id'>): void {
    const projects = this.getProjects();
    const project = projects.find(p => p.id === projectId);
    
    if (project) {
      const newTask: ProjectTask = {
        ...task,
        id: `task-${Date.now()}`,
      };
      project.tasks.push(newTask);
      project.updatedAt = new Date().toISOString();
      this.saveProjects(projects);
    }
  }

  // 删除任务
  deleteTask(projectId: string, taskId: string): void {
    const projects = this.getProjects();
    const project = projects.find(p => p.id === projectId);
    
    if (project) {
      project.tasks = project.tasks.filter(t => t.id !== taskId);
      project.updatedAt = new Date().toISOString();
      this.saveProjects(projects);
    }
  }

  // 默认项目数据
  private getDefaultProjects(): ProjectReport[] {
    const defaultProjects: ProjectReport[] = [
      {
        id: 'project-1',
        name: '数据结构课程设计',
        description: '实现一个基于图的社交 network 分析系统',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
        updatedAt: new Date().toISOString(),
        tasks: [
          {
            id: 'task-1',
            title: '完成需求分析文件',
            completed: true,
            priority: 'high',
            dueDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
          },
          {
            id: 'task-2',
            title: '设计数据结构和算法',
            completed: true,
            priority: 'high',
            dueDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
          },
          {
            id: 'task-3',
            title: '实现图的基本操作',
            completed: true,
            priority: 'high',
          },
          {
            id: 'task-4',
            title: '实现最短路径算法',
            completed: true,
            priority: 'medium',
          },
          {
            id: 'task-5',
            title: '实现社区发现算法',
            completed: true,
            priority: 'medium',
          },
          {
            id: 'task-6',
            title: '编写单元测试',
            completed: false,
            priority: 'high',
            dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2).toISOString(),
          },
          {
            id: 'task-7',
            title: '完成用户界面设计',
            completed: false,
            priority: 'medium',
            dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString(),
          },
          {
            id: 'task-8',
            title: '性能优化和调试',
            completed: false,
            priority: 'medium',
          },
          {
            id: 'task-9',
            title: '撰写项目报告',
            completed: false,
            priority: 'high',
            dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5).toISOString(),
          },
          {
            id: 'task-10',
            title: '准备答辩 PPT',
            completed: false,
            priority: 'low',
            dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
          },
        ],
      },
    ];

    this.saveProjects(defaultProjects);
    return defaultProjects;
  }
}

export const projectService = new ProjectService();
