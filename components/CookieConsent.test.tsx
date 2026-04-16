import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CookieConsent } from './CookieConsent';

describe('CookieConsent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not show banner when consent already exists', () => {
    (window.localStorage.getItem as jest.Mock).mockReturnValue('true');

    render(<CookieConsent />);

    expect(screen.queryByText('Çerez Kullanımı')).not.toBeInTheDocument();
  });

  it('shows banner on first visit without auto-accepting', async () => {
    (window.localStorage.getItem as jest.Mock).mockReturnValue(null);

    render(<CookieConsent />);

    await waitFor(() => {
      expect(screen.getByText('Çerez Kullanımı')).toBeInTheDocument();
      expect(screen.getByText(/çerezleri kullanıyoruz/i)).toBeInTheDocument();
    });

    // Should NOT auto-accept - user must click button
    expect(window.localStorage.setItem).not.toHaveBeenCalled();
  });

  it('stores consent only after user clicks accept button', async () => {
    (window.localStorage.getItem as jest.Mock).mockReturnValue(null);

    render(<CookieConsent />);

    const acceptButton = await screen.findByRole('button', { name: 'Anladım' });
    fireEvent.click(acceptButton);

    await waitFor(() => {
      expect(screen.queryByText('Çerez Kullanımı')).not.toBeInTheDocument();
    });

    // Verify consent was stored after user clicked
    expect(window.localStorage.setItem).toHaveBeenCalledWith('cookie_consent', 'true');
  });
});
