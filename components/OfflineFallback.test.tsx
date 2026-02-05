import { render, screen, fireEvent } from '@testing-library/react';
import OfflineFallback, { OfflineBanner, useOnlineStatus } from './OfflineFallback';

describe('OfflineFallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders offline message', () => {
    render(<OfflineFallback />);
    
    expect(screen.getByText('İnternet Bağlantısı Yok')).toBeInTheDocument();
    expect(screen.getByText(/şu anda çevrimdışısınız/i)).toBeInTheDocument();
  });

  it('renders feature cards', () => {
    render(<OfflineFallback />);
    
    expect(screen.getByText('Oyunlar Çevrimdışı')).toBeInTheDocument();
    expect(screen.getByText('Kafe Bilgileri')).toBeInTheDocument();
  });

  it('retry button is clickable', () => {
    render(<OfflineFallback />);
    
    const retryButton = screen.getByRole('button', { name: /yeniden dene/i });
    expect(() => fireEvent.click(retryButton)).not.toThrow();
  });

  it('shows PWA status text', () => {
    render(<OfflineFallback />);
    
    expect(screen.getByText(/çevrimdışı mod aktif/i)).toBeInTheDocument();
    expect(screen.getByText(/cafeduo pwa/i)).toBeInTheDocument();
  });
});

describe('OfflineBanner', () => {
  it('renders banner with offline message', () => {
    render(<OfflineBanner />);
    
    expect(screen.getByText('Çevrimdışı modu aktif')).toBeInTheDocument();
  });
});

describe('useOnlineStatus', () => {
  it('returns navigator.onLine status', () => {
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
    });
    
    expect(useOnlineStatus()).toBe(true);
  });
});
