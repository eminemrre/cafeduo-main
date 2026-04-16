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
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    socketService.connect();
    handlers.get('connect')?.();
    handlers.get('connect_error')?.({ message: 'network down' });

    expect(logSpy).toHaveBeenCalledWith('✅ Socket connected:', 'socket-1');
    expect(errorSpy).toHaveBeenCalledWith('❌ Socket connection error:', 'network down');
    expect(warnSpy).not.toHaveBeenCalled();

    logSpy.mockRestore();
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it.each([
    'Authentication required: No token provided',
    'Invalid token',
    'Token expired',
  ])('warns on auth-related connect_error: %s', (message) => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    socketService.connect();
    handlers.get('connect_error')?.({ message });

    expect(errorSpy).toHaveBeenCalledWith('❌ Socket connection error:', message);
    expect(warnSpy).toHaveBeenCalledWith('⚠️ Socket authentication failed - user may need to re-login');

    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('reconnects when the server explicitly disconnects the socket', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    socketService.connect();
    handlers.get('disconnect')?.('io server disconnect');
    handlers.get('disconnect')?.('transport close');

    expect(logSpy).toHaveBeenCalledWith('❌ Socket disconnected:', 'io server disconnect');
    expect(logSpy).toHaveBeenCalledWith('❌ Socket disconnected:', 'transport close');
    expect(mockSocket.connect).toHaveBeenCalledTimes(1);

    logSpy.mockRestore();
  });

  it('emits room and state events', () => {
    socketService.connect();

    socketService.joinGame('42');
    socketService.emitMove('11', { pick: 'rock' });
    socketService.emitGameStateUpdate('11', { hp: 2 });
    socketService.leaveGame('42');

    expect(mockSocket.emit).toHaveBeenCalledWith('join_game', '42');
    expect(mockSocket.emit).toHaveBeenCalledWith('game_move', {
      gameId: '11',
      move: { pick: 'rock' },
    });
    expect(mockSocket.emit).toHaveBeenCalledWith('update_game_state', {
      gameId: '11',
      state: { hp: 2 },
    });
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
