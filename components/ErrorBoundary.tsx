import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

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
            return (
                <div className="min-h-screen bg-[#0f141a] text-white flex flex-col items-center justify-center p-4">
                    <div className="bg-red-900/20 border border-red-500/50 p-8 rounded-xl max-w-2xl w-full">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="p-3 bg-red-600 rounded-full">
                                <AlertTriangle size={32} className="text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-red-400">Uygulama Hatası</h1>
                                <p className="text-gray-400">Beklenmedik bir hata oluştu.</p>
                            </div>
                        </div>

                        <div className="bg-black/50 p-4 rounded-lg font-mono text-sm text-red-300 overflow-auto max-h-64 mb-6 border border-red-900/30">
                            <p className="font-bold mb-2">{this.state.error?.toString()}</p>
                            <pre className="whitespace-pre-wrap text-xs opacity-70">
                                {this.state.errorInfo?.componentStack}
                            </pre>
                        </div>

                        <button
                            onClick={() => {
                                localStorage.clear();
                                window.location.href = '/';
                            }}
                            className="bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-lg font-medium transition-colors w-full"
                        >
                            Önbelleği Temizle ve Ana Sayfaya Dön
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
