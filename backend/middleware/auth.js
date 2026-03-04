const jwt = require('jsonwebtoken');
const { pool, isDbConnected } = require('../db');
const memoryState = require('../store/memoryState');
const { buildApiErrorPayload } = require('../utils/routeHelpers');
const redisClient = require('../config/redis');

const JWT_SECRET = process.env.JWT_SECRET;

// SECURITY: Configure blacklist fail mode (default: closed = reject on Redis failure)
const BLACKLIST_FAIL_MODE = process.env.BLACKLIST_FAIL_MODE || 'closed';

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
        const cookieToken = req.cookies?.auth_token;
        const authHeader = req.headers['authorization'];
        const isBearer = typeof authHeader === 'string' && authHeader.startsWith('Bearer ');
        const headerToken = isBearer ? authHeader.slice(7).trim() : null;
        const token = cookieToken || headerToken;
        const tokenSource = cookieToken ? 'cookie' : 'header';

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

        // Check token blacklist (Redis-based session invalidation)
        let isBlacklisted = false;
        let blacklistCheckFailed = false;
        
        // First check Redis blacklist
        if (redisClient && redisClient.status === 'ready') {
            try {
                isBlacklisted = await redisClient.get(`blacklist:token:${token}`);
            } catch (redisErr) {
                blacklistCheckFailed = true;
                console.error('Redis blacklist check failed:', redisErr.message);
                
                // SECURITY: Fail-closed behavior - reject request when blacklist check fails
                if (BLACKLIST_FAIL_MODE === 'closed') {
                    return sendAuthError(res, {
                        status: 503,
                        code: 'BLACKLIST_CHECK_FAILED',
                        message: 'Authentication service temporarily unavailable. Please try again.',
                    });
                }
                // If fail-open mode, continue to in-memory fallback
            }
        }
        
        // Fallback to in-memory blacklist if Redis not available or check failed (in fail-open mode)
        if (!isBlacklisted && !blacklistCheckFailed && global.tokenBlacklist) {
            const entry = global.tokenBlacklist.get(token);
            if (entry) {
                const now = Math.floor(Date.now() / 1000);
                // Clean up expired entries
                if (entry < now) {
                    global.tokenBlacklist.delete(token);
                } else {
                    isBlacklisted = true;
                }
            }
        }
        
        if (isBlacklisted) {
            return sendAuthError(res, {
                status: 401,
                code: 'TOKEN_REVOKED',
                message: 'Session has been revoked. Please log in again.',
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

        req.authToken = token;
        req.tokenSource = tokenSource;

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
