import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EmailVerifyBanner } from './EmailVerifyBanner';
import { api, ApiRequestError } from '../../lib/api';

jest.mock('../../lib/api', () => {
  class ApiRequestError extends Error {
    code?: string;
    status?: number;
    constructor(message: string, code?: string, status?: number) {
      super(message);
      this.code = code;
      this.status = status;
    }
  }
  return { ApiRequestError, api: { auth: { resendVerification: jest.fn() } } };
});

const resend = api.auth.resendVerification as jest.Mock;

// test-setup replaces sessionStorage with bare mocks; give it a real store here.
let store: Map<string, string>;
beforeEach(() => {
  jest.clearAllMocks();
  store = new Map();
  (window.sessionStorage.getItem as jest.Mock).mockImplementation((key: string) => store.get(key) ?? null);
  (window.sessionStorage.setItem as jest.Mock).mockImplementation((key: string, value: string) => {
    store.set(key, value);
  });
});

describe('EmailVerifyBanner', () => {
  it('shows only for a user known to be unverified', () => {
    const { rerender } = render(<EmailVerifyBanner emailVerified={false} />);
    expect(screen.getByRole('region', { name: 'E-posta doğrulama' })).toBeInTheDocument();
    rerender(<EmailVerifyBanner emailVerified />);
    expect(screen.queryByRole('region', { name: 'E-posta doğrulama' })).not.toBeInTheDocument();
    rerender(<EmailVerifyBanner emailVerified={undefined} />);
    expect(screen.queryByRole('region', { name: 'E-posta doğrulama' })).not.toBeInTheDocument();
  });

  it('sends a new link and says so', async () => {
    resend.mockResolvedValueOnce({ sent: true });
    render(<EmailVerifyBanner emailVerified={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Tekrar gönder' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/gönderdik/));
    expect(screen.queryByRole('button', { name: 'Tekrar gönder' })).not.toBeInTheDocument();
  });

  it('explains a rate limit and keeps the button', async () => {
    resend.mockRejectedValueOnce(new ApiRequestError('çok', 'AUTH_RESEND_VERIFICATION_RATE_LIMITED', 429));
    render(<EmailVerifyBanner emailVerified={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Tekrar gönder' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/çok kez/i));
    expect(screen.getByRole('button', { name: 'Tekrar gönder' })).toBeEnabled();
  });

  it('stays hidden for the rest of the session once closed', async () => {
    const { unmount } = render(<EmailVerifyBanner emailVerified={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Kapat' }));
    expect(screen.queryByRole('region', { name: 'E-posta doğrulama' })).not.toBeInTheDocument();
    unmount();
    render(<EmailVerifyBanner emailVerified={false} />);
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'E-posta doğrulama' })).not.toBeInTheDocument()
    );
  });
});
