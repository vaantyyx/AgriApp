import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Loader, Sprout } from 'lucide-react';

const BACKEND_URL = 'http://127.0.0.1:3001';

export default function VerifyEmailPage({ onNavigateToLogin }) {
  const [status, setStatus] = useState('loading'); // 'loading' | 'success' | 'error'
  const [message, setMessage] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (!token) {
      setStatus('error');
      setMessage('Lien de vérification invalide ou incomplet.');
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
          setMessage(data.message || 'Email confirmé avec succès !');
        }
      })
      .catch(() => {
        setStatus('error');
        setMessage('Impossible de se connecter au serveur.');
      });
  }, []);

  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px' }}>
      <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '460px', textAlign: 'center' }}>
        {/* Logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
          <div style={{ padding: '12px', borderRadius: '50%', background: 'var(--primary-glow)', color: 'var(--primary)' }}>
            <Sprout size={28} />
          </div>
        </div>

        {status === 'loading' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
              <Loader size={48} style={{ color: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
            </div>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '12px' }}>Vérification en cours…</h2>
            <p style={{ color: 'var(--text-muted)' }}>Validation de votre adresse email, veuillez patienter.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{ display: 'inline-flex', padding: '16px', borderRadius: '50%', background: 'rgba(16,185,129,0.15)', marginBottom: '20px' }}>
              <CheckCircle size={48} style={{ color: 'var(--primary)' }} />
            </div>
            <h2 style={{ fontSize: '1.6rem', marginBottom: '12px' }}>Email confirmé ! 🎉</h2>
            <p style={{ color: 'var(--text-muted)', lineHeight: '1.7', marginBottom: '32px' }}>
              {message}<br />Votre compte est maintenant actif. Vous pouvez vous connecter.
            </p>
            <button onClick={onNavigateToLogin} className="btn btn-primary" style={{ width: '100%', padding: '14px', fontSize: '1rem' }}>
              Se connecter maintenant
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ display: 'inline-flex', padding: '16px', borderRadius: '50%', background: 'rgba(239,68,68,0.15)', marginBottom: '20px' }}>
              <XCircle size={48} style={{ color: 'var(--danger)' }} />
            </div>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '12px' }}>Échec de la vérification</h2>
            <p style={{ color: 'var(--text-muted)', lineHeight: '1.7', marginBottom: '32px' }}>
              {message}
            </p>
            <button onClick={onNavigateToLogin} className="btn btn-secondary" style={{ width: '100%', padding: '12px' }}>
              Retour à la connexion
            </button>
          </>
        )}
      </div>
    </div>
  );
}
