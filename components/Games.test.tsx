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

    expect(screen.getByText('Neon Refleks')).toBeInTheDocument();
    expect(screen.getByText('Pixel Düello')).toBeInTheDocument();
    expect(screen.getByText('Retro Satranç')).toBeInTheDocument();
    expect(screen.getByText('Bilgi Sprinti')).toBeInTheDocument();
    expect(screen.getByText('Neon Hafıza')).toBeInTheDocument();

    expect(screen.getByText('Reflekse gir')).toBeInTheDocument();
    expect(screen.getByText('Düelloya başla')).toBeInTheDocument();
    expect(screen.getByText('Tahtaya geç')).toBeInTheDocument();
    expect(screen.getByText('Sprinti aç')).toBeInTheDocument();
    expect(screen.getByText('Kartlara bak')).toBeInTheDocument();

    expect(screen.getByText('Beklerken Oyna')).toBeInTheDocument();
    expect(screen.getByText('Anlık Kazanç')).toBeInTheDocument();
    expect(screen.getByText('Kafe Bağı')).toBeInTheDocument();
  });
});
