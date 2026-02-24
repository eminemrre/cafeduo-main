
import { io, Socket } from 'socket.io-client';

const withProtocol = (url: string): string => {
    if (url.startsWith('/') || /^https?:\/\//i.test(url)) return url;
    const isLocal = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(url);
    return `${isLocal ? 'http' : 'https'}://${url}`;
};

const enforceBrowserHttps = (url: string): string => {
    if (typeof window === 'undefined') return url;
    if (window.location.protocol !== 'https:') return url;
    if (!url.startsWith('http://')) return url;
    if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(url)) return url;
    return url.replace(/^http:\/\//i, 'https://');
};

export const normalizeBaseUrl = (url: string): string =>
    enforceBrowserHttps(withProtocol(url.trim())).replace(/\/+$/, '').replace(/\/api$/, '');

const resolveSocketUrl = () => {
    try {
        const envValues = new Function(
            'return {' +
            'socketUrl: import.meta.env?.VITE_SOCKET_URL,' +
            'apiBaseUrl: import.meta.env?.VITE_API_BASE_URL,' +
            'apiUrl: import.meta.env?.VITE_API_URL' +
            '}'
        )();

        if (envValues.socketUrl) return normalizeBaseUrl(String(envValues.socketUrl));
        if (envValues.apiBaseUrl) return normalizeBaseUrl(String(envValues.apiBaseUrl));
        if (envValues.apiUrl) return normalizeBaseUrl(String(envValues.apiUrl));
    } catch {
        // ignore and continue with fallback resolution
    }

    if (typeof window !== 'undefined' && window.location) {
        if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
            return window.location.origin;
        }
    }

    return 'http://localhost:3001';
};

const SOCKET_URL = resolveSocketUrl();

class SocketService {
    private socket: Socket | null = null;

    /**
     * Get JWT token from localStorage
     */
    private getToken(): string | undefined {
        try {
            const token = localStorage.getItem('token');
            return token || undefined;
        } catch {
            return undefined;
        }
    }

    /**
     * Establish socket connection with authentication
     */
    connect() {
        if (this.socket) return;

        this.socket = io(SOCKET_URL, {
            withCredentials: true,
            autoConnect: true,
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 5,
            auth: {
                token: this.getToken(),
            },
        });

        this.socket.on('connect', () => {
            console.log('✅ Socket connected:', this.socket?.id);
        });

        this.socket.on('connect_error', (error) => {
            console.error('❌ Socket connection error:', error.message);
            // If authentication failed, token might be invalid or expired
            if (error.message === 'Authentication required: No token provided' ||
                error.message === 'Invalid token' ||
                error.message === 'Token expired') {
                console.warn('⚠️ Socket authentication failed - user may need to re-login');
            }
        });

        this.socket.on('disconnect', (reason) => {
            console.log('❌ Socket disconnected:', reason);
            // If server disconnected, try to reconnect with fresh token
            if (reason === 'io server disconnect') {
                // Reconnect with fresh token
                this.socket?.connect();
            }
        });

        // Update auth token before each reconnection attempt
        this.socket.io?.on('reconnect_attempt', () => {
            const freshToken = this.getToken();
            if (freshToken && this.socket) {
                this.socket.auth = { token: freshToken };
                console.log('🔄 Reconnecting with fresh token...');
            }
        });
    }

    /**
     * Disconnect and cleanup socket
     */
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    /**
     * Update authentication token and reconnect if needed
     * Call this after login/logout to update socket auth
     */
    updateToken(token: string | null) {
        if (token) {
            try {
                localStorage.setItem('token', token);
            } catch {
                console.error('Failed to save token to localStorage');
            }
        } else {
            try {
                localStorage.removeItem('token');
            } catch {
                console.error('Failed to remove token from localStorage');
            }
        }

        // If socket is connected, disconnect and reconnect with new token
        if (this.socket) {
            this.disconnect();
            if (token) {
                this.connect();
            }
        }
    }

    /**
     * Get socket instance, creating if needed
     */
    getSocket() {
        if (!this.socket) {
            this.connect();
        }
        return this.socket;
    }

    /**
     * Join a game room
     */
    joinGame(gameId: string) {
        this.socket?.emit('join_game', gameId);
    }

    /**
     * Emit a game move
     */
    emitMove(gameId: string, move: unknown) {
        this.socket?.emit('game_move', { gameId, move });
    }

    /**
     * Emit game state update
     */
    emitGameStateUpdate(gameId: string, state: unknown) {
        this.socket?.emit('update_game_state', { gameId, state });
    }

    /**
     * Leave a game room
     */
    leaveGame(gameId: string) {
        this.socket?.emit('leave_game', gameId);
    }
}

export const socketService = new SocketService();
