const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.***REMOVED***,
    ssl: { rejectUnauthorized: false }
});

const API_URL = 'http://localhost:3001/api';

async function testAPI(method, endpoint, body = null) {
    try {
        const options = {
            method,
            headers: { 'Content-Type': 'application/json' }
        };
        if (body) options.body = JSON.stringify(body);

        const res = await fetch(`${API_URL}${endpoint}`, options);
        const data = await res.json();
        return { ok: res.ok, status: res.status, data };
    } catch (err) {
        return { ok: false, error: err.message };
    }
}

async function runTests() {
    console.log("\n" + "=".repeat(60));
    console.log("🧪 CAFEDUO KAPSAMLI SİSTEM TESTİ");
    console.log("=".repeat(60));

    let passed = 0;
    let failed = 0;
    const issues = [];

    // ============ DATABASE TESTS ============
    console.log("\n📦 VERİTABANI TESTLERİ\n");

    // Test 1: DB Connection
    try {
        const client = await pool.connect();
        client.release();
        console.log("✅ Veritabanı bağlantısı");
        passed++;
    } catch (err) {
        console.log("❌ Veritabanı bağlantısı:", err.message);
        issues.push("Veritabanı bağlantısı kurulamıyor");
        failed++;
    }

    // Test 2: Tables exist
    const requiredTables = ['users', 'cafes', 'games', 'rewards', 'user_items'];
    for (const table of requiredTables) {
        try {
            await pool.query(`SELECT 1 FROM ${table} LIMIT 1`);
            console.log(`✅ Tablo mevcut: ${table}`);
            passed++;
        } catch (err) {
            console.log(`❌ Tablo eksik: ${table}`);
            issues.push(`${table} tablosu eksik`);
            failed++;
        }
    }

    // Test 3: daily_pin column
    try {
        const res = await pool.query("SELECT daily_pin FROM cafes LIMIT 1");
        console.log("✅ daily_pin sütunu mevcut");
        passed++;
    } catch (err) {
        console.log("❌ daily_pin sütunu eksik");
        issues.push("cafes tablosunda daily_pin sütunu yok");
        failed++;
    }

    // Test 4: Cafes with PINs
    try {
        const res = await pool.query("SELECT id, name, daily_pin FROM cafes");
        console.log(`✅ ${res.rows.length} kafe bulundu`);
        res.rows.forEach(c => {
            const pinStatus = c.daily_pin && c.daily_pin !== '0000' ? '✓' : '⚠️ varsayılan';
            console.log(`   - ${c.name}: PIN="${c.daily_pin}" ${pinStatus}`);
        });
        passed++;
    } catch (err) {
        console.log("❌ Kafeler okunamadı:", err.message);
        failed++;
    }

    // Test 5: Cafe Admins
    try {
        const res = await pool.query("SELECT id, username, cafe_id FROM users WHERE role = 'cafe_admin'");
        console.log(`✅ ${res.rows.length} kafe admini bulundu`);
        res.rows.forEach(a => {
            if (a.cafe_id) {
                console.log(`   - ${a.username}: cafe_id=${a.cafe_id} ✓`);
            } else {
                console.log(`   - ${a.username}: cafe_id=NULL ⚠️ SORUN!`);
                issues.push(`${a.username} admininin cafe_id değeri NULL`);
            }
        });
        passed++;
    } catch (err) {
        console.log("❌ Kafe adminleri okunamadı:", err.message);
        failed++;
    }

    // ============ API TESTS ============
    console.log("\n🌐 API TESTLERİ\n");

    // Test 6: GET /api/cafes
    const cafesResult = await testAPI('GET', '/cafes');
    if (cafesResult.ok && Array.isArray(cafesResult.data)) {
        console.log(`✅ GET /api/cafes - ${cafesResult.data.length} kafe döndü`);

        // Check if daily_pin is included
        if (cafesResult.data[0]?.daily_pin !== undefined) {
            console.log("   ✓ daily_pin alanı API'da mevcut");
        } else {
            console.log("   ⚠️ daily_pin alanı API yanıtında YOK");
            issues.push("API /cafes endpoint'i daily_pin döndürmüyor");
        }
        passed++;
    } else {
        console.log("❌ GET /api/cafes başarısız:", cafesResult.error || cafesResult.status);
        issues.push("GET /api/cafes çalışmıyor");
        failed++;
    }

    // Test 7: Check-in with correct PIN
    if (cafesResult.ok && cafesResult.data.length > 0) {
        const testCafe = cafesResult.data[0];
        const testPin = testCafe.daily_pin || '0000';

        // First get a test user
        const usersResult = await pool.query("SELECT id FROM users LIMIT 1");
        if (usersResult.rows.length > 0) {
            const testUserId = usersResult.rows[0].id;

            const checkinResult = await testAPI('POST', '/cafes/check-in', {
                userId: testUserId,
                cafeId: testCafe.id,
                tableNumber: 1,
                pin: testPin
            });

            if (checkinResult.ok) {
                console.log(`✅ POST /api/cafes/check-in - PIN "${testPin}" kabul edildi`);
                passed++;
            } else {
                console.log(`❌ POST /api/cafes/check-in - PIN "${testPin}" reddedildi`);
                console.log(`   Hata: ${checkinResult.data?.error || 'Bilinmiyor'}`);
                issues.push(`Check-in çalışmıyor: ${checkinResult.data?.error}`);
                failed++;
            }
        }
    }

    // Test 8: Register endpoint
    const registerResult = await testAPI('POST', '/auth/register', {
        username: 'test_user_' + Date.now(),
        email: `test${Date.now()}@test.com`,
        password: 'test123'
    });
    if (registerResult.ok || registerResult.status === 400) {
        console.log("✅ POST /api/auth/register endpoint çalışıyor");
        passed++;
    } else {
        console.log("❌ POST /api/auth/register başarısız");
        issues.push("Kayıt endpoint'i çalışmıyor");
        failed++;
    }

    // Test 9: Login endpoint  
    const loginResult = await testAPI('POST', '/auth/login', {
        email: 'test@test.com',
        password: 'wrongpassword'
    });
    if (loginResult.status === 401 || loginResult.ok) {
        console.log("✅ POST /api/auth/login endpoint çalışıyor");
        passed++;
    } else {
        console.log("❌ POST /api/auth/login başarısız");
        issues.push("Giriş endpoint'i çalışmıyor");
        failed++;
    }

    // Test 10: Games endpoint
    const gamesResult = await testAPI('GET', '/games');
    if (gamesResult.ok) {
        console.log(`✅ GET /api/games - ${gamesResult.data.length} oyun`);
        passed++;
    } else {
        console.log("❌ GET /api/games başarısız");
        issues.push("Oyunlar endpoint'i çalışmıyor");
        failed++;
    }

    // Test 11: Rewards endpoint
    const rewardsResult = await testAPI('GET', '/rewards');
    if (rewardsResult.ok) {
        console.log(`✅ GET /api/rewards - ${rewardsResult.data.length} ödül`);
        passed++;
    } else {
        console.log("❌ GET /api/rewards başarısız");
        issues.push("Ödüller endpoint'i çalışmıyor");
        failed++;
    }

    // ============ SUMMARY ============
    console.log("\n" + "=".repeat(60));
    console.log("📊 SONUÇ");
    console.log("=".repeat(60));
    console.log(`\n✅ Başarılı: ${passed}`);
    console.log(`❌ Başarısız: ${failed}`);

    if (issues.length > 0) {
        console.log("\n⚠️ TESPİT EDİLEN SORUNLAR:");
        issues.forEach((issue, i) => console.log(`  ${i + 1}. ${issue}`));
    } else {
        console.log("\n🎉 Tüm testler başarılı!");
    }

    console.log("\n");
    pool.end();
}

runTests();
