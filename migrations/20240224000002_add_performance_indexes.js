/**
 * Performance Indexes Migration
 *
 * This migration adds indexes to optimize common queries:
 * - Lobby list queries (status='waiting' + created_at ordering)
 * - Active game lookups (by host_name or guest_name)
 * - User statistics (points leaderboard)
 * - Cafe-scoped queries
 *
 * @type {import('node-pg-migrate').Migration}
 */
exports.up = (pgm) => {
    // ============================================================================
    // GAMES TABLE INDEXES
    // ============================================================================

    // Lobby query optimization: status='waiting' + order by created_at DESC
    pgm.createIndex('games', ['status', 'created_at'], {
        name: 'idx_games_status_created',
        where: "status = 'waiting'",
        order: {
            created_at: 'DESC',
        },
    });

    // Table-specific lobby queries: status + table_code
    pgm.createIndex('games', ['status', 'table_code', 'created_at'], {
        name: 'idx_games_status_table_created',
        where: "status = 'waiting'",
        order: {
            created_at: 'DESC',
        },
    });

    // Game type filtering: status + game_type
    pgm.createIndex('games', ['status', 'game_type', 'created_at'], {
        name: 'idx_games_status_type_created',
        where: "status = 'waiting'",
        order: {
            created_at: 'DESC',
        },
    });

    // Active game lookup by host: host_name + status
    pgm.createIndex('games', ['host_name', 'status', 'created_at'], {
        name: 'idx_games_host_status_created',
        where: "status IN ('waiting', 'active')",
        order: {
            created_at: 'DESC',
        },
    });

    // Active game lookup by guest: guest_name + status
    pgm.createIndex('games', ['guest_name', 'status', 'created_at'], {
        name: 'idx_games_guest_status_created',
        where: "status IN ('waiting', 'active') AND guest_name IS NOT NULL",
        order: {
            created_at: 'DESC',
        },
    });

    // ============================================================================
    // USERS TABLE INDEXES
    // ============================================================================

    // Username case-insensitive lookup (for auth and game participants)
    pgm.createIndex('users', ['(LOWER(username))', 'cafe_id'], {
        name: 'idx_users_username_lower_cafe',
    });

    // Cafe-scoped user queries: cafe_id + table_number
    pgm.createIndex('users', ['cafe_id', 'table_number'], {
        name: 'idx_users_cafe_table',
        where: 'cafe_id IS NOT NULL',
    });

    // Points leaderboard: points DESC
    pgm.createIndex('users', ['points'], {
        name: 'idx_users_points_desc',
        order: {
            points: 'DESC',
        },
    });

    // Cafe active users
    pgm.createIndex('users', ['cafe_id'], {
        name: 'idx_users_cafe_active',
        where: 'cafe_id IS NOT NULL',
    });

    // ============================================================================
    // USER_ITEMS TABLE INDEXES
    // ============================================================================

    // User inventory lookup: user_id + is_used
    pgm.createIndex('user_items', ['user_id', 'is_used'], {
        name: 'idx_user_items_user_used',
    });

    // ============================================================================
    // PASSWORD_RESET_TOKENS TABLE INDEXES
    // ============================================================================

    // Token lookup + expiration
    pgm.createIndex('password_reset_tokens', ['token', 'expires_at'], {
        name: 'idx_password_tokens_expires',
    });
};

exports.down = (pgm) => {
    // Drop indexes in reverse order
    pgm.dropIndex('password_reset_tokens', 'idx_password_tokens_expires');
    pgm.dropIndex('user_items', 'idx_user_items_user_used');
    pgm.dropIndex('users', 'idx_users_cafe_active');
    pgm.dropIndex('users', 'idx_users_points_desc');
    pgm.dropIndex('users', 'idx_users_cafe_table');
    pgm.dropIndex('users', 'idx_users_username_lower_cafe');
    pgm.dropIndex('games', 'idx_games_guest_status_created');
    pgm.dropIndex('games', 'idx_games_host_status_created');
    pgm.dropIndex('games', 'idx_games_status_type_created');
    pgm.dropIndex('games', 'idx_games_status_table_created');
    pgm.dropIndex('games', 'idx_games_status_created');
};
