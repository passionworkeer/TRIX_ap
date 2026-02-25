/**
 * 专家 Agent 调度器
 *
 * 负责：
 * - 任务拓扑排序和批次调度
 * - 并行启动专家 Agent
 * - 监控任务执行状态
 * - 处理任务失败和重试
 */

import { Bash } from '../bash.ts';
import { TaskStatusManager, Task } from './TaskStatusManager.ts';

/**
 * 专家 Agent 调度器类
 */
export class ExpertAgentScheduler {
  private statusManager: TaskStatusManager;
  private maxRetries: number = 2;

  constructor(taskId: string) {
    this.statusManager = new TaskStatusManager(taskId);
  }

  /**
   * 调度任务执行
   */
  async scheduleTasks(tasks: Task[]): Promise<void> {
    console.log('🚀 开始调度任务...');

    // 初始化状态管理
    await this.statusManager.initialize('Agent 集群任务', tasks);

    // 拓扑排序，生成执行批次
    const batches = this.topologicalSort(tasks);
    console.log(`📊 生成 ${batches.length} 个执行批次`);

    // 按批次执行
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`\n🔄 执行批次 ${i + 1}/${batches.length} (${batch.length} 个任务)`);

      await this.executeBatch(batch);

      // 等待当前批次完成
      await this.waitForBatchCompletion(batch);
    }

    console.log('\n✅ 所有任务执行完成！');
  }

  /**
   * 执行一个批次的任务（并行）
   */
  private async executeBatch(tasks: Task[]): Promise<void> {
    const promises = tasks.map(task => this.launchExpertAgent(task));
    await Promise.all(promises);
  }

  /**
   * 启动单个专家 Agent
   */
  private async launchExpertAgent(task: Task): Promise<void> {
    console.log(`  📤 启动 ${task.expert} 处理任务 ${task.id}: ${task.title}`);

    // 更新状态为 in_progress
    await this.statusManager.updateTaskStatus(task.id, 'in_progress');

    try {
      // 构建专家 Agent 的 prompt
      const prompt = this.buildExpertPrompt(task);

      // 启动后台 agent（这里模拟，实际使用 Task tool）
      const output = await this.executeAgent(task, prompt);

      // Agent 完成后更新状态
      await this.statusManager.updateTaskStatus(
        task.id,
        'completed',
        output.outputFile
      );

      console.log(`  ✅ ${task.id} 完成`);

      // 检查并启动依赖此任务的下游任务
      await this.launchDependentTasks(task.id);

    } catch (error) {
      // 处理失败
      await this.handleTaskFailure(task, error);
    }
  }

  /**
   * 构建专家 Agent 的 prompt
   */
  private buildExpertPrompt(task: Task): string {
    return `你是 ${task.expert}。

## 你的任务

${task.description || task.title}

## 重要提示

1. 完成后请在最后输出一行：TASK_COMPLETE
2. 如果遇到问题，输出：TASK_FAILED: <原因>
3. 将结果保存到临时文件，不要直接返回所有内容

## 开始工作！`;
  }

  /**
   * 执行 Agent（模拟）
   */
  private async executeAgent(task: Task, prompt: string): Promise<{ outputFile: string }> {
    // 这里应该使用 Task tool 启动真实的 agent
    // 为了演示，我们模拟执行

    console.log(`    ⏳ ${task.expert} 正在后台工作...`);

    // 模拟执行时间
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 返回输出文件路径
    const outputFile = `.claude/tasks/${this.statusManager['taskId']}/results/${task.id}-${task.expert}.json`;

    // 创建模拟输出文件
    await Deno.writeTextFile(outputFile, JSON.stringify({
      taskId: task.id,
      expert: task.expert,
      title: task.title,
      status: 'completed',
      completedAt: new Date().toISOString(),
      result: '模拟输出结果'
    }, null, 2));

    return { outputFile };
  }

  /**
   * 启动依赖某个任务的下游任务
   */
  private async launchDependentTasks(completedTaskId: string): Promise<void> {
    const dependentTasks = await this.statusManager.getDependentTasks(completedTaskId);

    for (const task of dependentTasks) {
      const depsCompleted = await this.statusManager.areDependenciesCompleted(task.id);

      if (depsCompleted && task.status === 'pending') {
        console.log(`  🔗 依赖满足，启动任务 ${task.id}`);
        await this.launchExpertAgent(task);
      }
    }
  }

  /**
   * 等待批次完成
   */
  private async waitForBatchCompletion(tasks: Task[]): Promise<void> {
    while (true) {
      const allCompleted = tasks.every(task =>
        task.status === 'completed' || task.status === 'failed'
      );

      if (allCompleted) break;

      // 等待 1 秒后再次检查
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  /**
   * 处理任务失败
   */
  private async handleTaskFailure(task: Task, error: any): Promise<void> {
    console.error(`  ❌ ${task.id} 失败:`, error);

    // 记录失败
    await this.statusManager.updateTaskStatus(task.id, 'failed');

    // 判断是否可以重试
    const retryCount = task.retryCount || 0;
    if (retryCount < this.maxRetries) {
      // 重试
      console.log(`  🔄 重试 ${task.id} (${retryCount + 1}/${this.maxRetries})`);
      task.retryCount = retryCount + 1;
      await this.launchExpertAgent(task);
    } else {
      // 重试次数用尽，标记为失败
      console.error(`  💀 ${task.id} 重试次数用尽，放弃`);
    }
  }

  /**
   * 拓扑排序算法
   * 返回可以并行执行的批次
   */
  private topologicalSort(tasks: Task[]): Task[][] {
    const batches: Task[][] = [];
    const visited = new Set<string>();
    const remaining = [...tasks];

    while (remaining.length > 0) {
      const batch: Task[] = [];

      for (let i = remaining.length - 1; i >= 0; i--) {
        const task = remaining[i];
        const depsCompleted = task.dependencies.every(
          dep => visited.has(dep)
        );

        if (depsCompleted) {
          batch.push(task);
          remaining.splice(i, 1);
        }
      }

      if (batch.length > 0) {
        batches.push(batch);
        batch.forEach(task => visited.add(task.id));
      } else {
        // 循环依赖检测
        throw new Error('❌ 检测到循环依赖，无法调度任务');
      }
    }

    return batches;
  }
}

/**
 * Bash 工具模拟（用于兼容性）
 */
class Bash {
  static async command(cmd: string, options?: any): Promise<{ stdout: string; stderr: string }> {
    // 模拟执行
    return {
      stdout: '',
      stderr: ''
    };
  }
}
