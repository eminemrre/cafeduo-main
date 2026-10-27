import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CookieConsent } from './CookieConsent';

describe('necessary-cookie information', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (window.localStorage.getItem as jest.Mock).mockReturnValue(null);
  });

  it.each(['default', 'landing'] as const)(
    'informs without seeking consent (%s)',
    async (variant) => {
      render(<CookieConsent variant={variant} />);
      const notice = await screen.findByRole('region', { name: 'Çerez bildirimi' });
      expect(notice).toHaveTextContent(/zorunlu/i);
      expect(screen.getByRole('link', { name: 'Çerez politikası' })).toHaveAttribute(
        'href',
        '/cerezler'
      );
      expect(screen.queryByRole('button', { name: /Kabul et|Reddet/i })).not.toBeInTheDocument();
      expect(window.localStorage.setItem).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: 'Bildirimi kapat' }));
      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        'cafeduo_cookie_notice',
        '2026-10-27'
      );
      await waitFor(() =>
        expect(screen.queryByRole('region', { name: 'Çerez bildirimi' })).not.toBeInTheDocument()
      );
    }
  );

  it('does not mistake an old rejected choice for consent or a current acknowledgement', async () => {
    (window.localStorage.getItem as jest.Mock).mockImplementation((key: string) =>
      key === 'cookie_consent' ? 'rejected' : null
    );
    render(<CookieConsent />);
    expect(await screen.findByRole('button', { name: 'Bildirimi kapat' })).toBeInTheDocument();
  });

  it('remembers an acknowledgement for this version only', () => {
    (window.localStorage.getItem as jest.Mock).mockImplementation((key: string) =>
      key === 'cafeduo_cookie_notice' ? '2026-10-27' : null
    );
    render(<CookieConsent />);
    expect(screen.queryByRole('region', { name: 'Çerez bildirimi' })).not.toBeInTheDocument();
  });

  it('remains dismissible when browser storage is unavailable', async () => {
    (window.localStorage.getItem as jest.Mock).mockImplementation(() => {
      throw new Error('blocked');
    });
    (window.localStorage.setItem as jest.Mock).mockImplementationOnce(() => {
      throw new Error('blocked');
    });
    render(<CookieConsent />);
    fireEvent.click(await screen.findByRole('button', { name: 'Bildirimi kapat' }));
    expect(screen.queryByRole('region', { name: 'Çerez bildirimi' })).not.toBeInTheDocument();
  });
});
