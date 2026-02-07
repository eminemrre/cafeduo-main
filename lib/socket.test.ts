import { io } from 'socket.io-client';
import { socketService } from './socket';

jest.mock('socket.io-client', () => ({
  io: jest.fn(),
}));

describe('socketService', () => {
  const mockSocket = {
    id: 'socket-1',
    on: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
  };

  beforeEach(() => {
    socketService.disconnect();
    jest.clearAllMocks();
    (io as jest.Mock).mockReturnValue(mockSocket);
  });

  it('connect initializes socket once and registers events', () => {
    socketService.connect();
    socketService.connect();

    expect(io).toHaveBeenCalledTimes(1);
    expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
  });

  it('getSocket auto-connects when needed', () => {
    const socket = socketService.getSocket();

    expect(io).toHaveBeenCalledTimes(1);
    expect(socket).toBe(mockSocket);
  });

  it('joinGame emits join_game event', () => {
    socketService.connect();
    socketService.joinGame('42');

    expect(mockSocket.emit).toHaveBeenCalledWith('join_game', '42');
  });

  it('emitMove sends payload with gameId and move', () => {
    socketService.connect();
    socketService.emitMove('11', { pick: 'rock' });

    expect(mockSocket.emit).toHaveBeenCalledWith('game_move', {
      gameId: '11',
      move: { pick: 'rock' },
    });
  });

  it('disconnect closes active socket and resets instance', () => {
    socketService.connect();
    socketService.disconnect();
    socketService.connect();

    expect(mockSocket.disconnect).toHaveBeenCalledTimes(1);
    expect(io).toHaveBeenCalledTimes(2);
  });
});
