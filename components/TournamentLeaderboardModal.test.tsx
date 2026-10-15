import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TournamentLeaderboardModal } from './TournamentLeaderboardModal';

jest.mock('../lib/api', () => ({
  api: {
    tournaments: {
      leaderboard: jest.fn(),
    },
  },
}));

import { api } from '../lib/api';

const tournament = {
  id: 7,
  name: 'Riso Cup',
  end_at: '2026-12-31T00:00:00Z',
  status: 'active',
  prize_tiers: [],
} as never;

const leaderboardRows: Array<{
  id: number;
  username: string;
  total_points: string;
  rank: number;
  avatar_url: string | null;
  games_counted: number;
}> = [
  { id: 1, username: 'emin', total_points: '12.50', rank: 1, avatar_url: null, games_counted: 3 },
  { id: 2, username: 'rakip', total_points: '4.00', rank: 2, avatar_url: null, games_counted: 1 },
];

describe('TournamentLeaderboardModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.tournaments.leaderboard as jest.Mock).mockResolvedValue({ leaderboard: leaderboardRows });
  });

  it('renders nothing when closed', () => {
    render(
      <TournamentLeaderboardModal isOpen={false} onClose={() => {}} tournament={tournament} />
    );
    expect(screen.queryByText('Riso Cup')).not.toBeInTheDocument();
  });

  it('fetches and renders leaderboard rows with formatted points', async () => {
    render(<TournamentLeaderboardModal isOpen={true} onClose={() => {}} tournament={tournament} />);
    expect(api.tournaments.leaderboard).toHaveBeenCalledWith(7);
    await waitFor(() => expect(screen.getByText('emin')).toBeInTheDocument());
    expect(screen.getByText('rakip')).toBeInTheDocument();
    expect(screen.getByText('12.5')).toBeInTheDocument(); // 12.50 -> 12.5
    expect(screen.getByText('4')).toBeInTheDocument(); // 4.00 -> 4
  });

  it('calls onClose when close button clicked', async () => {
    const onClose = jest.fn();
    render(<TournamentLeaderboardModal isOpen={true} onClose={onClose} tournament={tournament} />);
    await waitFor(() => expect(screen.getByText('emin')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /kapat|close/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows an error message when the fetch fails', async () => {
    (api.tournaments.leaderboard as jest.Mock).mockRejectedValue(new Error('network'));
    render(<TournamentLeaderboardModal isOpen={true} onClose={() => {}} tournament={tournament} />);
    await waitFor(() => expect(screen.getByText(/network/i)).toBeInTheDocument());
  });
});
