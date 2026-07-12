import React from 'react';

const FALLBACK_TEXT = {
  fr: {
    title: 'Une erreur est survenue',
    body: "Quelque chose s'est mal passé. Essayez de recharger la page.",
    reload: 'Recharger la page',
  },
  en: {
    title: 'Something went wrong',
    body: 'An unexpected error occurred. Try reloading the page.',
    reload: 'Reload page',
  },
  ar: {
    title: 'حدث خطأ ما',
    body: 'حدث خطأ غير متوقع. حاول إعادة تحميل الصفحة.',
    reload: 'إعادة تحميل الصفحة',
  },
};

function getLocale() {
  try {
    const stored = localStorage.getItem('sougra_lang');
    return FALLBACK_TEXT[stored] ? stored : 'ar';
  } catch {
    return 'ar';
  }
}

/**
 * Class component required by React for componentDidCatch — no hook
 * equivalent exists. Kept self-sufficient (no context dependency) since it
 * wraps the providers and must still render if one of them throws.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Uncaught error:', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const locale = getLocale();
    const dir = locale === 'ar' ? 'rtl' : 'ltr';
    const t = FALLBACK_TEXT[locale];

    return (
      <div dir={dir} style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', textAlign: 'center',
        padding: 32, background: '#0b0f12', color: '#f3f4f6',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 12 }}>{t.title}</h1>
        <p style={{ color: '#9ca3af', marginBottom: 24, maxWidth: 420 }}>{t.body}</p>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '12px 28px', borderRadius: 10, border: 'none',
            background: '#10b981', color: 'white', fontWeight: 700,
            fontSize: '0.95rem', cursor: 'pointer',
          }}
        >
          {t.reload}
        </button>
      </div>
    );
  }
}
