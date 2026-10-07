import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in React Component Tree:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-surface-0 text-content-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-surface-1 border border-rose-500/30 rounded-2xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 bg-rose-500/10 text-rose-400 rounded-2xl flex items-center justify-center mx-auto border border-rose-500/20">
              <AlertTriangle size={28} />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-serif font-bold text-content-1">Si è verificato un errore</h2>
              <p className="text-xs text-content-3">
                Un componente dell&apos;applicazione ha riscontrato un problema inaspettato.
              </p>
            </div>
            {this.state.error && (
              <pre className="p-3 bg-surface-0 border border-surface-2 rounded-lg text-left text-[11px] font-mono text-rose-300 overflow-x-auto max-h-32">
                {this.state.error.message || String(this.state.error)}
              </pre>
            )}
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="px-4 py-2 bg-primary hover:bg-primary-hover text-surface-0 text-xs font-mono font-bold rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
              >
                <RefreshCw size={13} />
                <span>Ricarica</span>
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                className="px-4 py-2 bg-surface-2 hover:bg-surface-3 text-content-2 hover:text-content-1 text-xs font-mono rounded-xl border border-surface-3 flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Home size={13} />
                <span>Torna alla Home</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
