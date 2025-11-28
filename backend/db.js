const { Pool } = require('pg');
require('dotenv').config();

// Production environment configuration
const pool = new Pool({
  connectionString: process.env.***REMOVED***,
  ssl: process.env.***REMOVED*** ? { rejectUnauthorized: false } : false,
  // Fallback for local dev if ***REMOVED*** is not set
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'cafeduo',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

// Connection test
pool.connect((err, client, release) => {
  if (err) {
    console.warn('⚠️  UYARI: PostgreSQL bağlantısı kurulamadı.');
    console.warn('   Sunucu "In-Memory" (Geçici Bellek) modunda çalışacak.');
    console.warn('   Veriler sunucu kapandığında silinecektir.');
  } else {
    console.log('✅ Veritabanı bağlantısı başarılı.');
    release();
  }
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};