// ============================================
// Supabase 配置
// ============================================

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://__SUPABASE_PROJECT_REF_REDACTED__.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '__SUPABASE_ANON_KEY_REDACTED__';

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
