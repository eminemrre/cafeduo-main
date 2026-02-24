# Database Migrations

CafeDuo uses [node-pg-migrate](https://salsita.github.io/node-pg-migrate/) for database schema management.

## Quick Start

```bash
# Check migration status
npm run migrate:status

# Run all pending migrations
npm run migrate:up

# Rollback last migration
npm run migrate:down

# Rollback and re-run last migration
npm run migrate:redo

# Create a new migration
npm run migrate:create my_migration_name
```

## Configuration

Migration system is configured via `DATABASE_URL` environment variable or individual DB connection variables:

```bash
# Option 1: Connection string
DATABASE_URL=postgres://user:password@localhost:5432/cafeduo

# Option 2: Individual variables
DB_HOST=localhost
DB_PORT=5432
DB_NAME=cafeduo
DB_USER=postgres
DB_PASSWORD=password
DB_SSL=false
```

## Migration Files

Migrations are stored in `migrations/` directory with the naming pattern:
```
YYYYMMDDHHmmss_migration_name.js
```

Each migration file exports two functions:
- `exports.up(pgm)` - Applied when running migrations forward
- `exports.down(pgm)` - Applied when rolling back migrations

## Best Practices

### 1. **Always Test Rollback**
```bash
npm run migrate:up
npm run migrate:down
npm run migrate:up
```

### 2. **Use Transactions** (default: single-transaction per migration)
```javascript
exports.up = (pgm) => {
    pgm.createTable('my_table', { /* ... */ });
    pgm.addColumn('users', 'new_field', { /* ... */ });
};
```

### 3. **Handle Data Migrations Carefully**
```javascript
exports.up = async (pgm) => {
    // Add column with default
    pgm.addColumn('users', 'status', {
        type: 'VARCHAR(20)',
        notNull: true,
        default: 'active',
    });
    
    // Backfill data if needed
    await pgm.db.query(`
        UPDATE users 
        SET status = 'inactive' 
        WHERE last_login < NOW() - INTERVAL '1 year'
    `);
};
```

### 4. **Create Indexes Concurrently in Production**
```javascript
exports.up = (pgm) => {
    pgm.createIndex('users', 'email', {
        name: 'idx_users_email',
        unique: true,
        // Use CONCURRENTLY for production (requires separate transaction)
    });
};
```

### 5. **Avoid Breaking Changes**
- Don't drop columns that are still in use
- Add new columns as nullable or with defaults
- Use multi-step migrations for breaking changes:
  1. Add new column
  2. Backfill data
  3. Deploy code that uses new column
  4. Drop old column in next migration

## Production Deployment

### Pre-Deployment Checklist
- [ ] Test migrations locally
- [ ] Test rollback locally
- [ ] Review migration for breaking changes
- [ ] Backup database before running migrations
- [ ] Plan downtime if needed

### Running Migrations in Production

**Docker Compose:**
```bash
docker-compose exec api npm run migrate:up
```

**Direct Connection:**
```bash
DATABASE_URL=<production-url> npm run migrate:up
```

### Emergency Rollback
```bash
# Rollback last migration
DATABASE_URL=<production-url> npm run migrate:down

# Check status
DATABASE_URL=<production-url> npm run migrate:status
```

## Common Scenarios

### Adding a New Table
```bash
npm run migrate:create add_notifications_table
```

```javascript
exports.up = (pgm) => {
    pgm.createTable('notifications', {
        id: { type: 'SERIAL', primaryKey: true },
        user_id: { 
            type: 'INTEGER', 
            notNull: true,
            references: 'users(id)',
            onDelete: 'CASCADE',
        },
        message: { type: 'TEXT', notNull: true },
        read: { type: 'BOOLEAN', default: false },
        created_at: { 
            type: 'TIMESTAMP WITH TIME ZONE',
            default: pgm.func('CURRENT_TIMESTAMP'),
        },
    });
    
    pgm.createIndex('notifications', ['user_id', 'read']);
};

exports.down = (pgm) => {
    pgm.dropTable('notifications');
};
```

### Adding a Column
```bash
npm run migrate:create add_user_avatar_url
```

```javascript
exports.up = (pgm) => {
    pgm.addColumn('users', {
        avatar_url: { 
            type: 'TEXT',
            // Nullable to avoid blocking on existing rows
        },
    });
};

exports.down = (pgm) => {
    pgm.dropColumn('users', 'avatar_url');
};
```

### Creating an Index
```bash
npm run migrate:create add_games_winner_index
```

```javascript
exports.up = (pgm) => {
    pgm.createIndex('games', 'winner', {
        name: 'idx_games_winner',
        where: 'winner IS NOT NULL',
    });
};

exports.down = (pgm) => {
    pgm.dropIndex('games', 'winner', {
        name: 'idx_games_winner',
    });
};
```

### Renaming a Column
```bash
npm run migrate:create rename_user_department
```

```javascript
exports.up = (pgm) => {
    pgm.renameColumn('users', 'department', 'major');
};

exports.down = (pgm) => {
    pgm.renameColumn('users', 'major', 'department');
};
```

## Troubleshooting

### "Migration table does not exist"
Run migrations to create the table:
```bash
npm run migrate:up
```

### "Database connection failed"
Check your `DATABASE_URL` or connection variables:
```bash
echo $DATABASE_URL
```

### "Migration has already been run"
Check status and manually edit `pgmigrations` table if needed:
```bash
npm run migrate:status
```

### "Cannot run migration in transaction"
Some operations (like CREATE INDEX CONCURRENTLY) cannot run in transactions. Update migration:
```javascript
exports.shorthands = undefined;
exports.up = (pgm) => {
    pgm.noTransaction();
    // Your migration code
};
```

## Migration History

| Migration | Description | Date |
|-----------|-------------|------|
| 20240224000001 | Initial schema (cafes, users, games, user_items, password_reset_tokens) | 2024-02-24 |
| 20240224000002 | Performance indexes (lobby, active games, leaderboard, cafe queries) | 2024-02-24 |

## References

- [node-pg-migrate Documentation](https://salsita.github.io/node-pg-migrate/)
- [PostgreSQL ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html)
- [CafeDuo ADR-002: PostgreSQL](../docs/adr/ADR-002-postgresql.md)
