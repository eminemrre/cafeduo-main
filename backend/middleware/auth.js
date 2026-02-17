const jwt = require('jsonwebtoken');
const { pool, isDbConnected } = require('../db');
const memoryState = require('../store/memoryState');
const { buildApiErrorPayload } = require('../utils/routeHelpers');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is required. Refusing to start with an insecure fallback secret.');
}

const sendAuthError = (res, { status, code, message, details = null }) => {
    const payload = buildApiErrorPayload(res, {
        code,
        message,
        details,
        status,
    });
    return res.status(status).json(payload);
};

/**
 * Enhanced JWT Authentication Middleware
 */
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const isBearer = typeof authHeader === 'string' && authHeader.startsWith('Bearer ');
        const token = isBearer ? authHeader.slice(7).trim() : null;

        if (!token) {
            return sendAuthError(res, {
                status: 401,
                code: 'TOKEN_MISSING',
                message: 'Access token required',
            });
        }
        if (token.length > 2048) {
            return sendAuthError(res, {
                status: 401,
                code: 'TOKEN_INVALID_FORMAT',
                message: 'Invalid token format',
            });
        }

        // Verify token
        const decoded = jwt.verify(token, JWT_SECRET);

        // Fetch fresh user data from database
        if (await isDbConnected()) {
            const result = await pool.query(
                `SELECT id, username, email, role, is_admin as "isAdmin", 
                cafe_id, points, wins, games_played as "gamesPlayed",
                table_number, department
         FROM users 
         WHERE id = $1`,
                [decoded.id]
            );

            if (result.rows.length === 0) {
                return sendAuthError(res, {
                    status: 401,
                    code: 'USER_NOT_FOUND',
                    message: 'User not found',
                });
            }

            req.user = result.rows[0];
        } else {
            const memoryUser = Array.isArray(memoryState.users)
                ? memoryState.users.find((user) => Number(user.id) === Number(decoded.id))
                : null;

            if (memoryUser) {
                req.user = {
                    ...decoded,
                    ...memoryUser,
                    id: Number(memoryUser.id),
                    isAdmin: Boolean(memoryUser.isAdmin ?? memoryUser.is_admin ?? decoded.isAdmin),
                    gamesPlayed: Number(
                        memoryUser.gamesPlayed ?? memoryUser.games_played ?? decoded.gamesPlayed ?? 0
                    ),
                };
            } else {
                req.user = decoded;
            }
        }

        next();
    } catch (err) {
        if (err.name === 'JsonWebTokenError') {
            return sendAuthError(res, {
                status: 403,
                code: 'TOKEN_INVALID',
                message: 'Invalid token',
            });
        }
        if (err.name === 'TokenExpiredError') {
            return sendAuthError(res, {
                status: 403,
                code: 'TOKEN_EXPIRED',
                message: 'Token expired',
            });
        }

        console.error('Auth middleware error:', err);
        return sendAuthError(res, {
            status: 500,
            code: 'AUTH_ERROR',
            message: 'Authentication error',
        });
    }
};

const requireAdmin = (req, res, next) => {
    if (!req.user) {
        return sendAuthError(res, {
            status: 401,
            code: 'AUTH_REQUIRED',
            message: 'Auth required',
        });
    }
    if (req.user.role !== 'admin' && !req.user.isAdmin) {
        return sendAuthError(res, {
            status: 403,
            code: 'ADMIN_REQUIRED',
            message: 'Admin access required',
        });
    }
    next();
};

const requireCafeAdmin = (req, res, next) => {
    if (!req.user) {
        return sendAuthError(res, {
            status: 401,
            code: 'AUTH_REQUIRED',
            message: 'Authentication required',
        });
    }

    if (req.user.role !== 'cafe_admin' && req.user.role !== 'admin') {
        return sendAuthError(res, {
            status: 403,
            code: 'CAFE_ADMIN_REQUIRED',
            message: 'Cafe admin access required',
        });
    }

    next();
};

const requireOwnership = (paramName = 'id') => {
    return (req, res, next) => {
        if (!req.user) {
            return sendAuthError(res, {
                status: 401,
                code: 'AUTH_REQUIRED',
                message: 'Authentication required',
            });
        }

        const resourceUserId = req.params[paramName] || req.body.userId;

        // Admin can access any resource
        if (req.user.role === 'admin') {
            return next();
        }

        // Check if user owns the resource
        if (parseInt(resourceUserId) !== req.user.id) {
            return sendAuthError(res, {
                status: 403,
                code: 'ACCESS_DENIED',
                message: 'Access denied to this resource',
            });
        }

        next();
    };
};

module.exports = { authenticateToken, requireAdmin, requireCafeAdmin, requireOwnership };
