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
    <div ref={containerRef} className="input-icon-wrap w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="select-trigger-btn"
        style={{ color: selectedOption ? 'var(--text-main)' : 'var(--text-muted)', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}
      >
        <span>{selectedOption ? selectedOption[labelKey] : placeholder}</span>
        <span className="select-trigger-caret">▼</span>
      </button>

      {isOpen && (
        <div className="select-dropdown-panel">
          <div className="select-search-wrap">
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
              className="select-search-input"
            />
          </div>

          <div className="select-options-list">
            {filteredOptions.length === 0 ? (
              <div className="select-empty">
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
                    className={`select-option-btn${isSelected ? ' selected' : ''}`}
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
      setError(t('mustAcceptTermsError'));
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
            <div className="auth-brand-row">
              <div className="auth-brand-icon">
                <Sprout size={22} color="white" />
              </div>
              <span className="auth-brand-name">{t('appName')}</span>
            </div>
            <h2>{t('regSuccessTitle')}</h2>
            <h2 className="auth-subtitle-muted">{t('joinSougra')}</h2>
            <p>{t('heroSubtitle')}</p>
          </div>
        </div>

        <div className="auth-right">
          <div className="mw-400 w-full text-center">
            <div className="success-icon-circle">
              <CheckCircle size={48} style={{ color: 'var(--primary)' }} />
            </div>
            <h2 className="success-title">{t('regSuccessTitle')}</h2>
            <p className="success-text">
              {t('regSuccessEmailSent', { email: form.email })}
            </p>
            <p className="success-subtext">
              {t('regSuccessVerifyLink')}
            </p>
            <div className="success-dev-tip">
              {t('regSuccessDevTip')}
            </div>
            <button onClick={onNavigateToLogin} className="btn btn-primary btn-block-xl">
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
          <div className="auth-brand-row">
            <div className="auth-brand-icon">
              <Sprout size={22} color="white" />
            </div>
            <span className="auth-brand-name">
              {t('appName')}
            </span>
          </div>

          <h2>{t('registerTitle')} —</h2>
          <h2 className="auth-subtitle-muted">
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
        <div className="mw-480 w-full">
          <div className="auth-logo-row">
            <div className="auth-logo-icon">
              <Sprout size={18} color="white" />
            </div>
            <span className="auth-logo-name">
              {t('appName')}
            </span>
          </div>

          <h1 className="auth-form-title">{t('registerTitle')}</h1>
          <p className="auth-form-sub">{t('joinSougra')}</p>

        <form onSubmit={handleSubmit}>

          {/* Role Selection */}
          <div className="form-group mb-24">
            <label className="text-start">{t('accountType')}</label>
            <div className="role-select-grid">
              {[
                { value: 'buyer', label: t('buyerLabel'), icon: <ShoppingBag size={20} />, desc: t('buyerDesc') },
                { value: 'producer', label: t('producerLabel'), icon: <Tractor size={20} />, desc: t('producerDesc') },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { setForm(prev => ({ ...prev, role: opt.value })); setError(''); }}
                  className={`role-select-card${form.role === opt.value ? ' selected' : ''}`}
                >
                  <div className="role-select-card-icon">{opt.icon}</div>
                  <div className="role-select-card-label">{opt.label}</div>
                  <div className="role-select-card-desc">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Entity Type (buyers only) */}
          {form.role === 'buyer' && (
            <div className="form-group animate-fade-in mb-20">
              <label className="text-start">
                {t('entityTypeLabel')}
              </label>
              <div className="segmented-control">
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, entity_type: 'particulier' }))}
                  className={`segmented-btn${form.entity_type === 'particulier' ? ' active' : ''}`}
                >
                  {t('entityTypeParticulier')}
                </button>
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, entity_type: 'entreprise' }))}
                  className={`segmented-btn${form.entity_type === 'entreprise' ? ' active' : ''}`}
                >
                  {t('entityTypeEntreprise')}
                </button>
              </div>
              {form.entity_type === 'entreprise' && (
                <p className="hint-text-sm mt-6">
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
            <label htmlFor="reg-name" className="text-start">{t('fullNameLabel')}</label>
            <div className="input-icon-wrap">
              <input id="reg-name" type="text" placeholder={t('fullNamePlaceholder')}
                value={form.name} onChange={handleChange('name')}
                className="input-with-leading-icon" required />
              <User size={18} className="input-icon-leading" />
            </div>
          </div>

          {/* Email */}
          <div className="form-group">
            <label htmlFor="reg-email" className="text-start">{t('emailLabel')}</label>
            <div className="input-icon-wrap">
              <input id="reg-email" type="email" placeholder={t('emailPlaceholder')}
                value={form.email} onChange={handleChange('email')}
                className="input-with-leading-icon" required />
              <Mail size={18} className="input-icon-leading" />
            </div>
          </div>

          {/* Phone */}
          <div className="form-group">
            <label htmlFor="reg-phone" className="text-start">
              {t('phoneLabel')} <span className="label-hint">{t('optional')}</span>
            </label>
            <div style={{ display: 'flex', alignItems: 'stretch', flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}>
              <div
                className="phone-prefix-box"
                style={{
                  border: '1px solid var(--border)',
                  borderRight: dir === 'ltr' ? 'none' : '1px solid var(--border)',
                  borderLeft: dir === 'rtl' ? 'none' : '1px solid var(--border)',
                  borderRadius: dir === 'ltr' ? '8px 0 0 8px' : '0 8px 8px 0',
                }}
              >
                <svg width="22" height="16" viewBox="0 0 22 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="phone-flag-icon">
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
                className="phone-input"
                style={{
                  border: '1px solid var(--border)',
                  borderLeft: dir === 'ltr' ? 'none' : '1px solid var(--border)',
                  borderRight: dir === 'rtl' ? 'none' : '1px solid var(--border)',
                  borderRadius: dir === 'ltr' ? '0 8px 8px 0' : '8px 0 0 8px',
                }}
              />
            </div>
          </div>

          {/* Wilaya + Commune */}
          <div className="two-col-grid mb-20">
            {/* Wilaya */}
            <div className="form-group form-group-tight">
              <label className="text-start">
                {t('wilayaLabel')} <span className="label-hint">{t('optional')}</span>
              </label>
              <SearchableSelect
                options={wilayaOptions}
                value={form.wilaya}
                onChange={handleChange('wilaya')}
                placeholder={t('selectPlaceholder')}
              />
            </div>

            {/* Commune */}
            <div className="form-group form-group-tight">
              <label className="text-start">
                {t('communeLabel')} <span className="label-hint">{t('optional')}</span>
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
            <label htmlFor="reg-password" className="text-start">
              {t('passwordLabel')} <span className="label-hint label-hint-normal-case">{t('passwordHelp')}</span>
            </label>
            <div className="input-icon-wrap">
              <input id="reg-password" type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder={t('passwordHelpPlaceholder')}
                value={form.password} onChange={handleChange('password')}
                className="input-with-icons" required />
              <Lock size={18} className="input-icon-leading" />
              <button type="button" onClick={() => setShowPassword(p => !p)}
                aria-label={showPassword ? t('hidePasswordLabel') : t('showPasswordLabel')}
                className="input-icon-trailing-btn">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {form.password && (
              <div className="pwd-strength-row" style={{ flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}>
                {[8, 12, 16].map((len, i) => (
                  <div key={i} className="pwd-strength-segment" style={{ background: form.password.length >= len ? (i === 0 ? '#f59e0b' : i === 1 ? '#10b981' : '#3b82f6') : 'var(--border)' }} />
                ))}
                <span className="pwd-strength-label text-end">
                  {form.password.length < 8 ? t('strengthWeak') : form.password.length < 12 ? t('strengthMedium') : form.password.length < 16 ? t('strengthStrong') : t('strengthVeryStrong')}
                </span>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div className="form-group mb-24">
            <label htmlFor="reg-confirm" className="text-start">{t('confirmPasswordLabel')}</label>
            <div className="input-icon-wrap">
              <input id="reg-confirm" type="password" autoComplete="new-password" placeholder={t('confirmPasswordPlaceholder')}
                value={form.confirmPassword} onChange={handleChange('confirmPassword')}
                className="input-with-icons"
                style={{ borderColor: form.confirmPassword && form.password !== form.confirmPassword ? 'var(--danger)' : undefined }}
                required />
              <Lock size={18} className="input-icon-leading" />
              {form.confirmPassword && form.password === form.confirmPassword && (
                <CheckCircle size={16} className="input-icon-trailing-success" />
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="alert-box alert-box-center alert-danger mb-20" style={{ flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}>
              <ShieldAlert size={16} />
              <span>{error}</span>
            </div>
          )}

          <label className="terms-checkbox-label">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => { setAcceptedTerms(e.target.checked); setError(''); }}
              className="checkbox-terms"
              required
            />
            <span>
              {t('acceptTermsPrefix')}{' '}
              <button
                type="button"
                onClick={() => navigate('/terms')}
                className="btn-text-link btn-text-link-underline"
              >
                {t('termsLinkLabel')}
              </button>
              {' '}{t('acceptTermsSuffix')}
            </span>
          </label>

          <button type="submit" className="btn btn-primary btn-block-xl" disabled={loading || !acceptedTerms}>
            {loading ? (
              <span className="btn-loading-row">
                <span className="spinner spinner-md" />
                {t('registering')}
              </span>
            ) : t('registerBtn')}
          </button>
        </form>

        <p className="auth-footer-note">
          {t('alreadyHaveAccount')}{' '}
          <button onClick={onNavigateToLogin} className="btn-text-link btn-text-semibold btn-text-md">
            {t('login')}
          </button>
        </p>
        </div>
      </div>
    </div>
    </>
  );
}
