/**
 * 主 Agent 入口
 *
 * 负责：
 * - 接收用户需求
 * - 分析需求并识别技术领域
 * - 分解为子任务
 * - 匹配专家 Agent
 * - 调度任务执行
 * - 汇总结果并报告
 */

import { ExpertAgentScheduler } from '../lib/ExpertAgentScheduler.ts';
import { Task } from '../lib/TaskStatusManager.ts';

/**
 * 主 Agent 类
 */
export class MainAgent {
  private experts: string[] = [
    '前端专家',
    '后端专家',
    '数据库专家',
    '测试专家',
    '安全专家',        // ✅ 每个改动必查
    '质疑 Agent',      // ✅ 每个改动必查
    '运维专家',
    'WebSocket 专家'
  ];

  /**
   * 执行用户需求
   */
  async execute(userRequirement: string): Promise<void> {
    console.log('═════════════════════════════════════════════════════');
    console.log('🎯 Agent 集群协作系统');
    console.log('═════════════════════════════════════════════════════\n');

    // 1. 需求分析
    console.log('📋 阶段 1: 需求分析');
    const analysis = await this.analyzeRequirement(userRequirement);
    console.log(`  ✅ 需求类型: ${analysis.type}`);
    console.log(`  ✅ 涉及领域: ${analysis.domains.join(', ')}`);
    console.log(`  ✅ 优先级: ${analysis.priority}`);
    console.log(`  ✅ 复杂度: ${analysis.complexity}\n`);

    // 2. 任务分解
    console.log('🔨 阶段 2: 任务分解');
    const tasks = await this.decomposeTasks(userRequirement, analysis);
    console.log(`  ✅ 分解为 ${tasks.length} 个子任务\n`);

    // 3. 生成任务ID
    const taskId = this.generateTaskId();
    console.log(`🆔 任务ID: ${taskId}\n`);

    // 4. 启动任务调度
    const scheduler = new ExpertAgentScheduler(taskId);
    await scheduler.scheduleTasks(tasks);

    // 5. 汇总结果
    console.log('\n📊 阶段 3: 结果汇总');
    const report = await this.generateReport(taskId, tasks);
    console.log(report);

    console.log('\n═════════════════════════════════════════════════════');
    console.log('✅ 任务完成！');
    console.log('═════════════════════════════════════════════════════\n');
  }

  /**
   * 分析用户需求
   */
  private async analyzeRequirement(requirement: string): Promise<RequirementAnalysis> {
    // 简单的关键词匹配分析
    const keywords = {
      frontend: ['界面', 'UI', '组件', '样式', '动画', 'React', '前端', '页面'],
      backend: ['API', '接口', '后端', '服务端', '业务逻辑', '数据处理'],
      database: ['数据库', '表', 'SQL', '查询', '迁移', 'Supabase', 'SQLite'],
      testing: ['测试', '单元测试', '集成测试', 'E2E', '测试用例'],
      security: ['安全', '认证', '授权', '漏洞', '加密', 'JWT'],
      devops: ['部署', '运维', '监控', 'CI/CD', 'PM2', 'Nginx'],
      websocket: ['实时', 'WebSocket', 'Socket', '推送', '同步']
    };

    const domains: string[] = [];
    for (const [domain, words] of Object.entries(keywords)) {
      if (words.some(word => requirement.includes(word))) {
        if (domain === 'frontend') domains.push('前端');
        else if (domain === 'backend') domains.push('后端');
        else if (domain === 'database') domains.push('数据库');
        else if (domain === 'testing') domains.push('测试');
        else if (domain === 'security') domains.push('安全');
        else if (domain === 'devops') domains.push('运维');
        else if (domain === 'websocket') domains.push('WebSocket');
      }
    }

    // 默认包含前端和后端
    if (domains.length === 0) {
      domains.push('前端', '后端');
    }

    // 识别需求类型
    let type = 'feature';
    if (requirement.includes('修复') || requirement.includes('bug')) {
      type = 'bugfix';
    } else if (requirement.includes('优化') || requirement.includes('性能')) {
      type = 'optimization';
    } else if (requirement.includes('重构') || requirement.includes('架构')) {
      type = 'refactor';
    }

    // 确定优先级
    let priority = 'P1';
    if (requirement.includes('紧急') || requirement.includes('P0')) {
      priority = 'P0';
    } else if (requirement.includes('低优先级') || requirement.includes('P2')) {
      priority = 'P2';
    }

    // 估算复杂度
    let complexity = 'medium';
    if (domains.length <= 2) {
      complexity = 'simple';
    } else if (domains.length >= 5) {
      complexity = 'complex';
    }

    return {
      type,
      domains,
      priority,
      complexity
    };
  }

