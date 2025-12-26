
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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
