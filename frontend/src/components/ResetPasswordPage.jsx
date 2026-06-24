import React, { useState, useEffect } from 'react';
import { Leaf, Lock, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const BACKEND_URL = 'http://127.0.0.1:3001';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState('');
  
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setError('Jeton de réinitialisation manquant. Veuillez utiliser le lien fourni dans votre e-mail.');
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) return;

    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    setError('');
    setMessage(null);

    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || 'Une erreur est survenue.');
      } else {
        setMessage(data.message || 'Votre mot de passe a été réinitialisé avec succès.');
        setPassword('');
        setConfirmPassword('');
      }
    } catch {
      setError('Erreur de connexion au serveur.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page animate-fade-in">
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

          <h1 className="auth-form-title">Nouveau mot de passe</h1>
          <p className="auth-form-sub" style={{ marginBottom: 25 }}>
            Créez un nouveau mot de passe sécurisé pour votre compte.
          </p>

          {message ? (
            <div style={{
              borderRadius: 8, padding: '15px', fontSize: '0.9rem', marginBottom: 25,
              display: 'flex', alignItems: 'flex-start', gap: 10,
              color: '#047857', background: 'var(--success-soft)', border: '1px solid rgba(16,185,129,0.25)'
            }}>
              <CheckCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <span style={{ display: 'block', marginBottom: 10 }}>{message}</span>
                <button
                  onClick={() => navigate('/login')}
                  className="btn btn-primary btn-sm"
                >
                  Se connecter
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label>Nouveau mot de passe</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Au moins 8 caractères"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(''); }}
                    style={{ paddingLeft: '42px', paddingRight: '42px', width: '100%' }}
                    required
                    disabled={!token}
                  />
                  <Lock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)', pointerEvents: 'none' }} />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, display: 'flex' }}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 25 }}>
                <label>Confirmer le mot de passe</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Répétez le mot de passe"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                    style={{ paddingLeft: '42px', paddingRight: '42px', width: '100%' }}
                    required
                    disabled={!token}
                  />
                  <Lock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)', pointerEvents: 'none' }} />
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
                disabled={loading || !token}
              >
                {loading ? 'Réinitialisation...' : 'Réinitialiser le mot de passe'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
