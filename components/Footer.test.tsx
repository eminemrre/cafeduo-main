import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { Footer } from './Footer';

describe('Footer', () => {
  it('renders legal and contact links with current year', () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    );

    expect(screen.getByText('CafeDuo')).toBeInTheDocument();
    expect(
      screen.getByText(`© ${new Date().getFullYear()} tüm hakları saklıdır`)
    ).toBeInTheDocument();
    expect(
      screen.getByText('Kahve molana oyun, yeni karşılaşmalar ve güzel ödüller ekle.')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('footer-version-pill')).not.toBeInTheDocument();

    const privacyLink = screen.getByRole('link', { name: /Gizlilik Politikası & KVKK/i });
    expect(privacyLink).toHaveAttribute('href', '/gizlilik');

    expect(screen.getByRole('link', { name: 'Instagram' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Twitter' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'E-posta' })).toHaveAttribute(
      'href',
      'mailto:cafeduotr@gmail.com'
    );
    expect(screen.getByRole('link', { name: 'cafeduotr@gmail.com' })).toHaveAttribute(
      'href',
      'mailto:cafeduotr@gmail.com'
    );
  });
});
