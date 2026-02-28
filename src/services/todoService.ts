/**
 * Todo Service - 待办事项服务
 *
 * 处理待办事项的 CRUD 操作和同步逻辑
 */

import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import type {
  Todo,
  CreateTodoInput,
  UpdateTodoInput,
  SyncStatus,
} from '../types/workbench';

/**
 * 数据库 Todo 记录类型
 */
interface TodoRecord {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  completed: boolean;
  priority: string;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  sync_status: string;
}

/**
 * 将数据库记录转换为 Todo 类型
 */
function mapRecordToTodo(record: TodoRecord): Todo {
  return {
    id: record.id,
    user_id: record.user_id,
    title: record.title,
    description: record.description ?? undefined,
    completed: record.completed,
    priority: record.priority as Todo['priority'],
    due_date: record.due_date ?? undefined,
    created_at: record.created_at,
    updated_at: record.updated_at,
    sync_status: record.sync_status as SyncStatus,
  };
}

/**
 * 获取当前用户的所有待办事项
 * @returns 待办事项列表
 */
export async function getTodos(): Promise<Todo[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      logger.warn('[TodoService] User not authenticated');
      return [];
    }

    const { data, error } = await supabase
      .from('todos')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('[TodoService] Failed to fetch todos:', error);
      throw new Error(`获取待办事项失败: ${error.message}`);
    }

    return (data || []).map(mapRecordToTodo);
  } catch (error) {
    logger.error('[TodoService] Error in getTodos:', error);
    throw error;
  }
}

/**
 * 创建新的待办事项
 * @param input - 创建输入
 * @returns 创建的待办事项
 */
export async function createTodo(input: CreateTodoInput): Promise<Todo> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('请先登录');
    }

    const { data, error } = await supabase
      .from('todos')
      .insert({
        user_id: user.id,
        title: input.title,
        description: input.description ?? null,
        completed: input.completed ?? false,
        priority: input.priority ?? 'medium',
        due_date: input.due_date ?? null,
        sync_status: 'synced',
      })
      .select()
      .single();

    if (error) {
      logger.error('[TodoService] Failed to create todo:', error);
      throw new Error(`创建待办事项失败: ${error.message}`);
    }

    logger.info(`[TodoService] Todo created: id=${data.id}, user=${user.id}`);

    return mapRecordToTodo(data);
  } catch (error) {
    logger.error('[TodoService] Error in createTodo:', error);
    throw error;
  }
}

/**
 * 更新待办事项
 * @param id - 待办事项 ID
 * @param input - 更新输入
 * @returns 更新后的待办事项
 */
export async function updateTodo(id: string, input: UpdateTodoInput): Promise<Todo> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('请先登录');
    }

    // 构建更新对象
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (input.title !== undefined) {
      updateData.title = input.title;
    }
    if (input.description !== undefined) {
      updateData.description = input.description;
    }
    if (input.completed !== undefined) {
      updateData.completed = input.completed;
    }
    if (input.priority !== undefined) {
      updateData.priority = input.priority;
    }
    if (input.due_date !== undefined) {
      updateData.due_date = input.due_date;
    }
    if (input.sync_status !== undefined) {
      updateData.sync_status = input.sync_status;
    }

    const { data, error } = await supabase
      .from('todos')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      logger.error('[TodoService] Failed to update todo:', error);
      throw new Error(`更新待办事项失败: ${error.message}`);
    }

    if (!data) {
      throw new Error('待办事项不存在或无权限修改');
    }

    logger.info(`[TodoService] Todo updated: id=${id}, user=${user.id}`);

    return mapRecordToTodo(data);
  } catch (error) {
    logger.error('[TodoService] Error in updateTodo:', error);
    throw error;
  }
}

/**
 * 删除待办事项
 * @param id - 待办事项 ID
 */
export async function deleteTodo(id: string): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('请先登录');
    }

    const { error } = await supabase
      .from('todos')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      logger.error('[TodoService] Failed to delete todo:', error);
      throw new Error(`删除待办事项失败: ${error.message}`);
    }

    logger.info(`[TodoService] Todo deleted: id=${id}, user=${user.id}`);
  } catch (error) {
    logger.error('[TodoService] Error in deleteTodo:', error);
    throw error;
  }
}

