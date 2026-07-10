import React, { useState, useEffect, useRef } from 'react';
import { User, Mail, Phone, MapPin, FileText, Camera, Tractor, ShoppingBag, Edit3, Save, X, CheckCircle, AlertCircle, BarChart2, Shield } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';
import SecuritySettingsTab from './SecuritySettingsTab';
import { BACKEND_URL } from '../utils/config.js';

// ─── Profile completion for buyers ────────────────────────────────────────────
export function computeBuyerCompletion(user) {
  if (!user) return 0;
  const isEntreprise = user.entity_type === 'entreprise';
  if (!isEntreprise) {
    let score = 0;
    if (user.wilaya && user.wilaya.trim()) score += 34;
    if (user.commune && user.commune.trim()) score += 33;
    if (user.phone && user.phone.trim()) score += 33;
    return score;
  } else {
    let score = 0;
    if (user.wilaya && user.wilaya.trim()) score += 10;
    if (user.commune && user.commune.trim()) score += 10;
    if (user.phone && user.phone.trim()) score += 10;
    if (user.forme_juridique && user.forme_juridique.trim()) score += 10;
    if (user.rc && user.rc.trim()) score += 10;
    if (user.nif && user.nif.trim()) score += 10;
    if (user.secteur_activite && user.secteur_activite.trim()) score += 10;
    if (user.nom_commercial && user.nom_commercial.trim()) score += 30;
    return score;
  }
}

