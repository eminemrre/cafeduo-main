import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthModal } from './AuthModal';

const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();
const mockToastWarning = jest.fn();

// Mock useToast
jest.mock('../contexts/ToastContext', () => ({
  useToast: () => ({
    success: mockToastSuccess,
    error: mockToastError,
    warning: mockToastWarning
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
  const mockLoginUser = {
    id: 1,
    username: 'emin',
    email: 'emin3619@gmail.com',
    points: 0,
    wins: 0,
    gamesPlayed: 0,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders login form by default', () => {
    const { container } = render(
      <AuthModal
        isOpen={true}
        onClose={mockOnClose}
        initialMode="login"
        onLoginSuccess={mockOnLoginSuccess}
      />
    );

    expect(screen.getByText('Giriş Merkezi')).toBeInTheDocument();
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

    expect(screen.getByText('Kayıt Merkezi')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Kullanıcı adı')).toBeInTheDocument();
  });

  it('validates email format', async () => {
    const { container } = render(
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
    const { container } = render(
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

  it('toggles password visibility', () => {
    const { container } = render(
      <AuthModal
        isOpen={true}
        onClose={mockOnClose}
        initialMode="login"
        onLoginSuccess={mockOnLoginSuccess}
      />
    );

    const passwordInput = screen.getByTestId('auth-password-input');
    expect(passwordInput).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByRole('button', { name: 'Şifreyi göster' }));
    expect(passwordInput).toHaveAttribute('type', 'text');

    fireEvent.click(screen.getByRole('button', { name: 'Şifreyi gizle' }));
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('submits login successfully and returns user', async () => {
    const { api } = await import('../lib/api');
    (api.auth.login as jest.Mock).mockResolvedValue(mockLoginUser);

    const { container } = render(
      <AuthModal
        isOpen={true}
        onClose={mockOnClose}
        initialMode="login"
        onLoginSuccess={mockOnLoginSuccess}
      />
    );

    fireEvent.change(screen.getByTestId('auth-email-input'), {
      target: { value: 'emin3619@gmail.com' },
    });
    fireEvent.change(screen.getByTestId('auth-password-input'), {
      target: { value: 'secret123' },
    });

    fireEvent.submit(container.querySelector('form') as HTMLFormElement);

    await waitFor(() => {
      expect(api.auth.login).toHaveBeenCalledWith('emin3619@gmail.com', 'secret123');
      expect(mockOnLoginSuccess).toHaveBeenCalledWith(mockLoginUser);
    });
  });

  it('submits register successfully and returns user', async () => {
    const { api } = await import('../lib/api');
    (api.auth.register as jest.Mock).mockResolvedValue(mockLoginUser);

    const { container } = render(
      <AuthModal
        isOpen={true}
        onClose={mockOnClose}
        initialMode="register"
        onLoginSuccess={mockOnLoginSuccess}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('Kullanıcı adı'), {
      target: { value: 'eminemre' },
    });
    fireEvent.change(screen.getByTestId('auth-email-input'), {
      target: { value: 'emin3619@gmail.com' },
    });
    fireEvent.change(screen.getByTestId('auth-password-input'), {
      target: { value: 'secret123' },
    });

    fireEvent.submit(container.querySelector('form') as HTMLFormElement);

    await waitFor(() => {
      expect(api.auth.register).toHaveBeenCalledWith('eminemre', 'emin3619@gmail.com', 'secret123');
      expect(mockOnLoginSuccess).toHaveBeenCalledWith(mockLoginUser);
    });
  });

  it('shows mapped auth error message on wrong password', async () => {
    const { api } = await import('../lib/api');
    (api.auth.login as jest.Mock).mockRejectedValue({ code: 'auth/wrong-password' });

    const { container } = render(
      <AuthModal
        isOpen={true}
        onClose={mockOnClose}
        initialMode="login"
        onLoginSuccess={mockOnLoginSuccess}
      />
    );

    fireEvent.change(screen.getByTestId('auth-email-input'), {
      target: { value: 'emin3619@gmail.com' },
    });
    fireEvent.change(screen.getByTestId('auth-password-input'), {
      target: { value: 'secret123' },
    });

    fireEvent.submit(container.querySelector('form') as HTMLFormElement);

    await waitFor(() => {
      expect(screen.getByText('E-posta veya şifre hatalı.')).toBeInTheDocument();
      expect(mockToastError).toHaveBeenCalledWith('E-posta veya şifre hatalı.');
    });
  });

  it('blocks submit when form is invalid and shows toast', async () => {
    const { container } = render(
      <AuthModal
        isOpen={true}
        onClose={mockOnClose}
        initialMode="login"
        onLoginSuccess={mockOnLoginSuccess}
      />
    );

    fireEvent.submit(container.querySelector('form') as HTMLFormElement);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Lütfen form hatalarını düzeltin');
      expect(screen.getByText('E-posta adresi gereklidir')).toBeInTheDocument();
      expect(screen.getByText('Şifre gereklidir')).toBeInTheDocument();
    });
  });
});
