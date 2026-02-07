import React from 'react';
import { render, screen } from '@testing-library/react';
import { About } from './About';

describe('About', () => {
  it('renders platform positioning, pillars, and expert approach list', () => {
    render(<About />);

    expect(
      screen.getByText('Kafeleri oyun odaklı topluluk alanına çeviren dijital omurga.')
    ).toBeInTheDocument();

    expect(screen.getByText('Operasyonel Altyapı')).toBeInTheDocument();
    expect(screen.getByText('Hızlı Deneyim')).toBeInTheDocument();
    expect(screen.getByText('Güvenli İşleyiş')).toBeInTheDocument();
    expect(screen.getByText('B2B Uyum')).toBeInTheDocument();

    expect(screen.getByText('Kafe için net fayda modeli')).toBeInTheDocument();
    expect(screen.getByText('Gerçek zamanlı skor ve kupon akışı')).toBeInTheDocument();
    expect(
      screen.getByText('Rol bazlı panel yapısı (kullanıcı, kafe admin, sistem admin)')
    ).toBeInTheDocument();
    expect(screen.getByText('Deploy-ready Docker tabanlı canlı ortam')).toBeInTheDocument();
  });
});
