const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.***REMOVED***,
    ssl: { rejectUnauthorized: false }
});

async function fixDatabase() {
    console.log("\n🔧 VERİTABANI DÜZELTME\n");

    try {
        // 1. iibfkantin admininin cafe_id'sini düzelt
        console.log("1. iibfkantin adminini PAÜ İİBF Kantin'e bağlıyorum...");
        const fix1 = await pool.query(
            "UPDATE users SET cafe_id = 1 WHERE username = 'iibfkantin' OR id = 8"
        );
        console.log(`   ✅ ${fix1.rowCount} satır güncellendi`);

        // 2. Kafelere PIN ata
        console.log("\n2. Kafelere PIN atıyorum...");

        await pool.query("UPDATE cafes SET daily_pin = '1234' WHERE id = 1");
        console.log("   ✅ PAÜ İİBF Kantin → PIN: 1234");

        await pool.query("UPDATE cafes SET daily_pin = '5678' WHERE id = 2");
        console.log("   ✅ PAÜ Yemekhane → PIN: 5678");

        await pool.query("UPDATE cafes SET daily_pin = '1111' WHERE daily_pin = '0000' OR daily_pin IS NULL");
        console.log("   ✅ Diğer kafeler → PIN: 1111");

        // 3. Kontrol
        console.log("\n3. Kontrol ediyorum...\n");

        const cafes = await pool.query("SELECT id, name, daily_pin FROM cafes");
        console.log("📋 KAFELER:");
        cafes.rows.forEach(c => console.log(`   - ${c.name}: PIN="${c.daily_pin}"`));

        const admins = await pool.query("SELECT username, cafe_id FROM users WHERE role = 'cafe_admin'");
        console.log("\n👤 KAFE ADMİNLERİ:");
        admins.rows.forEach(a => console.log(`   - ${a.username}: cafe_id=${a.cafe_id}`));

        console.log("\n✅ DÜZELTME TAMAMLANDI!\n");
        console.log("Şimdi test et:");
        console.log("  - PAÜ İİBF Kantin → PIN: 1234");
        console.log("  - PAÜ Yemekhane → PIN: 5678\n");

    } catch (err) {
        console.error("❌ HATA:", err.message);
    } finally {
        pool.end();
    }
}

fixDatabase();
