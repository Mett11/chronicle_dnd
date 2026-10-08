import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
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
    console.error('Uncaught error in ErrorBoundary:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="min-h-screen bg-surface-0 text-content-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-surface-1 border border-surface-2 p-6 rounded-2xl space-y-4 text-center">
            <h2 className="text-lg font-bold text-error">Qualcosa è andato storto</h2>
            <p className="text-xs text-content-3">
              Si è verificato un errore imprevisto nell'interfaccia.
            </p>
            {this.state.error && (
              <div className="text-left bg-surface-2/60 border border-border-default/40 rounded-lg p-3 text-[11px] font-mono text-content-2 overflow-x-auto max-h-32">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.reload();
                }}
                className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-semibold cursor-pointer hover:bg-primary-hover transition-colors"
              >
                Ricarica Pagina
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    localStorage.removeItem('chronicle_current_campaign');
                  } catch {}
                  this.setState({ hasError: false, error: null });
                  window.location.href = window.location.pathname;
                }}
                className="px-4 py-2 bg-surface-2 text-content-1 rounded-xl text-xs font-semibold cursor-pointer hover:bg-surface-3 transition-colors border border-border-default"
              >
                Torna al Portale
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
