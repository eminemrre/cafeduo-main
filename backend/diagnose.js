const { pool } = require('./db');

async function diagnose() {
    console.log('🔍 Diagnosing Database...');

    try {
        // 1. Check Connection
        const client = await pool.connect();
        console.log('✅ Connection successful');
        client.release();

        // 2. Check Tables
        const tablesRes = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
        const tables = tablesRes.rows.map(r => r.table_name);
        console.log('📊 Tables:', tables);

        // 3. Check Users Columns
        if (tables.includes('users')) {
            const columnsRes = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'users'
      `);
            const columns = columnsRes.rows.map(r => r.column_name);
            console.log('👤 Users Columns:', columns);

            // Check specific columns
            const required = ['role', 'cafe_id', 'department', 'is_admin'];
            const missing = required.filter(c => !columns.includes(c));
            if (missing.length > 0) {
                console.error('❌ Missing columns in users:', missing);
            } else {
                console.log('✅ All required columns present in users');
            }
        } else {
            console.error('❌ Users table missing!');
        }

        // 4. Test Login Query
        console.log('🧪 Testing Login Query...');
        try {
            const testEmail = 'test@example.com'; // Doesn't need to exist, just testing syntax
            await pool.query('SELECT id, username, email, password_hash, points, wins, games_played as "gamesPlayed", department, is_admin as "isAdmin", role, cafe_id FROM users WHERE email = $1', [testEmail]);
            console.log('✅ Login query syntax is valid');
        } catch (err) {
            console.error('❌ Login query failed:', err.message);
        }

    } catch (err) {
        console.error('❌ Diagnosis failed:', err);
    } finally {
        pool.end();
    }
}

diagnose();