/**
 * 切换待办事项完成状态
 * @param id - 待办事项 ID
 * @returns 更新后的待办事项
 */
export async function toggleTodoComplete(id: string): Promise<Todo> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('请先登录');
    }

    // 先获取当前状态
    const { data: currentTodo, error: fetchError } = await supabase
      .from('todos')
      .select('completed')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !currentTodo) {
      throw new Error('待办事项不存在或无权限修改');
    }

    // 切换状态
    return updateTodo(id, { completed: !currentTodo.completed });
  } catch (error) {
    logger.error('[TodoService] Error in toggleTodoComplete:', error);
    throw error;
  }
}

/**
 * 同步本地变更到服务器
 * 将所有 pending 状态的待办事项同步到服务器
 * @returns 同步结果
 */
export async function syncWithServer(): Promise<{
  success: boolean;
  syncedCount: number;
  conflicts: Todo[];
  error?: string;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return {
        success: false,
        syncedCount: 0,
        conflicts: [],
        error: '请先登录',
      };
    }

    // 获取所有 pending 状态的待办事项
    const { data: pendingTodos, error: fetchError } = await supabase
      .from('todos')
      .select('*')
      .eq('user_id', user.id)
      .eq('sync_status', 'pending');

    if (fetchError) {
      logger.error('[TodoService] Failed to fetch pending todos:', fetchError);
      return {
        success: false,
        syncedCount: 0,
        conflicts: [],
        error: `获取待同步数据失败: ${fetchError.message}`,
      };
    }

    if (!pendingTodos || pendingTodos.length === 0) {
      return {
        success: true,
        syncedCount: 0,
        conflicts: [],
      };
    }

    let syncedCount = 0;
    const conflicts: Todo[] = [];

    for (const todo of pendingTodos) {
      // 检查服务器端是否有更新
      const { data: serverTodo, error: serverError } = await supabase
        .from('todos')
        .select('updated_at')
        .eq('id', todo.id)
        .single();

      if (serverError) {
        // 如果找不到，可能是新建的，标记为已同步
        const { error: updateError } = await supabase
          .from('todos')
          .update({ sync_status: 'synced' })
          .eq('id', todo.id);

        if (!updateError) {
          syncedCount++;
        }
        continue;
      }

      // 比较更新时间，检查冲突
      const localUpdatedAt = new Date(todo.updated_at).getTime();
      const serverUpdatedAt = new Date(serverTodo.updated_at).getTime();

      if (serverUpdatedAt > localUpdatedAt) {
        // 服务器有更新版本，标记为冲突
        await supabase
          .from('todos')
          .update({ sync_status: 'conflict' })
          .eq('id', todo.id);

        conflicts.push(mapRecordToTodo(todo));
      } else {
        // 标记为已同步
        const { error: updateError } = await supabase
          .from('todos')
          .update({ sync_status: 'synced' })
          .eq('id', todo.id);

        if (!updateError) {
          syncedCount++;
        }
      }
    }

    logger.info(
      `[TodoService] Sync completed: synced=${syncedCount}, conflicts=${conflicts.length}`
    );

    return {
      success: true,
      syncedCount,
      conflicts,
    };
  } catch (error) {
    logger.error('[TodoService] Error in syncWithServer:', error);
    return {
      success: false,
      syncedCount: 0,
      conflicts: [],
      error: error instanceof Error ? error.message : '同步失败',
    };
  }
}

/**
 * 获取待办事项统计信息
 * @returns 统计信息
 */
export async function getTodoStats(): Promise<{
  total: number;
  completed: number;
  pending: number;
  highPriority: number;
}> {
  try {
    const todos = await getTodos();

    return {
      total: todos.length,
      completed: todos.filter((t) => t.completed).length,
      pending: todos.filter((t) => !t.completed).length,
      highPriority: todos.filter((t) => t.priority === 'high' && !t.completed).length,
    };
  } catch (error) {
    logger.error('[TodoService] Error in getTodoStats:', error);
    return {
      total: 0,
      completed: 0,
      pending: 0,
      highPriority: 0,
    };
  }
}
