const { pool } = require('./db');

async function checkSchema() {
    console.log('🔍 Checking Schema...');
    try {
        // 1. Check Rewards Table
        const tablesRes = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'rewards'
    `);
        if (tablesRes.rows.length > 0) {
            console.log('✅ Rewards table exists');
        } else {
            console.error('❌ Rewards table MISSING');
        }

        // 2. Check Users Columns
        const columnsRes = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'last_daily_bonus'
    `);
        if (columnsRes.rows.length > 0) {
            console.log('✅ last_daily_bonus column exists');
        } else {
            console.error('❌ last_daily_bonus column MISSING');
        }

        // 3. Check Cafe Admin Role
        const roleRes = await pool.query(`
      SELECT role FROM users WHERE role = 'cafe_admin' LIMIT 1
    `);
        if (roleRes.rows.length > 0) {
            console.log('✅ Found at least one cafe_admin');
        } else {
            console.log('ℹ️ No cafe_admin found (might be normal if none created)');
        }

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        pool.end();
    }
}

checkSchema();
