import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router';
import { ResetPasswordPage } from './ResetPasswordPage';
import { api } from '../lib/api';

jest.mock('../lib/api', () => ({ api: { auth: { resetPassword: jest.fn() } } }));
const resetPassword = api.auth.resetPassword as jest.Mock;
const TOKEN = 'a'.repeat(64);

function ChangeLink() {
  const navigate = useNavigate();
  return (
    <button onClick={() => navigate(`/reset-password?token=${'b'.repeat(64)}`)}>
      Başka bağlantı
    </button>
  );
}

function renderPage(path = `/reset-password?token=${TOKEN}`, allowNavigation = false) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      {allowNavigation && <ChangeLink />}
      <Routes>
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/" element={<p>Giriş ekranı</p>} />
      </Routes>
    </MemoryRouter>
  );
}

function fillPasswords(password = 'new-pass-123', confirmation = password) {
  fireEvent.change(screen.getByLabelText('Yeni şifre'), { target: { value: password } });
  fireEvent.change(screen.getByLabelText('Şifre tekrar'), { target: { value: confirmation } });
}

function submit() {
  fireEvent.submit(screen.getByLabelText('Yeni şifre').closest('form')!);
}

describe('ResetPasswordPage', () => {
  beforeEach(() => resetPassword.mockReset());

  it.each(['/reset-password', '/reset-password?token=short', '/reset-password?token=%20%20'])(
    'explains an invalid link before asking for a password: %s',
    (path) => {
      renderPage(path);
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
        'Bağlantıyı kontrol edelim.'
      );
      expect(screen.getByText('Sıfırlama bağlantısı geçersiz veya eksik.')).toBeVisible();
      expect(screen.queryByLabelText('Yeni şifre')).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Giriş ekranına git' })).toHaveAttribute(
        'href',
        '/?auth=login'
      );
      expect(resetPassword).not.toHaveBeenCalled();
    }
  );

  it.each(['short', 'x'.repeat(73)])(
    'validates both server password limits and focuses the field',
    (password) => {
      renderPage();
      fillPasswords(password);
      submit();
      expect(screen.getByLabelText('Yeni şifre')).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByLabelText('Yeni şifre')).toHaveAccessibleDescription(
        'Şifre 6–72 karakter arasında olmalı.'
      );
      expect(screen.getByLabelText('Yeni şifre')).toHaveFocus();
      expect(resetPassword).not.toHaveBeenCalled();
    }
  );

  it('describes a mismatch at the confirmation field and clears it when corrected', () => {
    renderPage();
    fillPasswords('new-pass-123', 'different');
    submit();
    expect(screen.getByLabelText('Şifre tekrar')).toHaveFocus();
    expect(screen.getByLabelText('Şifre tekrar')).toHaveAccessibleDescription(
      'Şifreler eşleşmiyor.'
    );
    expect(resetPassword).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Şifre tekrar'), { target: { value: 'new-pass-123' } });
    expect(screen.queryByText('Şifreler eşleşmiyor.')).not.toBeInTheDocument();
  });

  it('asks for confirmation when it is empty', () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('Yeni şifre'), { target: { value: 'new-pass-123' } });
    submit();
    expect(screen.getByLabelText('Şifre tekrar')).toHaveAccessibleDescription(
      'Yeni şifreni tekrar yaz.'
    );
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it('toggles password visibility without clearing values', () => {
    renderPage();
    fillPasswords();
    fireEvent.click(screen.getByRole('button', { name: 'Şifreleri göster' }));
    for (const name of ['Yeni şifre', 'Şifre tekrar']) {
      expect(screen.getByLabelText(name)).toHaveAttribute('type', 'text');
      expect(screen.getByLabelText(name)).toHaveValue('new-pass-123');
    }
    expect(screen.getByRole('button', { name: 'Şifreleri gizle' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Şifreleri gizle' }));
    expect(screen.getByLabelText('Yeni şifre')).toHaveAttribute('type', 'password');
  });

  it('allows only one pending request and replaces the form with a focused success state', async () => {
    let resolve!: (value: { success: boolean; message: string }) => void;
    resetPassword.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      })
    );
    renderPage(`/reset-password?token=%20${TOKEN}%20`);
    fillPasswords();
    const form = screen.getByLabelText('Yeni şifre').closest('form')!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(resetPassword).toHaveBeenCalledTimes(1);
    expect(resetPassword).toHaveBeenCalledWith(TOKEN, 'new-pass-123');
    expect(form).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByLabelText('Yeni şifre')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Şifre kaydediliyor…' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Lütfen bekle.');
    await act(async () => resolve({ success: true, message: 'Şifren güncellendi.' }));
    expect(screen.getByRole('heading', { name: 'Şifren hazır.' })).toHaveFocus();
    expect(screen.queryByLabelText('Yeni şifre')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Şifren güncellendi.');
    expect(screen.getByRole('link', { name: 'Giriş yap' })).toHaveAttribute('href', '/?auth=login');
    fireEvent.click(screen.getByRole('link', { name: 'Giriş yap' }));
    expect(screen.getByText('Giriş ekranı')).toBeInTheDocument();
  });

  it('announces server errors, retains input and lets the user retry', async () => {
    resetPassword.mockRejectedValueOnce(new Error('Bağlantının süresi doldu.'));
    resetPassword.mockResolvedValueOnce({ success: true, message: 'Şifren güncellendi.' });
    renderPage();
    fillPasswords();
    submit();
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Bağlantının süresi doldu.')
    );
    expect(screen.getByLabelText('Yeni şifre')).toHaveValue('new-pass-123');
    expect(screen.getByRole('button', { name: 'Şifreyi güncelle' })).toBeEnabled();
    expect(screen.getByRole('link', { name: /giriş ekranındaki/ })).toHaveAttribute(
      'href',
      '/?auth=login'
    );
    submit();
    await waitFor(() => expect(screen.getByRole('heading')).toHaveTextContent('Şifren hazır.'));
    expect(resetPassword).toHaveBeenCalledTimes(2);
  });

  it('does not show success for an unsuccessful API response', async () => {
    resetPassword.mockResolvedValue({ success: false, message: 'Tekrar dene.' });
    renderPage();
    fillPasswords();
    submit();
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Tekrar dene.'));
    expect(screen.getByLabelText('Yeni şifre')).toBeEnabled();
    expect(screen.queryByText('Şifren hazır.')).not.toBeInTheDocument();
  });

  it('ignores completion of a request for a previously opened recovery link', async () => {
    let resolve!: (value: { success: boolean; message: string }) => void;
    resetPassword.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      })
    );
    renderPage(undefined, true);
    fillPasswords();
    submit();
    fireEvent.click(screen.getByRole('button', { name: 'Başka bağlantı' }));
    expect(screen.getByLabelText('Yeni şifre')).toHaveValue('');
    expect(screen.getByLabelText('Yeni şifre')).toBeEnabled();
    await act(async () => resolve({ success: true, message: 'Eski işlem tamamlandı.' }));
    expect(screen.queryByText('Eski işlem tamamlandı.')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Yeni şifre')).toHaveValue('');
  });
});
