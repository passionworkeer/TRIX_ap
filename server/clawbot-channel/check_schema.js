const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // 获取表结构
  db.get(`
    SELECT sql FROM sqlite_master
    WHERE type='table' AND name='pairings'
  `, (err, schema) => {
    if (err) {
      console.error('Error:', err);
      return;
    }

    console.log('=== Pairings Table Schema ===');
    console.log(schema?.sql || 'Table not found');

    // 获取所有索引
    db.all(`
      SELECT * FROM sqlite_master
      WHERE type='index' AND tbl_name='pairings'
    `, (err, indexes) => {
      if (err) {
        console.error('Error:', err);
        return;
      }

      console.log('\n=== Indexes on pairings table ===');
      indexes.forEach(idx => {
        console.log(`- ${idx.name}: ${idx.sql || '(auto-generated)'}`);
      });

      // 检查现有的配对记录数量
      db.get('SELECT COUNT(*) as count FROM pairings', (err, row) => {
        if (err) {
          console.error('Error:', err);
          return;
        }

        console.log('\n=== Current Data ===');
        console.log(`Total pairings: ${row.count}`);

        // 检查有多少个不同的 user_id
        db.all(`SELECT user_id, COUNT(*) as count FROM pairings GROUP BY user_id HAVING count > 1`, (err, users) => {
          if (err) {
            console.error('Error:', err);
            return;
          }

          if (users.length > 0) {
            console.log('\n=== Users with multiple pairings ===');
            users.forEach(u => {
              console.log(`User ${u.user_id}: ${u.count} pairings`);
            });
          }

          db.close();
        });
      });
    });
  });
});
