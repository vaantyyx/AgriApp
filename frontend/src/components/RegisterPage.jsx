import React, { useState, useEffect, useRef } from 'react';
import { Sprout, Mail, Lock, User, Tractor, ShoppingBag, ShieldAlert, Eye, EyeOff, CheckCircle, Phone, MapPin } from 'lucide-react';

const BACKEND_URL = 'http://127.0.0.1:3001';

// Custom Searchable Dropdown component for a premium experience
function SearchableSelect({ options, value, onChange, placeholder, disabled, labelKey = 'label', valueKey = 'value' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) setSearch('');
  }, [isOpen]);

  const selectedOption = options.find(opt => String(opt[valueKey]) === String(value));
  const filteredOptions = options.filter(opt =>
    String(opt[labelKey]).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          padding: '12px 14px',
          background: 'var(--bg-input)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          color: selectedOption ? 'var(--text-main)' : 'var(--text-muted)',
          fontSize: '0.95rem',
          outline: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          textAlign: 'left',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <span>{selectedOption ? selectedOption[labelKey] : placeholder}</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>▼</span>
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          left: 0,
          right: 0,
          zIndex: 1000,
          background: 'var(--bg-panel)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
          maxHeight: '260px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          backdropFilter: 'blur(20px)',
        }}>
          <div style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>
            <input
              type="text"
              placeholder="Rechercher..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
              style={{
                width: '100%',
                padding: '8px 10px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                color: 'var(--text-main)',
                fontSize: '0.9rem',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filteredOptions.length === 0 ? (
              <div style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center' }}>
                Aucun résultat
              </div>
            ) : (
              filteredOptions.map(opt => {
                const isSelected = String(opt[valueKey]) === String(value);
                return (
                  <button
                    key={opt[valueKey]}
                    type="button"
                    onClick={() => {
                      onChange(opt[valueKey]);
                      setIsOpen(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: isSelected ? 'var(--primary-glow)' : 'transparent',
                      border: 'none',
                      color: isSelected ? 'var(--primary)' : 'var(--text-main)',
                      fontSize: '0.9rem',
                      textAlign: 'left',
                      cursor: 'pointer',
                      outline: 'none',
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={e => {
                      if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                    }}
                    onMouseLeave={e => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    {opt[labelKey]}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function RegisterPage({ onNavigateToLogin }) {
  const [form, setForm] = useState({
    name: '', email: '', password: '', confirmPassword: '',
    role: '', phone: '', wilaya: '', commune: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const [wilayas, setWilayas] = useState([]);
  const [allCommunes, setAllCommunes] = useState([]);
  const [communes, setCommunes] = useState([]);

  // Load cities.json from public folder
  useEffect(() => {
    fetch('/cities.json')
      .then(r => r.json())
      .then(data => {
        setWilayas(data.wilayas || []);
        setAllCommunes(data.communes || []);
      })
      .catch(() => console.warn('[CITIES] Impossible de charger les communes.'));
  }, []);

  // Filter communes when wilaya changes
  useEffect(() => {
    if (!form.wilaya) {
      setCommunes([]);
      setForm(prev => ({ ...prev, commune: '' }));
      return;
    }
    const id = parseInt(form.wilaya);
    const filtered = allCommunes
      .filter(c => c.wilaya_id === id)
      .sort((a, b) => a.commune_name_latin.localeCompare(b.commune_name_latin));
    setCommunes(filtered);
    setForm(prev => ({ ...prev, commune: '' }));
  }, [form.wilaya, allCommunes]);

  const handleChange = (field) => (val) => {
    // If it's a standard event target
    const value = val && val.target ? val.target.value : val;
    setForm(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const validatePassword = (pwd) => {
    if (pwd.length < 8) return 'Le mot de passe doit contenir au moins 8 caractères.';
    return null;
  };

  const validatePhone = (phone) => {
    if (!phone) return null;
    const digits = phone.replace(/\s/g, '');
    if (!/^[0-9]{9,10}$/.test(digits)) return 'Numéro de téléphone invalide (9-10 chiffres sans le préfixe).';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { name, email, password, confirmPassword, role, phone, wilaya, commune } = form;

    if (!name || !email || !password || !confirmPassword || !role) {
      setError('Les champs Nom, Email, Mot de passe et Rôle sont obligatoires.');
      return;
    }

    const pwdError = validatePassword(password);
    if (pwdError) { setError(pwdError); return; }
    if (password !== confirmPassword) { setError('Les mots de passe ne correspondent pas.'); return; }

    const phoneError = validatePhone(phone);
    if (phoneError) { setError(phoneError); return; }

    setLoading(true);
    try {
      const fullPhone = phone
        ? `+213${phone.replace(/^0/, '').replace(/\s/g, '')}`
        : '';

      const selectedWilaya = wilayas.find(w => w.wilaya_id === parseInt(wilaya));
      const selectedCommune = communes.find(c => c.commune_id === parseInt(commune));

      const res = await fetch(`${BACKEND_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          role,
          phone: fullPhone,
          wilaya: selectedWilaya ? selectedWilaya.wilaya_name_latin : '',
          commune: selectedCommune ? selectedCommune.commune_name_latin : '',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Une erreur est survenue.');
      } else {
        setSuccess(true);
      }
    } catch {
      setError('Impossible de se connecter au serveur.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px' }}>
        <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '480px', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', padding: '20px', borderRadius: '50%', background: 'rgba(16,185,129,0.15)', marginBottom: '24px' }}>
            <CheckCircle size={48} style={{ color: 'var(--primary)' }} />
          </div>
          <h2 style={{ fontSize: '1.75rem', marginBottom: '12px' }}>Compte créé avec succès</h2>
          <p style={{ color: 'var(--text-muted)', lineHeight: '1.7', marginBottom: '8px' }}>
            Un e-mail de confirmation a été envoyé à <strong style={{ color: 'var(--text-main)' }}>{form.email}</strong>.
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.6', marginBottom: '32px' }}>
            Veuillez cliquer sur le lien dans l'e-mail pour activer votre compte. Pensez à vérifier vos courriers indésirables.
          </p>
          <div style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '10px', padding: '14px', marginBottom: '28px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            💡 Le lien de confirmation s'affiche également dans la console du serveur backend.
          </div>
          <button onClick={onNavigateToLogin} className="btn btn-primary" style={{ width: '100%', padding: '14px' }}>
            Accéder à la connexion
          </button>
        </div>
      </div>
    );
  }

  // Map wilayas list to dropdown format
  const wilayaOptions = wilayas.map(w => ({
    value: w.wilaya_id,
    label: `${String(w.wilaya_id).padStart(2, '0')} - ${w.wilaya_name_latin}`,
  }));

  // Map communes list to dropdown format
  const communeOptions = communes.map(c => ({
    value: c.commune_id,
    label: c.commune_name_latin,
  }));

  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 16px' }}>
      <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '560px' }}>

        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ display: 'inline-flex', padding: '12px', borderRadius: '50%', background: 'var(--primary-glow)', color: 'var(--primary)', marginBottom: '12px' }}>
            <Sprout size={28} />
          </div>
          <h2 style={{ fontSize: '1.75rem', marginBottom: '6px' }}>Créer un compte</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Rejoignez la plateforme AgriEnchères</p>
        </div>

        <form onSubmit={handleSubmit}>

          {/* Role Selection */}
          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label>Type de compte</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {[
                { value: 'buyer', label: 'Acheteur', icon: <ShoppingBag size={20} />, desc: 'Je recherche des produits agricoles' },
                { value: 'producer', label: 'Producteur', icon: <Tractor size={20} />, desc: 'Je propose mes récoltes' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { setForm(prev => ({ ...prev, role: opt.value })); setError(''); }}
                  style={{
                    padding: '16px', borderRadius: '10px', border: '2px solid',
                    borderColor: form.role === opt.value ? 'var(--primary)' : 'var(--border)',
                    background: form.role === opt.value ? 'var(--primary-glow)' : 'var(--bg-input)',
                    color: 'var(--text-main)', cursor: 'pointer', textAlign: 'left',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ color: form.role === opt.value ? 'var(--primary)' : 'var(--text-muted)', marginBottom: '6px' }}>{opt.icon}</div>
                  <div style={{ fontWeight: '700', fontSize: '0.95rem' }}>{opt.label}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div className="form-group">
            <label htmlFor="reg-name">Nom complet / Dénomination</label>
            <div style={{ position: 'relative' }}>
              <input id="reg-name" type="text" placeholder="Ex : Coopérative Agricole El Harrach"
                value={form.name} onChange={handleChange('name')}
                style={{ width: '100%', paddingLeft: '44px' }} required />
              <User size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>
          </div>

          {/* Email */}
          <div className="form-group">
            <label htmlFor="reg-email">Adresse e-mail</label>
            <div style={{ position: 'relative' }}>
              <input id="reg-email" type="email" placeholder="Ex : contact@cooperative.dz"
                value={form.email} onChange={handleChange('email')}
                style={{ width: '100%', paddingLeft: '44px' }} required />
              <Mail size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>
          </div>

          {/* Phone */}
          <div className="form-group">
            <label htmlFor="reg-phone">Numéro de téléphone <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.8rem' }}>(optionnel)</span></label>
            <div style={{ display: 'flex', gap: '0', alignItems: 'stretch' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '0 14px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--border)',
                borderRight: 'none',
                borderRadius: '8px 0 0 8px',
                whiteSpace: 'nowrap',
                color: 'var(--text-muted)',
                fontSize: '0.9rem',
                minWidth: '90px',
              }}>
                <svg width="22" height="16" viewBox="0 0 22 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '2px', flexShrink: 0 }}>
                  <rect width="11" height="16" fill="#006233"/>
                  <rect x="11" width="11" height="16" fill="white"/>
                  <path d="M13.5 8C13.5 9.65685 12.1569 11 10.5 11C8.84315 11 7.5 9.65685 7.5 8C7.5 6.34315 8.84315 5 10.5 5C12.1569 5 13.5 6.34315 13.5 8Z" fill="#D21034"/>
                  <path d="M12 8C12 9.10457 11.1046 10 10 10C8.89543 10 8 9.10457 8 8C8 6.89543 8.89543 6 10 6C11.1046 6 12 6.89543 12 8Z" fill="white"/>
                  <path d="M12.5 6.5L13.5 8L12.5 9L13.8 8.5L13.8 7.5L12.5 6.5Z" fill="#D21034"/>
                </svg>
                <span>+213</span>
              </div>
              <input
                id="reg-phone"
                type="tel"
                placeholder="06 12 34 56 78"
                value={form.phone}
                onChange={handleChange('phone')}
                style={{
                  flex: 1,
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border)',
                  borderLeft: 'none',
                  borderRadius: '0 8px 8px 0',
                  padding: '12px 14px',
                  color: 'var(--text-main)',
                  fontSize: '0.95rem',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Wilaya + Commune side by side with searchable select dropdowns */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            {/* Wilaya */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Wilaya <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.8rem' }}>(optionnel)</span></label>
              <SearchableSelect
                options={wilayaOptions}
                value={form.wilaya}
                onChange={handleChange('wilaya')}
                placeholder="Sélectionner..."
              />
            </div>

            {/* Commune */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Commune <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.8rem' }}>(optionnel)</span></label>
              <SearchableSelect
                options={communeOptions}
                value={form.commune}
                onChange={handleChange('commune')}
                placeholder={form.wilaya ? "Sélectionner..." : "Wilaya d'abord"}
                disabled={communes.length === 0}
              />
            </div>
          </div>

          {/* Password */}
          <div className="form-group">
            <label htmlFor="reg-password">
              Mot de passe <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none', fontSize: '0.8rem' }}>(minimum 8 caractères)</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input id="reg-password" type={showPassword ? 'text' : 'password'}
                placeholder="Choisissez un mot de passe sécurisé"
                value={form.password} onChange={handleChange('password')}
                style={{ width: '100%', paddingLeft: '44px', paddingRight: '44px' }} required />
              <Lock size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <button type="button" onClick={() => setShowPassword(p => !p)}
                style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {form.password && (
              <div style={{ display: 'flex', gap: '4px', marginTop: '6px', alignItems: 'center' }}>
                {[8, 12, 16].map((len, i) => (
                  <div key={i} style={{ flex: 1, height: '3px', borderRadius: '2px', background: form.password.length >= len ? (i === 0 ? '#f59e0b' : i === 1 ? '#10b981' : '#3b82f6') : 'var(--border)', transition: 'background 0.3s' }} />
                ))}
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', minWidth: '55px', textAlign: 'right' }}>
                  {form.password.length < 8 ? 'Faible' : form.password.length < 12 ? 'Moyen' : form.password.length < 16 ? 'Fort' : 'Très fort'}
                </span>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label htmlFor="reg-confirm">Confirmer le mot de passe</label>
            <div style={{ position: 'relative' }}>
              <input id="reg-confirm" type="password" placeholder="Répétez votre mot de passe"
                value={form.confirmPassword} onChange={handleChange('confirmPassword')}
                style={{
                  width: '100%', paddingLeft: '44px',
                  borderColor: form.confirmPassword && form.password !== form.confirmPassword ? 'var(--danger)' : undefined,
                }} required />
              <Lock size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              {form.confirmPassword && form.password === form.confirmPassword && (
                <CheckCircle size={16} style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--primary)' }} />
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{ color: 'var(--danger)', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '10px 14px', fontSize: '0.875rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={16} />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '14px' }} disabled={loading}>
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                Création en cours…
              </span>
            ) : 'Créer mon compte'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          Vous avez déjà un compte ?{' '}
          <button onClick={onNavigateToLogin} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: '600', cursor: 'pointer', fontSize: '0.9rem' }}>
            Se connecter
          </button>
        </p>
      </div>
    </div>
  );
}
