import { useState, useRef, useEffect } from 'react';
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
    <div className="otp-row">
      {Array.from({ length }).map((_, idx) => (
        <input
          key={idx}
          ref={el => inputs.current[idx] = el}
          type="text" inputMode="numeric" maxLength={1}
          value={value[idx] || ''}
          onChange={e => handleChange(e, idx)}
          onKeyDown={e => handleKeyDown(e, idx)}
          onPaste={handlePaste}
          className={`otp-digit${value[idx] ? ' filled' : ''}`}
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

  // Render's free tier spins the backend down after idle periods, and the
  // captcha challenge request is usually the first one to hit it — fire a
  // throwaway wake-up call as soon as this page mounts so the cold start
  // happens in the background while the user is still typing, not when
  // they open the captcha modal.
  useEffect(() => {
    fetch(`${BACKEND_URL}/health`).catch(() => {});
  }, []);

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
            <div className="auth-brand-row">
              <div className="auth-brand-icon">
                <Leaf size={22} color="white" />
              </div>
              <span className="auth-brand-name">{t('appName')}</span>
            </div>
            <h2>{t('otpStepTitleLine1')}</h2>
            <h2 className="auth-subtitle-muted">{t('otpStepTitleLine2')}</h2>
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
          <div className="mw-400 w-full">
            <div className="auth-logo-row">
              <div className="auth-logo-icon">
                <KeyRound size={18} color="white" />
              </div>
              <span className="auth-logo-name">
                {t('appName')}
              </span>
            </div>

            <h1 className="auth-form-title">{t('otpCodeTitle')}</h1>
            <p className="auth-form-sub">
              {t('otpSentToEmail', { email })}
            </p>

            <div className="mb-28">
              <OtpInput length={6} value={otpValue} onChange={setOtpValue} />
            </div>

            {otpError && (
              <div className="alert-box alert-box-center alert-danger mb-16">
                <ShieldAlert size={15} />
                {otpError}
              </div>
            )}

            <button
              id="otp-verify-btn"
              onClick={handleVerifyOtp}
              className="btn btn-primary btn-block-lg mb-14"
              disabled={otpLoading || otpValue.replace(/\D/g,'').length < 6}
            >
              {otpLoading ? (
                <span className="btn-loading-row">
                  <span className="spinner spinner-sm" />
                  {t('otpVerifying')}
                </span>
              ) : t('otpVerifyBtn')}
            </button>

            <div className="otp-resend-row">
              <RefreshCw size={13} />
              {resendCooldown > 0
                ? t('otpResendIn', { seconds: resendCooldown })
                : (
                  <button onClick={handleResendOtp} className="btn-text-link btn-text-bold btn-text-sm">
                    {t('otpResendBtn')}
                  </button>
                )}
            </div>

            <div className="mt-20 text-center">
              <button
                onClick={() => { setOtpRequired(false); setOtpValue(''); setOtpError(''); }}
                className="btn-text-muted btn-text-link-underline"
                style={{ fontSize: '0.8rem' }}
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
          <div className="auth-brand-row">
            <div className="auth-brand-icon">
              <Leaf size={22} color="white" />
            </div>
            <span className="auth-brand-name">
              {t('appName')}
            </span>
          </div>

          <h2>{t('loginTitle')} —</h2>
          <h2 className="auth-subtitle-muted">
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
        <div className="mw-380 w-full">
          <div className="auth-logo-row">
            <div className="auth-logo-icon">
              <Leaf size={18} color="white" />
            </div>
            <span className="auth-logo-name">
              {t('appName')}
            </span>
          </div>

          <h1 className="auth-form-title">{t('loginTitle')}</h1>
          <p className="auth-form-sub">{t('noAccount')}{' '}
            <button
              id="switch-to-register"
              onClick={onNavigateToRegister}
              className="btn-text-link btn-text-bold"
            >
              {t('createFreeAccount')}
            </button>
          </p>

          <form onSubmit={handleSubmit}>
            {/* Email */}
            <div className="form-group">
              <label htmlFor="login-email">{t('emailLabel')}</label>
              <div className="input-icon-wrap">
                <input
                  id="login-email" type="email" placeholder="votre@email.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(''); setNeedsVerification(false); }}
                  className="input-with-leading-icon"
                  required autoComplete="email"
                />
                <Mail size={16} className="input-icon-leading" />
              </div>
            </div>

            {/* Password */}
            <div className="form-group mb-20">
              <div className="flex-between mb-6">
                <label htmlFor="login-password" className="label-inline">{t('passwordLabel')}</label>
                <button
                  type="button"
                  onClick={() => navigate('/forgot-password')}
                  className="btn-text-link btn-text-sm"
                >
                  {t('forgotPageTitle')}
                </button>
              </div>
              <div className="input-icon-wrap">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('passwordPlaceholder')}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  className="input-with-icons"
                  required autoComplete="current-password"
                />
                <Lock size={16} className="input-icon-leading" />
                <button
                  type="button" id="toggle-password"
                  onClick={() => setShowPassword(p => !p)}
                  aria-label={showPassword ? t('hidePasswordLabel') : t('showPasswordLabel')}
                  className="input-icon-trailing-btn"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className={`alert-box mb-16 ${needsVerification ? 'alert-warning' : 'alert-danger'}`}>
                {needsVerification
                  ? <AlertCircle size={15} style={{ marginTop: 1, flexShrink: 0 }} />
                  : <ShieldAlert size={15} style={{ flexShrink: 0 }} />
                }
                <span>
                  {error}
                  {needsVerification && (
                    <>
                      <span className="text-block-sm">{t('checkInboxSpam')}</span>
                      {verificationSent ? (
                        <span className="alert-success-inline">
                          {t('emailResent') || 'Email renvoyé ! Vérifiez votre boîte de réception.'}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={handleResendVerification}
                          disabled={resendingVerification}
                          className="resend-verification-btn"
                          style={{ cursor: resendingVerification ? 'not-allowed' : 'pointer' }}
                        >
                          {resendingVerification ? (
                            <div className="spinner spinner-xs" />
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
              id="login-submit" type="submit" className="btn btn-primary btn-block-lg"
              disabled={loading}
            >
              {loading ? (
                <span className="btn-loading-row">
                  <span className="spinner spinner-sm" />
                  {t('loggingIn')}
                </span>
              ) : t('loginBtn')}
            </button>
          </form>

          <p className="auth-terms-note">
            {t('loginTermsPrefix')}{' '}
            <button
              type="button"
              onClick={() => navigate('/terms')}
              className="btn-text-link btn-text-link-underline"
            >
              {t('termsLinkLabel')}
            </button>
            {t('loginTermsSuffix')}
          </p>

          <div className="auth-divider">{t('appDesc')?.split('•')[0]?.trim() || '—'}</div>

          <div className="auth-switch">
            <p className="dev-tip-box">
              💡 {t('regSuccessDevTip')}
            </p>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
