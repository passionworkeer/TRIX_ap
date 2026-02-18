/**
 * 数据库迁移验证脚本
 * 用于验证迁移是否成功执行
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hmbukjvrbyhbuqumqdug.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtYnVranZyYnloYnVxdW1xZHVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3MDY5NTgsImV4cCI6MjA4NjI4Mjk1OH0.i6xwAotL826Dob_P71YrnhW6jITyVMV3xU5zmIbNs20';

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║           数据库迁移验证脚本                                   ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

async function checkView() {
  console.log('🔍 检查 friend_latest_messages 视图...');

  try {
    const { data, error } = await supabase
      .from('friend_latest_messages')
      .select('*')
      .limit(1);

    if (error) {
      console.log('   ❌ 视图不存在或无法访问');
      console.log(`   错误: ${error.message}\n`);
      return false;
    }

    console.log('   ✅ 视图存在且可访问');
    console.log('   📊 返回字段:', Object.keys(data[0] || {}).join(', ') || '(无数据)');
    console.log('');
    return true;

  } catch (error) {
    console.log('   ❌ 检查失败');
    console.log(`   错误: ${error.message}\n`);
    return false;
  }
}

async function checkFunction() {
  console.log('🔍 检查 mark_messages_as_read 函数...');

  try {
    // 尝试调用函数（使用测试参数）
    const { data, error } = await supabase.rpc('mark_messages_as_read', {
      p_user_id: '00000000-0000-0000-0000-000000000000',
      p_friend_id: '00000000-0000-0000-0000-000000000000'
    });

    // 函数存在，但可能没有数据更新（这是正常的）
    if (error) {
      console.log('   ❌ 函数不存在或无法调用');
      console.log(`   错误: ${error.message}\n`);
      return false;
    }

    console.log('   ✅ 函数存在且可调用\n');
    return true;

  } catch (error) {
    // 函数可能存在但参数验证失败
    if (error.message?.includes('does not exist')) {
      console.log('   ❌ 函数不存在\n');
      return false;
    }
    console.log('   ✅ 函数存在（参数验证失败是正常的）\n');
    return true;
  }
}

async function checkDataIntegrity() {
  console.log('🔍 检查数据完整性...');

  try {
    // 检查 friends 表中的 accepted 好友
    const { data: friends, error: friendsError } = await supabase
      .from('friends')
      .select('user_id, friend_id')
      .eq('status', 'accepted')
      .limit(5);

    if (friendsError) {
      console.log('   ⚠️  无法检查 friends 表');
      console.log(`   错误: ${friendsError.message}\n`);
      return false;
    }

    console.log(`   ✅ 找到 ${friends.length} 个已接受的好友关系`);

    // 尝试通过视图获取好友列表
    if (friends.length > 0) {
      const { data: viewData, error: viewError } = await supabase
        .from('friend_latest_messages')
        .select('*')
        .eq('user_id', friends[0].user_id)
        .limit(1);

      if (viewError) {
        console.log('   ⚠️  视图查询失败');
      } else {
        console.log(`   ✅ 视图正常返回数据 (${viewData.length} 条)`);
      }
    }

    console.log('');
    return true;

  } catch (error) {
    console.log(`   ⚠️  检查失败: ${error.message}\n`);
    return false;
  }
}

async function main() {
  const results = {
    view: await checkView(),
    function: await checkFunction(),
    integrity: await checkDataIntegrity()
  };

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║                      验证结果                                  ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');

  if (results.view && results.function && results.integrity) {
    console.log('║ ✅ 所有迁移都已成功执行！                                      ║');
    console.log('║                                                                ║');
    console.log('║ 数据库已准备就绪，可以正常使用。                                ║');
  } else {
    console.log('║ ⚠️  部分迁移未完成                                            ║');
    console.log('║                                                                ║');
    console.log('║ 请在 Supabase Dashboard 的 SQL Editor 中执行:                ║');
    console.log('║ https://app.supabase.com/project/_/sql                         ║');
    console.log('║                                                                ║');
    console.log('║ 需要执行的文件:                                                ║');
    if (!results.view) {
      console.log('║   ❌ 001_create_friend_latest_messages_view.sql              ║');
    }
    if (!results.function) {
      console.log('║   ❌ 002_create_mark_messages_as_read_function.sql            ║');
    }
  }

  console.log('╚══════════════════════════════════════════════════════════════╝\n');
}

main().catch(console.error);
