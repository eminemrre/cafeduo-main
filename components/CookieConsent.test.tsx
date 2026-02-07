import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CookieConsent } from './CookieConsent';

describe('CookieConsent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not render when consent already exists', () => {
    (window.localStorage.getItem as jest.Mock).mockReturnValue('true');

    render(<CookieConsent />);

    expect(screen.queryByText('Çerez Politikası')).not.toBeInTheDocument();
  });

  it('renders consent box when no consent is stored', async () => {
    (window.localStorage.getItem as jest.Mock).mockReturnValue(null);

    render(<CookieConsent />);

    await waitFor(() => {
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
  });

  it('closes when dismissed without writing consent', async () => {
    (window.localStorage.getItem as jest.Mock).mockReturnValue(null);

    render(<CookieConsent />);

    const buttons = await screen.findAllByRole('button');
    fireEvent.click(buttons[1]);

    expect(window.localStorage.setItem).not.toHaveBeenCalled();
    expect(screen.queryByText('Çerez Politikası')).not.toBeInTheDocument();
  });
});
