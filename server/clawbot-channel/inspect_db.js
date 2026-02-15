const { initDatabase, dbGet, dbAll } = require('./config/database');

async function inspect() {
  try {
    // 首先确保数据库和表已经初始化
    console.log('Initializing database...');
    initDatabase();
    console.log('Database initialized.\n');

    // 等待一下，让数据库初始化完成
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('=== Current Data ===');

    // 检查所有配对记录
    const allPairings = await dbAll('SELECT * FROM pairings ORDER BY created_at DESC');
    console.log(`\nTotal pairings: ${allPairings.length}`);

    // 检查 paired 状态的记录
    const paired = await dbAll("SELECT * FROM pairings WHERE status = 'paired' ORDER BY created_at DESC");
    console.log(`\nPaired records: ${paired.length}`);
    paired.forEach((row, idx) => {
      console.log(`\n${idx + 1}. Pairing ID: ${row.id}`);
      console.log(`   User ID: ${row.user_id}`);
      console.log(`   Device ID: ${row.device_id}`);
      console.log(`   Device Name: ${row.device_name}`);
      console.log(`   Status: ${row.status}`);
      console.log(`   Created: ${row.created_at}`);
      console.log(`   Paired At: ${row.paired_at}`);
      console.log(`   Expires: ${row.expires_at}`);
    });

    // 检查是否有重复的 user_id (paired 状态)
    const duplicates = await dbAll(`
      SELECT user_id, COUNT(*) as count
      FROM pairings
      WHERE status = 'paired'
      GROUP BY user_id
      HAVING count > 1
    `);

    if (duplicates.length > 0) {
      console.log('\n=== ⚠️ DUPLICATES FOUND ===');
      duplicates.forEach(d => {
        console.log(`User ${d.user_id} has ${d.count} paired records`);
      });
    } else {
      console.log('\n✅ No duplicate user_id in paired status');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

inspect();
