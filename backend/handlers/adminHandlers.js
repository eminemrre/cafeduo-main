const {
  normalizeAdminCreateUserPayload,
  normalizeRoleUpdatePayload,
  normalizePointsUpdatePayload,
} = require('../utils/adminValidation');
const { executeDataMode, sendApiError, sendApiProblem } = require('../utils/routeHelpers');

const createAdminHandlers = ({
  pool,
  isDbConnected,
  bcrypt,
  logger,
  normalizeCafeCreatePayload,
  normalizeCafeUpdatePayload,
  getMemoryUsers,
  setMemoryUsers,
  clearCacheByPattern = async () => {},
}) => {
  const getUsers = async (req, res) =>
    executeDataMode(isDbConnected, {
      db: async () => {
        try {
          const result = await pool.query(`
            SELECT 
              u.id, u.username, u.email, u.points, u.wins, u.games_played as "gamesPlayed",
              u.department, u.role, u.is_admin as "isAdmin", u.cafe_id, u.table_number,
              c.name as cafe_name
            FROM users u
            LEFT JOIN cafes c ON u.cafe_id = c.id
            ORDER BY u.created_at DESC
          `);
          return res.json(result.rows);
        } catch (err) {
          return sendApiError(res, logger, 'Error fetching users', err, 'Kullanıcılar yüklenemedi.');
        }
      },
      memory: async () => res.json(getMemoryUsers()),
    });

  const createUser = async (req, res) => {
    const validation = normalizeAdminCreateUserPayload(req.body);
    if (!validation.ok) {
      return sendApiProblem(res, {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: validation.error,
      });
    }

    const payload = validation.value;

    return executeDataMode(isDbConnected, {
      db: async () => {
        try {
          const existingUser = await pool.query('SELECT id FROM users WHERE LOWER(email) = $1', [payload.email]);
          if (existingUser.rows.length > 0) {
            return sendApiProblem(res, {
              status: 409,
              code: 'EMAIL_ALREADY_REGISTERED',
              message: 'Bu e-posta zaten kayıtlı.',
            });
          }

          const hashedPassword = await bcrypt.hash(payload.password, 10);
          const result = await pool.query(
            `INSERT INTO users (
              username, email, password_hash, points, wins, games_played, department, role, is_admin, cafe_id
            ) VALUES ($1, $2, $3, $4, 0, 0, $5, $6, $7, $8)
            RETURNING
              id, username, email, points, wins, games_played as "gamesPlayed",
              department, role, is_admin as "isAdmin", cafe_id`,
            [
              payload.username,
              payload.email,
              hashedPassword,
              payload.points,
              payload.department,
              payload.role,
              payload.role === 'admin',
              payload.role === 'cafe_admin' ? payload.cafeId : null,
            ]
          );

          return res.status(201).json(result.rows[0]);
        } catch (err) {
          return sendApiError(res, logger, 'Admin create user error', err, 'Kullanıcı oluşturulamadı.');
        }
      },
      memory: async () => {
        const users = getMemoryUsers();
        const nextId = (users.reduce((max, user) => Math.max(max, Number(user.id) || 0), 0) || 0) + 1;
        const createdUser = {
          id: nextId,
          username: payload.username,
          email: payload.email,
          points: payload.points,
          wins: 0,
          gamesPlayed: 0,
          department: payload.department,
          role: payload.role,
          isAdmin: payload.role === 'admin',
          cafe_id: payload.role === 'cafe_admin' ? payload.cafeId : null,
        };
        setMemoryUsers([createdUser, ...users]);
        return res.status(201).json(createdUser);
      },
    });
  };

  const getGames = async (req, res) =>
    executeDataMode(isDbConnected, {
      db: async () => {
        try {
          const result = await pool.query(`
            SELECT 
              g.id, g.host_name, g.guest_name, g.game_type, g.table_code, g.status,
              g.created_at, c.name as cafe_name
            FROM games g
            LEFT JOIN users u ON g.host_name = u.username
            LEFT JOIN cafes c ON u.cafe_id = c.id
            ORDER BY g.created_at DESC
            LIMIT 100
          `);
          return res.json(result.rows);
        } catch (err) {
          return sendApiError(res, logger, 'Error fetching games', err, 'Oyunlar yüklenemedi.');
        }
      },
      memory: async () => res.json([]),
    });

  const updateUserRole = async (req, res) => {
    const { id } = req.params;
    const validation = normalizeRoleUpdatePayload(req.body);
    if (!validation.ok) {
      return sendApiProblem(res, {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: validation.error,
      });
    }
    const payload = validation.value;

    return executeDataMode(isDbConnected, {
      db: async () => {
        try {
          let result;

          if (payload.role === 'cafe_admin') {
            result = await pool.query(
              'UPDATE users SET role = $1, is_admin = false, cafe_id = $2 WHERE id = $3 RETURNING id, username, email, role, is_admin, cafe_id, points, wins, games_played, department',
              [payload.role, payload.cafeId, id]
            );
          } else {
            result = await pool.query(
              'UPDATE users SET role = $1, is_admin = $2, cafe_id = NULL WHERE id = $3 RETURNING id, username, email, role, is_admin, cafe_id, points, wins, games_played, department',
              [payload.role, payload.role === 'admin', id]
            );
          }

          if (result.rows.length === 0) {
            return sendApiProblem(res, {
              status: 404,
              code: 'USER_NOT_FOUND',
              message: 'Kullanıcı bulunamadı.',
            });
          }

          return res.json({ success: true, user: result.rows[0] });
        } catch (err) {
          return sendApiError(res, logger, 'Role update error', err, 'Rol güncellenemedi.');
        }
      },
      memory: async () => {
        const users = getMemoryUsers();
        const userIndex = users.findIndex((user) => Number(user.id) === Number(id));
        if (userIndex === -1) {
          return sendApiProblem(res, {
            status: 404,
            code: 'USER_NOT_FOUND',
            message: 'Kullanıcı bulunamadı.',
          });
        }

        const nextUsers = [...users];
        nextUsers[userIndex] = {
          ...nextUsers[userIndex],
          role: payload.role,
          isAdmin: payload.role === 'admin',
          cafe_id: payload.role === 'cafe_admin' ? payload.cafeId : null,
        };
        setMemoryUsers(nextUsers);
        return res.json({ success: true, user: nextUsers[userIndex] });
      },
    });
  };

  const updateUserPoints = async (req, res) => {
    const { id } = req.params;
    const validation = normalizePointsUpdatePayload(req.body);
    if (!validation.ok) {
      return sendApiProblem(res, {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: validation.error,
      });
    }
    const points = validation.value;

    return executeDataMode(isDbConnected, {
      db: async () => {
        try {
          const result = await pool.query(
            `UPDATE users
             SET points = $1
             WHERE id = $2
             RETURNING
               id, username, email, points, wins, games_played as "gamesPlayed",
               department, role, is_admin as "isAdmin", cafe_id`,
            [points, id]
          );

          if (result.rows.length === 0) {
            return sendApiProblem(res, {
              status: 404,
              code: 'USER_NOT_FOUND',
              message: 'Kullanıcı bulunamadı.',
            });
          }

          return res.json(result.rows[0]);
        } catch (err) {
          return sendApiError(res, logger, 'Admin update points error', err, 'Puan güncellenemedi.');
        }
      },
      memory: async () => {
        const users = getMemoryUsers();
        const userIndex = users.findIndex((user) => Number(user.id) === Number(id));
        if (userIndex === -1) {
          return sendApiProblem(res, {
            status: 404,
            code: 'USER_NOT_FOUND',
            message: 'Kullanıcı bulunamadı.',
          });
        }

        const nextUsers = [...users];
        nextUsers[userIndex] = { ...nextUsers[userIndex], points };
        setMemoryUsers(nextUsers);
        return res.json(nextUsers[userIndex]);
      },
    });
  };

  const updateCafe = async (req, res) => {
    const { id } = req.params;
    const validation = normalizeCafeUpdatePayload(req.body);
    if (!validation.ok) {
      return sendApiProblem(res, {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: validation.error,
      });
    }
    const updatesPayload = validation.value;

    return executeDataMode(isDbConnected, {
      db: async () => {
        try {
          const updates = [];
          const values = [];
          let paramCount = 1;

          if (updatesPayload.address !== undefined) {
            updates.push(`address = $${paramCount++}`);
            values.push(updatesPayload.address);
          }
          if (updatesPayload.totalTables !== undefined) {
            updates.push(`total_tables = $${paramCount++}`);
            values.push(updatesPayload.totalTables);
            updates.push(`table_count = $${paramCount++}`);
            values.push(updatesPayload.tableCount);
          }
          if (updatesPayload.pin !== undefined) {
            updates.push(`pin = $${paramCount++}`);
            values.push(updatesPayload.pin);
          }
          if (updatesPayload.latitude !== undefined) {
            updates.push(`latitude = $${paramCount++}`);
            values.push(updatesPayload.latitude);
          }
          if (updatesPayload.longitude !== undefined) {
            updates.push(`longitude = $${paramCount++}`);
            values.push(updatesPayload.longitude);
          }
          if (updatesPayload.radius !== undefined) {
            updates.push(`radius = $${paramCount++}`);
            values.push(updatesPayload.radius);
          }
          if (updatesPayload.secondaryLatitude !== undefined) {
            updates.push(`secondary_latitude = $${paramCount++}`);
            values.push(updatesPayload.secondaryLatitude);
          }
          if (updatesPayload.secondaryLongitude !== undefined) {
            updates.push(`secondary_longitude = $${paramCount++}`);
            values.push(updatesPayload.secondaryLongitude);
          }
          if (updatesPayload.secondaryRadius !== undefined) {
            updates.push(`secondary_radius = $${paramCount++}`);
            values.push(updatesPayload.secondaryRadius);
          }

          values.push(id);
          const query = `UPDATE cafes SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING id, name, address, total_tables, pin, latitude, longitude, table_count, radius, secondary_latitude, secondary_longitude, secondary_radius`;
          const result = await pool.query(query, values);

          if (result.rows.length === 0) {
            return sendApiProblem(res, {
              status: 404,
              code: 'CAFE_NOT_FOUND',
              message: 'Kafe bulunamadı.',
            });
          }

          return res.json({ success: true, cafe: result.rows[0] });
        } catch (err) {
          return sendApiError(res, logger, 'Cafe update error', err, 'Kafe güncellenemedi.');
        }
      },
      memory: async () =>
        sendApiProblem(res, {
          status: 501,
          code: 'NOT_IMPLEMENTED',
          message: 'Demo modda kafe güncellenemez.',
        }),
    });
  };

  const createCafe = async (req, res) => {
    const validation = normalizeCafeCreatePayload(req.body);
    if (!validation.ok) {
      return sendApiProblem(res, {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: validation.error,
      });
    }
    const cafe = validation.value;

    return executeDataMode(isDbConnected, {
      db: async () => {
        try {
          const result = await pool.query(
            `INSERT INTO cafes (
              name,
              address,
              total_tables,
              pin,
              latitude,
              longitude,
              table_count,
              radius,
              secondary_latitude,
              secondary_longitude,
              secondary_radius
            )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING id, name, address, total_tables, pin, latitude, longitude, table_count, radius, secondary_latitude, secondary_longitude, secondary_radius`,
            [
              cafe.name,
              cafe.address,
              cafe.totalTables,
              cafe.pin,
              cafe.latitude,
              cafe.longitude,
              cafe.tableCount,
              cafe.radius,
              cafe.secondaryLatitude,
              cafe.secondaryLongitude,
              cafe.secondaryRadius,
            ]
          );

          return res.status(201).json({ success: true, cafe: result.rows[0] });
        } catch (err) {
          if (err && err.code === '23505') {
            return sendApiProblem(res, {
              status: 409,
              code: 'CAFE_ALREADY_EXISTS',
              message: 'Bu isimde bir kafe zaten mevcut.',
            });
          }
          return sendApiError(res, logger, 'Cafe creation error', err, 'Kafe oluşturulamadı.');
        }
      },
      memory: async () =>
        res.status(201).json({
          success: true,
          cafe: {
            id: Date.now(),
            name: cafe.name,
            address: cafe.address,
            total_tables: cafe.totalTables,
            pin: cafe.pin,
            latitude: cafe.latitude,
            longitude: cafe.longitude,
            table_count: cafe.tableCount,
            radius: cafe.radius,
            secondary_latitude: cafe.secondaryLatitude,
            secondary_longitude: cafe.secondaryLongitude,
            secondary_radius: cafe.secondaryRadius,
          },
        }),
    });
  };

  const createCafeAdmin = async (req, res) => {
    const { username, email, password, cafeId } = req.body || {};
    if (!username || !email || !password || !cafeId) {
      return sendApiProblem(res, {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Kullanıcı adı, e-posta, şifre ve kafe seçimi zorunludur.',
      });
    }

    return executeDataMode(isDbConnected, {
      db: async () => {
        try {
          const hashedPassword = await bcrypt.hash(String(password), 10);
          const result = await pool.query(
            `INSERT INTO users (username, email, password_hash, role, cafe_id) 
             VALUES ($1, $2, $3, 'cafe_admin', $4) 
             RETURNING id, username, email, role, cafe_id`,
            [String(username).trim(), String(email).trim().toLowerCase(), hashedPassword, Number(cafeId)]
          );
          return res.json(result.rows[0]);
        } catch (err) {
          return sendApiError(res, logger, 'Admin create cafe admin error', err, 'Database error');
        }
      },
      memory: async () =>
        sendApiProblem(res, {
          status: 501,
          code: 'NOT_IMPLEMENTED',
          message: 'Not implemented in memory mode',
        }),
    });
  };

  const deleteCafe = async (req, res) => {
    const cafeId = Number(req.params?.id);
    if (!Number.isInteger(cafeId) || cafeId <= 0) {
      return sendApiProblem(res, {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Geçersiz kafe kimliği.',
      });
    }

    return executeDataMode(isDbConnected, {
      db: async () => {
        const client = await pool.connect();
        let committed = false;
        try {
          await client.query('BEGIN');

          const cafeResult = await client.query(
            'SELECT id, name FROM cafes WHERE id = $1 FOR UPDATE',
            [cafeId]
          );
          if (cafeResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return sendApiProblem(res, {
              status: 404,
              code: 'CAFE_NOT_FOUND',
              message: 'Kafe bulunamadı.',
            });
          }

          const cafeCountResult = await client.query('SELECT COUNT(*)::int AS count FROM cafes');
          const totalCafes = Number(cafeCountResult.rows[0]?.count || 0);
          if (totalCafes <= 1) {
            await client.query('ROLLBACK');
            return sendApiProblem(res, {
              status: 400,
              code: 'LAST_CAFE_DELETION_FORBIDDEN',
              message: 'Sistemde en az bir kafe kalmalıdır.',
            });
          }

          const usersResult = await client.query(
            'SELECT id, username, role FROM users WHERE cafe_id = $1',
            [cafeId]
          );
          const users = usersResult.rows || [];
          const usernames = [...new Set(
            users
              .map((user) => String(user.username || '').trim())
              .filter(Boolean)
          )];

          const cafeAdminsDemoted = users.filter((user) => user.role === 'cafe_admin').length;

          const detachedUsersResult = await client.query(
            `
              UPDATE users
              SET
                cafe_id = NULL,
                table_number = NULL,
                role = CASE WHEN role = 'cafe_admin' THEN 'user' ELSE role END,
                is_admin = CASE WHEN role = 'cafe_admin' THEN FALSE ELSE is_admin END
              WHERE cafe_id = $1
            `,
            [cafeId]
          );

          const rewardsDeletedResult = await client.query(
            'DELETE FROM rewards WHERE cafe_id = $1',
            [cafeId]
          );

          let gamesForceClosed = 0;
          if (usernames.length > 0) {
            const forcedGameState = JSON.stringify({
              forceClosed: true,
              forceCloseReason: 'cafe_deleted',
              forceClosedAt: new Date().toISOString(),
            });
            const gamesResult = await client.query(
              `
                UPDATE games
                SET
                  status = 'finished',
                  game_state = COALESCE(game_state, '{}'::jsonb) || $2::jsonb
                WHERE status IN ('waiting', 'active')
                  AND (host_name = ANY($1::text[]) OR guest_name = ANY($1::text[]))
              `,
              [usernames, forcedGameState]
            );
            gamesForceClosed = gamesResult.rowCount || 0;
          }

          const deleteCafeResult = await client.query(
            'DELETE FROM cafes WHERE id = $1 RETURNING id, name',
            [cafeId]
          );
          if (deleteCafeResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return sendApiProblem(res, {
              status: 404,
              code: 'CAFE_NOT_FOUND',
              message: 'Kafe bulunamadı.',
            });
          }

          await client.query('COMMIT');
          committed = true;

          try {
            await clearCacheByPattern('cache:/api/cafes*');
          } catch (cacheErr) {
            logger.warn('Cafe cache cleanup failed after delete', cacheErr);
          }

          return res.json({
            success: true,
            deletedCafe: deleteCafeResult.rows[0],
            cleanup: {
              detachedUsers: detachedUsersResult.rowCount || 0,
              cafeAdminsDemoted,
              rewardsDeleted: rewardsDeletedResult.rowCount || 0,
              gamesForceClosed,
            },
          });
        } catch (err) {
          if (!committed) {
            try {
              await client.query('ROLLBACK');
            } catch (rollbackErr) {
              logger.error('Cafe delete rollback error:', rollbackErr);
            }
          }
          return sendApiError(res, logger, 'Cafe delete error', err, 'Kafe silinemedi.');
        } finally {
          client.release();
        }
      },
      memory: async () =>
        sendApiProblem(res, {
          status: 501,
          code: 'NOT_IMPLEMENTED',
          message: 'Demo modda kafe silme desteklenmiyor.',
        }),
    });
  };

  const deleteUser = async (req, res) => {
    const { id } = req.params;
    if (Number(id) === Number(req.user.id)) {
      return sendApiProblem(res, {
        status: 400,
        code: 'SELF_DELETE_FORBIDDEN',
        message: 'Kendi hesabınızı silemezsiniz.',
      });
    }

    return executeDataMode(isDbConnected, {
      db: async () => {
        try {
          const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
          if (result.rows.length === 0) {
            return sendApiProblem(res, {
              status: 404,
              code: 'USER_NOT_FOUND',
              message: 'Kullanıcı bulunamadı.',
            });
          }
          return res.json({ success: true });
        } catch (err) {
          return sendApiError(res, logger, 'Admin delete user error', err, 'Kullanıcı silinemedi.');
        }
      },
      memory: async () => {
        const users = getMemoryUsers();
        const nextUsers = users.filter((user) => Number(user.id) !== Number(id));
        if (nextUsers.length === users.length) {
          return sendApiProblem(res, {
            status: 404,
            code: 'USER_NOT_FOUND',
            message: 'Kullanıcı bulunamadı.',
          });
        }
        setMemoryUsers(nextUsers);
        return res.json({ success: true });
      },
    });
  };

  return {
    getUsers,
    createUser,
    getGames,
    updateUserRole,
    updateUserPoints,
    updateCafe,
    createCafe,
    deleteCafe,
    createCafeAdmin,
    deleteUser,
  };
};

module.exports = {
  createAdminHandlers,
};
