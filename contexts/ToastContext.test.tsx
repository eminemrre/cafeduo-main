import React from 'react';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import { ToastProvider, useToast } from './ToastContext';
import { suppressExpectedReactError } from '../test-utils/suppressReactError';

// Test component that uses toast
const TestComponent = () => {
  const toast = useToast();
  
  return (
    <div>
      <button onClick={() => toast.success('Başarılı!')}>Success</button>
      <button onClick={() => toast.error('Hata!')}>Error</button>
      <button onClick={() => toast.warning('Uyarı!')}>Warning</button>
      <button onClick={() => toast.loading('Yükleniyor...')}>Loading</button>
      <button onClick={() => toast.success('Kalıcı', 0)}>Persistent</button>
    </div>
  );
};

const renderWithProvider = (component: React.ReactElement) => {
  return render(
    <ToastProvider>
      {component}
    </ToastProvider>
  );
};

class HookErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return <div data-testid="hook-error">{this.state.error.message}</div>;
    }
    return this.props.children;
  }
}

describe('ToastContext', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('renders without crashing', () => {
    renderWithProvider(<TestComponent />);
    expect(screen.getByText('Success')).toBeInTheDocument();
  });

  it('shows success toast', () => {
    renderWithProvider(<TestComponent />);
    
    act(() => {
      screen.getByText('Success').click();
    });

    expect(screen.getByText('Başarılı!')).toBeInTheDocument();
  });

  it('shows error toast', () => {
    renderWithProvider(<TestComponent />);
    
    act(() => {
      screen.getByText('Error').click();
    });

    expect(screen.getByText('Hata!')).toBeInTheDocument();
  });

  it('shows warning toast', () => {
    renderWithProvider(<TestComponent />);
    
    act(() => {
      screen.getByText('Warning').click();
    });

    expect(screen.getByText('Uyarı!')).toBeInTheDocument();
  });

  it('shows loading toast', () => {
    renderWithProvider(<TestComponent />);
    
    act(() => {
      screen.getByText('Loading').click();
    });

    expect(screen.getByText('Yükleniyor...')).toBeInTheDocument();
  });

  it('auto-dismisses toast after duration', async () => {
    renderWithProvider(<TestComponent />);
    
    act(() => {
      screen.getByText('Success').click();
    });

    expect(screen.getByText('Başarılı!')).toBeInTheDocument();

    // Fast forward 3 seconds (default duration)
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    await waitFor(() => {
      expect(screen.queryByText('Başarılı!')).not.toBeInTheDocument();
    });
  });

  it('keeps loading toast until manually dismissed', async () => {
    renderWithProvider(<TestComponent />);
    
    act(() => {
      screen.getByText('Loading').click();
    });

    expect(screen.getByText('Yükleniyor...')).toBeInTheDocument();

    // Fast forward 10 seconds
    act(() => {
      jest.advanceTimersByTime(10000);
    });

    // Loading toast should still be there
    expect(screen.getByText('Yükleniyor...')).toBeInTheDocument();
  });

  it('shows multiple toasts', () => {
    renderWithProvider(<TestComponent />);
    
    act(() => {
      screen.getByText('Success').click();
      screen.getByText('Error').click();
      screen.getByText('Warning').click();
    });

    expect(screen.getByText('Başarılı!')).toBeInTheDocument();
    expect(screen.getByText('Hata!')).toBeInTheDocument();
    expect(screen.getByText('Uyarı!')).toBeInTheDocument();
  });

  it('allows manual dismiss via close button', async () => {
    renderWithProvider(<TestComponent />);
    
    act(() => {
      screen.getByText('Success').click();
    });

    const closeButton = screen.getByTestId('toast-close');
    
    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByText('Başarılı!')).not.toBeInTheDocument();
    });
  });

  it('throws error when useToast is used outside provider', () => {
    const consoleSpy = suppressExpectedReactError();

    const BrokenComponent = () => {
      useToast();
      return null;
    };

    render(
      <HookErrorBoundary>
        <BrokenComponent />
      </HookErrorBoundary>
    );

    expect(screen.getByTestId('hook-error')).toHaveTextContent('useToast must be used within ToastProvider');

    consoleSpy.mockRestore();
  });

  it('error toast has longer duration (4s)', async () => {
    renderWithProvider(<TestComponent />);
    
    act(() => {
      screen.getByText('Error').click();
    });

    expect(screen.getByText('Hata!')).toBeInTheDocument();

    // Fast forward 3 seconds (should still be there)
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(screen.getByText('Hata!')).toBeInTheDocument();

    // Fast forward another 2 seconds (total 5s)
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    await waitFor(() => {
      expect(screen.queryByText('Hata!')).not.toBeInTheDocument();
    });
  });
});
