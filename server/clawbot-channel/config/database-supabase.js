// ============================================
// Supabase 数据库配置（服务器端）
// ============================================
const { createClient } = require('@supabase/supabase-js');

// 从环境变量读取配置
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('[Database] ❌ 缺少 Supabase 配置！');
  console.error('请设置环境变量：');
  console.error('  SUPABASE_URL=https://xxx.supabase.co');
  console.error('  SUPABASE_ANON_KEY=xxx');
  process.exit(1);
}

// 创建 Supabase 客户端
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false, // 服务器端不需要持久化会话
    autoRefreshToken: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

console.log('[Database] ✅ 已连接到 Supabase:', supabaseUrl);

// ============================================
// 数据库操作接口（兼容 SQLite 版本）
// ============================================

/**
 * 执行 SQL 查询（兼容 dbRun）
 * 注意：Supabase 不支持直接执行 SQL，使用 REST API 代替
 */
async function run(table, operation, data) {
  const { data: result, error } = await supabase
    .from(table)
    [operation](data)
    .select();

  if (error) {
    console.error('[Database] ❌ 操作失败:', error);
    throw error;
  }

  return {
    lastID: result?.[0]?.id,
    changes: result?.length || 0,
    data: result?.[0]
  };
}

/**
 * 获取单条记录（兼容 dbGet）
 */
async function get(table, filters) {
  let query = supabase.from(table).select('*');

  // 应用过滤条件
  for (const [key, value] of Object.entries(filters)) {
    query = query.eq(key, value);
  }

  const { data, error } = await query.single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = 没有数据
    console.error('[Database] ❌ 查询失败:', error);
    throw error;
  }

  return data || null;
}

/**
 * 获取多条记录（兼容 dbAll）
 */
async function all(table, filters = {}) {
  let query = supabase.from(table).select('*');

  // 应用过滤条件
  for (const [key, value] of Object.entries(filters)) {
    query = query.eq(key, value);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[Database] ❌ 查询失败:', error);
    throw error;
  }

  return data || [];
}

// ============================================
// 导出兼容接口
// ============================================
module.exports = {
  // Supabase 客户端
  supabase,

  // 新接口（推荐）
  run,
  get,
  all,

  // 兼容旧代码
  dbRun: run,
  dbGet: get,
  dbAll: all,
};
