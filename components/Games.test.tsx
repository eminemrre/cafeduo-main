import React from 'react';
import { render, screen } from '@testing-library/react';
import { Games } from './Games';

describe('Games', () => {
  it('renders featured games and supporting highlights', () => {
    render(<Games />);

    expect(
      screen.getByTestId('games-main-heading')
    ).toBeInTheDocument();
    expect(screen.getByTestId('games-main-heading')).toHaveTextContent(
      'Bekleme dakikalarını oyuna çeviren kısa tur kütüphanesi.'
    );

    expect(screen.getByText('Retro Satranç')).toBeInTheDocument();
    expect(screen.getByText('Bilgi Sprinti')).toBeInTheDocument();
    expect(screen.getByText('Tank Düellosu')).toBeInTheDocument();

    expect(screen.getByText('Tahtaya geç')).toBeInTheDocument();
    expect(screen.getByText('Sprinti aç')).toBeInTheDocument();
    expect(screen.getByText('Düelloya başla')).toBeInTheDocument();

    expect(screen.getByText('Beklerken Oyna')).toBeInTheDocument();
    expect(screen.getByText('Anlık Kazanç')).toBeInTheDocument();
    expect(screen.getByText('Kafe Bağı')).toBeInTheDocument();
  });
});
