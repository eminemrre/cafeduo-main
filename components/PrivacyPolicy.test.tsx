import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { PrivacyPolicy } from './PrivacyPolicy';

describe('PrivacyPolicy', () => {
  it('renders KVKK sections and primary contact details', () => {
    render(
      <MemoryRouter>
        <PrivacyPolicy />
      </MemoryRouter>
    );

    expect(screen.getByText('Gizlilik Politikası ve KVKK Aydınlatma Metni')).toBeInTheDocument();
    expect(screen.getByText(/Son güncelleme:/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Veri Sorumlusu/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Çerez Politikası/i })).toBeInTheDocument();
    expect(screen.getByText('cafeduotr@gmail.com')).toBeInTheDocument();
    expect(screen.getByText('Emin Emre')).toBeInTheDocument();
    expect(screen.getByText(/Gaziler Caddesi No:40/)).toBeInTheDocument();
    expect(screen.getByText(/Son güncelleme: 27 Ekim 2026/)).toBeInTheDocument();
    for (const link of screen.getAllByRole('link', { name: 'Çerez politikası' })) {
      expect(link).toHaveAttribute('href', '/cerezler');
    }
    expect(screen.getByRole('navigation', { name: 'Bu metinde' })).toBeInTheDocument();

    const backLink = screen.getByRole('link', { name: /Ana Sayfaya Dön/i });
    expect(backLink).toHaveAttribute('href', '/');
  });

  it('does not change the published legal version when the calendar changes', () => {
    jest.useFakeTimers().setSystemTime(new Date('2027-01-01T12:00:00Z'));
    try {
      render(
        <MemoryRouter>
          <PrivacyPolicy />
        </MemoryRouter>
      );
      expect(screen.getByText(/Son güncelleme: 27 Ekim 2026/)).toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });
});
