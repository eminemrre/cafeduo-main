import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { VerifyEmailPage } from './VerifyEmailPage';
import { api, ApiRequestError } from '../lib/api';

jest.mock('../lib/api', () => {
  class ApiRequestError extends Error {
    code?: string;
    status?: number;
    constructor(message: string, code?: string, status?: number) {
      super(message);
      this.code = code;
      this.status = status;
    }
  }
  return {
    ApiRequestError,
    api: { auth: { verifyEmail: jest.fn(), resendVerification: jest.fn() } },
  };
});

const verifyEmail = api.auth.verifyEmail as jest.Mock;
const resendVerification = api.auth.resendVerification as jest.Mock;
const TOKEN = 'c'.repeat(64);

const renderPage = (path = `/dogrula?token=${TOKEN}`) =>
  render(
    <React.StrictMode>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/dogrula" element={<VerifyEmailPage />} />
        </Routes>
      </MemoryRouter>
    </React.StrictMode>
  );

beforeEach(() => jest.clearAllMocks());

describe('VerifyEmailPage', () => {
  it('confirms the link once, even under StrictMode, and says so', async () => {
    verifyEmail.mockResolvedValue({ status: 'verified' });
    renderPage();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'E-postan doğrulandı' })).toBeInTheDocument());
    expect(verifyEmail).toHaveBeenCalledTimes(1);
    expect(verifyEmail).toHaveBeenCalledWith(TOKEN);
  });

  it('treats a second click as already verified', async () => {
    verifyEmail.mockResolvedValue({ status: 'already' });
    renderPage();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'E-postan zaten doğrulanmış' })).toBeInTheDocument());
  });

  it('offers a new link for an expired one and asks to sign in when there is no session', async () => {
    verifyEmail.mockRejectedValue(new ApiRequestError('süresi dolmuş', 'VERIFICATION_EXPIRED', 400));
    resendVerification.mockRejectedValueOnce(new ApiRequestError('auth', 'AUTH_REQUIRED', 401));
    renderPage();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Bağlantının süresi dolmuş' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Yeni bağlantı gönder' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/giriş yap/i));

    resendVerification.mockResolvedValueOnce({ sent: true });
    fireEvent.click(screen.getByRole('button', { name: 'Yeni bağlantı gönder' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/Yeni bağlantıyı gönderdik/));
  });

  it('lets a network failure be retried instead of leaving a dead end', async () => {
    verifyEmail.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce({ status: 'verified' });
    renderPage();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Şu an doğrulayamadık' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Yeniden dene' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'E-postan doğrulandı' })).toBeInTheDocument());
    expect(verifyEmail).toHaveBeenCalledTimes(2);
  });

  it('explains a resend rate limit', async () => {
    verifyEmail.mockRejectedValue(new ApiRequestError('süresi dolmuş', 'VERIFICATION_EXPIRED', 400));
    resendVerification.mockRejectedValueOnce(
      new ApiRequestError('çok', 'AUTH_RESEND_VERIFICATION_RATE_LIMITED', 429)
    );
    renderPage();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Yeni bağlantı gönder' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Yeni bağlantı gönder' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/çok kez/));
  });

  it('calls a missing or malformed token invalid without asking the server', async () => {
    renderPage('/dogrula');
    expect(screen.getByRole('heading', { name: 'Bağlantı geçersiz' })).toBeInTheDocument();
    expect(verifyEmail).not.toHaveBeenCalled();
  });

  it('calls a rejected token invalid', async () => {
    verifyEmail.mockRejectedValue(new ApiRequestError('geçersiz', 'VERIFICATION_INVALID', 400));
    renderPage();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Bağlantı geçersiz' })).toBeInTheDocument());
  });
});
