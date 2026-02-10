/**
 * 批量创建 TRIX 测试用户
 * 
 * 使用说明:
 * 1. 安装依赖: npm install @supabase/supabase-js dotenv
 * 2. 在 .env 文件中配置: VITE_SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY
 * 3. 运行脚本: node create-test-users.js
 * 
 * 注意: 需要 Supabase Service Role Key (在 Settings → API 中获取)
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Supabase 配置
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // 需要在 .env 中添加

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 错误: 请在 .env 文件中配置 VITE_SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// 创建 Supabase 管理员客户端
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// 测试用户列表
const testUsers = [
  {
    email: 'xiaoming@trix.app',
    password: 'trix2026',
    id: '11111111-1111-1111-1111-111111111111',
    username: 'xiaoming',
    display_name: '小明'
  },
  {
    email: 'alice@trix.app',
    password: 'trix2026',
    id: '22222222-2222-2222-2222-222222222222',
    username: 'alice',
    display_name: 'Alice'
  },
  {
    email: 'bob@trix.app',
    password: 'trix2026',
    id: '33333333-3333-3333-3333-333333333333',
    username: 'bob',
    display_name: 'Bob'
  },
  {
    email: 'carol@trix.app',
    password: 'trix2026',
    id: '44444444-4444-4444-4444-444444444444',
    username: 'carol',
    display_name: 'Carol'
  },
  {
    email: 'david@trix.app',
    password: 'trix2026',
    id: '55555555-5555-5555-5555-555555555555',
    username: 'david',
    display_name: 'David'
  },
  {
    email: 'emma@trix.app',
    password: 'trix2026',
    id: '66666666-6666-6666-6666-666666666666',
    username: 'emma',
    display_name: 'Emma'
  }
];

// 创建用户函数
async function createTestUsers() {
  console.log('🚀 开始创建测试用户...\n');

  for (const user of testUsers) {
    try {
      // 使用 Admin API 创建用户
      const { data, error } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: {
          username: user.username,
          display_name: user.display_name
        }
      });

      if (error) {
        console.error(`❌ 创建用户 ${user.email} 失败:`, error.message);
        continue;
      }

      console.log(`✅ 成功创建用户: ${user.email}`);
      console.log(`   - 用户 ID: ${data.user.id}`);
      console.log(`   - 显示名称: ${user.display_name}`);

      // 检查 ID 是否与预期一致
      if (data.user.id !== user.id) {
        console.log(`   ⚠️  警告: 用户 ID 不匹配!`);
        console.log(`   - 预期: ${user.id}`);
        console.log(`   - 实际: ${data.user.id}`);
        console.log(`   - 请手动更新数据库中的 users 表`);
      }

    } catch (error) {
      console.error(`❌ 创建用户 ${user.email} 时发生异常:`, error);
    }

    console.log('');
  }

  console.log('✨ 用户创建完成!\n');
  console.log('📝 下一步:');
  console.log('   1. 登录 Supabase Dashboard');
  console.log('   2. 检查 Authentication → Users');
  console.log('   3. 验证所有 6 个用户都已创建');
  console.log('   4. 使用 xiaoming@trix.app / trix2026 登录应用测试\n');
}

// 执行创建
createTestUsers().catch(console.error);
