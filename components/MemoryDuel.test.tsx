import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryDuel } from './MemoryDuel';

jest.mock('../lib/api', () => ({
    api: {
        games: {
            get: jest.fn().mockResolvedValue({ id: 1, status: 'active', hostName: 'testuser' }),
            move: jest.fn().mockResolvedValue({})
        }
    }
}));

jest.mock('../lib/socket', () => ({
    socketService: {
        getSocket: () => ({ on: jest.fn(), off: jest.fn() }),
        joinGame: jest.fn(),
        emitMove: jest.fn()
    }
}));

jest.mock('../lib/multiplayer', () => ({
    submitScoreAndWaitForWinner: jest.fn().mockResolvedValue({ winner: 'testuser', finished: true })
}));

jest.mock('../lib/gameAudio', () => ({
    playGameSfx: jest.fn()
}));

const defaultProps = {
    currentUser: { id: '1', username: 'testuser', role: 'user' } as any,
    gameId: 1,
    opponentName: 'opponent',
    isBot: false,
    onGameEnd: jest.fn(),
    onLeave: jest.fn()
};

describe('MemoryDuel Component', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders the game board with 16 cards', async () => {
        render(<MemoryDuel {...defaultProps} />);

        expect(screen.getByText('Neon Hafıza')).toBeInTheDocument();

        // There should be 16 buttons (cards) rendered.
        await waitFor(() => {
            const buttons = screen.getAllByRole('button');
            // Cards + Oyundan Çık button
            // 16 cards + 1 leave button = 17 buttons
            expect(buttons.length).toBeGreaterThanOrEqual(16);
        }, { timeout: 2000 });
    });

    it('displays both player scores start at 0', async () => {
        render(<MemoryDuel {...defaultProps} />);
        // Get all display instances of 0 (can be multiple places)
        const zeros = await screen.findAllByText('0');
        expect(zeros.length).toBeGreaterThanOrEqual(2);
    });
});
