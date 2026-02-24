/**
 * Initial Schema Migration
 * 
 * This migration creates the initial database schema for CafeDuo.
 * It includes tables for cafes, users, games, and password reset tokens.
 * 
 * @type {import('node-pg-migrate').Migration}
 */
exports.up = (pgm) => {
    // Cafes table
    pgm.createTable('cafes', {
        id: {
            type: 'SERIAL',
            primaryKey: true,
        },
        name: {
            type: 'VARCHAR(255)',
            notNull: true,
            unique: true,
        },
        address: {
            type: 'TEXT',
        },
        total_tables: {
            type: 'INTEGER',
            default: 10,
        },
        pin: {
            type: 'VARCHAR(4)',
            default: '0000',
        },
        latitude: {
            type: 'DECIMAL(10, 8)',
        },
        longitude: {
            type: 'DECIMAL(11, 8)',
        },
        radius: {
            type: 'INTEGER',
            default: 500,
        },
        secondary_latitude: {
            type: 'DECIMAL(10, 8)',
        },
        secondary_longitude: {
            type: 'DECIMAL(11, 8)',
        },
        secondary_radius: {
            type: 'INTEGER',
        },
        daily_pin: {
            type: 'VARCHAR(6)',
            default: '0000',
        },
        created_at: {
            type: 'TIMESTAMP WITH TIME ZONE',
            default: pgm.func('CURRENT_TIMESTAMP'),
        },
    });

    // Users table
    pgm.createTable('users', {
        id: {
            type: 'SERIAL',
            primaryKey: true,
        },
        username: {
            type: 'VARCHAR(255)',
            notNull: true,
        },
        email: {
            type: 'VARCHAR(255)',
            notNull: true,
            unique: true,
        },
        password_hash: {
            type: 'VARCHAR(255)',
            notNull: true,
        },
        points: {
            type: 'INTEGER',
            default: 0,
        },
        wins: {
            type: 'INTEGER',
            default: 0,
        },
        games_played: {
            type: 'INTEGER',
            default: 0,
        },
        department: {
            type: 'VARCHAR(255)',
        },
        role: {
            type: 'VARCHAR(50)',
            default: 'user',
        },
        cafe_id: {
            type: 'INTEGER',
            references: 'cafes(id)',
            onDelete: 'SET NULL',
        },
        table_number: {
            type: 'INTEGER',
        },
        created_at: {
            type: 'TIMESTAMP WITH TIME ZONE',
            default: pgm.func('CURRENT_TIMESTAMP'),
        },
    });

    // Indexes for users table
    pgm.createIndex('users', ['LOWER(username)', 'cafe_id'], {
        name: 'idx_users_lower_username_cafe',
    });
    pgm.createIndex('users', ['cafe_id', 'table_number'], {
        name: 'idx_users_cafe_table_number',
    });

    // Password reset tokens table
    pgm.createTable('password_reset_tokens', {
        id: {
            type: 'SERIAL',
            primaryKey: true,
        },
        user_id: {
            type: 'INTEGER',
            notNull: true,
            references: 'users(id)',
            onDelete: 'CASCADE',
        },
        token_hash: {
            type: 'VARCHAR(255)',
            notNull: true,
        },
        expires_at: {
            type: 'TIMESTAMP WITH TIME ZONE',
            notNull: true,
        },
        used_at: {
            type: 'TIMESTAMP WITH TIME ZONE',
        },
        request_ip: {
            type: 'VARCHAR(64)',
        },
        user_agent: {
            type: 'VARCHAR(255)',
        },
        created_at: {
            type: 'TIMESTAMP WITH TIME ZONE',
            default: pgm.func('CURRENT_TIMESTAMP'),
        },
    });

    // Indexes for password_reset_tokens table
    pgm.createIndex('password_reset_tokens', ['token_hash', 'expires_at', 'used_at'], {
        name: 'idx_password_reset_lookup',
    });
    pgm.createIndex('password_reset_tokens', ['user_id', 'used_at'], {
        name: 'idx_password_reset_user',
    });

    // Games table
    pgm.createTable('games', {
        id: {
            type: 'SERIAL',
            primaryKey: true,
        },
        host_name: {
            type: 'VARCHAR(255)',
            notNull: true,
        },
        guest_name: {
            type: 'VARCHAR(255)',
        },
        game_type: {
            type: 'VARCHAR(50)',
            notNull: true,
        },
        points: {
            type: 'INTEGER',
            notNull: true,
        },
        table_code: {
            type: 'VARCHAR(50)',
            notNull: true,
        },
        status: {
            type: 'VARCHAR(20)',
            default: 'waiting',
        },
        player1_move: {
            type: 'VARCHAR(50)',
        },
        player2_move: {
            type: 'VARCHAR(50)',
        },
        game_state: {
            type: 'JSONB',
        },
        winner: {
            type: 'VARCHAR(255)',
        },
        created_at: {
            type: 'TIMESTAMP WITH TIME ZONE',
            default: pgm.func('CURRENT_TIMESTAMP'),
        },
    });

    // Indexes for games table
    pgm.createIndex('games', ['status', 'created_at'], {
        name: 'idx_games_status_created_at',
        order: [{ column: 'created_at', direction: 'DESC' }],
    });
    pgm.createIndex('games', ['status', 'table_code', 'created_at'], {
        name: 'idx_games_status_table_created_at',
        order: [{ column: 'created_at', direction: 'DESC' }],
    });
    pgm.createIndex('games', ['status', 'game_type', 'created_at'], {
        name: 'idx_games_status_type_created_at',
        order: [{ column: 'created_at', direction: 'DESC' }],
    });
    pgm.createIndex('games', ['status', 'host_name', 'created_at'], {
        name: 'idx_games_status_host_created_at',
        order: [{ column: 'created_at', direction: 'DESC' }],
    });
    pgm.createIndex('games', ['status', 'guest_name', 'created_at'], {
        name: 'idx_games_status_guest_created_at',
        order: [{ column: 'created_at', direction: 'DESC' }],
    });
    pgm.createIndex('games', ['host_name', 'created_at'], {
        name: 'idx_games_host_created_at',
        order: [{ column: 'created_at', direction: 'DESC' }],
    });
    pgm.createIndex('games', ['guest_name', 'created_at'], {
        name: 'idx_games_guest_created_at',
        order: [{ column: 'created_at', direction: 'DESC' }],
    });

    // User Items (Inventory) table
    pgm.createTable('user_items', {
        id: {
            type: 'SERIAL',
            primaryKey: true,
        },
        user_id: {
            type: 'INTEGER',
            references: 'users(id)',
            onDelete: 'CASCADE',
        },
        item_id: {
            type: 'INTEGER',
            notNull: true,
        },
        item_title: {
            type: 'VARCHAR(255)',
            notNull: true,
        },
        code: {
            type: 'VARCHAR(50)',
            notNull: true,
        },
        is_used: {
            type: 'BOOLEAN',
            default: false,
        },
        used_at: {
            type: 'TIMESTAMP WITH TIME ZONE',
        },
        redeemed_at: {
            type: 'TIMESTAMP WITH TIME ZONE',
            default: pgm.func('CURRENT_TIMESTAMP'),
        },
    });

    // Index for user_items table
    pgm.createIndex('user_items', ['user_id', 'is_used'], {
        name: 'idx_user_items_user_is_used',
    });

    // Insert initial cafes
    pgm.sql(`
        INSERT INTO cafes (name, address, total_tables, pin) 
        VALUES 
            ('PAÜ İİBF Kantin', 'İktisadi ve İdari Bilimler Fakültesi', 30, '1234'),
            ('PAÜ Mühendislik Kafeterya', 'Mühendislik Fakültesi', 25, '1234'),
            ('PAÜ Merkez Yemekhane', 'Merkez Kampüs', 50, '1234')
        ON CONFLICT (name) DO UPDATE SET 
            address = EXCLUDED.address,
            total_tables = EXCLUDED.total_tables,
            pin = EXCLUDED.pin
    `);
};

exports.down = (pgm) => {
    // Drop tables in reverse order due to foreign key constraints
    pgm.dropTable('user_items', { ifExists: true });
    pgm.dropTable('games', { ifExists: true });
    pgm.dropTable('password_reset_tokens', { ifExists: true });
    pgm.dropTable('users', { ifExists: true });
    pgm.dropTable('cafes', { ifExists: true });
};
