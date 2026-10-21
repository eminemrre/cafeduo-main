import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { isDynamicImportError } from '../lib/chunkLoad';
import { safeGoHome, safeReload } from '../lib/navigation';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      const isChunkError = isDynamicImportError(this.state.error);
      const actionLabel = isChunkError
        ? 'Sayfayı Yeniden Yükle'
        : 'Önbelleği Temizle ve Ana Sayfaya Dön';

      return (
        <div className="duo-scope min-h-screen bg-paper text-carbon flex flex-col items-center justify-center px-5 py-10">
          <div className="w-full max-w-xl bg-paper-deep p-6 sm:p-8">
            <AlertTriangle
              size={28}
              strokeWidth={2.2}
              className="text-candy-danger"
              aria-hidden="true"
            />
            <h1 className="mt-4 font-candy-display text-[2rem] leading-[0.98] text-carbon">
              Uygulama Hatası
            </h1>
            <p className="mt-3 text-[0.9375rem] leading-6 text-carbon-soft">
              Beklenmedik bir hata oluştu. Sayfayı yenilemek çoğu zaman yeter; aşağıdaki ayrıntılar
              destek ekibine yardımcı olur.
            </p>

            <details className="mt-5 bg-paper p-4">
              <summary className="duo-focus cursor-pointer text-[0.9375rem] font-semibold text-carbon">
                Hata ayrıntıları
              </summary>
              <div className="mt-3 max-h-64 overflow-auto custom-scrollbar text-[0.8125rem] text-carbon-soft">
                <p className="font-semibold text-carbon">{this.state.error?.toString()}</p>
                <pre className="mt-2 whitespace-pre-wrap font-candy-mono">
                  {this.state.errorInfo?.componentStack}
                </pre>
              </div>
            </details>

            <button
              type="button"
              onClick={() => {
                if (isChunkError) {
                  safeReload();
                  return;
                }

                localStorage.clear();
                safeGoHome();
              }}
              className="duo-focus mt-6 min-h-12 w-full bg-carbon px-6 text-[0.9375rem] font-semibold text-paper transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
            >
              {actionLabel}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
