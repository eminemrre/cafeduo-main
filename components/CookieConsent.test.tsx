import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CookieConsent } from './CookieConsent';

describe('CookieConsent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not show banner when consent already accepted (legacy true)', () => {
    (window.localStorage.getItem as jest.Mock).mockReturnValue('true');

    render(<CookieConsent />);

    expect(screen.queryByText('Çerez Kullanımı')).not.toBeInTheDocument();
  });

  it('does not show banner when consent already accepted (new value)', () => {
    (window.localStorage.getItem as jest.Mock).mockReturnValue('accepted');

    render(<CookieConsent />);

    expect(screen.queryByText('Çerez Kullanımı')).not.toBeInTheDocument();
  });

  it('shows banner on first visit without auto-accepting', async () => {
    (window.localStorage.getItem as jest.Mock).mockReturnValue(null);

    render(<CookieConsent />);

    await waitFor(() => {
      expect(screen.getByText('Çerez Kullanımı')).toBeInTheDocument();
    });

    // Should NOT auto-accept - user must click a button
    expect(window.localStorage.setItem).not.toHaveBeenCalled();
  });

  it('stores accepted consent only after user clicks Kabul Et', async () => {
    (window.localStorage.getItem as jest.Mock).mockReturnValue(null);

    render(<CookieConsent />);

    const acceptButton = await screen.findByRole('button', { name: 'Kabul Et' });
    fireEvent.click(acceptButton);

    await waitFor(() => {
      expect(screen.queryByText('Çerez Kullanımı')).not.toBeInTheDocument();
    });

    expect(window.localStorage.setItem).toHaveBeenCalledWith('cookie_consent', 'accepted');
  });

  it('stores rejected consent after user clicks Reddet and dismisses the banner', async () => {
    (window.localStorage.getItem as jest.Mock).mockReturnValue(null);

    render(<CookieConsent />);

    const rejectButton = await screen.findByRole('button', { name: 'Reddet' });
    fireEvent.click(rejectButton);

    expect(window.localStorage.setItem).toHaveBeenCalledWith('cookie_consent', 'rejected');

    // Banner is dismissed so the user can browse the landing page. Enforcement
    // happens at auth time (AuthModal blocks login/register when consent isn't
    // accepted and re-opens this banner by clearing the rejected value).
    await waitFor(() => {
      expect(screen.queryByText('Çerez Kullanımı')).not.toBeInTheDocument();
    });
  });

  it('does not show banner when consent is already rejected', () => {
    (window.localStorage.getItem as jest.Mock).mockReturnValue('rejected');

    render(<CookieConsent />);

    expect(screen.queryByText('Çerez Kullanımı')).not.toBeInTheDocument();
  });
});
