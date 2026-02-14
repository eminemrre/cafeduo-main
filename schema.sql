-- Cafes table
CREATE TABLE IF NOT EXISTS cafes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    address TEXT,
    total_tables INTEGER DEFAULT 10,
    pin VARCHAR(4) DEFAULT '0000',
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    radius INTEGER DEFAULT 500,
    secondary_latitude DECIMAL(10, 8),
    secondary_longitude DECIMAL(11, 8),
    secondary_radius INTEGER,
    daily_pin VARCHAR(6) DEFAULT '0000',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    points INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    games_played INTEGER DEFAULT 0,
    department VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user', -- 'user', 'admin', 'cafe_admin'
    cafe_id INTEGER REFERENCES cafes(id), -- For cafe_admin
    table_number INTEGER, -- Current table number when checked in
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Password reset tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    request_ip VARCHAR(64),
    user_agent VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_password_reset_lookup
    ON password_reset_tokens(token_hash, expires_at, used_at);
CREATE INDEX IF NOT EXISTS idx_password_reset_user
    ON password_reset_tokens(user_id, used_at);

-- Add columns if they don't exist (Migration for existing DB)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='department') THEN
        ALTER TABLE users ADD COLUMN department VARCHAR(255);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='role') THEN
        ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'user';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='cafe_id') THEN
        ALTER TABLE users ADD COLUMN cafe_id INTEGER REFERENCES cafes(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='table_number') THEN
        ALTER TABLE users ADD COLUMN table_number INTEGER;
    END IF;
    
    -- Add missing columns to cafes table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cafes' AND column_name='address') THEN
        ALTER TABLE cafes ADD COLUMN address TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cafes' AND column_name='total_tables') THEN
        ALTER TABLE cafes ADD COLUMN total_tables INTEGER DEFAULT 10;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cafes' AND column_name='pin') THEN
        ALTER TABLE cafes ADD COLUMN pin VARCHAR(4) DEFAULT '0000';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cafes' AND column_name='latitude') THEN
        ALTER TABLE cafes ADD COLUMN latitude DECIMAL(10, 8);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cafes' AND column_name='longitude') THEN
        ALTER TABLE cafes ADD COLUMN longitude DECIMAL(11, 8);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cafes' AND column_name='radius') THEN
        ALTER TABLE cafes ADD COLUMN radius INTEGER DEFAULT 500;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cafes' AND column_name='secondary_latitude') THEN
        ALTER TABLE cafes ADD COLUMN secondary_latitude DECIMAL(10, 8);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cafes' AND column_name='secondary_longitude') THEN
        ALTER TABLE cafes ADD COLUMN secondary_longitude DECIMAL(11, 8);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cafes' AND column_name='secondary_radius') THEN
        ALTER TABLE cafes ADD COLUMN secondary_radius INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cafes' AND column_name='daily_pin') THEN
        ALTER TABLE cafes ADD COLUMN daily_pin VARCHAR(6) DEFAULT '0000';
    END IF;
END $$;

-- Games table
CREATE TABLE IF NOT EXISTS games (
    id SERIAL PRIMARY KEY,
    host_name VARCHAR(255) NOT NULL,
    game_type VARCHAR(50) NOT NULL,
    points INTEGER NOT NULL,
    table_code VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'waiting', -- 'waiting', 'active', 'completed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User Items (Inventory) table
CREATE TABLE IF NOT EXISTS user_items (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    item_id INTEGER NOT NULL,
    item_title VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMP WITH TIME ZONE,
    redeemed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add columns to user_items if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_items' AND column_name='is_used') THEN
        ALTER TABLE user_items ADD COLUMN is_used BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_items' AND column_name='used_at') THEN
        ALTER TABLE user_items ADD COLUMN used_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Insert Initial Cafes
INSERT INTO cafes (name, address, total_tables, pin) 
VALUES 
    ('PAÜ İİBF Kantin', 'İktisadi ve İdari Bilimler Fakültesi', 30, '1234'),
    ('PAÜ Mühendislik Kafeterya', 'Mühendislik Fakültesi', 25, '1234'),
    ('PAÜ Merkez Yemekhane', 'Merkez Kampüs', 50, '1234')
ON CONFLICT (name) DO UPDATE SET 
    address = EXCLUDED.address,
    total_tables = EXCLUDED.total_tables,
    pin = EXCLUDED.pin;
