const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = './data/pairing.db';
const db = new sqlite3.Database(dbPath);

console.log('=== Fixing Duplicate Paired Records ===\n');

db.serialize(() => {
  // 1. 检查当前 paired 记录
  db.all("SELECT * FROM pairings WHERE status = 'paired' ORDER BY created_at DESC", (err, rows) => {
    if (err) {
      console.error('Error:', err.message);
      process.exit(1);
    }

    console.log(`Current paired records: ${rows.length}`);
    rows.forEach((r, i) => {
      console.log(`  ${i+1}. user=${r.user_id}, device=${r.device_id}, created=${r.created_at}`);
    });

    // 2. 找出重复的 user_id
    db.all(`
      SELECT user_id, COUNT(*) as count
      FROM pairings
      WHERE status = 'paired'
      GROUP BY user_id
      HAVING count > 1
    `, (err, duplicates) => {
      if (err) {
        console.error('Error:', err.message);
        process.exit(1);
      }

      if (duplicates.length === 0) {
        console.log('\n✅ No duplicates found. Database is clean.');
        db.close();
        process.exit(0);
      }

      console.log(`\n⚠️  Found ${duplicates.length} user(s) with multiple paired records:`);
      duplicates.forEach(d => {
        console.log(`  - User ${d.user_id}: ${d.count} paired records`);
      });

      // 3. 将旧的 paired 记录标记为 unpaired（保留每个user_id最新的）
      const sql = `
        UPDATE pairings SET status = 'unpaired'
        WHERE id NOT IN (
          SELECT max_id FROM (
            SELECT MAX(id) as max_id, user_id
            FROM pairings
            WHERE status = 'paired'
            GROUP BY user_id
          )
        ) AND status = 'paired'
      `;

      db.run(sql, function(err) {
        if (err) {
          console.error('\n❌ Update Error:', err.message);
          process.exit(1);
        }

        console.log(`\n✅ Updated ${this.changes} old paired record(s) to 'unpaired'`);

        // 4. 验证结果
        db.all("SELECT * FROM pairings WHERE status = 'paired' ORDER BY created_at DESC", (err, finalRows) => {
          if (err) {
            console.error('Error:', err.message);
            process.exit(1);
          }

          console.log(`\n✅ Final paired records: ${finalRows.length}`);
          finalRows.forEach((r, i) => {
            console.log(`  ${i+1}. user=${r.user_id}, device=${r.device_id}`);
          });

          db.close();
          console.log('\n✅ Database cleanup complete!');
        });
      });
    });
  });
});
