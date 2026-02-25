/**
 * 任务状态管理器
 *
 * 负责管理任务的执行状态，包括：
 * - 创建和更新任务状态文件
 * - 生成人类可读的 Markdown 进度报告
 * - 管理任务依赖关系
 * - 跟踪任务执行时间
 */

export interface Task {
  id: string;
  title: string;
  expert: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  dependencies: string[];
  startTime?: string;
  endTime?: string;
  outputFile?: string;
  retryCount?: number;
  estimatedTime?: number; // 预估时间（分钟）
}

export interface TaskStatus {
  taskId: string;
  title: string;
  startTime: string;
  status: 'in_progress' | 'completed' | 'failed';
  tasks: Task[];
}

export interface TaskProgress {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  failed: number;
}

/**
 * 任务状态管理器类
 */
export class TaskStatusManager {
  private statusFile: string;
  private taskId: string;

  constructor(taskId: string) {
    this.taskId = taskId;
    this.statusFile = `.claude/tasks/${taskId}/status.json`;
  }

  /**
   * 初始化任务状态
   */
  async initialize(title: string, tasks: Task[]): Promise<void> {
    const status: TaskStatus = {
      taskId: this.taskId,
      title,
      startTime: new Date().toISOString(),
      status: 'in_progress',
      tasks
    };

    await this.ensureDirectory();
    await this.writeStatus(status);
    await this.generateMarkdownStatus(status);
  }

  /**
   * 更新任务状态
   */
  async updateTaskStatus(
    taskId: string,
    status: Task['status'],
    outputFile?: string
  ): Promise<void> {
    const currentStatus = await this.readStatus();
    const task = currentStatus.tasks.find(t => t.id === taskId);

    if (task) {
      task.status = status;

      if (status === 'in_progress') {
        task.startTime = new Date().toISOString();
      } else if (status === 'completed' || status === 'failed') {
        task.endTime = new Date().toISOString();
      }

      if (outputFile) {
        task.outputFile = outputFile;
      }

      await this.writeStatus(currentStatus);
      await this.generateMarkdownStatus(currentStatus);
    }
  }

  /**
   * 获取依赖某个任务的所有任务
   */
  async getDependentTasks(taskId: string): Promise<Task[]> {
    const currentStatus = await this.readStatus();
    return currentStatus.tasks.filter(
      t => t.dependencies.includes(taskId)
    );
  }

  /**
   * 检查某个任务的所有依赖是否都完成
   */
  async areDependenciesCompleted(taskId: string): Promise<boolean> {
    const currentStatus = await this.readStatus();
    const task = currentStatus.tasks.find(t => t.id === taskId);

    if (!task) return false;

    return task.dependencies.every(depId => {
      const depTask = currentStatus.tasks.find(t => t.id === depId);
      return depTask?.status === 'completed';
    });
  }

  /**
   * 获取任务进度
   */
  async getProgress(): Promise<TaskProgress> {
    const currentStatus = await this.readStatus();

    const progress: TaskProgress = {
      total: currentStatus.tasks.length,
      completed: currentStatus.tasks.filter(t => t.status === 'completed').length,
      inProgress: currentStatus.tasks.filter(t => t.status === 'in_progress').length,
      pending: currentStatus.tasks.filter(t => t.status === 'pending').length,
      failed: currentStatus.tasks.filter(t => t.status === 'failed').length
    };

    return progress;
  }

  /**
   * 获取可以启动的任务（所有依赖都完成）
   */
  async getReadyTasks(): Promise<Task[]> {
    const currentStatus = await this.readStatus();
    const readyTasks: Task[] = [];

    for (const task of currentStatus.tasks) {
      if (task.status === 'pending') {
        const depsCompleted = await this.areDependenciesCompleted(task.id);
        if (depsCompleted) {
          readyTasks.push(task);
        }
      }
    }

    return readyTasks;
  }

  /**
   * 读取状态文件
   */
  private async readStatus(): Promise<TaskStatus> {
    const content = await Deno.readTextFile(this.statusFile);
    return JSON.parse(content);
  }

