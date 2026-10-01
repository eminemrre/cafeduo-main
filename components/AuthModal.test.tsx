import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthModal } from './AuthModal';

// AuthModal uses AnimatePresence to conditionally mount content.
// Replace with a transparent wrapper so fireEvent.blur triggers properly.
jest.mock('framer-motion', () => {
  // Match real motion's stable component identities so re-renders retain focus.
  const components = new Map<string, React.ComponentType<any>>();
  return {
    motion: new Proxy(
      {},
      {
        get: (_target, tag: string) => {
          if (!components.has(tag)) {
            components.set(
              tag,
              React.forwardRef(({ children, ...props }: any, ref: any) => {
                const {
                  initial: _i,
                  animate: _a,
                  exit: _e,
                  transition: _t,
                  variants: _v,
                  whileHover: _wh,
                  whileTap: _wt,
                  ...rest
                } = props;
                return React.createElement(tag, { ...rest, ref }, children);
              })
            );
          }
          return components.get(tag);
        },
      }
    ),
    AnimatePresence: ({ children }: any) => <>{children}</>,
    useReducedMotion: () => false,
  };
});

const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();
const mockToastWarning = jest.fn();

// Mock useToast
jest.mock('../contexts/ToastContext', () => ({
  useToast: () => ({
    success: mockToastSuccess,
    error: mockToastError,
    warning: mockToastWarning,
  }),
}));

// Mock api
jest.mock('../lib/api', () => ({
  api: {
    auth: {
      login: jest.fn(),
      register: jest.fn(),
      forgotPassword: jest.fn(),
    },
  },
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
    // Cookie consent gate: AuthModal blocks submission unless consent is
    // accepted. Default to 'accepted' so tests can exercise the auth
    // flow; individual tests can override per-test if needed.
    (window.localStorage.getItem as jest.Mock).mockImplementation((key: string) =>
      key === 'cookie_consent' ? 'accepted' : null
    );
  });

  it('keeps keyboard focus inside the dialog, closes with Escape, and returns focus', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    const props = {
      isOpen: true,
      onClose: mockOnClose,
      initialMode: 'login' as const,
      onLoginSuccess: mockOnLoginSuccess,
    };
    const { rerender } = render(<AuthModal {...props} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveFocus();
    expect(document.body.style.overflow).toBe('hidden');
    const close = screen.getByRole('button', { name: 'Kapat' });
    close.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).not.toBe(close);
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(close).toHaveFocus();
    trigger.focus();
    expect(dialog).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(mockOnClose).toHaveBeenCalledTimes(1);
    rerender(<AuthModal {...props} isOpen={false} />);
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).not.toBe('hidden');
    trigger.remove();
  });

  it('allows keyboard access to the separate cookie-consent portal', () => {
    render(
      <>
        <AuthModal
          isOpen={true}
          onClose={mockOnClose}
          initialMode="login"
          onLoginSuccess={mockOnLoginSuccess}
        />
        <section aria-label="Çerez bildirimi">
          <button>Consent choice</button>
        </section>
      </>
    );
    const consent = screen.getByRole('button', { name: 'Consent choice' });
    consent.focus();
    expect(consent).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(screen.getByRole('button', { name: 'Kapat' })).toHaveFocus();
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

    expect(screen.getByRole('heading', { name: 'Giriş Yap' })).toBeInTheDocument();
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

    expect(screen.getByRole('heading', { name: 'Kayıt Ol' })).toBeInTheDocument();
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

    // Submit the form with an invalid email to trigger full validation
    // (validateForm sets all touched fields and shows all errors at once)
    fireEvent.change(screen.getByTestId('auth-email-input'), {
      target: { value: 'invalid-email' },
    });
    fireEvent.submit(container.querySelector('form') as HTMLFormElement);

    await waitFor(() => {
      const errors = container.querySelectorAll('p');
      const found = Array.from(errors).some((p) =>
        (p.textContent ?? '').includes('Geçerli bir e-posta adresi girin')
      );
      expect(found).toBe(true);
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

    // Fill in a valid email but a short password, then submit to trigger validation
    fireEvent.change(screen.getByTestId('auth-email-input'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByTestId('auth-password-input'), {
      target: { value: '123' },
    });
    fireEvent.submit(container.querySelector('form') as HTMLFormElement);

    await waitFor(() => {
      const errors = container.querySelectorAll('p');
      const found = Array.from(errors).some((p) =>
        (p.textContent ?? '').includes('Şifre en az 6 karakter olmalıdır')
      );
      expect(found).toBe(true);
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

  it('toggles password visibility', async () => {
    render(
      <AuthModal
        isOpen={true}
        onClose={mockOnClose}
        initialMode="login"
        onLoginSuccess={mockOnLoginSuccess}
      />
    );

    expect(screen.getByTestId('auth-password-input')).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByRole('button', { name: 'Şifreyi göster' }));
    await waitFor(() => {
      expect(screen.getByTestId('auth-password-input')).toHaveAttribute('type', 'text');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Şifreyi gizle' }));
    await waitFor(() => {
      expect(screen.getByTestId('auth-password-input')).toHaveAttribute('type', 'password');
    });
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

  describe('forgot-password flow', () => {
    it('shows "Şifremi unuttum" link in login mode', () => {
      render(
        <AuthModal
          isOpen={true}
          onClose={mockOnClose}
          initialMode="login"
          onLoginSuccess={mockOnLoginSuccess}
        />
      );

      expect(screen.getByText('Şifremi unuttum')).toBeInTheDocument();
    });

    it('clicking the link switches to forgot-password form', () => {
      render(
        <AuthModal
          isOpen={true}
          onClose={mockOnClose}
          initialMode="login"
          onLoginSuccess={mockOnLoginSuccess}
        />
      );

      fireEvent.click(screen.getByText('Şifremi unuttum'));

      expect(screen.getByRole('heading', { name: 'Şifremi Unuttum' })).toBeInTheDocument();
      expect(screen.queryByPlaceholderText('Şifre')).not.toBeInTheDocument();
    });

    it('submits forgot-password flow and shows success message', async () => {
      const { api } = await import('../lib/api');
      (api.auth.forgotPassword as jest.Mock).mockResolvedValue({
        success: true,
        message: 'Sıfırlama bağlantısı gönderildi.',
      });

      const { container } = render(
        <AuthModal
          isOpen={true}
          onClose={mockOnClose}
          initialMode="login"
          onLoginSuccess={mockOnLoginSuccess}
        />
      );

      fireEvent.click(screen.getByText('Şifremi unuttum'));
      fireEvent.change(screen.getByTestId('auth-email-input'), {
        target: { value: 'emin3619@gmail.com' },
      });
      fireEvent.submit(container.querySelector('form') as HTMLFormElement);

      await waitFor(() => {
        expect(api.auth.forgotPassword).toHaveBeenCalledWith('emin3619@gmail.com');
        expect(screen.getByText('Sıfırlama bağlantısı gönderildi.')).toBeInTheDocument();
      });
    });

    it('"geri dön" link returns to login form', () => {
      render(
        <AuthModal
          isOpen={true}
          onClose={mockOnClose}
          initialMode="login"
          onLoginSuccess={mockOnLoginSuccess}
        />
      );

      fireEvent.click(screen.getByText('Şifremi unuttum'));
      expect(screen.getByRole('heading', { name: 'Şifremi Unuttum' })).toBeInTheDocument();

      fireEvent.click(screen.getByText('Giriş ekranına dön'));
      expect(screen.getByRole('heading', { name: 'Giriş Yap' })).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Şifre')).toBeInTheDocument();
    });
  });
});
