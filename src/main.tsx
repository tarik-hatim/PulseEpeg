import React, { Component, ErrorInfo, ReactNode, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class TvBootErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo): void {
    console.warn('PulseEPG Boot ErrorBoundary caught error:', error, errorInfo);
  }

  handleResetAndReload = (): void => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.clear();
      }
    } catch {
      // Ignore storage errors on restricted WebViews
    }
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            backgroundColor: '#0a0e17',
            color: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            textAlign: 'center',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>
            PulseEPG — Mode de récupération Android TV
          </h1>
          <p
            style={{
              fontSize: '14px',
              color: '#94a3b8',
              maxWidth: '480px',
              marginBottom: '18px',
            }}
          >
            {this.state.errorMessage ||
              'Une erreur est survenue lors de l’initialisation du profil.'}
          </p>
          <button
            type="button"
            autoFocus
            onClick={this.handleResetAndReload}
            style={{
              padding: '10px 22px',
              borderRadius: '10px',
              border: '2px solid #ffffff',
              backgroundColor: '#0055ff',
              color: '#ffffff',
              fontSize: '15px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Réinitialiser le profil &amp; Relancer
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

try {
  const isCapacitorOrTvWebView =
    typeof window !== 'undefined' &&
    Boolean(
      (
        window as unknown as {
          Capacitor?: { isNativePlatform?: () => boolean };
        }
      ).Capacitor?.isNativePlatform?.() ||
        window.location.protocol === 'capacitor:' ||
        (window.location.hostname === 'localhost' && !window.location.port) ||
        /\b(Andr0id|Android\s+TV|BRAVIA|AFT|MiBOX|Echolink|Atomo|Leanback)\b/i.test(
          navigator.userAgent || ''
        )
    );

  if (!isCapacitorOrTvWebView && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      try {
        if ('caches' in window) {
          caches
            .keys()
            .then((keys) => {
              for (const key of keys) {
                if (key !== 'pulse-epg-shell-v6') {
                  void caches.delete(key);
                }
              }
            })
            .catch(() => undefined);
        }
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            void registration.update().catch(() => undefined);
          })
          .catch((err) => {
            console.warn(
              'Échec de l’enregistrement du Service Worker PulseEPG:',
              err
            );
          });
      } catch {
        // Ignore Service Worker errors on older WebViews
      }
    });
  }
} catch {
  // Ignore SW detection errors
}

function bootstrapApplication(): void {
  try {
    const rootElement = document.getElementById('root');
    if (!rootElement) return;

    createRoot(rootElement).render(
      <StrictMode>
        <TvBootErrorBoundary>
          <App />
        </TvBootErrorBoundary>
      </StrictMode>
    );
  } catch (err) {
    console.error('Erreur critique au montage React PulseEPG:', err);
  }
}

bootstrapApplication();

