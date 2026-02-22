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
        errorInfo: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ errorInfo });
    }

    public render() {
        if (this.state.hasError) {
            const isChunkError = isDynamicImportError(this.state.error);
            const actionLabel = isChunkError
                ? 'Sayfayı Yeniden Yükle'
                : 'Önbelleği Temizle ve Ana Sayfaya Dön';

            return (
                <div className="min-h-screen rf-page-shell noise-bg text-white flex flex-col items-center justify-center p-4">
                    <div className="rf-screen-card max-w-2xl w-full p-6 sm:p-8">
                        <div className="rf-terminal-strip mb-3">Sistem TR-X // Hata Yakalandı</div>
                        <div className="flex items-center gap-4 mb-6">
                            <div className="p-3 bg-red-600/90 border border-red-300/60">
                                <AlertTriangle size={32} className="text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-red-300 uppercase tracking-[0.08em]">Uygulama Hatası</h1>
                                <p className="text-[var(--rf-muted)]">Beklenmedik bir hata oluştu.</p>
                            </div>
                        </div>

                        <div className="bg-black/50 p-4 font-mono text-sm text-red-300 overflow-auto max-h-64 mb-6 border border-red-900/30 custom-scrollbar">
                            <p className="font-bold mb-2">{this.state.error?.toString()}</p>
                            <pre className="whitespace-pre-wrap text-xs opacity-70">
                                {this.state.errorInfo?.componentStack}
                            </pre>
                        </div>

                        <button
                            onClick={() => {
                                if (isChunkError) {
                                    safeReload();
                                    return;
                                }

                                localStorage.clear();
                                safeGoHome();
                            }}
                            className="bg-red-600 hover:bg-red-500 text-white px-6 py-3 font-medium transition-colors w-full uppercase tracking-[0.08em] border border-red-300/45"
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
