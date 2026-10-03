/**
 * Socket.IO Authentication Middleware
 *
 * This middleware authenticates Socket.IO connections using JWT tokens.
 * It must be applied before io.on('connection') to ensure all socket
 * connections are authenticated.
 *
 * SECURITY: Also checks token blacklist to ensure logged-out users cannot maintain connections.
 *
 * Usage:
 *   io.use(socketAuthMiddleware);
 *   io.on('connection', (socket) => {
 *     // socket.user is available here
 *   });
 */

const jwt = require('jsonwebtoken');
const { pool, isDbConnected } = require('../db');
const memoryState = require('../store/memoryState');
const logger = require('../utils/logger');
const { isTokenRevoked, TokenRevocationUnavailableError } = require('../utils/tokenRevocation');
const { getRequiredJwtSecret } = require('../utils/securityConfig');

const JWT_SECRET = getRequiredJwtSecret();

/**
 * Socket.IO Authentication Middleware
 * 
 * Verifies JWT token from socket handshake and attaches user data to socket
 */
const socketAuthMiddleware = async (socket, next) => {
    try {
        // Try cookie first (new), fallback to handshake auth token (legacy).
        const cookieToken = socket.request?.cookies?.auth_token;
        const handshakeToken = socket.handshake.auth?.token;
        const token = cookieToken || handshakeToken;
        const tokenSource = cookieToken ? 'cookie' : 'handshake';

        if (!token) {
            logger.warn('Socket connection rejected: No token provided', {
                socketId: socket.id,
                ip: socket.handshake.address
            });
            return next(new Error('Authentication required: No token provided'));
        }

        // Validate token format
        if (typeof token !== 'string' || token.length > 2048) {
            logger.warn('Socket connection rejected: Invalid token format', {
                socketId: socket.id
            });
            return next(new Error('Invalid token format'));
        }

        // Verify JWT token
        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (err) {
            if (err.name === 'TokenExpiredError') {
                logger.warn('Socket connection rejected: Token expired', {
                    socketId: socket.id
                });
                return next(new Error('Token expired'));
            }
            if (err.name === 'JsonWebTokenError') {
                logger.warn('Socket connection rejected: Invalid token', {
                    socketId: socket.id
                });
                return next(new Error('Invalid token'));
            }
            throw err;
        }

        const isBlacklisted = await isTokenRevoked(token);

        if (isBlacklisted) {
            logger.warn('Socket connection rejected: Token has been revoked', {
                socketId: socket.id,
                userId: decoded.id
            });
            return next(new Error('Token has been revoked'));
        }

        // Fetch fresh user data from database
        let user;
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
                logger.warn('Socket connection rejected: User not found', {
                    socketId: socket.id,
                    userId: decoded.id
                });
                return next(new Error('User not found'));
            }

            user = result.rows[0];
        } else {
            // Fallback to memory state (development only)
            const memoryUser = Array.isArray(memoryState.users)
                ? memoryState.users.find((u) => Number(u.id) === Number(decoded.id))
                : null;

            if (memoryUser) {
                user = {
                    ...decoded,
                    ...memoryUser,
                    id: Number(memoryUser.id),
                    isAdmin: Boolean(memoryUser.isAdmin ?? memoryUser.is_admin ?? decoded.isAdmin),
                    gamesPlayed: Number(
                        memoryUser.gamesPlayed ?? memoryUser.games_played ?? decoded.gamesPlayed ?? 0
                    ),
                };
            } else {
                logger.warn('Socket connection rejected: User not found in memory state', {
                    socketId: socket.id,
                    userId: decoded.id
                });
                return next(new Error('User not found'));
            }
        }

        // Attach user data to socket for use in event handlers
        socket.user = user;
        socket.userId = user.id;
        socket.username = user.username;
        socket.tokenSource = tokenSource;

        logger.info('Socket authenticated successfully', {
            socketId: socket.id,
            userId: user.id,
            username: user.username,
            ip: socket.handshake.address,
            tokenSource,
        });

        next();
    } catch (err) {
        if (err instanceof TokenRevocationUnavailableError) {
            return next(new Error('Authentication service temporarily unavailable'));
        }
        logger.error('Socket authentication error', {
            socketId: socket.id,
            error: err.message,
            stack: err.stack
        });
        next(new Error('Authentication error'));
    }
};

module.exports = { socketAuthMiddleware };
