import { io } from 'socket.io-client';
import { socketService } from './socket';

jest.mock('socket.io-client', () => ({
  io: jest.fn(),
}));

describe('socketService', () => {
  const handlers = new Map<string, (...args: any[]) => void>();
  const mockSocket = {
    id: 'socket-1',
    on: jest.fn((event: string, handler: (...args: any[]) => void) => {
      handlers.set(event, handler);
    }),
    emit: jest.fn(),
    disconnect: jest.fn(),
    connect: jest.fn(),
  };

  beforeEach(() => {
    socketService.disconnect();
    handlers.clear();
    jest.clearAllMocks();
    (io as jest.Mock).mockReturnValue(mockSocket);
  });

  it('connect initializes socket once and registers core events', () => {
    socketService.connect();
    socketService.connect();

    expect(io).toHaveBeenCalledTimes(1);
    expect(io).toHaveBeenCalledWith(
      window.location.origin,
      expect.objectContaining({
        withCredentials: true,
        reconnectionAttempts: Infinity,
        timeout: 10000,
        transports: ['polling', 'websocket'],
      })
    );
    expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('connect_error', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
  });

  it('getSocket auto-connects when needed', () => {
    const socket = socketService.getSocket();

    expect(io).toHaveBeenCalledTimes(1);
    expect(socket).toBe(mockSocket);
  });

  it('logs connect and generic connect_error events', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    socketService.connect();
    handlers.get('connect')?.();
    handlers.get('connect_error')?.({ message: 'network down' });

    expect(warnSpy).toHaveBeenCalledWith('✅ Socket connected:', 'socket-1');
    expect(errorSpy).toHaveBeenCalledWith('❌ Socket connection error:', 'network down');

    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it.each(['Authentication required: No token provided', 'Invalid token', 'Token expired'])(
    'warns on auth-related connect_error: %s',
    (message) => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      socketService.connect();
      handlers.get('connect_error')?.({ message });

      expect(errorSpy).toHaveBeenCalledWith('❌ Socket connection error:', message);
      expect(warnSpy).toHaveBeenCalledWith(
        '⚠️ Socket authentication failed - user may need to re-login'
      );

      errorSpy.mockRestore();
      warnSpy.mockRestore();
    }
  );

  it('reconnects when the server explicitly disconnects the socket', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    socketService.connect();
    handlers.get('disconnect')?.('io server disconnect');
    handlers.get('disconnect')?.('transport close');

    expect(warnSpy).toHaveBeenCalledWith('❌ Socket disconnected:', 'io server disconnect');
    expect(warnSpy).toHaveBeenCalledWith('❌ Socket disconnected:', 'transport close');
    expect(mockSocket.connect).toHaveBeenCalledTimes(1);

    warnSpy.mockRestore();
  });

  it('emits only room membership events', () => {
    socketService.connect();

    socketService.joinGame('42');
    socketService.leaveGame('42');

    expect(mockSocket.emit).toHaveBeenCalledWith('join_game', '42');
    expect(mockSocket.emit).toHaveBeenCalledWith('leave_game', '42');
  });

  it('disconnect closes active socket and resets instance', () => {
    socketService.connect();
    socketService.disconnect();
    socketService.connect();

    expect(mockSocket.disconnect).toHaveBeenCalledTimes(1);
    expect(io).toHaveBeenCalledTimes(2);
  });
});
