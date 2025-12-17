const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.***REMOVED***,
    ssl: { rejectUnauthorized: false }
});

async function checkPinData() {
    console.log("\n🔍 PIN SİSTEMİ KONTROL\n");
    console.log("=".repeat(50));

    try {
        // 1. Kafeleri ve PIN'lerini göster
        console.log("\n📋 VERİTABANINDAKİ KAFELER:");
        const cafes = await pool.query('SELECT id, name, daily_pin FROM cafes');

        if (cafes.rows.length === 0) {
            console.log("❌ HİÇ KAFE YOK! Önce kafe eklenmeli.");
        } else {
            cafes.rows.forEach(cafe => {
                console.log(`  ID: ${cafe.id} | İsim: ${cafe.name} | PIN: "${cafe.daily_pin}" (tip: ${typeof cafe.daily_pin})`);
            });
        }

        // 2. Kafe adminlerini göster
        console.log("\n👤 KAFE ADMİNLERİ:");
        const admins = await pool.query("SELECT id, username, email, role, cafe_id FROM users WHERE role = 'cafe_admin'");

        if (admins.rows.length === 0) {
            console.log("❌ HİÇ KAFE ADMİNİ YOK!");
        } else {
            admins.rows.forEach(admin => {
                console.log(`  ID: ${admin.id} | ${admin.username} | cafe_id: ${admin.cafe_id}`);
                if (!admin.cafe_id) {
                    console.log(`    ⚠️  UYARI: Bu adminin cafe_id değeri NULL! PIN güncelleyemez!`);
                }
            });
        }

        // 3. daily_pin sütunu var mı?
        console.log("\n🔧 SÜTUN KONTROLÜ:");
        const columns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'cafes' AND column_name = 'daily_pin'
    `);

        if (columns.rows.length === 0) {
            console.log("❌ daily_pin SÜTUNU YOK! Oluşturulmalı:");
            console.log("   ALTER TABLE cafes ADD COLUMN daily_pin VARCHAR(6) DEFAULT '0000';");
        } else {
            console.log(`  ✅ daily_pin sütunu var (${columns.rows[0].data_type})`);
        }

        console.log("\n" + "=".repeat(50));
        console.log("TEST TAMAMLANDI\n");

    } catch (err) {
        console.error("❌ HATA:", err.message);
    } finally {
        pool.end();
    }
}

checkPinData();
