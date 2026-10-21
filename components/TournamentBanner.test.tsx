import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TournamentBanner } from './TournamentBanner';

describe('TournamentBanner', () => {
  const baseTournament = {
    id: 1,
    name: 'Kafe Kupası',
    end_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 saat
    status: 'active',
    prize_tiers: [] as never[],
  };
  const tournament = baseTournament as never;

  it('renders tournament name and countdown', () => {
    render(<TournamentBanner tournament={tournament} onOpenLeaderboard={() => {}} />);
    expect(screen.getByText('Kafe Kupası')).toBeInTheDocument();
    expect(screen.getByText(/02:00:00|01:59:/)).toBeInTheDocument();
  });

  it('calls onOpenLeaderboard when CTA clicked', () => {
    const onOpen = jest.fn();
    render(<TournamentBanner tournament={tournament} onOpenLeaderboard={onOpen} />);
    const cta = screen.getByRole('button');
    fireEvent.click(cta);
    expect(onOpen).toHaveBeenCalled();
  });

  it('shows 00:00 for past tournaments', () => {
    const past = {
      ...baseTournament,
      end_at: new Date(Date.now() - 1000).toISOString(),
    } as never;
    render(<TournamentBanner tournament={past} onOpenLeaderboard={() => {}} />);
    expect(screen.getByText('00:00')).toBeInTheDocument();
  });
});
