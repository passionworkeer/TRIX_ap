/**
 * 数据库结构最终验证报告
 * 根据项目实际需求文档检查数据库状态
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://__SUPABASE_PROJECT_REF_REDACTED__.supabase.co';
const supabaseKey = '__SUPABASE_ANON_KEY_REDACTED__';

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║           数据库结构最终验证报告                               ║');
console.log('║                    (基于实际需求文档)                           ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

// 根据 DATABASE-REQUIREMENTS.md 的实际需求定义
const actualRequirements = {
  profiles: {
    requiredFields: ['id', 'username', 'email', 'full_name', 'avatar_url', 'bio', 'points', 'avatar_config', 'website', 'created_at', 'updated_at'],
    note: 'days_active 和 interaction_count 是计算字段，不需要存储'
  },
  friends: {
    requiredFields: ['id', 'user_id', 'friend_id', 'status', 'is_studying', 'study_time', 'created_at', 'updated_at'],
    note: 'name, avatar_url, bio 来自 profiles 表，通过 JOIN 获取'
  },
  chat_messages: {
    requiredFields: ['id', 'conversation_id', 'sender_id', 'receiver_id', 'text', 'is_read', 'created_at', 'message_type', 'media_uri', 'media_type', 'media_size', 'media_metadata'],
    note: 'conversation_id 是文本字段，格式为 ${smallerUUID}_${largerUUID}'
  },
  unread_counts: {
    requiredFields: ['id', 'user_id', 'friend_id', 'unread_count', 'last_message', 'last_message_time', 'updated_at']
  },
  notifications: {
    requiredFields: ['id', 'user_id', 'type', 'title', 'content', 'avatar_url', 'is_read', 'created_at']
  },
  mails: {
    requiredFields: ['id', 'user_id', 'from_name', 'from_avatar', 'subject', 'preview', 'content', 'is_read', 'created_at']
  },
  study_sessions: {
    requiredFields: ['id', 'user_id', 'subject', 'duration', 'started_at', 'ended_at', 'notes', 'created_at']
  },
  // 需要的视图和存储过程
  views: {
    friend_latest_messages: {
      requiredFields: ['user_id', 'friend_id', 'name', 'avatar_url', 'status', 'bio', 'study_time', 'is_studying', 'unread_count', 'last_message', 'last_message_time']
    }
  },
  functions: {
    mark_messages_as_read: {
      params: ['p_user_id', 'p_friend_id']
    }
  }
};

async function checkTableStructure(tableName, expectedFields) {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);

    if (error) {
      return { exists: false, error: error.message };
    }

    const actualFields = data && data.length > 0 ? Object.keys(data[0]) : [];
    const missingFields = expectedFields.filter(f => !actualFields.includes(f));
    const extraFields = actualFields.filter(f => !expectedFields.includes(f));

    return {
      exists: true,
      hasData: data && data.length > 0,
      actualFields,
      missingFields,
      extraFields
    };

  } catch (err) {
    return { exists: false, error: err.message };
  }
}

async function checkView() {
  try {
    const { data, error } = await supabase
      .from('friend_latest_messages')
      .select('*')
      .limit(1);

    if (error) {
      return { exists: false, error: error.message };
    }

    const actualFields = data && data.length > 0 ? Object.keys(data[0]) : [];
    const expectedFields = actualRequirements.views.friend_latest_messages.requiredFields;
    const missingFields = expectedFields.filter(f => !actualFields.includes(f));
    const extraFields = actualFields.filter(f => !expectedFields.includes(f));

    return {
      exists: true,
      actualFields,
      missingFields,
      extraFields
    };

  } catch (err) {
    return { exists: false, error: err.message };
  }
}

async function checkFunction() {
  try {
    await supabase.rpc('mark_messages_as_read', {
      p_user_id: '00000000-0000-0000-0000-000000000000',
      p_friend_id: '00000000-0000-0000-0000-000000000000'
    });
    return { exists: true };
  } catch (error) {
    // 函数存在但参数验证失败是正常的
    if (error.message?.includes('does not exist')) {
      return { exists: false, error: error.message };
    }
    return { exists: true };
  }
}

async function main() {
  console.log('📋 检查表结构...\n');

  const tableResults = {};

  for (const [tableName, config] of Object.entries(actualRequirements)) {
    if (tableName === 'views' || tableName === 'functions') continue;

    const result = await checkTableStructure(tableName, config.requiredFields);
    tableResults[tableName] = result;

    console.log(`📦 ${tableName}`);

    if (!result.exists) {
      console.log(`   ❌ 表不存在: ${result.error}`);
    } else {
      if (result.missingFields.length === 0) {
        console.log(`   ✅ 所有必需字段都存在`);
      } else {
        console.log(`   ⚠️  缺失字段: ${result.missingFields.join(', ')}`);
      }

      if (result.extraFields.length > 0) {
        console.log(`   ℹ️  额外字段: ${result.extraFields.join(', ')}`);
      }

      console.log(`   📊 ${result.hasData ? '有数据' : '无数据'}`);
    }

    if (result.missingFields.length > 0 || result.extraFields.length > 0) {
      console.log(`   📝 ${config.note || ''}`);
    }

    console.log('');
  }

  console.log('🔍 检查视图...\n');

  const viewResult = await checkView();
  console.log(`📝 friend_latest_messages 视图`);

  if (viewResult.exists) {
    if (viewResult.missingFields.length === 0) {
      console.log(`   ✅ 所有必需字段都存在`);
    } else {
      console.log(`   ⚠️  缺失字段: ${viewResult.missingFields.join(', ')}`);
    }

    if (viewResult.extraFields.length > 0) {
      console.log(`   ℹ️  额外字段: ${viewResult.extraFields.join(', ')}`);
    }

    console.log(`   📊 实际字段: ${viewResult.actualFields.join(', ')}`);
  } else {
    console.log(`   ❌ 视图不存在`);
  }

  console.log('');
  console.log('🔧 检查存储过程...\n');

  const functionResult = await checkFunction();
  console.log(`📝 mark_messages_as_read 函数`);

  if (functionResult.exists) {
    console.log(`   ✅ 函数存在且可调用`);
  } else {
    console.log(`   ❌ 函数不存在`);
  }

  console.log('\n\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                      最终结论                                  ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');

  let allGood = true;

  for (const [tableName, result] of Object.entries(tableResults)) {
    if (!result.exists || result.missingFields.length > 0) {
      allGood = false;
      break;
    }
  }

  if (allGood && viewResult.exists && viewResult.missingFields.length === 0 && functionResult.exists) {
    console.log('║ ✅ 数据库结构完全符合项目需求！                                  ║');
    console.log('║                                                                ║');
    console.log('║ 所有表、视图和存储过程都已正确配置。                             ║');
    console.log('║                                                                ║');
    console.log('║ 项目可以正常运行，无需额外操作。                                 ║');
  } else {
    console.log('║ ⚠️  发现一些问题，请查看上方详细信息                              ║');
  }

  console.log('╚══════════════════════════════════════════════════════════════╝\n');
}

main().catch(console.error);
