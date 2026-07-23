import { useState, useEffect, useRef } from 'react';
import { Shield, Save, X, Edit3, CheckCircle, AlertCircle, Camera, User, Mail, Phone, MapPin } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';
import SecuritySettingsTab from './SecuritySettingsTab';
import { BACKEND_URL } from '../utils/config.js';
import { WILAYA_COORDS } from '../utils/wilayaCoordinates.js';

const WILAYA_LIST = Object.entries(WILAYA_COORDS).map(([id, w]) => ({ id: parseInt(id), name: w.name })).sort((a, b) => a.id - b.id);

function Avatar({ photoUrl, name, size = 96 }) {
  const initials = name ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '?';
  if (photoUrl) return <img src={photoUrl} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--primary)', display: 'block' }} />;
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.35, fontWeight: 800, color: 'white', border: '3px solid rgba(255,255,255,0.15)', flexShrink: 0 }}>
      {initials}
    </div>
  );
}

// Admin accounts don't take part in auctions, have no producer/buyer profile
// fields (bio, documents, professional info, stats), and self-deactivation
// would lock the admin out of their own panel — this is a deliberately
// minimal page, not BuyerProfilePage/ProducerProfilePage with sections hidden.
export default function AdminProfilePage({ token, user: initialUser, onUserUpdate, onLogout, onNavigateToDashboard }) {
  const { t, dir, locale } = useTranslation();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', wilaya: '', commune: '' });
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [toast, setToast] = useState(null);
  const [activeTab, setActiveTab] = useState('profile');
  const fileInputRef = useRef(null);

  const showToast = (message, type = 'success') => { setToast({ message, type }); setTimeout(() => setToast(null), 3500); };
  const photoUrl = profile?.profilePhoto ? `${BACKEND_URL}/uploads/${profile.profilePhoto}?token=${token}` : null;

  useEffect(() => {
    let active = true;
    fetch(`${BACKEND_URL}/api/profile`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (!active) return;
        setProfile(data);
        setForm({ name: data.name || '', email: data.email || '', phone: data.phone || '', wilaya: data.wilaya || '', commune: data.commune || '' });
      })
      .catch(() => { if (active) showToast(t('serverError'), 'error'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleSave = async () => {
    if (!form.name.trim() || form.name.trim().length < 2) { showToast(t('updateError'), 'error'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) { showToast(t('updateError'), 'error'); return; }
    setSaving(true);
    try {
      const payload = { name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(), wilaya: form.wilaya, commune: form.commune.trim() };
      const res = await fetch(`${BACKEND_URL}/api/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setProfile(prev => ({ ...prev, ...payload }));
        onUserUpdate({ ...initialUser, ...payload });
        setEditing(false);
        showToast(t('updateSuccess'));
      } else {
        showToast(data.error || t('updateError'), 'error');
      }
    } catch {
      showToast(t('serverError'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { showToast(locale === 'ar' ? 'صيغة غير مدعومة. استخدم JPEG أو PNG أو WebP.' : (locale === 'en' ? 'Unsupported format. Use JPEG, PNG or WebP.' : 'Format non supporté. Utilisez JPEG, PNG ou WebP.'), 'error'); return; }
    if (file.size > 20 * 1024 * 1024) { showToast(locale === 'ar' ? 'الملف كبير جدًا (الحد الأقصى 20 ميغابايت).' : (locale === 'en' ? 'File too large (20MB max).' : 'Fichier trop volumineux (maximum 20 Mo).'), 'error'); return; }
    setUploadingPhoto(true);
    const formData = new FormData();
    formData.append('photo', file);
    try {
      const res = await fetch(`${BACKEND_URL}/api/profile/photo`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData });
      const data = await res.json();
      if (res.ok) {
        const pf = data.photoUrl.split('/uploads/')[1];
        setProfile(prev => ({ ...prev, profilePhoto: pf }));
        onUserUpdate({ ...initialUser, profilePhoto: pf });
        showToast(t('updateSuccess'));
      } else {
        showToast(data.error || t('updateError'), 'error');
      }
    } catch {
      showToast(t('serverError'), 'error');
    } finally {
      setUploadingPhoto(false);
    }
  };

  if (loading) return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
        <div style={{ width: 40, height: 40, border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
        {t('verifLoading')}
      </div>
    </div>
  );

  const memberDateStr = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-DZ' : (locale === 'fr' ? 'fr-DZ' : 'en-US'), { month: 'long', year: 'numeric' })
    : '—';

  return (
    <div className="dash-page-scroll" style={{ flex: 1, padding: '32px 40px', overflowY: 'auto', textAlign: 'start', minHeight: '100vh', background: 'var(--bg-main)' }} dir={dir}>
      {toast && (
        <div style={{ position: 'fixed', top: 80, right: dir === 'ltr' ? 24 : 'auto', left: dir === 'rtl' ? 24 : 'auto', zIndex: 1000, background: toast.type === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', border: `1px solid ${toast.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`, color: toast.type === 'success' ? 'var(--primary)' : 'var(--danger)', padding: '12px 20px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8, backdropFilter: 'blur(10px)', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
          {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="glass-panel" style={{ marginBottom: 24, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <Avatar photoUrl={photoUrl} name={profile?.name} size={96} />
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handlePhotoChange} />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto}
              title={locale === 'ar' ? 'تغيير صورة الملف الشخصي' : (locale === 'en' ? 'Change profile photo' : 'Modifier la photo de profil')}
              aria-label={locale === 'ar' ? 'تغيير صورة الملف الشخصي' : (locale === 'en' ? 'Change profile photo' : 'Modifier la photo de profil')}
              style={{ position: 'absolute', bottom: 0, right: dir === 'ltr' ? 0 : 'auto', left: dir === 'rtl' ? 0 : 'auto', width: 32, height: 32, borderRadius: '50%', background: 'var(--primary)', border: '2px solid var(--bg-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              {uploadingPhoto ? <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> : <Camera size={14} style={{ color: 'white' }} />}
            </button>
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.6rem', margin: 0 }}>{profile?.name}</h1>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 700, background: 'rgba(139,92,246,0.15)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.3)' }}>
                <Shield size={11} /> {locale === 'ar' ? 'مسؤول' : (locale === 'en' ? 'Admin' : 'Administrateur')}
              </span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '0 0 4px', direction: 'ltr', textAlign: dir === 'rtl' ? 'right' : 'left' }}>{profile?.email}</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
              {locale === 'ar' ? `عضو منذ ${memberDateStr}` : (locale === 'en' ? `Member since ${memberDateStr}` : `Membre depuis ${memberDateStr}`)}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {!editing ? (
              <>
                <button onClick={() => setEditing(true)} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.875rem' }}><Edit3 size={15} /> {t('editBtn')}</button>
                <button onClick={onNavigateToDashboard} className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.875rem' }}>{t('backToDash')}</button>
              </>
            ) : (
              <>
                <button onClick={() => { setEditing(false); setForm({ name: profile.name || '', email: profile.email || '', phone: profile.phone || '', wilaya: profile.wilaya || '', commune: profile.commune || '' }); }} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.875rem' }}><X size={15} /> {t('cancelBtn')}</button>
                <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.875rem' }}>
                  {saving ? <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> : <Save size={15} />}
                  {t('saveBtn')}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 16, borderBottom: '1px solid var(--border)', marginBottom: 24, paddingBottom: 2, flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}>
        {[
          { id: 'profile', icon: <User size={16} />, label: locale === 'ar' ? 'الحساب' : (locale === 'en' ? 'Account' : 'Compte') },
          { id: 'security', icon: <Shield size={16} />, label: locale === 'ar' ? 'الأمان والوصول' : (locale === 'en' ? 'Security & Access' : 'Sécurité & Accès') },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ background: 'none', border: 'none', padding: '10px 16px', cursor: 'pointer', fontSize: '0.95rem', fontWeight: activeTab === tab.id ? 700 : 500, color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-muted)', borderBottom: `3px solid ${activeTab === tab.id ? 'var(--primary)' : 'transparent'}`, display: 'flex', alignItems: 'center', gap: 8, flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}>
            {tab.icon}<span>{tab.label}</span>
          </button>
        ))}
      </div>

      {activeTab === 'profile' ? (
        <div className="glass-panel" style={{ textAlign: 'start', maxWidth: 520 }}>
          <h3 style={{ fontSize: '0.8rem', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <User size={14} /> <span>{t('personalInfo')}</span>
          </h3>
          {!editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {[
                { icon: <User size={16} />, label: t('fullNameLabel'), value: profile?.name },
                { icon: <Mail size={16} />, label: t('emailLabel'), value: profile?.email },
                { icon: <Phone size={16} />, label: t('phoneLabel'), value: profile?.phone || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('phoneNotProvided')}</span> },
                { icon: <MapPin size={16} />, label: t('wilayaLabel'), value: profile?.wilaya || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('wilayaNotProvided')}</span> },
                { icon: <MapPin size={16} />, label: t('communeLabel'), value: profile?.commune || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('communeNotProvided')}</span> },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <div style={{ color: 'var(--text-muted)', marginTop: 2, flexShrink: 0 }}>{item.icon}</div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{item.label}</div>
                    <div style={{ color: 'var(--text-main)', fontSize: '0.95rem' }}>{item.value}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="admin-edit-name">{t('fullNameLabel')}</label>
                <input id="admin-edit-name" type="text" value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} style={{ width: '100%', textAlign: 'start' }} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="admin-edit-email">{t('emailLabel')}</label>
                <input id="admin-edit-email" type="email" value={form.email} onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))} style={{ width: '100%', textAlign: 'start', direction: 'ltr' }} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="admin-edit-phone">{t('phoneLabel')}</label>
                <input id="admin-edit-phone" type="tel" value={form.phone} onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))} style={{ width: '100%', textAlign: 'start', direction: 'ltr' }} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="admin-edit-wilaya">{t('wilayaLabel')}</label>
                <select id="admin-edit-wilaya" value={form.wilaya} onChange={e => setForm(prev => ({ ...prev, wilaya: e.target.value }))} style={{ width: '100%' }}>
                  <option value="">{t('selectPlaceholder')}</option>
                  {WILAYA_LIST.map(w => <option key={w.id} value={w.name}>{w.id < 10 ? `0${w.id}` : w.id} – {w.name}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="admin-edit-commune">{t('communeLabel')}</label>
                <input id="admin-edit-commune" type="text" value={form.commune} onChange={e => setForm(prev => ({ ...prev, commune: e.target.value }))} style={{ width: '100%', textAlign: 'start' }} />
              </div>
            </div>
          )}
        </div>
      ) : (
        <SecuritySettingsTab
          token={token}
          profile={profile}
          setProfile={setProfile}
          onUserUpdate={onUserUpdate}
          showToast={showToast}
          onLogout={onLogout}
          initialUser={initialUser}
          hideDangerZone
        />
      )}
    </div>
  );
}
