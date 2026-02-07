const jwt = require('jsonwebtoken');
const { pool, isDbConnected } = require('../db');
const memoryState = require('../store/memoryState');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is required. Refusing to start with an insecure fallback secret.');
}

/**
 * Enhanced JWT Authentication Middleware
 */
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const isBearer = typeof authHeader === 'string' && authHeader.startsWith('Bearer ');
        const token = isBearer ? authHeader.slice(7).trim() : null;

        if (!token) {
            return res.status(401).json({
                error: 'Access token required',
                code: 'TOKEN_MISSING'
            });
        }
        if (token.length > 2048) {
            return res.status(401).json({
                error: 'Invalid token format',
                code: 'TOKEN_INVALID_FORMAT'
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
                return res.status(401).json({
                    error: 'User not found',
                    code: 'USER_NOT_FOUND'
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
            return res.status(403).json({
                error: 'Invalid token',
                code: 'TOKEN_INVALID'
            });
        }
        if (err.name === 'TokenExpiredError') {
            return res.status(403).json({
                error: 'Token expired',
                code: 'TOKEN_EXPIRED'
            });
        }

        console.error('Auth middleware error:', err);
        return res.status(500).json({
            error: 'Authentication error',
            code: 'AUTH_ERROR'
        });
    }
};

const requireAdmin = (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Auth required' });
    if (req.user.role !== 'admin' && !req.user.isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

const requireCafeAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            error: 'Authentication required',
            code: 'AUTH_REQUIRED'
        });
    }

    if (req.user.role !== 'cafe_admin' && req.user.role !== 'admin') {
        return res.status(403).json({
            error: 'Cafe admin access required',
            code: 'CAFE_ADMIN_REQUIRED'
        });
    }

    next();
};

const requireOwnership = (paramName = 'id') => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Authentication required',
                code: 'AUTH_REQUIRED'
            });
        }

        const resourceUserId = req.params[paramName] || req.body.userId;

        // Admin can access any resource
        if (req.user.role === 'admin') {
            return next();
        }

        // Check if user owns the resource
        if (parseInt(resourceUserId) !== req.user.id) {
            return res.status(403).json({
                error: 'Access denied to this resource',
                code: 'ACCESS_DENIED'
            });
        }

        next();
    };
};

module.exports = { authenticateToken, requireAdmin, requireCafeAdmin, requireOwnership };
