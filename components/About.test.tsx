import React from 'react';
import { render, screen } from '@testing-library/react';
import { About } from './About';

describe('About', () => {
  it('renders platform positioning, pillars, and expert approach list', () => {
    render(<About />);

    expect(
      screen.getByTestId('about-main-heading')
    ).toBeInTheDocument();
    expect(screen.getByTestId('about-main-heading')).toHaveTextContent(
      'Bekleyen kullanıcıyı aktif oyuncuya çeviren sosyal oyun altyapısı.'
    );

    expect(screen.getByText('Anlık Eşleşme')).toBeInTheDocument();
    expect(screen.getByText('Kısa Tur Dinamiği')).toBeInTheDocument();
    expect(screen.getByText('Güvenli Giriş')).toBeInTheDocument();
    expect(screen.getByText('Ödül Döngüsü')).toBeInTheDocument();

    expect(screen.getByText('Kullanıcı + kafe için net kazanım')).toBeInTheDocument();
    expect(screen.getByText('Canlı eşleşme ve skor güncellemesi')).toBeInTheDocument();
    expect(screen.getByText('Kısa tur, yüksek tekrar oynanış döngüsü')).toBeInTheDocument();
    expect(screen.getByText('Ödül ekonomisiyle kafe sadakati')).toBeInTheDocument();
  });
});
