import React from 'react';
import { render, screen } from '@testing-library/react';
import { PrivacyPolicy } from './PrivacyPolicy';

describe('PrivacyPolicy', () => {
  it('renders KVKK sections and primary contact details', () => {
    render(<PrivacyPolicy />);

    expect(screen.getByText('Gizlilik Politikası ve KVKK Aydınlatma Metni')).toBeInTheDocument();
    expect(screen.getByText(/Son güncelleme:/i)).toBeInTheDocument();
    expect(screen.getByText(/1. Veri Sorumlusu/i)).toBeInTheDocument();
    expect(screen.getByText(/8. Çerez Politikası/i)).toBeInTheDocument();
    expect(screen.getByText('kvkk@cafeduo.com')).toBeInTheDocument();

    const backLink = screen.getByRole('link', { name: 'Ana Sayfaya Dön' });
    expect(backLink).toHaveAttribute('href', '/');
  });
});
