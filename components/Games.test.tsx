import React from 'react';
import { render, screen } from '@testing-library/react';
import { Games } from './Games';

describe('Games', () => {
  it('renders featured games and supporting highlights', () => {
    render(<Games />);

    expect(
      screen.getByText('Kısa tur mantığıyla çalışan, tekrar oranı yüksek oyun kütüphanesi.')
    ).toBeInTheDocument();

    expect(screen.getByText('Refleks Avı')).toBeInTheDocument();
    expect(screen.getByText('Tank Düellosu')).toBeInTheDocument();
    expect(screen.getByText('Retro Satranç')).toBeInTheDocument();
    expect(screen.getByText('Bilgi Yarışı')).toBeInTheDocument();

    expect(screen.getByText('Anında başlat')).toBeInTheDocument();
    expect(screen.getByText('Düelloya gir')).toBeInTheDocument();
    expect(screen.getByText('Tahtayı aç')).toBeInTheDocument();
    expect(screen.getByText('Bilgi turunu aç')).toBeInTheDocument();

    expect(screen.getByText('Kısa Seans')).toBeInTheDocument();
    expect(screen.getByText('Tekrar Motivasyonu')).toBeInTheDocument();
    expect(screen.getByText('Denge ve Ölçüm')).toBeInTheDocument();
  });
});
