import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthModal } from './AuthModal';

// Mock useToast
jest.mock('../contexts/ToastContext', () => ({
  useToast: () => ({
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn()
  })
}));

// Mock api
jest.mock('../lib/api', () => ({
  api: {
    auth: {
      login: jest.fn(),
      register: jest.fn()
    }
  }
}));

describe('AuthModal', () => {
  const mockOnClose = jest.fn();
  const mockOnLoginSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders login form by default', () => {
    render(
      <AuthModal
        isOpen={true}
        onClose={mockOnClose}
        initialMode="login"
        onLoginSuccess={mockOnLoginSuccess}
      />
    );

    expect(screen.getByText('GIRIS_YAP.EXE')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('E-posta')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Şifre')).toBeInTheDocument();
  });

  it('renders register form when mode is register', () => {
    render(
      <AuthModal
        isOpen={true}
        onClose={mockOnClose}
        initialMode="register"
        onLoginSuccess={mockOnLoginSuccess}
      />
    );

    expect(screen.getByText('KAYIT_OL.EXE')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Kullanıcı Adı')).toBeInTheDocument();
  });

  it('validates email format', async () => {
    render(
      <AuthModal
        isOpen={true}
        onClose={mockOnClose}
        initialMode="login"
        onLoginSuccess={mockOnLoginSuccess}
      />
    );

    const emailInput = screen.getByPlaceholderText('E-posta');
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    fireEvent.blur(emailInput);

    await waitFor(() => {
      expect(screen.getByText('Geçerli bir e-posta adresi girin')).toBeInTheDocument();
    });
  });

  it('validates password minimum length', async () => {
    render(
      <AuthModal
        isOpen={true}
        onClose={mockOnClose}
        initialMode="login"
        onLoginSuccess={mockOnLoginSuccess}
      />
    );

    const passwordInput = screen.getByPlaceholderText('Şifre');
    fireEvent.change(passwordInput, { target: { value: '123' } });
    fireEvent.blur(passwordInput);

    await waitFor(() => {
      expect(screen.getByText('Şifre en az 6 karakter olmalıdır')).toBeInTheDocument();
    });
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <AuthModal
        isOpen={false}
        onClose={mockOnClose}
        initialMode="login"
        onLoginSuccess={mockOnLoginSuccess}
      />
    );

    expect(container.firstChild).toBeNull();
  });
});
