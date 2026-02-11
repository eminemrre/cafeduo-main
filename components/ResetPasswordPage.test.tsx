import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ResetPasswordPage } from './ResetPasswordPage';

jest.mock('../lib/api', () => ({
  api: {
    auth: {
      resetPassword: jest.fn(),
    },
  },
}));

describe('ResetPasswordPage', () => {
  it('shows validation error when token is missing', async () => {
    render(
      <MemoryRouter initialEntries={['/reset-password']}>
        <Routes>
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText('Yeni şifre'), {
      target: { value: 'new-pass-123' },
    });
    fireEvent.change(screen.getByPlaceholderText('Yeni şifre tekrar'), {
      target: { value: 'new-pass-123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /şifreyi güncelle/i }));

    await waitFor(() => {
      expect(screen.getByText('Sıfırlama bağlantısı geçersiz veya eksik.')).toBeInTheDocument();
    });
  });

  it('submits reset request with token from query string', async () => {
    const { api } = await import('../lib/api');
    (api.auth.resetPassword as jest.Mock).mockResolvedValue({
      success: true,
      message: 'Şifre güncellendi.',
    });

    render(
      <MemoryRouter initialEntries={['/reset-password?token=token-abc']}>
        <Routes>
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText('Yeni şifre'), {
      target: { value: 'new-pass-123' },
    });
    fireEvent.change(screen.getByPlaceholderText('Yeni şifre tekrar'), {
      target: { value: 'new-pass-123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /şifreyi güncelle/i }));

    await waitFor(() => {
      expect(api.auth.resetPassword).toHaveBeenCalledWith('token-abc', 'new-pass-123');
      expect(screen.getByText('Şifre güncellendi.')).toBeInTheDocument();
    });
  });
});

