const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const { pool } = require('./db');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Database Schema (Robust Version)
const initDb = async () => {
  if (await isDbConnected()) {
    try {
      console.log('🔄 Veritabanı şeması kontrol ediliyor...');

      // 1. Users Table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          points INTEGER DEFAULT 0,
          wins INTEGER DEFAULT 0,
          games_played INTEGER DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 2. Cafes Table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS cafes (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL UNIQUE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 3. Games Table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS games (
          id SERIAL PRIMARY KEY,
          host_name VARCHAR(255) NOT NULL,
          game_type VARCHAR(50) NOT NULL,
          points INTEGER NOT NULL,
          table_code VARCHAR(50) NOT NULL,
          status VARCHAR(20) DEFAULT 'waiting',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 4. User Items Table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS user_items (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id),
          item_id INTEGER NOT NULL,
          item_title VARCHAR(255) NOT NULL,
          code VARCHAR(50) NOT NULL,
          redeemed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 5. Rewards Table (Dynamic System)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS rewards (
          id SERIAL PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          cost INTEGER NOT NULL,
          description TEXT,
          icon VARCHAR(50),
          cafe_id INTEGER REFERENCES cafes(id),
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 6. Add Columns Safely
      const addColumn = async (table, column, type) => {
        try {
          await pool.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${type}`);
        } catch (e) {
          console.error(`⚠️ Sütun eklenemedi: ${table}.${column}`, e.message);
        }
      };

      await addColumn('users', 'department', 'VARCHAR(255)');
      await addColumn('users', 'is_admin', 'BOOLEAN DEFAULT FALSE');
      await addColumn('users', 'role', "VARCHAR(50) DEFAULT 'user'");
      await addColumn('users', 'cafe_id', 'INTEGER REFERENCES cafes(id)');
      await addColumn('users', 'last_daily_bonus', 'DATE');

      await addColumn('user_items', 'is_used', 'BOOLEAN DEFAULT FALSE');
      await addColumn('user_items', 'used_at', 'TIMESTAMP WITH TIME ZONE');

      // 7. Seed Initial Cafes
      await pool.query(`INSERT INTO cafes (name) VALUES ('PAÜ İİBF Kantin'), ('PAÜ Yemekhane') ON CONFLICT (name) DO NOTHING`);

      // 8. Seed Initial Rewards (If empty)
      const rewardsCheck = await pool.query('SELECT COUNT(*) FROM rewards');
      if (parseInt(rewardsCheck.rows[0].count) === 0) {
        await pool.query(`
            INSERT INTO rewards (title, cost, description, icon, is_active) VALUES
            ('Bedava Filtre Kahve', 500, 'Günün yorgunluğunu at.', 'coffee', true),
            ('%20 Hesap İndirimi', 850, 'Tüm masada geçerli.', 'discount', true),
            ('Cheesecake İkramı', 400, 'Tatlı bir mola ver.', 'dessert', true),
            ('Oyun Jetonu x5', 100, 'Ekstra oyun hakkı.', 'game', true)
          `);
        console.log('🎁 Başlangıç ödülleri eklendi.');
      }

      console.log('✅ Veritabanı şeması başarıyla güncellendi.');
    } catch (err) {
      console.error('❌ Kritik Şema Hatası:', err);
    }
  }
};

// --- IN-MEMORY FALLBACK DATA (For testing without DB) ---
let MEMORY_USERS = [
  { id: 1, username: 'DemoUser', email: 'demo@cafe.com', password: '123', points: 1250, wins: 12, gamesPlayed: 25 }
];
let MEMORY_GAMES = [
  { id: 1, hostName: 'GamerTr_99', gameType: 'Taş Kağıt Makas', points: 150, table: 'MASA04', status: 'waiting' }
];
let MEMORY_REWARDS = [];

// Helper to check DB status
const isDbConnected = async () => {
  try {
    const client = await pool.connect();
    client.release();
    return true;
  } catch (e) {
    return false;
  }
};

// --- API ROUTES ---

// 1. REGISTER
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Tüm alanlar zorunludur.' });
  }

  if (await isDbConnected()) {
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const result = await pool.query(
        'INSERT INTO users (username, email, password_hash, points, department) VALUES ($1, $2, $3, 100, $4) RETURNING id, username, email, points, wins, games_played as "gamesPlayed", department, is_admin as "isAdmin"',
        [username, email, hashedPassword, req.body.department || '']
      );
      res.json(result.rows[0]);
    } catch (err) {
      res.status(400).json({ error: 'Kullanıcı oluşturulamadı. E-posta kullanımda olabilir.' });
    }
  } else {
    // Fallback
    if (MEMORY_USERS.find(u => u.email === email)) {
      return res.status(400).json({ error: 'E-posta kullanımda.' });
    }
    const newUser = { id: Date.now(), username, email, password, points: 100, wins: 0, gamesPlayed: 0 };
    MEMORY_USERS.push(newUser);
    res.json(newUser);
  }
});

// 2. LOGIN
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (await isDbConnected()) {
    try {
      const result = await pool.query('SELECT id, username, email, password_hash, points, wins, games_played as "gamesPlayed", department, is_admin as "isAdmin", role, cafe_id FROM users WHERE email = $1', [email]);

      if (result.rows.length > 0) {
        const user = result.rows[0];
        const match = await bcrypt.compare(password, user.password_hash);

        if (match) {
          // Daily Bonus Logic
          let bonusReceived = false;

          // 2. Daily Bonus Check (Only for regular users, not admins)
          const today = new Date().toISOString().split('T')[0];
          const lastBonus = user.last_daily_bonus ? new Date(user.last_daily_bonus).toISOString().split('T')[0] : null;

          // Only give bonus if:
          // 1. User is NOT an admin (is_admin is false)
          // 2. User is NOT a cafe_admin (role is 'user' or null/undefined, but definitely not 'cafe_admin')
          // 3. Has not received bonus today
          const isEligibleForBonus = !user.is_admin && user.role !== 'cafe_admin' && user.role !== 'admin';

          if (isEligibleForBonus && lastBonus !== today) {
            console.log(`🎁 Awarding daily bonus to ${user.username}`);
            await pool.query('UPDATE users SET points = points + 10, last_daily_bonus = NOW() WHERE id = $1', [user.id]);
            user.points += 10;
            bonusReceived = true;
          }

          // Remove password_hash from response
          delete user.password_hash;
          delete user.last_daily_bonus; // Don't send internal date

          res.json({ ...user, bonusReceived });
        } else {
          res.status(401).json({ error: 'Geçersiz e-posta veya şifre.' });
        }
      } else {
        res.status(401).json({ error: 'Geçersiz e-posta veya şifre.' });
      }
    } catch (err) {
      console.error("LOGIN ERROR:", err); // Detailed logging
      res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
    }
  } else {
    // Fallback
    const user = MEMORY_USERS.find(u => u.email === email && u.password === password);
    if (user) res.json(user);
    else res.status(401).json({ error: 'Kullanıcı bulunamadı.' });
  }
});

// 3. GET GAMES
app.get('/api/games', async (req, res) => {
  if (await isDbConnected()) {
    const result = await pool.query('SELECT * FROM games WHERE status = \'waiting\' ORDER BY created_at DESC');
    res.json(result.rows);
  } else {
    res.json(MEMORY_GAMES);
  }
});

// 4. CREATE GAME
app.post('/api/games', async (req, res) => {
  const { hostName, gameType, points, table } = req.body;

  if (await isDbConnected()) {
    try {
      const result = await pool.query(
        'INSERT INTO games (host_name, game_type, points, table_code, status) VALUES ($1, $2, $3, $4, \'waiting\') RETURNING *',
        [hostName, gameType, points, table]
      );
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  } else {
    const newGame = { id: Date.now(), hostName, gameType, points, table, status: 'waiting' };
    MEMORY_GAMES.unshift(newGame);
    res.json(newGame);
  }
});

// 5. JOIN GAME (Delete/Archive logic)
app.post('/api/games/:id/join', async (req, res) => {
  const { id } = req.params;

  if (await isDbConnected()) {
    // For simplicity, we just delete it from active list or mark status active
    await pool.query('UPDATE games SET status = \'active\' WHERE id = $1', [id]);
    res.json({ success: true });
  } else {
    MEMORY_GAMES = MEMORY_GAMES.filter(g => g.id != id);
    res.json({ success: true });
  }
});

// 6. UPDATE USER (Points, Stats)
app.put('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const { points, wins, gamesPlayed } = req.body;

  if (await isDbConnected()) {
    const result = await pool.query(
      'UPDATE users SET points = $1, wins = $2, games_played = $3, department = $4 WHERE id = $5 RETURNING id, username, email, points, wins, games_played as "gamesPlayed", department, is_admin as "isAdmin"',
      [points, wins, gamesPlayed, req.body.department, id]
    );
    res.json(result.rows[0]);
  } else {
    const idx = MEMORY_USERS.findIndex(u => u.id == id);
    if (idx !== -1) {
      MEMORY_USERS[idx] = { ...MEMORY_USERS[idx], points, wins, gamesPlayed };
      res.json(MEMORY_USERS[idx]);
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  }
});

// 7. SHOP: BUY ITEM
app.post('/api/shop/buy', async (req, res) => {
  const { userId, item } = req.body; // item: { id, title, cost, icon }

  if (await isDbConnected()) {
    try {
      // 1. Check points
      const userRes = await pool.query('SELECT points FROM users WHERE id = $1', [userId]);
      if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });

      const currentPoints = userRes.rows[0].points;
      if (currentPoints < item.cost) {
        return res.status(400).json({ error: 'Yetersiz puan.' });
      }

      // 2. Deduct points
      const newPoints = currentPoints - item.cost;
      await pool.query('UPDATE users SET points = $1 WHERE id = $2', [newPoints, userId]);

      // 3. Add to inventory
      const code = `CD-${Math.floor(1000 + Math.random() * 9000)}`;
      const redeemRes = await pool.query(
        'INSERT INTO user_items (user_id, item_id, item_title, code) VALUES ($1, $2, $3, $4) RETURNING *',
        [userId, item.id, item.title, code]
      );

      res.json({ success: true, newPoints, reward: redeemRes.rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'İşlem başarısız.' });
    }
  } else {
    res.status(500).json({ error: 'Veritabanı bağlantısı yok.' });
  }
});

// Get User Items (Coupons)
app.get('/api/users/:id/items', async (req, res) => {
  const userId = parseInt(req.params.id);
  try {
    if (await isDbConnected()) { // Check DB connection
      const result = await pool.query(
        `SELECT id, user_id, item_id, item_title, code, redeemed_at, is_used, used_at FROM user_items 
         WHERE user_id = $1 
         AND redeemed_at > NOW() - INTERVAL '5 days'
         ORDER BY redeemed_at DESC`,
        [userId]
      );
      res.json(result.rows.map(item => ({
        ...item,
        status: item.is_used ? 'used' : 'active'
      })));
    } else {
      // Memory fallback
      const items = memoryItems.filter(item => {
        const isExpired = new Date(item.redeemed_at) < new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
        return item.user_id === userId && !isExpired;
      });
      res.json(items.map(item => ({
        ...item,
        status: item.is_used ? 'used' : 'active'
      })));
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Use Coupon (Cafe Admin)
app.post('/api/coupons/use', async (req, res) => {
  const { code } = req.body;
  try {
    if (await isDbConnected()) { // Check DB connection
      const result = await pool.query(
        `UPDATE user_items 
         SET is_used = TRUE, used_at = NOW() 
         WHERE code = $1 AND is_used = FALSE AND redeemed_at > NOW() - INTERVAL '5 days'
         RETURNING *`,
        [code]
      );

      if (result.rows.length === 0) {
        return res.status(400).json({ error: 'Kupon geçersiz, süresi dolmuş veya zaten kullanılmış.' });
      }

      res.json({ success: true, item: result.rows[0] });
    } else {
      const itemIndex = memoryItems.findIndex(i => i.code === code && !i.is_used && new Date(i.redeemed_at) > new Date(Date.now() - 5 * 24 * 60 * 60 * 1000));
      if (itemIndex === -1) {
        return res.status(400).json({ error: 'Kupon bulunamadı, süresi dolmuş veya zaten kullanılmış.' });
      }
      memoryItems[itemIndex].is_used = true;
      memoryItems[itemIndex].used_at = new Date();
      res.json({ success: true, item: memoryItems[itemIndex] });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get Cafes
app.get('/api/cafes', async (req, res) => {
  try {
    if (await isDbConnected()) { // Check DB connection
      const result = await pool.query('SELECT * FROM cafes ORDER BY name');
      res.json(result.rows);
    } else {
      res.json([
        { id: 1, name: 'PAÜ İİBF Kantin' },
        { id: 2, name: 'PAÜ Yemekhane' }
      ]);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Create Cafe Admin (Super Admin only)
app.post('/api/admin/cafe-admins', async (req, res) => {
  const { username, email, password, cafeId } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    if (await isDbConnected()) { // Check DB connection
      const result = await pool.query(
        `INSERT INTO users (username, email, password_hash, role, cafe_id) 
         VALUES ($1, $2, $3, 'cafe_admin', $4) 
         RETURNING id, username, email, role, cafe_id`,
        [username, email, hashedPassword, cafeId]
      );
      res.json(result.rows[0]);
    } else {
      res.status(501).json({ error: 'Not implemented in memory mode' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// 8. SHOP: GET INVENTORY
app.get('/api/shop/inventory/:userId', async (req, res) => {
  const { userId } = req.params;
  if (await isDbConnected()) {
    // Filter expired coupons (5 days)
    const result = await pool.query("SELECT * FROM user_items WHERE user_id = $1 AND redeemed_at > NOW() - INTERVAL '5 days' ORDER BY redeemed_at DESC", [userId]);
    // Map to frontend format
    const rewards = result.rows.map(row => ({
      redeemId: row.id,
      id: row.item_id,
      title: row.item_title,
      code: row.code,
      redeemedAt: row.redeemed_at
    }));
    res.json(rewards);
  } else {
    // Memory Fallback with Expiration
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

    // In a real app we might delete them, here we just filter for display
    const userItems = MEMORY_REWARDS.filter(r => r.userId == userId && new Date(r.redeemedAt) > fiveDaysAgo);
    res.json(userItems);
  }
});

// 9. ADMIN: GET USERS
app.get('/api/admin/users', async (req, res) => {
  if (await isDbConnected()) {
    const result = await pool.query('SELECT id, username, email, points, wins, games_played as "gamesPlayed", department, is_admin as "isAdmin", role, cafe_id FROM users ORDER BY id ASC');
    res.json(result.rows);
  } else {
    res.json(MEMORY_USERS);
  }
});

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../dist')));

// ... (keep existing API routes)

// 10. ADMIN: DELETE USER
app.delete('/api/admin/users/:id', async (req, res) => {
  const { id } = req.params;
  if (await isDbConnected()) {
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ success: true });
  } else {
    MEMORY_USERS = MEMORY_USERS.filter(u => u.id != id);
    res.json({ success: true });
  }
});

// 11. REWARDS: GET ALL
app.get('/api/rewards', async (req, res) => {
  if (await isDbConnected()) {
    try {
      const result = await pool.query('SELECT * FROM rewards WHERE is_active = true ORDER BY cost ASC');
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: 'Ödüller yüklenemedi.' });
    }
  } else {
    // Memory fallback
    res.json([
      { id: 1, title: 'Bedava Filtre Kahve', cost: 500, description: 'Günün yorgunluğunu at.', icon: 'coffee' },
      { id: 2, title: '%20 Hesap İndirimi', cost: 850, description: 'Tüm masada geçerli.', icon: 'discount' },
      { id: 3, title: 'Cheesecake İkramı', cost: 400, description: 'Tatlı bir mola ver.', icon: 'dessert' },
      { id: 4, title: 'Oyun Jetonu x5', cost: 100, description: 'Ekstra oyun hakkı.', icon: 'game' },
    ]);
  }
});

// 12. REWARDS: CREATE (Cafe Admin)
app.post('/api/rewards', async (req, res) => {
  const { title, cost, description, icon, cafeId } = req.body;

  if (await isDbConnected()) {
    try {
      const result = await pool.query(
        'INSERT INTO rewards (title, cost, description, icon, cafe_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [title, cost, description, icon, cafeId]
      );
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: 'Ödül oluşturulamadı.' });
    }
  } else {
    res.status(501).json({ error: 'Not implemented in memory mode' });
  }
});

// 13. REWARDS: DELETE
app.delete('/api/rewards/:id', async (req, res) => {
  const { id } = req.params;
  if (await isDbConnected()) {
    try {
      await pool.query('UPDATE rewards SET is_active = false WHERE id = $1', [id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Silme işlemi başarısız.' });
    }
  } else {
    res.status(501).json({ error: 'Not implemented in memory mode' });
  }
});

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({ error: 'Sunucu hatası oluştu.' });
});

// Initialize DB and start server
initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
});