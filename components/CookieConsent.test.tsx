import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CookieConsent } from './CookieConsent';

describe('CookieConsent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows preferences button when consent already exists, but keeps panel closed', () => {
    (window.localStorage.getItem as jest.Mock).mockReturnValue('true');

    render(<CookieConsent />);

    expect(screen.getByRole('button', { name: 'Çerez Tercihleri' })).toBeInTheDocument();
    expect(screen.queryByText('Çerez Politikası')).not.toBeInTheDocument();
  });

  it('renders consent box when no consent is stored', async () => {
    (window.localStorage.getItem as jest.Mock).mockReturnValue(null);

    render(<CookieConsent />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Çerez Tercihleri' })).toBeInTheDocument();
      expect(screen.getByText('Çerez Politikası')).toBeInTheDocument();
      expect(screen.getByText(/çerezleri kullanıyoruz/i)).toBeInTheDocument();
    });
  });

  it('persists consent and closes when accepted', async () => {
    (window.localStorage.getItem as jest.Mock).mockReturnValue(null);

    render(<CookieConsent />);

    fireEvent.click(await screen.findByRole('button', { name: 'Kabul Et' }));

    expect(window.localStorage.setItem).toHaveBeenCalledWith('cookie_consent', 'true');
    expect(screen.queryByText('Çerez Politikası')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Çerez Tercihleri' })).toBeInTheDocument();
  });

  it('closes panel when dismissed without writing consent and allows reopening', async () => {
    (window.localStorage.getItem as jest.Mock).mockReturnValue(null);

    render(<CookieConsent />);

    fireEvent.click(await screen.findByRole('button', { name: 'Çerez panelini kapat' }));

    expect(window.localStorage.setItem).not.toHaveBeenCalled();
    expect(screen.queryByText('Çerez Politikası')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Çerez Tercihleri' }));
    expect(await screen.findByText('Çerez Politikası')).toBeInTheDocument();
  });
});
