const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://__SUPABASE_PROJECT_REF_REDACTED__.supabase.co',
  '__SUPABASE_ANON_KEY_REDACTED__'
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
