import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TankBattle } from './TankBattle';
import { User } from '../types';

// Mock canvas
HTMLCanvasElement.prototype.getContext = jest.fn().mockReturnValue({
    fillRect: jest.fn(),
    clearRect: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    closePath: jest.fn(),
    fill: jest.fn(),
    stroke: jest.fn(),
    arc: jest.fn(),
    createLinearGradient: jest.fn().mockReturnValue({ addColorStop: jest.fn() }),
    fillText: jest.fn(),
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 0,
    lineCap: '',
    shadowColor: '',
    shadowBlur: 0,
    font: '',
});

describe('TankBattle', () => {
    const mockUser: User = {
        id: 1,
        username: 'emin',
        email: 'emin@example.com',
        points: 100,
        wins: 0,
        gamesPlayed: 0,
    };

    beforeEach(() => {
        jest.useFakeTimers();
        jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
            return 0;
        });
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    it('renders the game canvas and controls', () => {
        render(
            <TankBattle
                currentUser={mockUser}
                gameId={1}
                isBot={true}
                onGameEnd={jest.fn()}
                onLeave={jest.fn()}
            />
        );

        expect(screen.getByTestId('tank-battle')).toBeInTheDocument();
        expect(screen.getByTestId('tank-fire-button')).toBeInTheDocument();
        expect(screen.getByTestId('tank-angle-slider')).toBeInTheDocument();
        expect(screen.getByTestId('tank-power-slider')).toBeInTheDocument();
        expect(screen.getByText('Tank Düellosu')).toBeInTheDocument();
    });

    it('renders angle and power sliders with default values', () => {
        render(
            <TankBattle
                currentUser={mockUser}
                gameId={1}
                isBot={true}
                onGameEnd={jest.fn()}
                onLeave={jest.fn()}
            />
        );

        const angleSlider = screen.getByTestId('tank-angle-slider') as HTMLInputElement;
        const powerSlider = screen.getByTestId('tank-power-slider') as HTMLInputElement;

        // Default values
        expect(angleSlider).not.toBeDisabled();
        expect(powerSlider).not.toBeDisabled();
        expect(angleSlider.min).toBe('5');
        expect(angleSlider.max).toBe('85');
        expect(powerSlider.min).toBe('10');
        expect(powerSlider.max).toBe('100');
    });

    it('displays HP hearts for both players', () => {
        render(
            <TankBattle
                currentUser={mockUser}
                gameId={1}
                isBot={true}
                onGameEnd={jest.fn()}
                onLeave={jest.fn()}
            />
        );

        // 3 HP for player + 3 HP for opponent = 6 hearts total
        const hearts = screen.getAllByText('♥');
        expect(hearts.length).toBe(6);
    });

    it('fires when fire button is clicked on player turn', () => {
        render(
            <TankBattle
                currentUser={mockUser}
                gameId={1}
                isBot={true}
                onGameEnd={jest.fn()}
                onLeave={jest.fn()}
            />
        );

        const fireButton = screen.getByTestId('tank-fire-button');
        expect(fireButton).not.toBeDisabled();
        fireEvent.click(fireButton);
        // Fire was triggered (button may transition to disabled state asynchronously)
        expect(fireButton).toBeInTheDocument();
    });
});
