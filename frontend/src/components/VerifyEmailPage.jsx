import React, { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Loader, Leaf, Mail, RefreshCw } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';
import { BACKEND_URL } from '../utils/config.js';

export default function VerifyEmailPage({ onNavigateToLogin }) {
  const { t, dir, locale } = useTranslation();
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');
  const [resendEmail, setResendEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [resendDone, setResendDone] = useState(false);

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

  const handleResend = async () => {
    if (!resendEmail.trim()) return;
    setResending(true);
    setResendDone(false);
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resendEmail.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setResendDone(true);
        setMessage(locale === 'ar' ? 'تم إرسال البريد! تحقق من صندوق الوارد الخاص بك.' : 'Email renvoyé ! Vérifiez votre boîte de réception.');
      } else {
        setMessage(data.error || t('serverError'));
      }
    } catch {
      setMessage(t('serverError'));
    } finally {
      setResending(false);
    }
  };

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

            {/* Resend email form */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 8, color: 'var(--text-muted)' }}>
                {locale === 'ar' ? 'أدخل بريدك الإلكتروني لإعادة إرسال رابط التفعيل' : 'Entrez votre email pour recevoir un nouveau lien'}
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="email"
                  value={resendEmail}
                  onChange={e => setResendEmail(e.target.value)}
                  placeholder={t('emailPlaceholder')}
                  style={{
                    flex: 1, padding: '10px 12px', borderRadius: '8px',
                    border: '1px solid var(--border)', background: 'var(--bg-input)',
                    color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none',
                  }}
                />
                <button
                  onClick={handleResend}
                  disabled={resending || !resendEmail.trim()}
                  style={{
                    padding: '10px 16px', borderRadius: '8px',
                    background: 'var(--primary)', color: 'white', border: 'none',
                    fontWeight: 600, fontSize: '0.85rem', cursor: resending || !resendEmail.trim() ? 'not-allowed' : 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 6, opacity: resending || !resendEmail.trim() ? 0.6 : 1,
                  }}
                >
                  {resending ? (
                    <div style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  ) : <RefreshCw size={14} />}
                  {t('resendEmail') || 'Renvoyer'}
                </button>
              </div>
              {resendDone && (
                <p style={{ marginTop: 8, fontSize: '0.8rem', color: '#10b981' }}>
                  {locale === 'ar' ? 'تم الإرسال! تحقق من بريدك الإلكتروني.' : 'Email renvoyé ! Vérifiez votre boîte de réception.'}
                </p>
              )}
            </div>

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