  /**
   * 写入状态文件
   */
  private async writeStatus(status: TaskStatus): Promise<void> {
    await Deno.writeTextFile(
      this.statusFile,
      JSON.stringify(status, null, 2)
    );
  }

  /**
   * 生成 Markdown 状态文件（人类可读）
   */
  private async generateMarkdownStatus(status: TaskStatus): Promise<void> {
    const markdown = this.toMarkdown(status);
    const markdownFile = this.statusFile.replace('.json', '.md');
    await Deno.writeTextFile(markdownFile, markdown);
  }

  /**
   * 转换为 Markdown 格式
   */
  private toMarkdown(status: TaskStatus): string {
    const statusEmoji = {
      'pending': '⏳',
      'in_progress': '🔄',
      'completed': '✅',
      'failed': '❌'
    };

    const progress = this.calculateProgress(status.tasks);

    let markdown = `# 任务执行状态\n\n`;
    markdown += `**任务**: ${status.title}\n`;
    markdown += `**任务ID**: ${status.taskId}\n`;
    markdown += `**开始时间**: ${this.formatTime(status.startTime)}\n`;
    markdown += `**当前状态**: ${statusEmoji[status.status]} ${this.getStatusText(status.status)}\n\n`;

    markdown += `## 📊 整体进度\n\n`;
    markdown += `总任务数: ${progress.total}\n`;
    markdown += `✅ 已完成: ${progress.completed} (${this.getPercentage(progress.completed, progress.total)}%)\n`;
    markdown += `🔄 进行中: ${progress.inProgress} (${this.getPercentage(progress.inProgress, progress.total)}%)\n`;
    markdown += `⏳ 等待中: ${progress.pending} (${this.getPercentage(progress.pending, progress.total)}%)\n`;
    markdown += `❌ 失败: ${progress.failed} (${this.getPercentage(progress.failed, progress.total)}%)\n\n`;

    markdown += `## 📋 任务详情\n\n`;
    markdown += `| 任务ID | 任务描述 | 专家 | 状态 | 开始时间 | 完成时间 | 依赖 |\n`;
    markdown += `|--------|----------|------|------|----------|----------|------|\n`;

    for (const task of status.tasks) {
      const emoji = statusEmoji[task.status];
      const deps = task.dependencies.join(', ') || '-';
      markdown += `| ${task.id} | ${task.title} | ${task.expert} | ${emoji} ${task.status} | ${task.startTime ? this.formatTime(task.startTime) : '-'} | ${task.endTime ? this.formatTime(task.endTime) : '-'} | ${deps} |\n`;
    }

    markdown += `\n---\n\n`;
    markdown += `**最后更新**: ${this.formatTime(new Date().toISOString())}\n`;

    return markdown;
  }

  /**
   * 计算任务进度
   */
  private calculateProgress(tasks: Task[]): TaskProgress {
    return {
      total: tasks.length,
      completed: tasks.filter(t => t.status === 'completed').length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      pending: tasks.filter(t => t.status === 'pending').length,
      failed: tasks.filter(t => t.status === 'failed').length
    };
  }

  /**
   * 获取百分比
   */
  private getPercentage(value: number, total: number): string {
    if (total === 0) return '0';
    return Math.round((value / total) * 100).toString();
  }

  /**
   * 格式化时间
   */
  private formatTime(isoString: string): string {
    const date = new Date(isoString);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  /**
   * 获取状态文本
   */
  private getStatusText(status: string): string {
    const statusText = {
      'in_progress': '进行中',
      'completed': '已完成',
      'failed': '失败'
    };
    return statusText[status] || status;
  }

  /**
   * 确保目录存在
   */
  private async ensureDirectory(): Promise<void> {
    const dir = `.claude/tasks/${this.taskId}`;
    try {
      await Deno.mkdir(dir, { recursive: true });
      await Deno.mkdir(`${dir}/results`, { recursive: true });
    } catch (error) {
      // 目录已存在，忽略
    }
  }
}
