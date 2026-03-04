/**
 * Socket.IO Authentication Middleware Tests
 */

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-testing-only';

// Mock dependencies
jest.mock('../db', () => ({
    pool: {
        query: jest.fn(),
    },
    isDbConnected: jest.fn().mockResolvedValue(true),
}));

jest.mock('../store/memoryState', () => ({
    users: [],
}));

jest.mock('../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
}));

jest.mock('../config/redis', () => null);

const { socketAuthMiddleware } = require('./socketAuth');
const jwt = require('jsonwebtoken');

describe('Socket Auth Middleware', () => {
    let mockSocket;
    let mockNext;
    let mockError;

    const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-testing-only';

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();

        // Create mock socket
        mockSocket = {
            id: 'test-socket-id',
            request: {
                cookies: {},
            },
            handshake: {
                auth: {},
                address: '127.0.0.1',
            },
        };

        mockNext = jest.fn();
        mockError = new Error('Test error');
    });

    describe('Token Validation', () => {
        it('should reject connection when no token is provided', async () => {
            mockSocket.handshake.auth = {};

            await socketAuthMiddleware(mockSocket, mockNext);

            expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
            expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Authentication required: No token provided'
            }));
        });

        it('should reject connection when token is invalid format', async () => {
            mockSocket.handshake.auth.token = 123;

            await socketAuthMiddleware(mockSocket, mockNext);

            expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
            expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Invalid token format'
            }));
        });

        it('should reject connection when token is too long', async () => {
            mockSocket.handshake.auth.token = 'a'.repeat(2049);

            await socketAuthMiddleware(mockSocket, mockNext);

            expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
            expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Invalid token format'
            }));
        });

        it('should reject connection when token is expired', async () => {
            const expiredToken = jwt.sign(
                { id: 1, username: 'testuser' },
                JWT_SECRET,
                { expiresIn: '-1h' }
            );
            mockSocket.handshake.auth.token = expiredToken;

            await socketAuthMiddleware(mockSocket, mockNext);

            expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
            expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Token expired'
            }));
        });

        it('should reject connection when token is invalid', async () => {
            mockSocket.handshake.auth.token = 'invalid.token.here';

            await socketAuthMiddleware(mockSocket, mockNext);

            expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
            expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Invalid token'
            }));
        });
    });

    describe('User Authentication', () => {
        const { pool, isDbConnected } = require('../db');

        it('should authenticate user with valid token', async () => {
            const validToken = jwt.sign(
                { id: 1, username: 'testuser' },
                JWT_SECRET,
                { expiresIn: '1h' }
            );
            mockSocket.handshake.auth.token = validToken;

            const mockUser = {
                id: 1,
                username: 'testuser',
                email: 'test@example.com',
                role: 'user',
                isAdmin: false,
                cafe_id: null,
                points: 100,
                wins: 5,
                gamesPlayed: 10,
                table_number: null,
                department: null,
            };

            pool.query.mockResolvedValue({ rows: [mockUser] });

            await socketAuthMiddleware(mockSocket, mockNext);

            expect(mockNext).toHaveBeenCalledWith();
            expect(mockSocket.user).toEqual(mockUser);
            expect(mockSocket.userId).toBe(1);
            expect(mockSocket.username).toBe('testuser');
            expect(mockSocket.tokenSource).toBe('handshake');
        });

        it('should authenticate using cookie token when provided', async () => {
            const validToken = jwt.sign(
                { id: 2, username: 'cookieuser' },
                JWT_SECRET,
                { expiresIn: '1h' }
            );
            mockSocket.request.cookies.auth_token = validToken;

            const mockUser = {
                id: 2,
                username: 'cookieuser',
                email: 'cookie@example.com',
                role: 'user',
                isAdmin: false,
            };

            pool.query.mockResolvedValue({ rows: [mockUser] });

            await socketAuthMiddleware(mockSocket, mockNext);

            expect(mockNext).toHaveBeenCalledWith();
            expect(mockSocket.userId).toBe(2);
            expect(mockSocket.tokenSource).toBe('cookie');
        });

        it('should prioritize cookie token over handshake token', async () => {
            const cookieToken = jwt.sign(
                { id: 3, username: 'cookie-priority' },
                JWT_SECRET,
                { expiresIn: '1h' }
            );
            const handshakeToken = jwt.sign(
                { id: 99, username: 'handshake-user' },
                JWT_SECRET,
                { expiresIn: '1h' }
            );
            mockSocket.request.cookies.auth_token = cookieToken;
            mockSocket.handshake.auth.token = handshakeToken;

            pool.query.mockResolvedValue({
                rows: [{ id: 3, username: 'cookie-priority', role: 'user', isAdmin: false }],
            });

            await socketAuthMiddleware(mockSocket, mockNext);

            expect(mockSocket.userId).toBe(3);
            expect(mockSocket.tokenSource).toBe('cookie');
            expect(mockNext).toHaveBeenCalledWith();
        });

        it('should reject connection when user not found in database', async () => {
            const validToken = jwt.sign(
                { id: 999, username: 'nonexistent' },
                JWT_SECRET,
                { expiresIn: '1h' }
            );
            mockSocket.handshake.auth.token = validToken;

            pool.query.mockResolvedValue({ rows: [] });

            await socketAuthMiddleware(mockSocket, mockNext);

            expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
            expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
                message: 'User not found'
            }));
        });
    });

    describe('Memory State Fallback', () => {
        const { isDbConnected } = require('../db');
        const memoryState = require('../store/memoryState');

        it('should use memory state when database is not connected', async () => {
            isDbConnected.mockResolvedValue(false);

            const validToken = jwt.sign(
                { id: 1, username: 'testuser' },
                JWT_SECRET,
                { expiresIn: '1h' }
            );
            mockSocket.handshake.auth.token = validToken;

            const mockMemoryUser = {
                id: 1,
                username: 'testuser',
                email: 'test@example.com',
                isAdmin: false,
                points: 100,
            };

            memoryState.users = [mockMemoryUser];

            await socketAuthMiddleware(mockSocket, mockNext);

            expect(mockNext).toHaveBeenCalledWith();
            expect(mockSocket.user).toBeDefined();
            expect(mockSocket.userId).toBe(1);
            expect(mockSocket.username).toBe('testuser');
        });

        it('should reject connection when user not found in memory state', async () => {
            isDbConnected.mockResolvedValue(false);

            const validToken = jwt.sign(
                { id: 999, username: 'nonexistent' },
                JWT_SECRET,
                { expiresIn: '1h' }
            );
            mockSocket.handshake.auth.token = validToken;

            memoryState.users = [];

            await socketAuthMiddleware(mockSocket, mockNext);

            expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
            expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
                message: 'User not found'
            }));
        });
    });
});