// ─── Searchable Select ────────────────────────────────────────────────────────
function SearchableSelect({ options, value, onChange, placeholder, disabled, labelKey = 'label', valueKey = 'value' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);
  const { t, dir } = useTranslation();

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setIsOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => { if (!isOpen) setSearch(''); }, [isOpen]);

  const selectedOption = options.find(opt => String(opt[valueKey]) === String(value));
  const filteredOptions = options.filter(opt => String(opt[labelKey]).toLowerCase().includes(search.toLowerCase()));

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <button type="button" disabled={disabled} onClick={() => setIsOpen(!isOpen)} style={{ width: '100%', padding: '12px 14px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', color: selectedOption ? 'var(--text-main)' : 'var(--text-muted)', fontSize: '0.9rem', outline: 'none', cursor: disabled ? 'not-allowed' : 'pointer', textAlign: 'start', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: disabled ? 0.5 : 1 }}>
        <span>{selectedOption ? selectedOption[labelKey] : placeholder}</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>▼</span>
      </button>
      {isOpen && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 1000, background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.4)', maxHeight: '260px', overflow: 'hidden', display: 'flex', flexDirection: 'column', backdropFilter: 'blur(20px)' }}>
          <div style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>
            <input type="text" placeholder={t('searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} autoFocus style={{ width: '100%', padding: '8px 10px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none', textAlign: 'start' }} />
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filteredOptions.length === 0 ? (
              <div style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center' }}>{t('noResult')}</div>
            ) : filteredOptions.map(opt => {
              const isSelected = String(opt[valueKey]) === String(value);
              return (
                <button key={opt[valueKey]} type="button" onClick={() => { onChange(opt[valueKey]); setIsOpen(false); }} style={{ width: '100%', padding: '10px 14px', background: isSelected ? 'var(--primary-glow)' : 'transparent', border: 'none', color: isSelected ? 'var(--primary)' : 'var(--text-main)', fontSize: '0.9rem', textAlign: 'start', cursor: 'pointer', outline: 'none', transition: 'background 0.2s' }} onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }} onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}>
                  {opt[labelKey]}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ photoUrl, name, size = 96 }) {
  const initials = name ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '?';
  const colors = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444'];
  const colorIndex = name ? name.charCodeAt(0) % colors.length : 0;
  if (photoUrl) return <img src={photoUrl} alt="Photo de profil" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--primary)', display: 'block' }} />;
  return <div style={{ width: size, height: size, borderRadius: '50%', background: `linear-gradient(135deg, ${colors[colorIndex]}, ${colors[(colorIndex + 1) % colors.length]})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.35, fontWeight: '800', color: 'white', border: '3px solid rgba(255,255,255,0.15)', flexShrink: 0 }}>{initials}</div>;
}

function StatItem({ value, label, color, isText, dir }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)', flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}>
      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontWeight: '800', color, fontSize: isText ? '0.85rem' : '1.25rem' }}>{value}</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function BuyerProfilePage({ token, user: initialUser, onUserUpdate, onLogout, onNavigateToDashboard }) {
  const { t, dir, locale } = useTranslation();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingRc, setUploadingRc] = useState(false);
  const [toast, setToast] = useState(null);
  const [activeTab, setActiveTab] = useState('profile');

  const [wilayas, setWilayas] = useState([]);
  const [allCommunes, setAllCommunes] = useState([]);
  const [communes, setCommunes] = useState([]);

  const fileInputRef = useRef(null);
  const rcFileInputRef = useRef(null);

  const photoUrl = profile?.profilePhoto ? `${BACKEND_URL}/uploads/${profile.profilePhoto}` : null;
  const showToast = (message, type = 'success') => { setToast({ message, type }); setTimeout(() => setToast(null), 3500); };

  useEffect(() => {
    fetch('/cities.json').then(r => r.json()).then(data => { setWilayas(data.wilayas || []); setAllCommunes(data.communes || []); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!form.wilaya_id) { setCommunes([]); return; }
    const id = parseInt(form.wilaya_id);
    setCommunes(allCommunes.filter(c => c.wilaya_id === id).sort((a, b) => a.commune_name_latin.localeCompare(b.commune_name_latin)));
  }, [form.wilaya_id, allCommunes]);

  const fetchProfile = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/profile`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) {
        setProfile(data);
        setForm({ name: data.name, phone: data.phone || '', bio: data.bio || '', wilaya: data.wilaya || '', commune: data.commune || '', wilaya_id: '', commune_id: '', entity_type: data.entity_type || 'particulier', rc: data.rc || '', nif: data.nif || '', forme_juridique: data.forme_juridique || '', nom_commercial: data.nom_commercial || '', secteur_activite: data.secteur_activite || '', possede_transport: !!data.possede_transport, possede_chambre_froide: !!data.possede_chambre_froide });
      }
    } catch { showToast(t('updateError'), 'error'); } finally { setLoading(false); }
  };

  useEffect(() => {
    if (profile && wilayas.length > 0) {
      const matchedWilaya = wilayas.find(w => w.wilaya_name_latin.toLowerCase() === (profile.wilaya || '').toLowerCase());
      if (matchedWilaya) {
        setForm(prev => {
          if (prev.wilaya_id) return prev;
          let matchedCommuneId = '';
          if (allCommunes.length > 0 && profile.commune) {
            const mc = allCommunes.find(c => c.wilaya_id === matchedWilaya.wilaya_id && c.commune_name_latin.toLowerCase() === profile.commune.toLowerCase());
            if (mc) matchedCommuneId = mc.commune_id;
          }
          return { ...prev, wilaya_id: String(matchedWilaya.wilaya_id), commune_id: String(matchedCommuneId) };
        });
      }
    }
  }, [profile, wilayas, allCommunes]);

  useEffect(() => { fetchProfile(); }, []);

  const handleWilayaChange = (val) => {
    const wId = val && val.target ? val.target.value : val;
    const selectedWilaya = wilayas.find(w => w.wilaya_id === parseInt(wId));
    setForm(prev => ({ ...prev, wilaya_id: wId, wilaya: selectedWilaya ? selectedWilaya.wilaya_name_latin : '', commune_id: '', commune: '' }));
  };

  const handleCommuneChange = (val) => {
    const cId = val && val.target ? val.target.value : val;
    const selectedCommune = communes.find(c => c.commune_id === parseInt(cId));
    setForm(prev => ({ ...prev, commune_id: cId, commune: selectedCommune ? selectedCommune.commune_name_latin : '' }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let phoneToSave = form.phone || '';
      if (phoneToSave && !phoneToSave.startsWith('+')) phoneToSave = `+213${phoneToSave.replace(/^0/, '').replace(/\s/g, '')}`;
      const payload = { name: form.name, phone: phoneToSave, bio: form.bio, wilaya: form.wilaya, commune: form.commune, rc: form.rc || '', nif: form.nif || '', forme_juridique: form.forme_juridique || '', nom_commercial: form.nom_commercial || '', secteur_activite: form.secteur_activite || '', possede_transport: !!form.possede_transport, possede_chambre_froide: !!form.possede_chambre_froide };
      const res = await fetch(`${BACKEND_URL}/api/profile`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (res.ok) { setProfile(prev => ({ ...prev, ...payload })); onUserUpdate({ ...initialUser, ...payload }); setEditing(false); showToast(t('updateSuccess')); }
      else showToast(data.error || t('updateError'), 'error');
    } catch { showToast(t('serverError'), 'error'); } finally { setSaving(false); }
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { showToast('Format non supporté. Utilisez JPEG, PNG ou WebP.', 'error'); return; }
    if (file.size > 20 * 1024 * 1024) { showToast('Fichier trop volumineux (maximum 20 Mo).', 'error'); return; }
    setUploadingPhoto(true);
    const formData = new FormData();
    formData.append('photo', file);
    try {
      const res = await fetch(`${BACKEND_URL}/api/profile/photo`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData });
      const data = await res.json();
      if (res.ok) { const pf = data.photoUrl.split('/uploads/')[1]; setProfile(prev => ({ ...prev, profilePhoto: pf })); onUserUpdate({ ...initialUser, profilePhoto: pf }); showToast(t('updateSuccess')); }
      else showToast(data.error || t('updateError'), 'error');
    } catch { showToast(t('serverError'), 'error'); } finally { setUploadingPhoto(false); }
  };

  const handleRcDocumentChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) { showToast('Format non supporté. Utilisez JPEG, PNG, WebP ou PDF.', 'error'); return; }
    if (file.size > 20 * 1024 * 1024) { showToast('Fichier trop volumineux (maximum 20 Mo).', 'error'); return; }
    setUploadingRc(true);
    const formData = new FormData();
    formData.append('rcDocument', file);
    try {
      const res = await fetch(`${BACKEND_URL}/api/profile/rc-document`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData });
      const data = await res.json();
      if (res.ok) { const df = data.documentUrl.split('/uploads/')[1]; setProfile(prev => ({ ...prev, rcDocument: df })); onUserUpdate({ ...initialUser, rcDocument: df }); showToast(t('updateSuccess')); }
      else showToast(data.error || t('updateError'), 'error');
    } catch { showToast(t('serverError'), 'error'); } finally { setUploadingRc(false); }
  };

  if (loading) return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
        {t('verifLoading')}
      </div>
    </div>
  );

  const displayPhone = profile?.phone || null;
  const locationParts = [profile?.commune, profile?.wilaya].filter(Boolean);
  const displayLocation = locationParts.length > 0 ? locationParts.join(', ') : null;
  const wilayaOptions = wilayas.map(w => ({ value: w.wilaya_id, label: `${String(w.wilaya_id).padStart(2, '0')} - ${w.wilaya_name_latin}` }));
  const communeOptions = communes.map(c => ({ value: c.commune_id, label: c.commune_name_latin }));
  const memberDateStr = profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-DZ' : (locale === 'fr' ? 'fr-DZ' : 'en-US'), { month: 'long', year: 'numeric' }) : '—';
  const completion = computeBuyerCompletion(profile);

  return (
    <div style={{ flex: 1, padding: '32px 40px', overflowY: 'auto', textAlign: 'start' }}>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: '80px', right: dir === 'ltr' ? '24px' : 'auto', left: dir === 'rtl' ? '24px' : 'auto', zIndex: 1000, background: toast.type === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', border: `1px solid ${toast.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`, color: toast.type === 'success' ? 'var(--primary)' : 'var(--danger)', padding: '12px 20px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px', flexDirection: dir === 'rtl' ? 'row-reverse' : 'row', backdropFilter: 'blur(10px)', animation: 'fadeIn 0.3s ease', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
          {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="glass-panel" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '28px', flexWrap: 'wrap', flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <Avatar photoUrl={photoUrl} name={profile?.name} size={96} />
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handlePhotoChange} />
            <button onClick={() => fileInputRef.current?.click()} disabled={uploadingPhoto} title="Modifier la photo de profil" style={{ position: 'absolute', bottom: '0', right: dir === 'ltr' ? '0' : 'auto', left: dir === 'rtl' ? '0' : 'auto', width: '32px', height: '32px', borderRadius: '50%', background: 'var(--primary)', border: '2px solid var(--bg-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'transform 0.2s ease' }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
              {uploadingPhoto ? <div style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> : <Camera size={14} style={{ color: 'white' }} />}
            </button>
          </div>
          <div style={{ flex: 1, minWidth: '200px', textAlign: 'start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px', flexWrap: 'wrap', flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}>
              <h1 style={{ fontSize: '1.6rem', margin: 0 }}>{profile?.name}</h1>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: '700', background: 'rgba(59,130,246,0.15)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)', flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}>
                <ShoppingBag size={11} /> {t('role_buyer')}
              </span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '0 0 4px', direction: 'ltr', textAlign: dir === 'rtl' ? 'right' : 'left' }}>{profile?.email}</p>
            {displayPhone && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px', margin: '0 0 2px', flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}><Phone size={13} /> <span style={{ direction: 'ltr' }}>{displayPhone}</span></p>}
            {displayLocation && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px', margin: 0, flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}><MapPin size={13} /> <span>{displayLocation}</span></p>}
          </div>
          <div style={{ display: 'flex', gap: '10px', flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}>
            {!editing ? (
              <>
                <button onClick={() => setEditing(true)} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.875rem' }}><Edit3 size={15} /> {t('editBtn')}</button>
                <button onClick={onNavigateToDashboard} className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.875rem' }}>{t('backToDash')}</button>
              </>
            ) : (
              <>
                <button onClick={() => setEditing(false)} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.875rem' }}><X size={15} /> {t('cancelBtn')}</button>
                <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.875rem' }}>
                  {saving ? <div style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> : <Save size={15} />}
                  {t('saveBtn')}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Completion Banner */}
      <div className="glass-panel" style={{ padding: '20px 24px', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'start' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
            {locale === 'ar' ? 'نسبة اكتمال الملف الشخصي' : 'Taux de complétion du profil'}
          </span>
          <span style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--primary)' }}>{completion}%</span>
        </div>
        <div style={{ width: '100%', height: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '5px', overflow: 'hidden' }}>
          <div style={{ width: `${completion}%`, height: '100%', background: 'linear-gradient(90deg, var(--primary) 0%, #10B981 100%)', borderRadius: '5px', transition: 'width 0.5s ease-out' }} />
        </div>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
          {locale === 'ar' ? 'يجب أن تصل نسبة اكتمال ملفك الشخصي إلى 70% على الأقل لتتمكن من إنشاء مزاد جديد.' : "Votre profil doit être complété à au moins 70% pour pouvoir lancer une enchère."}
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '16px', borderBottom: '1px solid var(--border)', marginBottom: '24px', paddingBottom: '2px', flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}>
        {[{ id: 'profile', icon: <User size={16} />, label: locale === 'ar' ? 'معلومات الحساب' : 'Informations du profil' }, { id: 'security', icon: <Shield size={16} />, label: locale === 'ar' ? 'الأمان والوصول' : 'Sécurité & Accès' }].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ background: 'none', border: 'none', padding: '10px 16px', cursor: 'pointer', fontSize: '0.95rem', fontWeight: activeTab === tab.id ? 700 : 500, color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-muted)', borderBottom: `3px solid ${activeTab === tab.id ? 'var(--primary)' : 'transparent'}`, transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', gap: 8, flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}>
            {tab.icon}<span>{tab.label}</span>
          </button>
        ))}
      </div>

      {activeTab === 'profile' ? (
        <div style={{ display: 'grid', gridTemplateColumns: dir === 'rtl' ? '320px 1fr' : '1fr 320px', gap: '24px', flexWrap: 'wrap' }}>
          {dir === 'rtl' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="glass-panel" style={{ textAlign: 'start' }}>
                <h3 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}><BarChart2 size={14} /> <span>{t('statistics')}</span></h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <StatItem value={profile?.stats?.auctionsCount ?? 0} label={t('auctionsCreated')} color="var(--secondary)" dir={dir} />
                  <StatItem value={memberDateStr} label={t('memberSinceLabel')} color="var(--primary)" isText dir={dir} />
                </div>
              </div>
              <div className="glass-panel" style={{ textAlign: 'center' }}>
                <div style={{ display: 'inline-flex', padding: '12px', borderRadius: '50%', background: 'rgba(16,185,129,0.1)', marginBottom: '12px' }}><CheckCircle size={24} style={{ color: 'var(--primary)' }} /></div>
                <p style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--primary)', margin: '0 0 4px' }}>{t('accountVerified')}</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>{t('emailConfirmed')}</p>
              </div>
            </div>
          )}

          {/* Profile Info Panel */}
          <div className="glass-panel" style={{ textAlign: 'start' }}>
            <h3 style={{ fontSize: '0.8rem', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}>
              <User size={14} /> <span>{t('personalInfo')}</span>
            </h3>
            {!editing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {[
                  { icon: <User size={16} />, label: t('fullNameLabel'), value: profile?.name },
                  { icon: <Mail size={16} />, label: t('emailLabel'), value: profile?.email },
                  { icon: <Phone size={16} />, label: t('phoneLabel'), value: displayPhone || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('phoneNotProvided')}</span> },
                  { icon: <MapPin size={16} />, label: t('wilayaLabel'), value: profile?.wilaya || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('wilayaNotProvided')}</span> },
                  { icon: <MapPin size={16} />, label: t('communeLabel'), value: profile?.commune || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('communeNotProvided')}</span> },
                  { icon: <User size={16} />, label: locale === 'ar' ? 'نوع الكيان' : "Type d'entité", value: profile?.entity_type === 'entreprise' ? (locale === 'ar' ? 'مؤسسة' : 'Entreprise') : (locale === 'ar' ? 'فرد' : 'Particulier') },
                  ...(profile?.entity_type === 'entreprise' ? [
                    { icon: <ShoppingBag size={16} />, label: locale === 'ar' ? 'الاسم التجاري' : 'Nom commercial', value: profile?.nom_commercial || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Non renseigné</span> },
                    { icon: <FileText size={16} />, label: locale === 'ar' ? 'الشكل القانوني' : 'Forme juridique', value: profile?.forme_juridique || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Non renseigné</span> },
                    { icon: <FileText size={16} />, label: locale === 'ar' ? 'رقم السجل التجاري (RC)' : 'Registre de commerce (RC)', value: profile?.rc || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Non renseigné</span> },
                    { icon: <FileText size={16} />, label: locale === 'ar' ? 'الرقم التعريف الجبائي (NIF)' : "Numéro d'identification fiscale (NIF)", value: profile?.nif || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Non renseigné</span> },
                    { icon: <ShoppingBag size={16} />, label: locale === 'ar' ? 'قطاع النشاط' : "Secteur d'activité", value: profile?.secteur_activite || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Non renseigné</span> },
                  ] : []),
                  { icon: <Tractor size={16} />, label: locale === 'ar' ? 'وسائل النقل' : 'Possède un transport', value: profile?.possede_transport ? (locale === 'ar' ? 'نعم ✓' : 'Oui ✓') : (locale === 'ar' ? 'لا ✗' : 'Non ✗') },
                  { icon: <Tractor size={16} />, label: locale === 'ar' ? 'غرفة تبريد' : 'Possède une chambre froide', value: profile?.possede_chambre_froide ? (locale === 'ar' ? 'نعم ✓' : 'Oui ✓') : (locale === 'ar' ? 'لا ✗' : 'Non ✗') },
                  { icon: <FileText size={16} />, label: t('bioLabel'), value: profile?.bio || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('bioPlaceholder')}</span> },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}>
                    <div style={{ color: 'var(--text-muted)', marginTop: '2px', flexShrink: 0 }}>{item.icon}</div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>{item.label}</div>
                      <div style={{ color: 'var(--text-main)', fontSize: '0.95rem' }}>{item.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Name */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="buyer-edit-name">{t('fullNameLabel')}</label>
                  <div style={{ position: 'relative' }}>
                    <input id="buyer-edit-name" type="text" placeholder={t('fullNamePlaceholder')} value={form.name || ''} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} style={{ width: '100%', paddingLeft: dir === 'ltr' ? '40px' : '16px', paddingRight: dir === 'rtl' ? '40px' : '16px', textAlign: 'start' }} />
                    <User size={15} style={{ position: 'absolute', left: dir === 'ltr' ? '12px' : 'auto', right: dir === 'rtl' ? '12px' : 'auto', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  </div>
                </div>
                {/* Phone */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="buyer-edit-phone">{t('phoneLabel')}</label>
                  <div style={{ display: 'flex', flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRight: dir === 'ltr' ? 'none' : '1px solid var(--border)', borderLeft: dir === 'rtl' ? 'none' : '1px solid var(--border)', borderRadius: dir === 'ltr' ? '8px 0 0 8px' : '0 8px 8px 0', whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '0.88rem', minWidth: '80px' }}>
                      <svg width="20" height="14" viewBox="0 0 22 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '2px', flexShrink: 0 }}><rect width="11" height="16" fill="#006233"/><rect x="11" width="11" height="16" fill="white"/><path d="M13.5 8C13.5 9.65685 12.1569 11 10.5 11C8.84315 11 7.5 9.65685 7.5 8C7.5 6.34315 8.84315 5 10.5 5C12.1569 5 13.5 6.34315 13.5 8Z" fill="#D21034"/><path d="M12 8C12 9.10457 11.1046 10 10 10C8.89543 10 8 9.10457 8 8C8 6.89543 8.89543 6 10 6C11.1046 6 12 6.89543 12 8Z" fill="white"/><path d="M12.5 6.5L13.5 8L12.5 9L13.8 8.5L13.8 7.5L12.5 6.5Z" fill="#D21034"/></svg>
                      +213
                    </div>
                    <input id="buyer-edit-phone" type="tel" placeholder="06 12 34 56 78" value={form.phone ? form.phone.replace(/^\+213/, '0') : ''} onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))} style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border)', borderLeft: dir === 'ltr' ? 'none' : '1px solid var(--border)', borderRight: dir === 'rtl' ? 'none' : '1px solid var(--border)', borderRadius: dir === 'ltr' ? '0 8px 8px 0' : '8px 0 0 8px', padding: '11px 14px', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none', textAlign: 'start' }} />
                  </div>
                </div>
                {/* Wilaya */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>{t('wilayaLabel')}</label>
                  <SearchableSelect options={wilayaOptions} value={form.wilaya_id} onChange={handleWilayaChange} placeholder={t('selectPlaceholder')} />
                  {profile?.wilaya && !form.wilaya_id && <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>{locale === 'fr' ? 'Actuellement' : (locale === 'ar' ? 'حالياً' : 'Currently')} : <strong>{profile.wilaya}</strong></p>}
                </div>
                {/* Commune */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>{t('communeLabel')}</label>
                  <SearchableSelect options={communeOptions} value={form.commune_id} onChange={handleCommuneChange} placeholder={form.wilaya_id ? t('selectPlaceholder') : t('wilayaFirst')} disabled={communes.length === 0} />
                  {profile?.commune && !form.commune_id && <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>{locale === 'fr' ? 'Actuellement' : (locale === 'ar' ? 'حالياً' : 'Currently')} : <strong>{profile.commune}</strong></p>}
                </div>
                {/* Bio */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="buyer-edit-bio">{t('bioLabel')}</label>
                  <textarea id="buyer-edit-bio" placeholder={t('bioPlaceholder')} value={form.bio || ''} onChange={e => setForm(prev => ({ ...prev, bio: e.target.value }))} rows={4} maxLength={500} style={{ width: '100%', resize: 'vertical', textAlign: 'start' }} />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: dir === 'rtl' ? 'left' : 'right', display: 'block' }}>{(form.bio || '').length}/500</span>
                </div>
                {/* Buyer-specific fields */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>{locale === 'ar' ? 'نوع الكيان' : "Type d'entité"} <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.75rem' }}>({locale === 'ar' ? 'محدد عند التسجيل' : "défini à l'inscription"})</span></label>
                  <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-main)', fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'not-allowed', opacity: 0.7 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '50%', background: form.entity_type === 'entreprise' ? 'var(--warning)' : 'var(--primary)', color: 'white', fontSize: '0.7rem' }}>{form.entity_type === 'entreprise' ? 'E' : 'P'}</span>
                    {form.entity_type === 'entreprise' ? (locale === 'ar' ? 'مؤسسة' : 'Entreprise') : (locale === 'ar' ? 'فرد' : 'Particulier')}
                  </div>
                </div>
                {form.entity_type === 'entreprise' && (
                  <>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>{locale === 'ar' ? 'الاسم التجاري' : 'Nom commercial'}</label>
                      <input type="text" placeholder={locale === 'ar' ? 'مثال: شركة التوزيع الكبرى' : 'Ex: DistriAgri S.A.R.L.'} value={form.nom_commercial || ''} onChange={e => setForm(prev => ({ ...prev, nom_commercial: e.target.value }))} style={{ width: '100%', textAlign: 'start' }} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>{locale === 'ar' ? 'الشكل القانوني' : 'Forme juridique'}</label>
                      <select value={form.forme_juridique || ''} onChange={e => setForm(prev => ({ ...prev, forme_juridique: e.target.value }))} style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none', cursor: 'pointer' }}>
                        <option value="">{locale === 'ar' ? '-- اختر الشكل القانوني --' : '-- Choisir forme juridique --'}</option>
                        <option value="SARL">SARL</option><option value="EURL">EURL</option><option value="SNC">SNC</option><option value="Entreprise individuelle">Entreprise individuelle</option><option value="Autre">Autre</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>{locale === 'ar' ? 'رقم السجل التجاري (RC)' : 'Numéro Registre de Commerce (RC)'}</label>
                      <input type="text" placeholder="Ex: 16/00-1234567B20" value={form.rc || ''} onChange={e => setForm(prev => ({ ...prev, rc: e.target.value }))} style={{ width: '100%', textAlign: 'start' }} />
                    </div>
                    {/* RC Document upload */}
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>{locale === 'ar' ? 'تحميل وثيقة السجل التجاري' : 'Joindre le Registre de Commerce'}</label>
                      <input ref={rcFileInputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" style={{ display: 'none' }} onChange={handleRcDocumentChange} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <button type="button" onClick={() => rcFileInputRef.current?.click()} disabled={uploadingRc} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', fontSize: '0.85rem', fontWeight: 600, background: 'rgba(245,158,11,0.12)', color: '#d97706', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '8px', cursor: uploadingRc ? 'not-allowed' : 'pointer', transition: 'all 0.3s ease' }}>
                          {uploadingRc ? <div style={{ width: '14px', height: '14px', border: '2px solid rgba(217,119,6,0.3)', borderTopColor: '#d97706', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> : <FileText size={15} />}
                          {profile?.rcDocument ? (locale === 'ar' ? 'تغيير الملف' : 'Changer le fichier') : (locale === 'ar' ? 'اختيار ملف' : 'Choisir un fichier')}
                        </button>
                        {profile?.rcDocument && <a href={`${BACKEND_URL}/uploads/${profile.rcDocument}`} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', fontSize: '0.85rem', background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '8px', textDecoration: 'none', fontWeight: 600 }}><FileText size={15} />{locale === 'ar' ? 'عرض الوثيقة' : 'Voir le document'}</a>}
                      </div>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>{locale === 'ar' ? 'JPEG, PNG, WebP أو PDF. الحد الأقصى 20 ميغابايت.' : 'JPEG, PNG, WebP ou PDF. Max 20 Mo.'}</p>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>{locale === 'ar' ? 'الرقم التعريف الجبائي (NIF)' : "Numéro d'Identification Fiscale (NIF)"}</label>
                      <input type="text" placeholder="Ex: 001234567890123" value={form.nif || ''} onChange={e => setForm(prev => ({ ...prev, nif: e.target.value }))} style={{ width: '100%', textAlign: 'start' }} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>{locale === 'ar' ? 'قطاع النشاط' : "Secteur d'activité"}</label>
                      <select value={form.secteur_activite || ''} onChange={e => setForm(prev => ({ ...prev, secteur_activite: e.target.value }))} style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none', cursor: 'pointer' }}>
                        <option value="">{locale === 'ar' ? '-- اختر القطاع --' : '-- Choisir secteur --'}</option>
                        <option value="Agroalimentaire">Agroalimentaire</option><option value="Distribution">Distribution</option><option value="Restauration">Restauration</option><option value="Export">Export</option><option value="Transformation">Transformation</option><option value="Autre">Autre</option>
                      </select>
                    </div>
                  </>
                )}
                <div style={{ display: 'flex', gap: '20px', marginTop: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                    <input type="checkbox" checked={!!form.possede_transport} onChange={e => setForm(prev => ({ ...prev, possede_transport: e.target.checked }))} style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--primary)' }} />
                    <span>{locale === 'ar' ? 'أملك وسيلة نقل' : 'Possède un transport'}</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                    <input type="checkbox" checked={!!form.possede_chambre_froide} onChange={e => setForm(prev => ({ ...prev, possede_chambre_froide: e.target.checked }))} style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--primary)' }} />
                    <span>{locale === 'ar' ? 'أملك غرفة تبريد' : 'Possède une chambre froide'}</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {dir === 'ltr' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="glass-panel" style={{ textAlign: 'start' }}>
                <h3 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}><BarChart2 size={14} /> {t('statistics')}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <StatItem value={profile?.stats?.auctionsCount ?? 0} label={t('auctionsCreated')} color="var(--secondary)" dir={dir} />
                  <StatItem value={memberDateStr} label={t('memberSinceLabel')} color="var(--primary)" isText dir={dir} />
                </div>
              </div>
              <div className="glass-panel" style={{ textAlign: 'center' }}>
                <div style={{ display: 'inline-flex', padding: '12px', borderRadius: '50%', background: 'rgba(16,185,129,0.1)', marginBottom: '12px' }}><CheckCircle size={24} style={{ color: 'var(--primary)' }} /></div>
                <p style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--primary)', margin: '0 0 4px' }}>{t('accountVerified')}</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>{t('emailConfirmed')}</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <SecuritySettingsTab token={token} profile={profile} setProfile={setProfile} onUserUpdate={onUserUpdate} showToast={showToast} onLogout={onLogout} initialUser={initialUser} />
      )}
    </div>
  );
}
