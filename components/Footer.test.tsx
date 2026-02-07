import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Footer } from './Footer';

describe('Footer', () => {
  it('renders legal and contact links with current year', () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    );

    expect(screen.getByText('CafeDuo')).toBeInTheDocument();
    expect(screen.getByText(`© ${new Date().getFullYear()} tüm hakları saklıdır`)).toBeInTheDocument();

    const privacyLink = screen.getByRole('link', { name: /Gizlilik Politikası & KVKK/i });
    expect(privacyLink).toHaveAttribute('href', '/gizlilik');

    expect(screen.getByRole('link', { name: 'Instagram' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Twitter' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'E-posta' })).toHaveAttribute(
      'href',
      'mailto:kvkk@cafeduo.com'
    );
  });
});
