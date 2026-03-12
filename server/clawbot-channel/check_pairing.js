const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://__SUPABASE_PROJECT_REF_REDACTED__.supabase.co',
  '__SUPABASE_ANON_KEY_REDACTED__'
);

// 查看 pairing_requests 表的列
async function main() {
  const { data, error } = await supabase
    .from('pairing_requests')
    .select('*')
    .limit(1);

  console.log('Columns:', data ? Object.keys(data[0] || {}) : 'No data');
  console.log('Error:', error);

  // 查看已有的配对记录
  const { data: existing } = await supabase
    .from('pairing_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('Existing records:', JSON.stringify(existing, null, 2));
}

main();
