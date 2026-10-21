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

  handleSimpleReload = (): void => {
    window.location.reload();
  };

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
      const isArabic = typeof document !== 'undefined' && document.documentElement.dir === 'rtl';
      return (
        <div
          dir={isArabic ? 'rtl' : 'ltr'}
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
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              marginBottom: '16px',
            }}
          >
            ⚠️
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>
            {isArabic ? 'حدث خطأ غير متوقع في التطبيق' : 'Une interruption inattendue est survenue'}
          </h1>
          <p
            style={{
              fontSize: '13px',
              color: '#94a3b8',
              maxWidth: '480px',
              marginBottom: '20px',
              lineHeight: 1.5,
            }}
          >
            {isArabic
              ? 'نعتذر عن هذا العطل المؤقت. يمكنك إعادة تحميل التطبيق بأمان لمواصلة التصفح، أو إعادة الضبط إن استمرت المشكلة.'
              : 'Nous vous prions de nous excuser pour ce contretemps. Rechargez l’application pour reprendre votre session, ou réinitialisez si le problème persiste.'}
          </p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              type="button"
              autoFocus
              onClick={this.handleSimpleReload}
              style={{
                padding: '10px 24px',
                borderRadius: '12px',
                border: 'none',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 0 16px rgba(37,99,235,0.4)',
              }}
            >
              {isArabic ? 'إعادة تحميل التطبيق' : 'Recharger l’application'}
            </button>
            <button
              type="button"
              onClick={this.handleResetAndReload}
              style={{
                padding: '10px 18px',
                borderRadius: '12px',
                border: '1px solid #334155',
                backgroundColor: '#141a26',
                color: '#cbd5e1',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {isArabic ? 'إعادة الضبط والبدء' : 'Réinitialiser & Relancer'}
            </button>
          </div>
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

