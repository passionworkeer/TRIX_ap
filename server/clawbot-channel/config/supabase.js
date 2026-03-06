// ============================================
// Supabase 配置
// ============================================

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://hmbukjvrbyhbuqumqdug.supabase.co';

// 必须提供 SUPABASE_SERVICE_KEY 或 SUPABASE_ANON_KEY
// 推荐使用 SERVICE_KEY（可绕过 RLS），或者使用 ANON_KEY（需要正确配置 RLS）
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error('[ERROR] SUPABASE_SERVICE_KEY or SUPABASE_ANON_KEY is required');
  process.exit(1);
}

// 创建 Supabase 客户端
// service_role 密钥用于后端服务，可以绕过 RLS
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// 导出
module.exports = {
  supabase,
  supabaseUrl,
  supabaseKey
};
