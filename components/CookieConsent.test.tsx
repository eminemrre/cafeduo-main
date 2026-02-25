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

  it('auto-accepts and shows informational banner on first visit', async () => {
    (window.localStorage.getItem as jest.Mock).mockReturnValue(null);

    render(<CookieConsent />);

    await waitFor(() => {
      expect(screen.getByText('Çerez Kullanımı')).toBeInTheDocument();
      expect(screen.getByText(/çerezleri kullanıyoruz/i)).toBeInTheDocument();
    });

    expect(window.localStorage.setItem).toHaveBeenCalledWith('cookie_consent', 'true');
  });

  it('allows dismissing the informational banner', async () => {
    (window.localStorage.getItem as jest.Mock).mockReturnValue(null);

    render(<CookieConsent />);

    fireEvent.click(await screen.findByRole('button', { name: 'Anladım' }));

    await waitFor(() => {
      expect(screen.queryByText('Çerez Kullanımı')).not.toBeInTheDocument();
    });
  });
});
