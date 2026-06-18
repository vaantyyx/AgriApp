import React, { useState } from 'react';
import { Leaf, Mail, Lock, Eye, EyeOff, ShieldAlert, AlertCircle, Zap, Users, TrendingUp } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';

const BACKEND_URL = 'http://127.0.0.1:3001';

export default function LoginPage({ onLoginSuccess, onNavigateToRegister }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [needsVerification, setNeedsVerification] = useState(false);
  const [loading, setLoading] = useState(false);

  const { t, dir } = useTranslation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError(t('fieldsRequired'));
      return;
    }

    setLoading(true);
    setError('');
    setNeedsVerification(false);

    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.needsVerification) setNeedsVerification(true);
        setError(data.error || t('serverError'));
      } else {
        onLoginSuccess(data.token, data.user);
      }
    } catch {
      setError(t('serverError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page animate-fade-in" dir={dir}>

      {/* Left panel */}
      <div className="auth-left">
        <div className="auth-left-content">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
            <div style={{
              width: 40, height: 40,
              background: 'rgba(255,255,255,0.15)',
              borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Leaf size={22} color="white" />
            </div>
            <span style={{ color: '#fff', fontSize: '1.25rem', fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
              {t('appName')}
            </span>
          </div>

          <h2>{t('loginTitle')} —</h2>
          <h2 style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 400, marginBottom: 16 }}>
            {t('loginPortal')}
          </h2>
          <p>{t('heroSubtitle')}</p>

          <div className="auth-left-feature">
            <div className="auth-left-feature-icon"><Zap size={16} /></div>
            <div>
              <h4>{t('trustRealtime')}</h4>
              <p>{t('stepSocketDesc')?.slice(0, 80)}...</p>
            </div>
          </div>
          <div className="auth-left-feature">
            <div className="auth-left-feature-icon"><Users size={16} /></div>
            <div>
              <h4>{t('trustCommunity')}</h4>
              <p>{t('statDirect')} — {t('statDirectLabel')}</p>
            </div>
          </div>
          <div className="auth-left-feature">
            <div className="auth-left-feature-icon"><TrendingUp size={16} /></div>
            <div>
              <h4>{t('trustGrowth')}</h4>
              <p>{t('statProducts')} {t('statProductsLabel')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="auth-right">
        <div style={{ maxWidth: 380, width: '100%' }}>
          <div className="auth-logo-row" style={{ display: dir === 'rtl' ? 'flex' : 'flex' }}>
            <div style={{
              width: 36, height: 36,
              background: 'var(--primary)',
              borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Leaf size={18} color="white" />
            </div>
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.1rem', color: 'var(--primary)' }}>
              {t('appName')}
            </span>
          </div>

          <h1 className="auth-form-title">{t('loginTitle')}</h1>
          <p className="auth-form-sub">{t('noAccount')}{' '}
            <button
              id="switch-to-register"
              onClick={onNavigateToRegister}
              style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer', fontSize: 'inherit', fontFamily: 'inherit', padding: 0 }}
            >
              {t('createFreeAccount')}
            </button>
          </p>

          <form onSubmit={handleSubmit}>
            {/* Email */}
            <div className="form-group">
              <label htmlFor="login-email">{t('emailLabel')}</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="login-email"
                  type="email"
                  placeholder="votre@email.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(''); setNeedsVerification(false); }}
                  style={{
                    paddingInlineStart: '42px',
                    textAlign: 'start',
                  }}
                  required
                  autoComplete="email"
                />
                <Mail size={16} style={{
                  position: 'absolute',
                  insetInlineStart: 14,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-faint)',
                  pointerEvents: 'none',
                }} />
              </div>
            </div>

            {/* Password */}
            <div className="form-group" style={{ marginBottom: 22 }}>
              <label htmlFor="login-password">{t('passwordLabel')}</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('passwordPlaceholder')}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  style={{
                    paddingInlineStart: '42px',
                    paddingInlineEnd: '42px',
                    textAlign: 'start',
                  }}
                  required
                  autoComplete="current-password"
                />
                <Lock size={16} style={{
                  position: 'absolute',
                  insetInlineStart: 14,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-faint)',
                  pointerEvents: 'none',
                }} />
                <button
                  type="button"
                  id="toggle-password"
                  onClick={() => setShowPassword(p => !p)}
                  style={{
                    position: 'absolute',
                    insetInlineEnd: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: 4,
                    display: 'flex',
                  }}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                borderRadius: 8,
                padding: '10px 14px',
                fontSize: '0.875rem',
                marginBottom: 18,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                textAlign: 'start',
                ...(needsVerification
                  ? { color: '#92400e', background: 'var(--warning-soft)', border: '1px solid rgba(245,158,11,0.25)' }
                  : { color: '#9b1c1c', background: 'var(--danger-soft)', border: '1px solid rgba(229,62,62,0.25)' })
              }}>
                {needsVerification
                  ? <AlertCircle size={15} style={{ marginTop: 1, flexShrink: 0 }} />
                  : <ShieldAlert size={15} style={{ flexShrink: 0 }} />
                }
                <span>
                  {error}
                  {needsVerification && (
                    <span style={{ display: 'block', marginTop: 3, fontSize: '0.8rem', opacity: 0.8 }}>
                      {t('checkInboxSpam')}
                    </span>
                  )}
                </span>
              </div>
            )}

            <button
              id="login-submit"
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px', fontSize: '0.95rem' }}
              disabled={loading}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <span style={{
                    width: 15, height: 15,
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: 'white',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                  }} />
                  {t('loggingIn')}
                </span>
              ) : t('loginBtn')}
            </button>
          </form>

          <div className="auth-divider">{t('appDesc')?.split('•')[0]?.trim() || '—'}</div>

          <div className="auth-switch">
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', background: 'var(--bg-section)', borderRadius: 8, padding: '10px 12px' }}>
              💡 {t('regSuccessDevTip')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
