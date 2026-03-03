// ============================================
// Supabase 配置
// ============================================

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://hmbukjvrbyhbuqumqdug.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtYnVranZyYnloYnVxdW1xZHVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3MDY5NTgsImV4cCI6MjA4NjI4Mjk1OH0.i6xwAotL826Dob_P71YrnhW6jITyVMV3xU5zmIbNs20';

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
