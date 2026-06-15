import React, { useState } from 'react';
import { Sprout, Mail, Lock, Eye, EyeOff, ShieldAlert, AlertCircle } from 'lucide-react';

const BACKEND_URL = 'http://127.0.0.1:3001';

export default function LoginPage({ onLoginSuccess, onNavigateToRegister }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [needsVerification, setNeedsVerification] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Veuillez renseigner tous les champs.');
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
        if (data.needsVerification) {
          setNeedsVerification(true);
        }
        setError(data.error || 'Erreur de connexion.');
      } else {
        onLoginSuccess(data.token, data.user);
      }
    } catch {
      setError('Impossible de se connecter au serveur. Le backend est-il lancé ?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px' }}>
      <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '440px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ display: 'inline-flex', padding: '12px', borderRadius: '50%', background: 'var(--primary-glow)', color: 'var(--primary)', marginBottom: '12px' }}>
            <Sprout size={28} />
          </div>
          <h2 style={{ fontSize: '1.75rem', marginBottom: '6px' }}>Connexion</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Portail AgriEnchères</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="login-email">Adresse Email</label>
            <div style={{ position: 'relative' }}>
              <input
                id="login-email"
                type="email"
                placeholder="votre@email.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); setNeedsVerification(false); }}
                style={{ width: '100%', paddingLeft: '44px' }}
                required
                autoComplete="email"
              />
              <Mail size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label htmlFor="login-password">Mot de passe</label>
            <div style={{ position: 'relative' }}>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Entrez votre mot de passe"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                style={{ width: '100%', paddingLeft: '44px', paddingRight: '44px' }}
                required
                autoComplete="current-password"
              />
              <Lock size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Error Messages */}
          {error && (
            <div style={{ borderRadius: '8px', padding: '10px 14px', fontSize: '0.875rem', marginBottom: '20px', display: 'flex', alignItems: 'flex-start', gap: '8px', ...(needsVerification ? { color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)' } : { color: 'var(--danger)', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }) }}>
              {needsVerification ? <AlertCircle size={16} style={{ marginTop: '1px', flexShrink: 0 }} /> : <ShieldAlert size={16} style={{ flexShrink: 0 }} />}
              <span>
                {error}
                {needsVerification && (
                  <span style={{ display: 'block', marginTop: '4px', fontSize: '0.8rem', opacity: 0.8 }}>
                    Vérifiez votre boîte email (et vos spams).
                  </span>
                )}
              </span>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '14px' }}
            disabled={loading}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                Connexion…
              </span>
            ) : 'Se connecter'}
          </button>
        </form>

        {/* Register link */}
        <div style={{ marginTop: '24px', textAlign: 'center', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
            Pas encore de compte ?{' '}
            <button
              onClick={onNavigateToRegister}
              style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: '700', cursor: 'pointer', fontSize: '0.9rem' }}
            >
              Créer un compte gratuit
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