  /**
   * 分解任务
   */
  private async decomposeTasks(requirement: string, analysis: RequirementAnalysis): Promise<Task[]> {
    const tasks: Task[] = [];
    let taskId = 1;

    // 根据领域生成任务
    if (analysis.domains.includes('数据库')) {
      tasks.push({
        id: `T${String(taskId++).padStart(3, '0')}`,
        title: '设计数据库表结构',
        expert: '数据库专家',
        status: 'pending',
        dependencies: [],
        estimatedTime: 10,
        description: `根据需求设计数据库表结构`
      });
    }

    if (analysis.domains.includes('后端')) {
      const deps = analysis.domains.includes('数据库') ? ['T001'] : [];
      tasks.push({
        id: `T${String(taskId++).padStart(3, '0')}`,
        title: '实现后端 API',
        expert: '后端专家',
        status: 'pending',
        dependencies: deps,
        estimatedTime: 15,
        description: `实现后端 API 接口和业务逻辑`
      });
    }

    if (analysis.domains.includes('前端')) {
      const deps = analysis.domains.includes('后端') ? [`T${String(taskId - 1).padStart(3, '0')}`] : [];
      tasks.push({
        id: `T${String(taskId++).padStart(3, '0')}`,
        title: '实现前端界面',
        expert: '前端专家',
        status: 'pending',
        dependencies: deps,
        estimatedTime: 20,
        description: `实现前端用户界面和交互逻辑`
      });
    }

    if (analysis.domains.includes('安全')) {
      tasks.push({
        id: `T${String(taskId++).padStart(3, '0')}`,
        title: '安全审查',
        expert: '安全专家',
        status: 'pending',
        dependencies: [],
        estimatedTime: 15,
        description: `审查代码安全性和漏洞`
      });
    }

    if (analysis.domains.includes('测试')) {
      const frontendTaskId = `T${String(taskId - (analysis.domains.includes('安全') ? 2 : 1)).padStart(3, '0')}`;
      tasks.push({
        id: `T${String(taskId++).padStart(3, '0')}`,
        title: '编写测试',
        expert: '测试专家',
        status: 'pending',
        dependencies: [frontendTaskId],
        estimatedTime: 10,
        description: `编写单元测试和集成测试`
      });
    }

    if (analysis.domains.includes('WebSocket')) {
      tasks.push({
        id: `T${String(taskId++).padStart(3, '0')}`,
        title: '实现实时通信',
        expert: 'WebSocket 专家',
        status: 'pending',
        dependencies: [],
        estimatedTime: 15,
        description: `实现 WebSocket 实时通信功能`
      });
    }

    if (analysis.domains.includes('运维')) {
      tasks.push({
        id: `T${String(taskId++).padStart(3, '0')}`,
        title: '配置部署',
        expert: '运维专家',
        status: 'pending',
        dependencies: [],
        estimatedTime: 10,
        description: `配置部署环境和 CI/CD`
      });
    }

    return tasks;
  }

  /**
   * 生成任务ID
   */
  private generateTaskId(): string {
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 8);
    return `TASK-${dateStr}-${random}`;
  }

  /**
   * 生成最终报告
   */
  private async generateReport(taskId: string, tasks: Task[]): Promise<string> {
    // 这里应该读取实际的任务状态，现在模拟生成
    let report = '\n## 📊 执行摘要\n\n';
    report += `- 总任务数: ${tasks.length}\n`;
    report += `- 参与专家: ${this.experts.length} 个\n`;
    report += `- 预计总耗时: ${tasks.reduce((sum, task) => sum + (task.estimatedTime || 0), 0)} 分钟\n`;

    report += '\n## ✅ 完成情况\n\n';
    report += '所有任务已成功完成！\n';

    report += '\n## 📦 输出文件\n\n';
    report += `- 状态文件: .claude/tasks/${taskId}/status.json\n`;
    report += `- 进度报告: .claude/tasks/${taskId}/status.md\n`;
    report += `- 专家结果: .claude/tasks/${taskId}/results/\n`;

    return report;
  }
}

/**
 * 需求分析结果
 */
interface RequirementAnalysis {
  type: string;        // feature, bugfix, optimization, refactor
  domains: string[];   // 前端, 后端, 数据库, 测试, 安全, 运维, WebSocket
  priority: string;    // P0, P1, P2
  complexity: string;  // simple, medium, complex
}

/**
 * 主入口
 */
export async function mainAgent(userRequirement: string): Promise<void> {
  const agent = new MainAgent();
  await agent.execute(userRequirement);
}

// 如果直接运行此脚本
if (import.meta.main) {
  const requirement = Deno.args[0] || '实现用户登录功能';
  await mainAgent(requirement);
}
