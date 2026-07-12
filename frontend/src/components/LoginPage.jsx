import React, { useState, useRef } from 'react';
import { Leaf, Mail, Lock, Eye, EyeOff, ShieldAlert, AlertCircle, Zap, Users, TrendingUp, ShieldCheck, RefreshCw, KeyRound } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { BACKEND_URL } from '../utils/config.js';
import CaptchaGrid from './CaptchaGrid';
import SiteNavbar from './SiteNavbar';

// ─── OTP Input ──────────────────────────────────────────────────────────────
function OtpInput({ length = 6, value, onChange }) {
  const inputs = useRef([]);

  const handleChange = (e, idx) => {
    const ch = e.target.value.replace(/\D/, '').slice(-1);
    const arr = value.split('');
    arr[idx] = ch;
    const next = arr.join('');
    onChange(next);
    if (ch && idx < length - 1) inputs.current[idx + 1]?.focus();
  };

  const handleKeyDown = (e, idx) => {
    if (e.key === 'Backspace' && !value[idx] && idx > 0) {
      inputs.current[idx - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    onChange(pasted.padEnd(length, '').slice(0, length));
  };

  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
      {Array.from({ length }).map((_, idx) => (
        <input
          key={idx}
          ref={el => inputs.current[idx] = el}
          type="text" inputMode="numeric" maxLength={1}
          value={value[idx] || ''}
          onChange={e => handleChange(e, idx)}
          onKeyDown={e => handleKeyDown(e, idx)}
          onPaste={handlePaste}
          style={{
            width: 46, height: 52, borderRadius: 10, textAlign: 'center',
            fontSize: '1.4rem', fontWeight: 800, letterSpacing: 0,
            background: 'var(--bg-input)', border: `2px solid ${value[idx] ? 'var(--primary)' : 'var(--border)'}`,
            color: 'var(--text-main)', outline: 'none',
            transition: 'border-color 0.2s ease',
          }}
        />
      ))}
    </div>
  );
}

export default function LoginPage({ onLoginSuccess, onNavigateToRegister }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [needsVerification, setNeedsVerification] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // 2FA / OTP state
  const [resendingVerification, setResendingVerification] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [otpRequired, setOtpRequired] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef(null);
  const captchaRef = useRef(null);

  const { t, dir, locale } = useTranslation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) { setError(t('fieldsRequired')); return; }
    const captchaChallengeId = captchaRef.current?.getToken();
    if (!captchaChallengeId) { setError(t('captchaRequired')); return; }

    setLoading(true);
    setError('');
    setNeedsVerification(false);
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password, captchaChallengeId, locale }),
      });
      // The token is single-use and gets consumed server-side on this call
      // regardless of outcome below, so the badge must go back to unverified.
      captchaRef.current?.reset();
      const data = await res.json();
      if (!res.ok) {
        if (data.needsVerification) setNeedsVerification(true);
        setError(data.error || t('serverError'));
      } else if (data.status === 'OTP_REQUIRED') {
        // 2FA required — show OTP step
        setOtpRequired(true);
        startCooldown(60);
      } else {
        onLoginSuccess(data.token, data.user);
      }
    } catch {
      setError(t('serverError'));
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setResendingVerification(true);
    setVerificationSent(false);
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), locale }),
      });
      const data = await res.json();
      if (res.ok) {
        setVerificationSent(true);
      } else {
        setError(data.error || t('serverError'));
      }
    } catch {
      setError(t('serverError'));
    } finally {
      setResendingVerification(false);
    }
  };

  const startCooldown = (seconds) => {
    setResendCooldown(seconds);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) { clearInterval(cooldownRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    try {
      await fetch(`${BACKEND_URL}/api/auth/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: email.trim(), locale }),
      });
      startCooldown(60);
      setOtpError('');
    } catch {
      setOtpError(t('serverError'));
    }
  };

  const handleVerifyOtp = async () => {
    if (otpValue.replace(/\D/g, '').length < 6) { setOtpError(t('otpEnterFullCode')); return; }
    setOtpLoading(true);
    setOtpError('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: email.trim(), otp: otpValue }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOtpError(data.error || t('serverError'));
      } else {
        onLoginSuccess(data.token, data.user);
      }
    } catch {
      setOtpError(t('serverError'));
    } finally {
      setOtpLoading(false);
    }
  };

  // ── OTP screen ──────────────────────────────────────────────────────────
  if (otpRequired) {
    return (
      <>
      <SiteNavbar />
      <div className="auth-page animate-fade-in" dir={dir}>
        <div className="auth-left">
          <div className="auth-left-content">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
              <div style={{ width: 40, height: 40, background: 'rgba(255,255,255,0.15)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Leaf size={22} color="white" />
              </div>
              <span style={{ color: '#fff', fontSize: '1.25rem', fontWeight: 800, fontFamily: 'var(--font-heading)' }}>{t('appName')}</span>
            </div>
            <h2>{t('otpStepTitleLine1')}</h2>
            <h2 style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 400, marginBottom: 16 }}>{t('otpStepTitleLine2')}</h2>
            <p>{t('otpStepIntro')}</p>
            <div className="auth-left-feature">
              <div className="auth-left-feature-icon"><ShieldCheck size={16} /></div>
              <div>
                <h4>{t('otpDoubleSecurityTitle')}</h4>
                <p>{t('otpDoubleSecurityDesc')}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="auth-right">
          <div style={{ maxWidth: 400, width: '100%' }}>
            <div className="auth-logo-row">
              <div style={{ width: 36, height: 36, background: 'var(--primary)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <KeyRound size={18} color="white" />
              </div>
              <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.1rem', color: 'var(--primary)' }}>
                {t('appName')}
              </span>
            </div>

            <h1 className="auth-form-title">{t('otpCodeTitle')}</h1>
            <p className="auth-form-sub">
              {t('otpSentToEmail', { email })}
            </p>

            <div style={{ marginBottom: 28 }}>
              <OtpInput length={6} value={otpValue} onChange={setOtpValue} />
            </div>

            {otpError && (
              <div style={{
                borderRadius: 8, padding: '10px 14px', fontSize: '0.875rem', marginBottom: 16,
                display: 'flex', alignItems: 'center', gap: 8,
                color: '#9b1c1c', background: 'var(--danger-soft)', border: '1px solid rgba(229,62,62,0.25)',
              }}>
                <ShieldAlert size={15} />
                {otpError}
              </div>
            )}

            <button
              id="otp-verify-btn"
              onClick={handleVerifyOtp}
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px', fontSize: '0.95rem', marginBottom: 14 }}
              disabled={otpLoading || otpValue.replace(/\D/g,'').length < 6}
            >
              {otpLoading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <span style={{ width: 15, height: 15, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  {t('otpVerifying')}
                </span>
              ) : t('otpVerifyBtn')}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              <RefreshCw size={13} />
              {resendCooldown > 0
                ? t('otpResendIn', { seconds: resendCooldown })
                : (
                  <button onClick={handleResendOtp} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', padding: 0 }}>
                    {t('otpResendBtn')}
                  </button>
                )}
            </div>

            <div style={{ marginTop: 20, textAlign: 'center' }}>
              <button
                onClick={() => { setOtpRequired(false); setOtpValue(''); setOtpError(''); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline' }}
              >
                {t('otpBackToLogin')}
              </button>
            </div>
          </div>
        </div>
      </div>
      </>
    );
  }

  // ── Normal login screen ──────────────────────────────────────────────────
  return (
    <>
    <SiteNavbar />
    <div className="auth-page animate-fade-in" dir={dir}>

      {/* Left panel */}
      <div className="auth-left">
        <div className="auth-left-content">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
            <div style={{ width: 40, height: 40, background: 'rgba(255,255,255,0.15)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
            <div style={{ width: 36, height: 36, background: 'var(--primary)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                  id="login-email" type="email" placeholder="votre@email.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(''); setNeedsVerification(false); }}
                  style={{ paddingInlineStart: '42px', textAlign: 'start' }}
                  required autoComplete="email"
                />
                <Mail size={16} style={{ position: 'absolute', insetInlineStart: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)', pointerEvents: 'none' }} />
              </div>
            </div>

            {/* Password */}
            <div className="form-group" style={{ marginBottom: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label htmlFor="login-password" style={{ marginBottom: 0 }}>{t('passwordLabel')}</label>
                <button
                  type="button"
                  onClick={() => navigate('/forgot-password')}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.85rem', cursor: 'pointer', padding: 0 }}
                >
                  Mot de passe oublié ?
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('passwordPlaceholder')}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  style={{ paddingInlineStart: '42px', paddingInlineEnd: '42px', textAlign: 'start' }}
                  required autoComplete="current-password"
                />
                <Lock size={16} style={{ position: 'absolute', insetInlineStart: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)', pointerEvents: 'none' }} />
                <button
                  type="button" id="toggle-password"
                  onClick={() => setShowPassword(p => !p)}
                  aria-label={showPassword ? t('hidePasswordLabel') : t('showPasswordLabel')}
                  style={{ position: 'absolute', insetInlineEnd: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, display: 'flex' }}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                borderRadius: 8, padding: '10px 14px', fontSize: '0.875rem', marginBottom: 18,
                display: 'flex', alignItems: 'flex-start', gap: 8, textAlign: 'start',
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
                    <>
                      <span style={{ display: 'block', marginTop: 3, fontSize: '0.8rem', opacity: 0.8 }}>{t('checkInboxSpam')}</span>
                      {verificationSent ? (
                        <span style={{ display: 'block', marginTop: 8, fontSize: '0.8rem', color: '#10b981' }}>
                          {t('emailResent') || 'Email renvoyé ! Vérifiez votre boîte de réception.'}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={handleResendVerification}
                          disabled={resendingVerification}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10,
                            padding: '6px 14px', fontSize: '0.8rem', fontWeight: 600,
                            background: 'rgba(245,158,11,0.15)', color: '#d97706',
                            border: '1px solid rgba(245,158,11,0.3)', borderRadius: '6px',
                            cursor: resendingVerification ? 'not-allowed' : 'pointer',
                            transition: 'all 0.3s ease',
                          }}
                        >
                          {resendingVerification ? (
                            <div style={{ width: '12px', height: '12px', border: '2px solid rgba(217,119,6,0.3)', borderTopColor: '#d97706', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                          ) : null}
                          {t('resendEmail') || 'Renvoyer l\'email d\'activation'}
                        </button>
                      )}
                    </>
                  )}
                </span>
              </div>
            )}

            <CaptchaGrid ref={captchaRef} />

            <button
              id="login-submit" type="submit" className="btn btn-primary"
              style={{ width: '100%', padding: '12px', fontSize: '0.95rem' }}
              disabled={loading}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <span style={{ width: 15, height: 15, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  {t('loggingIn')}
                </span>
              ) : t('loginBtn')}
            </button>
          </form>

          <p style={{ fontSize: '0.78rem', color: 'var(--text-faint)', textAlign: 'center', marginTop: 16 }}>
            En vous connectant, vous acceptez nos{' '}
            <button
              type="button"
              onClick={() => navigate('/terms')}
              style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: 'inherit', fontFamily: 'inherit', padding: 0, textDecoration: 'underline' }}
            >
              Conditions Générales d'Utilisation
            </button>
            .
          </p>

          <div className="auth-divider">{t('appDesc')?.split('•')[0]?.trim() || '—'}</div>

          <div className="auth-switch">
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', background: 'var(--bg-section)', borderRadius: 8, padding: '10px 12px' }}>
              💡 {t('regSuccessDevTip')}
            </p>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
