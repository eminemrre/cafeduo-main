
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

    connect() {
        if (this.socket) return;

        this.socket = io(SOCKET_URL, {
            withCredentials: true,
            autoConnect: true,
            reconnection: true,
        });

        this.socket.on('connect', () => {
            console.log('✅ Socket connected:', this.socket?.id);
        });

        this.socket.on('disconnect', () => {
            console.log('❌ Socket disconnected');
        });
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    getSocket() {
        if (!this.socket) {
            this.connect();
        }
        return this.socket;
    }

    joinGame(gameId: string) {
        this.socket?.emit('join_game', gameId);
    }

    emitMove(gameId: string, move: any) {
        this.socket?.emit('game_move', { gameId, move });
    }
}

export const socketService = new SocketService();
