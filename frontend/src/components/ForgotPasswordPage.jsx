import React, { useState } from 'react';
import { Leaf, Mail, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BACKEND_URL } from '../utils/config.js';
import { useTranslation } from '../context/LanguageContext';

export default function ForgotPasswordPage() {
  const { t, dir, locale } = useTranslation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError(t('forgotEmailRequired'));
      return;
    }

    setLoading(true);
    setError('');
    setMessage(null);

    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), locale }),
      });
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || t('resetGenericError'));
      } else {
        setMessage(data.message || t('forgotSuccessMessage'));
        setEmail('');
      }
    } catch {
      setError(t('serverError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page animate-fade-in" dir={dir}>
      <div className="auth-right" style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ maxWidth: 400, width: '100%', padding: '20px' }}>
          <div className="auth-logo-row" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{ width: 36, height: 36, background: 'var(--primary)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Leaf size={18} color="white" />
            </div>
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.1rem', color: 'var(--primary)' }}>
              Sougra
            </span>
          </div>

          <h1 className="auth-form-title">{t('forgotPageTitle')}</h1>
          <p className="auth-form-sub" style={{ marginBottom: 25 }}>
            {t('forgotPageSub')}
          </p>

          {message ? (
            <div style={{
              borderRadius: 8, padding: '15px', fontSize: '0.9rem', marginBottom: 25,
              display: 'flex', alignItems: 'flex-start', gap: 10,
              color: '#047857', background: 'var(--success-soft)', border: '1px solid rgba(16,185,129,0.25)'
            }}>
              <CheckCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{message}</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label htmlFor="reset-email">{t('emailLabel')}</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="reset-email" type="email" placeholder="votre@email.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(''); }}
                    style={{ paddingLeft: '42px', width: '100%' }}
                    required autoFocus
                  />
                  <Mail size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)', pointerEvents: 'none' }} />
                </div>
              </div>

              {error && (
                <div style={{
                  borderRadius: 8, padding: '10px 14px', fontSize: '0.875rem', marginBottom: 20,
                  display: 'flex', alignItems: 'center', gap: 8,
                  color: '#9b1c1c', background: 'var(--danger-soft)', border: '1px solid rgba(229,62,62,0.25)'
                }}>
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit" className="btn btn-primary"
                style={{ width: '100%', padding: '12px', fontSize: '0.95rem' }}
                disabled={loading}
              >
                {loading ? t('forgotSending') : t('forgotSendBtn')}
              </button>
            </form>
          )}

          <div style={{ marginTop: 25, textAlign: 'center' }}>
            <button
              onClick={() => navigate('/login')}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, width: '100%' }}
            >
              <ArrowLeft size={14} /> {t('verifErrorBtn')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
