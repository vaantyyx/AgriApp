import React, { useState } from 'react';
import { Sprout, User, Tractor, ShoppingBag } from 'lucide-react';

export default function RoleSelection({ onSelect }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState(''); // 'buyer' or 'producer'
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Veuillez entrer votre nom ou le nom de votre entreprise.');
      return;
    }
    if (!role) {
      setError('Veuillez sélectionner un rôle.');
      return;
    }
    onSelect({ name: name.trim(), role });
  };

  return (
    <div className="flex align-center justify-between" style={{ minHeight: '80vh', justifyContent: 'center' }}>
      <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '480px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ 
            display: 'inline-flex', 
            padding: '16px', 
            borderRadius: '50%', 
            background: 'var(--primary-glow)', 
            color: 'var(--primary)',
            marginBottom: '16px' 
          }}>
            <Sprout size={36} />
          </div>
          <h2 style={{ fontSize: '2rem', marginBottom: '8px' }}>Sougra</h2>
          <p style={{ color: 'var(--text-muted)' }}>Achat et vente directe de récoltes agricoles</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name-input">Nom / Entreprise</label>
            <div style={{ position: 'relative' }}>
              <input
                id="name-input"
                type="text"
                placeholder="Ex: Ferme des Plaines ou Biocoop"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError('');
                }}
                style={{ width: '100%', paddingLeft: '44px' }}
              />
              <User size={18} style={{ 
                position: 'absolute', 
                left: '14px', 
                top: '50%', 
                transform: 'translateY(-50%)', 
                color: 'var(--text-muted)' 
              }} />
            </div>
          </div>

          <label style={{ display: 'block', marginBottom: '10px' }}>Votre rôle</label>
          <div className="grid-2" style={{ marginBottom: '24px' }}>
            <button
              type="button"
              className={`btn ${role === 'buyer' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => {
                setRole('buyer');
                setError('');
              }}
              style={{ 
                height: '100px', 
                flexDirection: 'column', 
                gap: '12px',
                borderColor: role === 'buyer' ? 'var(--primary)' : 'var(--border)'
              }}
            >
              <ShoppingBag size={24} />
              <span style={{ fontSize: '0.9rem' }}>Acheteur</span>
            </button>

            <button
              type="button"
              className={`btn ${role === 'producer' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => {
                setRole('producer');
                setError('');
              }}
              style={{ 
                height: '100px', 
                flexDirection: 'column', 
                gap: '12px',
                borderColor: role === 'producer' ? 'var(--primary)' : 'var(--border)'
              }}
            >
              <Tractor size={24} />
              <span style={{ fontSize: '0.9rem' }}>Producteur</span>
            </button>
          </div>

          {error && (
            <div style={{ 
              color: 'var(--danger)', 
              background: 'rgba(239, 68, 68, 0.1)', 
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '8px',
              padding: '10px 14px',
              fontSize: '0.875rem',
              marginBottom: '20px'
            }}>
              {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '14px' }}>
            Accéder à l'application
          </button>
        </form>
      </div>
    </div>
  );
}
