import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';
import { safeGoHome, safeReload } from '../lib/navigation';

jest.mock('../lib/navigation', () => ({
  safeGoHome: jest.fn(),
  safeReload: jest.fn(),
}));

const Crash: React.FC = () => {
  throw new Error('boom');
};

const ChunkCrash: React.FC = () => {
  throw new TypeError('error loading dynamically imported module: /assets/CafeDashboard.js');
};

describe('ErrorBoundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <div>safe-content</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('safe-content')).toBeInTheDocument();
  });

  it('renders fallback UI when child throws', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <Crash />
      </ErrorBoundary>
    );

    expect(screen.getByText('Uygulama Hatası')).toBeInTheDocument();
    expect(screen.getByText(/Error: boom/)).toBeInTheDocument();
    consoleSpy.mockRestore();
  });

  it('clears storage on recovery button click', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const clearSpy = jest.spyOn(window.localStorage, 'clear');

    render(
      <ErrorBoundary>
        <Crash />
      </ErrorBoundary>
    );

    fireEvent.click(screen.getByText('Önbelleği Temizle ve Ana Sayfaya Dön'));
    expect(clearSpy).toHaveBeenCalledTimes(1);
    expect(safeGoHome).toHaveBeenCalledTimes(1);
    expect(safeReload).not.toHaveBeenCalled();

    clearSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it('reloads page instead of clearing session on chunk-load error', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const clearSpy = jest.spyOn(window.localStorage, 'clear');

    render(
      <ErrorBoundary>
        <ChunkCrash />
      </ErrorBoundary>
    );

    fireEvent.click(screen.getByText('Sayfayı Yeniden Yükle'));
    expect(safeReload).toHaveBeenCalledTimes(1);
    expect(safeGoHome).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();

    clearSpy.mockRestore();
    consoleSpy.mockRestore();
  });
});
