const { pool } = require('./db');

async function checkUser() {
    try {
        const email = 'emin3619@gmail.com';
        console.log(`🔍 Checking user: ${email}`);

        const res = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

        if (res.rows.length === 0) {
            console.log('❌ User not found');
        } else {
            const user = res.rows[0];
            console.log('✅ User found:', {
                id: user.id,
                username: user.username,
                email: user.email,
                hasPasswordHash: !!user.password_hash,
                passwordHashLength: user.password_hash ? user.password_hash.length : 0,
                role: user.role,
                cafe_id: user.cafe_id
            });

            if (!user.password_hash) {
                console.error('❌ FATAL: Password hash is missing!');
            }
        }
    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        pool.end();
    }
}

checkUser();
