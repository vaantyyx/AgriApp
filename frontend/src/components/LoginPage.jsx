import React, { useState } from 'react';
import { Sprout, Mail, Lock, User, Tractor, ShoppingBag, ShieldAlert } from 'lucide-react';

const MOCK_USERS = [
  { email: 'acheteur@agri.dz', password: 'password123', name: 'Coopérative Centrale Agro', role: 'buyer' },
  { email: 'ferme.mitidja@agri.dz', password: 'producer123', name: 'Ferme de la Mitidja', role: 'producer' },
  { email: 'agri.sud@agri.dz', password: 'producer123', name: 'Agro Sud Biskra', role: 'producer' },
  { email: 'colline.kabylie@agri.dz', password: 'producer123', name: 'Vergers de la Kabylie', role: 'producer' }
];

export default function LoginPage({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Veuillez renseigner tous les champs.');
      return;
    }

    const matchedUser = MOCK_USERS.find(
      u => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === password
    );

    if (matchedUser) {
      setError('');
      onLoginSuccess({
        email: matchedUser.email,
        name: matchedUser.name,
        role: matchedUser.role
      });
    } else {
      setError('Email ou mot de passe incorrect.');
    }
  };

  const handleAutofill = (user) => {
    setEmail(user.email);
    setPassword(user.password);
    setError('');
  };

  return (
    <div className="flex align-center justify-between" style={{ minHeight: '80vh', justifyContent: 'center', flexWrap: 'wrap', gap: '32px', padding: '0 16px' }}>
      
      {/* Login Box */}
      <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '440px' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ 
            display: 'inline-flex', 
            padding: '12px', 
            borderRadius: '50%', 
            background: 'var(--primary-glow)', 
            color: 'var(--primary)',
            marginBottom: '12px' 
          }}>
            <Sprout size={28} />
          </div>
          <h2 style={{ fontSize: '1.75rem', marginBottom: '6px' }}>Connexion sécurisée</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Portail AgriEnchères</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Adresse Email</label>
            <div style={{ position: 'relative' }}>
              <input
                id="email"
                type="email"
                placeholder="Ex: acheteur@agri.dz"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError('');
                }}
                style={{ width: '100%', paddingLeft: '44px' }}
                required
              />
              <Mail size={18} style={{ 
                position: 'absolute', 
                left: '14px', 
                top: '50%', 
                transform: 'translateY(-50%)', 
                color: 'var(--text-muted)' 
              }} />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label htmlFor="password">Mot de passe</label>
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                type="password"
                placeholder="Entrez votre mot de passe"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                style={{ width: '100%', paddingLeft: '44px' }}
                required
              />
              <Lock size={18} style={{ 
                position: 'absolute', 
                left: '14px', 
                top: '50%', 
                transform: 'translateY(-50%)', 
                color: 'var(--text-muted)' 
              }} />
            </div>
          </div>

          {error && (
            <div style={{ 
              color: 'var(--danger)', 
              background: 'rgba(239, 68, 68, 0.1)', 
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '8px',
              padding: '10px 14px',
              fontSize: '0.875rem',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <ShieldAlert size={16} />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '14px' }}>
            Se connecter
          </button>
        </form>
      </div>

      {/* Mock Credentials Helper Box */}
      <div className="glass-panel animate-fade-in credentials-box" style={{ width: '100%', maxWidth: '440px', marginTop: 0 }}>
        <h3 className="credentials-title">
          <ShieldAlert size={18} />
          Identifiants de test (Sans base de données)
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px', lineHeight: '1.4' }}>
          Sélectionnez un profil ci-dessous pour remplir automatiquement les champs de connexion :
        </p>

        <div className="credentials-list">
          {MOCK_USERS.map((u, i) => (
            <div key={i} className="credential-item">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600' }}>
                  {u.role === 'buyer' ? (
                    <ShoppingBag size={13} style={{ color: 'var(--primary)' }} />
                  ) : (
                    <Tractor size={13} style={{ color: 'var(--accent)' }} />
                  )}
                  <span>{u.name}</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                    ({u.role === 'buyer' ? 'Acheteur' : 'Producteur'})
                  </span>
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '2px' }}>
                  Email: {u.email} | Mdp: {u.password}
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => handleAutofill(u)}
                className="btn btn-secondary credential-click-to-copy"
                style={{ padding: '4px 8px', fontSize: '0.75rem', textDecoration: 'none', background: 'rgba(255,255,255,0.05)' }}
              >
                Utiliser
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
