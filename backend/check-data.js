const { pool } = require('./db');

async function checkData() {
    console.log('🔍 Checking Data...');
    try {
        const rewardsRes = await pool.query('SELECT * FROM rewards');
        console.log(`🎁 Rewards count: ${rewardsRes.rows.length}`);
        if (rewardsRes.rows.length > 0) {
            console.log('First reward:', rewardsRes.rows[0].title);
        } else {
            console.log('⚠️ No rewards found!');
        }
    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        pool.end();
    }
}

checkData();
