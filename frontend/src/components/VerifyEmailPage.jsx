import React, { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Loader, Leaf } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';

const BACKEND_URL = 'http://127.0.0.1:3001';

export default function VerifyEmailPage({ onNavigateToLogin }) {
  const { t, dir } = useTranslation();
  const [status, setStatus] = useState('loading'); // 'loading' | 'success' | 'error'
  const [message, setMessage] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (!token) {
      setStatus('error');
      setMessage(t('verifErrorTitle'));
      return;
    }

    fetch(`${BACKEND_URL}/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setStatus('error');
          setMessage(data.error);
        } else {
          setStatus('success');
          setMessage(data.message || t('verifSuccessSub'));
        }
      })
      .catch(() => {
        setStatus('error');
        setMessage(t('serverError'));
      });
  }, [t]);

  return (
    <div className="verify-page animate-fade-in" dir={dir}>
      <div className="verify-card">

        {/* Logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <div style={{
            width: 52, height: 52,
            background: 'linear-gradient(135deg, var(--primary), var(--primary-light))',
            borderRadius: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Leaf size={26} color="white" />
          </div>
        </div>

        <div style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '1.25rem',
          fontWeight: 800,
          color: 'var(--primary)',
          marginBottom: 28,
        }}>
          {t('appName')}
        </div>

        {status === 'loading' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <Loader size={44} style={{ color: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
            </div>
            <h2 style={{ fontSize: '1.4rem', marginBottom: 10 }}>{t('verifLoading')}</h2>
            <p style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>{t('verifLoadingSub')}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{
              display: 'inline-flex',
              padding: 16,
              borderRadius: '50%',
              background: 'var(--success-soft)',
              marginBottom: 20,
            }}>
              <CheckCircle2 size={44} style={{ color: 'var(--success)' }} />
            </div>
            <h2 style={{ fontSize: '1.5rem', marginBottom: 10 }}>{t('verifSuccessTitle')}</h2>
            <p style={{ color: 'var(--text-muted)', lineHeight: 1.65, marginBottom: 28 }}>
              {message}
            </p>
            <button
              id="verify-login-btn"
              onClick={onNavigateToLogin}
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px' }}
            >
              {t('verifSuccessBtn')}
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{
              display: 'inline-flex',
              padding: 16,
              borderRadius: '50%',
              background: 'var(--danger-soft)',
              marginBottom: 20,
            }}>
              <XCircle size={44} style={{ color: 'var(--danger)' }} />
            </div>
            <h2 style={{ fontSize: '1.4rem', marginBottom: 10 }}>{t('verifErrorTitle')}</h2>
            <p style={{ color: 'var(--text-muted)', lineHeight: 1.65, marginBottom: 28 }}>
              {message}
            </p>
            <button
              id="verify-back-btn"
              onClick={onNavigateToLogin}
              className="btn btn-secondary"
              style={{ width: '100%', padding: '12px' }}
            >
              {t('verifErrorBtn')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
