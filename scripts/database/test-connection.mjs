import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';

// 加载环境变量
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 缺少 Supabase 配置');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔌 正在连接 Supabase...');
console.log('📍 URL:', supabaseUrl);

// 测试连接：获取 profiles 表的前 5 条数据
async function testConnection() {
  try {
    const { data, error, status } = await supabase
      .from('profiles')
      .select('*')
      .limit(5);

    if (error) {
      console.error('❌ 查询失败:', error.message);
      console.error('   错误详情:', JSON.stringify(error, null, 2));
      return false;
    }

    console.log('✅ 连接成功！');
    console.log(`📊 找到 ${data?.length || 0} 条用户记录`);

    if (data && data.length > 0) {
      console.log('\n用户列表：');
      data.forEach((profile, index) => {
        console.log(`${index + 1}. ${profile.username || profile.full_name || '未命名'} (${profile.id})`);
      });
    }

    return true;
  } catch (err) {
    console.error('❌ 发生错误:', err.message);
    return false;
  }
}

// 执行测试
testConnection().then(success => {
  if (success) {
    console.log('\n✅ Supabase CLI (通过代码) 已就绪，可以开始操作数据库了！');
  }
  process.exit(success ? 0 : 1);
});
