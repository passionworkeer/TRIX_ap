const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://hmbukjvrbyhbuqumqdug.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtYnVranZyYnloYnVxdW1xZHVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3MDY5NTgsImV4cCI6MjA4NjI4Mjk1OH0.i6xwAotL826Dob_P71YrnhW6jITyVMV3xU5zmIbNs20'
);

// 更新配对记录，添加 device_token
async function main() {
  const pairingId = 'a71ff096-e859-496c-81c7-a77e4c32cac3';

  // 生成一个 device_token
  const deviceToken = 'trix-token-' + Date.now();

  const { error } = await supabase
    .from('pairing_requests')
    .update({
      status: 'approved',
      device_token: deviceToken,
      approved_at: new Date().toISOString()
    })
    .eq('id', pairingId);

  if (error) {
    console.error('Update error:', error);
  } else {
    console.log('Updated pairing request with device_token:', deviceToken);
  }

  // 验证更新后的记录
  const { data } = await supabase
    .from('pairing_requests')
    .select('*')
    .eq('id', pairingId)
    .single();

  console.log('Updated record:', JSON.stringify(data, null, 2));
}

main();
