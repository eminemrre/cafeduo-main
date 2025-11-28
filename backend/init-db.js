const { pool } = require('./db');
const fs = require('fs');
const path = require('path');

async function initDb() {
  try {
    const schemaPath = path.join(__dirname, '../schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('🔄 Veritabanı tabloları oluşturuluyor...');

    await pool.query(schemaSql);

    console.log('✅ Veritabanı başarıyla hazırlandı!');

    // Seed Admin User
    const adminCheck = await pool.query("SELECT * FROM users WHERE username = 'admin'");
    if (adminCheck.rows.length === 0) {
      const bcrypt = require('bcrypt');
      const hashed = await bcrypt.hash('admin', 10);
      await pool.query(
        "INSERT INTO users (username, email, password_hash, points, is_admin, department) VALUES ($1, $2, $3, $4, $5, $6)",
        ['admin', 'admin@cafeduo.com', hashed, 99999, true, 'Yönetim']
      );
      console.log('👑 Admin kullanıcısı oluşturuldu: admin / admin');
    }

  } catch (err) {
    console.error('❌ Veritabanı oluşturulurken hata:', err);
  } finally {
    await pool.end();
  }
}

initDb();
