const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://hmbukjvrbyhbuqumqdug.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtYnVranZyYnloYnVxdW1xZHVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3MDY5NTgsImV4cCI6MjA4NjI4Mjk1OH0.i6xwAotL826Dob_P71YrnhW6jITyVMV3xU5zmIbNs20'
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
