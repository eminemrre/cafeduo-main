-- Cafes table
CREATE TABLE IF NOT EXISTS cafes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

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
INSERT INTO cafes (name) VALUES ('PAÜ İİBF Kantin'), ('PAÜ Yemekhane') ON CONFLICT (name) DO NOTHING;