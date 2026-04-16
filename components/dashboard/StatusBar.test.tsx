import React from 'react';
import { render, screen } from '@testing-library/react';
import { StatusBar } from './StatusBar';
import { User } from '../../types';

describe('StatusBar', () => {
  const user: User = {
    id: 1,
    username: 'emin',
    email: 'emin@example.com',
    points: 320,
    wins: 11,
    gamesPlayed: 24,
  };

  it('renders user stats and default department label', () => {
    render(<StatusBar user={user} tableCode="" isMatched={false} />);

    expect(screen.getByText('emin')).toBeInTheDocument();
    expect(screen.getByText('Öğrenci')).toBeInTheDocument();
    expect(screen.getByTestId('user-points')).toHaveTextContent('320');
    expect(screen.getByTestId('user-wins')).toHaveTextContent('11');
    expect(screen.getByTestId('user-games')).toHaveTextContent('24');
  });

  it('shows connected table code when matched', () => {
    render(<StatusBar user={user} tableCode="A12" isMatched={true} />);

    expect(screen.getByTestId('table-status')).toHaveTextContent('A12');
    expect(screen.queryByText('Masa bağlı değil')).not.toBeInTheDocument();
  });

  it('shows disconnected message when not matched', () => {
    render(<StatusBar user={user} tableCode="" isMatched={false} />);

    expect(screen.getByTestId('table-status')).toHaveTextContent('Masa bağlı değil');
  });

  it('renders uppercase user avatar initial', () => {
    render(<StatusBar user={{ ...user, username: 'ali' }} tableCode="B3" isMatched={true} />);

    expect(screen.getByText('A')).toBeInTheDocument();
  });
});
