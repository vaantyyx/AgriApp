import React, { useState, useEffect, useRef } from 'react';
import { Sprout, Mail, Lock, User, Tractor, ShoppingBag, ShieldAlert, Eye, EyeOff, CheckCircle, Phone, MapPin, Zap, Users, TrendingUp } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { BACKEND_URL } from '../utils/config.js';
import SiteNavbar from './SiteNavbar';

// Custom Searchable Dropdown component for a premium experience
function SearchableSelect({ options, value, onChange, placeholder, disabled, labelKey = 'label', valueKey = 'value' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);
  const { t, dir } = useTranslation();

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
          textAlign: 'start',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <span>{selectedOption ? selectedOption[labelKey] : placeholder}</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginInlineStart: '8px' }}>▼</span>
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
              placeholder={t('searchPlaceholder')}
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
                textAlign: 'start',
              }}
            />
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filteredOptions.length === 0 ? (
              <div style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center' }}>
                {t('noResult')}
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
                      textAlign: 'start',
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
  const { t, dir, locale } = useTranslation();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '', email: '', password: '', confirmPassword: '',
    role: '', phone: '', wilaya: '', commune: '', entity_type: 'particulier',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

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
    const value = val && val.target ? val.target.value : val;
    setForm(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const validatePassword = (pwd) => {
    if (pwd.length < 8) return t('passwordMinChar');
    return null;
  };

  const validatePhone = (phone) => {
    if (!phone) return null;
    const digits = phone.replace(/\s/g, '');
    if (!/^[0-9]{9,10}$/.test(digits)) return t('phoneInvalid');
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { name, email, password, confirmPassword, role, phone, wilaya, commune, entity_type } = form;

    if (!name || !email || !password || !confirmPassword || !role) {
      setError(t('fieldsRequired'));
      return;
    }

    if (!acceptedTerms) {
      setError("Vous devez accepter les Conditions Générales d'Utilisation pour créer un compte.");
      return;
    }

    const pwdError = validatePassword(password);
    if (pwdError) { setError(pwdError); return; }
    if (password !== confirmPassword) { setError(t('passwordMismatch')); return; }

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
          entity_type,
          acceptedTerms,
          locale,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t('serverError'));
      } else {
        setSuccess(true);
      }
    } catch {
      setError(t('serverError'));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <>
      <SiteNavbar />
      <div className="auth-page animate-fade-in" dir={dir}>
        <div className="auth-left">
          <div className="auth-left-content">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
              <div style={{ width: 40, height: 40, background: 'rgba(255,255,255,0.15)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Sprout size={22} color="white" />
              </div>
              <span style={{ color: '#fff', fontSize: '1.25rem', fontWeight: 800, fontFamily: 'var(--font-heading)' }}>{t('appName')}</span>
            </div>
            <h2>{t('regSuccessTitle')}</h2>
            <h2 style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 400, marginBottom: 16 }}>{t('joinSougra')}</h2>
            <p>{t('heroSubtitle')}</p>
          </div>
        </div>

        <div className="auth-right">
          <div style={{ maxWidth: 400, width: '100%', textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', padding: '20px', borderRadius: '50%', background: 'rgba(16,185,129,0.15)', marginBottom: '24px' }}>
              <CheckCircle size={48} style={{ color: 'var(--primary)' }} />
            </div>
            <h2 style={{ fontSize: '1.75rem', marginBottom: '12px' }}>{t('regSuccessTitle')}</h2>
            <p style={{ color: 'var(--text-muted)', lineHeight: '1.7', marginBottom: '8px' }}>
              {t('regSuccessEmailSent', { email: form.email })}
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.6', marginBottom: '32px' }}>
              {t('regSuccessVerifyLink')}
            </p>
            <div style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '10px', padding: '14px', marginBottom: '28px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {t('regSuccessDevTip')}
            </div>
            <button onClick={onNavigateToLogin} className="btn btn-primary" style={{ width: '100%', padding: '14px' }}>
              {t('accessLogin')}
            </button>
          </div>
        </div>
      </div>
      </>
    );
  }

  const wilayaOptions = wilayas.map(w => ({
    value: w.wilaya_id,
    label: `${String(w.wilaya_id).padStart(2, '0')} - ${w.wilaya_name_latin}`,
  }));

  const communeOptions = communes.map(c => ({
    value: c.commune_id,
    label: c.commune_name_latin,
  }));

  return (
    <>
    <SiteNavbar />
    <div className="auth-page animate-fade-in" dir={dir}>

      {/* Left panel */}
      <div className="auth-left">
        <div className="auth-left-content">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
            <div style={{ width: 40, height: 40, background: 'rgba(255,255,255,0.15)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sprout size={22} color="white" />
            </div>
            <span style={{ color: '#fff', fontSize: '1.25rem', fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
              {t('appName')}
            </span>
          </div>

          <h2>{t('registerTitle')} —</h2>
          <h2 style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 400, marginBottom: 16 }}>
            {t('joinSougra')}
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
      <div className="auth-right auth-right-wide">
        <div style={{ maxWidth: 480, width: '100%' }}>
          <div className="auth-logo-row">
            <div style={{ width: 36, height: 36, background: 'var(--primary)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sprout size={18} color="white" />
            </div>
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.1rem', color: 'var(--primary)' }}>
              {t('appName')}
            </span>
          </div>

          <h1 className="auth-form-title">{t('registerTitle')}</h1>
          <p className="auth-form-sub">{t('joinSougra')}</p>

        <form onSubmit={handleSubmit}>

          {/* Role Selection */}
          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label style={{ textAlign: dir === 'rtl' ? 'right' : 'left' }}>{t('accountType')}</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {[
                { value: 'buyer', label: t('buyerLabel'), icon: <ShoppingBag size={20} />, desc: t('buyerDesc') },
                { value: 'producer', label: t('producerLabel'), icon: <Tractor size={20} />, desc: t('producerDesc') },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { setForm(prev => ({ ...prev, role: opt.value })); setError(''); }}
                  style={{
                    padding: '16px', borderRadius: '10px', border: '2px solid',
                    borderColor: form.role === opt.value ? 'var(--primary)' : 'var(--border)',
                    background: form.role === opt.value ? 'var(--primary-glow)' : 'var(--bg-input)',
                    color: 'var(--text-main)', cursor: 'pointer', textAlign: 'start',
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

          {/* Entity Type (buyers only) */}
          {form.role === 'buyer' && (
            <div className="form-group animate-fade-in" style={{ marginBottom: '20px' }}>
              <label style={{ textAlign: dir === 'rtl' ? 'right' : 'left' }}>
                {t('entityTypeLabel')}
              </label>
              <div style={{
                display: 'flex',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '4px',
                gap: '4px',
              }}>
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, entity_type: 'particulier' }))}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '8px',
                    border: 'none',
                    background: form.entity_type === 'particulier' ? 'var(--primary)' : 'transparent',
                    color: form.entity_type === 'particulier' ? 'white' : 'var(--text-muted)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    fontSize: '0.9rem',
                  }}
                >
                  {t('entityTypeParticulier')}
                </button>
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, entity_type: 'entreprise' }))}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '8px',
                    border: 'none',
                    background: form.entity_type === 'entreprise' ? 'var(--primary)' : 'transparent',
                    color: form.entity_type === 'entreprise' ? 'white' : 'var(--text-muted)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    fontSize: '0.9rem',
                  }}
                >
                  {t('entityTypeEntreprise')}
                </button>
              </div>
              {form.entity_type === 'entreprise' && (
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                  {locale === 'ar'
                    ? 'يمكنك إكمال معلومات مؤسستك (السجل التجاري، NIF...) لاحقاً من صفحة الملف الشخصي.'
                    : locale === 'en'
                    ? 'You can complete your company information (RC, NIF...) later from your profile page.'
                    : 'Vous pourrez compléter les informations de votre entreprise (RC, NIF...) plus tard depuis votre profil.'}
                </p>
              )}
            </div>
          )}

          {/* Name */}
          <div className="form-group">
            <label htmlFor="reg-name" style={{ textAlign: dir === 'rtl' ? 'right' : 'left' }}>{t('fullNameLabel')}</label>
            <div style={{ position: 'relative' }}>
              <input id="reg-name" type="text" placeholder={t('fullNamePlaceholder')}
                value={form.name} onChange={handleChange('name')}
                style={{
                  width: '100%',
                  paddingLeft: dir === 'ltr' ? '44px' : '16px',
                  paddingRight: dir === 'rtl' ? '44px' : '16px',
                  textAlign: 'start'
                }} required />
              <User size={18} style={{
                position: 'absolute',
                left: dir === 'ltr' ? '14px' : 'auto',
                right: dir === 'rtl' ? '14px' : 'auto',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)'
              }} />
            </div>
          </div>

          {/* Email */}
          <div className="form-group">
            <label htmlFor="reg-email" style={{ textAlign: dir === 'rtl' ? 'right' : 'left' }}>{t('emailLabel')}</label>
            <div style={{ position: 'relative' }}>
              <input id="reg-email" type="email" placeholder={t('emailPlaceholder')}
                value={form.email} onChange={handleChange('email')}
                style={{
                  width: '100%',
                  paddingLeft: dir === 'ltr' ? '44px' : '16px',
                  paddingRight: dir === 'rtl' ? '44px' : '16px',
                  textAlign: 'start'
                }} required />
              <Mail size={18} style={{
                position: 'absolute',
                left: dir === 'ltr' ? '14px' : 'auto',
                right: dir === 'rtl' ? '14px' : 'auto',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)'
              }} />
            </div>
          </div>

          {/* Phone */}
          <div className="form-group">
            <label htmlFor="reg-phone" style={{ textAlign: dir === 'rtl' ? 'right' : 'left' }}>
              {t('phoneLabel')} <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.8rem' }}>{t('optional')}</span>
            </label>
            <div style={{ display: 'flex', gap: '0', alignItems: 'stretch', flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '0 14px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--border)',
                borderRight: dir === 'ltr' ? 'none' : '1px solid var(--border)',
                borderLeft: dir === 'rtl' ? 'none' : '1px solid var(--border)',
                borderRadius: dir === 'ltr' ? '8px 0 0 8px' : '0 8px 8px 0',
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
                  borderLeft: dir === 'ltr' ? 'none' : '1px solid var(--border)',
                  borderRight: dir === 'rtl' ? 'none' : '1px solid var(--border)',
                  borderRadius: dir === 'ltr' ? '0 8px 8px 0' : '8px 0 0 8px',
                  padding: '12px 14px',
                  color: 'var(--text-main)',
                  fontSize: '0.95rem',
                  outline: 'none',
                  textAlign: 'start',
                }}
              />
            </div>
          </div>

          {/* Wilaya + Commune */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            {/* Wilaya */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ textAlign: dir === 'rtl' ? 'right' : 'left' }}>
                {t('wilayaLabel')} <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.8rem' }}>{t('optional')}</span>
              </label>
              <SearchableSelect
                options={wilayaOptions}
                value={form.wilaya}
                onChange={handleChange('wilaya')}
                placeholder={t('selectPlaceholder')}
              />
            </div>

            {/* Commune */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ textAlign: dir === 'rtl' ? 'right' : 'left' }}>
                {t('communeLabel')} <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.8rem' }}>{t('optional')}</span>
              </label>
              <SearchableSelect
                options={communeOptions}
                value={form.commune}
                onChange={handleChange('commune')}
                placeholder={form.wilaya ? t('selectPlaceholder') : t('wilayaFirst')}
                disabled={communes.length === 0}
              />
            </div>
          </div>

          {/* Password */}
          <div className="form-group">
            <label htmlFor="reg-password" style={{ textAlign: dir === 'rtl' ? 'right' : 'left' }}>
              {t('passwordLabel')} <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none', fontSize: '0.8rem' }}>{t('passwordHelp')}</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input id="reg-password" type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder={t('passwordHelpPlaceholder')}
                value={form.password} onChange={handleChange('password')}
                style={{
                  width: '100%',
                  paddingLeft: dir === 'ltr' ? '44px' : '16px',
                  paddingRight: dir === 'rtl' ? '44px' : '16px',
                  textAlign: 'start'
                }} required />
              <Lock size={18} style={{
                position: 'absolute',
                left: dir === 'ltr' ? '14px' : 'auto',
                right: dir === 'rtl' ? '14px' : 'auto',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)'
              }} />
              <button type="button" onClick={() => setShowPassword(p => !p)}
                aria-label={showPassword ? t('hidePasswordLabel') : t('showPasswordLabel')}
                style={{
                  position: 'absolute',
                  right: dir === 'ltr' ? '14px' : 'auto',
                  left: dir === 'rtl' ? '14px' : 'auto',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 0
                }}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {form.password && (
              <div style={{ display: 'flex', gap: '4px', marginTop: '6px', alignItems: 'center', flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}>
                {[8, 12, 16].map((len, i) => (
                  <div key={i} style={{ flex: 1, height: '3px', borderRadius: '2px', background: form.password.length >= len ? (i === 0 ? '#f59e0b' : i === 1 ? '#10b981' : '#3b82f6') : 'var(--border)', transition: 'background 0.3s' }} />
                ))}
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', minWidth: '55px', textAlign: dir === 'rtl' ? 'left' : 'right' }}>
                  {form.password.length < 8 ? t('strengthWeak') : form.password.length < 12 ? t('strengthMedium') : form.password.length < 16 ? t('strengthStrong') : t('strengthVeryStrong')}
                </span>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label htmlFor="reg-confirm" style={{ textAlign: dir === 'rtl' ? 'right' : 'left' }}>{t('confirmPasswordLabel')}</label>
            <div style={{ position: 'relative' }}>
              <input id="reg-confirm" type="password" autoComplete="new-password" placeholder={t('confirmPasswordPlaceholder')}
                value={form.confirmPassword} onChange={handleChange('confirmPassword')}
                style={{
                  width: '100%',
                  paddingLeft: dir === 'ltr' ? '44px' : '16px',
                  paddingRight: dir === 'rtl' ? '44px' : '16px',
                  textAlign: 'start',
                  borderColor: form.confirmPassword && form.password !== form.confirmPassword ? 'var(--danger)' : undefined,
                }} required />
              <Lock size={18} style={{
                position: 'absolute',
                left: dir === 'ltr' ? '14px' : 'auto',
                right: dir === 'rtl' ? '14px' : 'auto',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)'
              }} />
              {form.confirmPassword && form.password === form.confirmPassword && (
                <CheckCircle size={16} style={{
                  position: 'absolute',
                  right: dir === 'ltr' ? '14px' : 'auto',
                  left: dir === 'rtl' ? '14px' : 'auto',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--primary)'
                }} />
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              color: 'var(--danger)',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: '8px',
              padding: '10px 14px',
              fontSize: '0.875rem',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexDirection: dir === 'rtl' ? 'row-reverse' : 'row',
              textAlign: 'start'
            }}>
              <ShieldAlert size={16} />
              <span>{error}</span>
            </div>
          )}

          <label style={{
            display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '16px',
            fontSize: '0.85rem', color: 'var(--text-body)', cursor: 'pointer', textAlign: 'start',
          }}>
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => { setAcceptedTerms(e.target.checked); setError(''); }}
              style={{ marginTop: '3px', flexShrink: 0, width: '16px', height: '16px', cursor: 'pointer' }}
              required
            />
            <span>
              Je déclare avoir lu et accepté les{' '}
              <button
                type="button"
                onClick={() => navigate('/terms')}
                style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: 'inherit', fontFamily: 'inherit', padding: 0, textDecoration: 'underline' }}
              >
                Conditions Générales d'Utilisation
              </button>
              {' '}de Sougra.
            </span>
          </label>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '14px' }} disabled={loading || !acceptedTerms}>
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <span style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                {t('registering')}
              </span>
            ) : t('registerBtn')}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          {t('alreadyHaveAccount')}{' '}
          <button onClick={onNavigateToLogin} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: '600', cursor: 'pointer', fontSize: '0.9rem' }}>
            {t('login')}
          </button>
        </p>
        </div>
      </div>
    </div>
    </>
  );
}
