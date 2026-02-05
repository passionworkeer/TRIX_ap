import React, { useState, useEffect } from 'react';
import { CheckCircle2, Circle, Clock, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { projectService, ProjectReport } from '../src/services/projectService';

const ProjectProgress: React.FC = () => {
  const [project, setProject] = useState<ProjectReport | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const currentProject = projectService.getCurrentProject();
    setProject(currentProject);
  }, []);

  if (!project) return null;

  const progress = projectService.getProjectProgress(project.id);
  const incompleteTasks = project.tasks.filter(t => !t.completed);
  const upcomingTasks = incompleteTasks
    .filter(t => t.dueDate)
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
    .slice(0, 3);

  const getPriorityColor = (priority: 'high' | 'medium' | 'low') => {
    switch (priority) {
      case 'high': return 'text-red-500 bg-red-500/10 border-red-200';
      case 'medium': return 'text-orange-500 bg-orange-500/10 border-orange-200';
      case 'low': return 'text-blue-500 bg-blue-500/10 border-blue-200';
    }
  };

  const getPriorityText = (priority: 'high' | 'medium' | 'low') => {
    switch (priority) {
      case 'high': return '高优先级';
      case 'medium': return '中优先级';
      case 'low': return '低优先级';
    }
  };

  const formatDueDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return '已逾期';
    if (diffDays === 0) return '今天到期';
    if (diffDays === 1) return '明天到期';
    if (diffDays <= 7) return `${diffDays}天后`;
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  const toggleTask = (taskId: string) => {
    projectService.toggleTaskCompletion(project.id, taskId);
    setProject(projectService.getCurrentProject());
  };

  return (
    <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-2xl border border-white/50 dark:border-white/10 rounded-3xl p-5 shadow-xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">
            {project.name}
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-1">
            {project.description}
          </p>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="ml-2 p-2 rounded-xl bg-white/50 hover:bg-white/70 dark:bg-slate-700/50 dark:hover:bg-slate-700/70 transition-colors"
        >
          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            完成进度
          </span>
          <span className="text-2xl font-black bg-gradient-to-r from-cyan-500 to-blue-600 bg-clip-text text-transparent">
            {progress.percentage}%
          </span>
        </div>
        <div className="h-3 bg-slate-200/50 dark:bg-slate-700/50 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full transition-all duration-500 relative overflow-hidden"
            style={{ width: `${progress.percentage}%` }}
          >
            <div className="absolute inset-0 bg-white/20 animate-shimmer"></div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-white/50 dark:bg-slate-700/30 rounded-2xl p-3 text-center border border-slate-200/50">
          <div className="text-xl font-black text-green-600">
            {progress.completedTasks}
          </div>
          <div className="text-[10px] text-slate-600 dark:text-slate-400 font-medium">
            已完成
          </div>
        </div>
        <div className="bg-white/50 dark:bg-slate-700/30 rounded-2xl p-3 text-center border border-slate-200/50">
          <div className="text-xl font-black text-slate-700 dark:text-slate-300">
            {progress.totalTasks - progress.completedTasks}
          </div>
          <div className="text-[10px] text-slate-600 dark:text-slate-400 font-medium">
            待完成
          </div>
        </div>
        <div className="bg-white/50 dark:bg-slate-700/30 rounded-2xl p-3 text-center border border-slate-200/50">
          <div className="text-xl font-black text-red-600">
            {progress.highPriorityLeft}
          </div>
          <div className="text-[10px] text-slate-600 dark:text-slate-400 font-medium">
            高优先级
          </div>
        </div>
      </div>

      {/* Upcoming Tasks - Collapsed View */}
      {!isExpanded && upcomingTasks.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
            <Clock size={12} />
            即将到期
          </div>
          {upcomingTasks.slice(0, 2).map(task => (
            <div
              key={task.id}
              className="flex items-center gap-2 p-2 rounded-xl bg-white/40 dark:bg-slate-700/40 border border-slate-200/50"
            >
              <Circle size={14} className="text-slate-400 shrink-0" />
              <span className="text-xs text-slate-700 dark:text-slate-300 flex-1 truncate">
                {task.title}
              </span>
              {task.dueDate && (
                <span className="text-[10px] text-orange-600 dark:text-orange-400 font-medium shrink-0">
                  {formatDueDate(task.dueDate)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Expanded Task List */}
      {isExpanded && (
        <div className="mt-4 space-y-2 max-h-80 overflow-y-auto">
          <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
            所有任务 ({progress.totalTasks})
          </div>
          {project.tasks.map(task => (
            <div
              key={task.id}
              onClick={() => toggleTask(task.id)}
              className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                task.completed
                  ? 'bg-green-50/50 dark:bg-green-900/10 border-green-200/50'
                  : 'bg-white/40 dark:bg-slate-700/40 border-slate-200/50 hover:bg-white/60'
              }`}
            >
              {task.completed ? (
                <CheckCircle2 size={18} className="text-green-600 shrink-0 mt-0.5" />
              ) : (
                <Circle size={18} className="text-slate-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium mb-1 ${
                  task.completed 
                    ? 'text-slate-500 line-through' 
                    : 'text-slate-800 dark:text-slate-200'
                }`}>
                  {task.title}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${getPriorityColor(task.priority)}`}>
                    {getPriorityText(task.priority)}
                  </span>
                  {task.dueDate && !task.completed && (
                    <span className="text-[10px] text-slate-600 dark:text-slate-400 flex items-center gap-1">
                      <Clock size={10} />
                      {formatDueDate(task.dueDate)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProjectProgress;
