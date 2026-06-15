import React, { useState, useEffect, useRef } from 'react';
import { User, Mail, Phone, MapPin, FileText, Camera, Tractor, ShoppingBag, Edit3, Save, X, CheckCircle, AlertCircle, BarChart2 } from 'lucide-react';

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
          fontSize: '0.9rem',
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

function Avatar({ photoUrl, name, size = 96 }) {
  const initials = name ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '?';
  const colors = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444'];
  const colorIndex = name ? name.charCodeAt(0) % colors.length : 0;

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt="Photo de profil"
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--primary)', display: 'block' }}
      />
    );
  }

  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `linear-gradient(135deg, ${colors[colorIndex]}, ${colors[(colorIndex + 1) % colors.length]})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: '800', color: 'white',
      border: '3px solid rgba(255,255,255,0.15)',
      flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}

export default function ProfilePage({ token, user: initialUser, onUserUpdate, onNavigateToDashboard }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [toast, setToast] = useState(null);

  // Wilaya / Commune selects for edit mode
  const [wilayas, setWilayas] = useState([]);
  const [allCommunes, setAllCommunes] = useState([]);
  const [communes, setCommunes] = useState([]);

  const fileInputRef = useRef(null);

  const photoUrl = profile?.profilePhoto
    ? `${BACKEND_URL}/uploads/${profile.profilePhoto}`
    : null;

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Load cities data
  useEffect(() => {
    fetch('/cities.json')
      .then(r => r.json())
      .then(data => {
        setWilayas(data.wilayas || []);
        setAllCommunes(data.communes || []);
      })
      .catch(() => {});
  }, []);

  // Filter communes when wilaya changes in form
  useEffect(() => {
    if (!form.wilaya_id) {
      setCommunes([]);
      return;
    }
    const id = parseInt(form.wilaya_id);
    const filtered = allCommunes
      .filter(c => c.wilaya_id === id)
      .sort((a, b) => a.commune_name_latin.localeCompare(b.commune_name_latin));
    setCommunes(filtered);
  }, [form.wilaya_id, allCommunes]);

  const fetchProfile = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setProfile(data);
        setForm({
          name: data.name,
          phone: data.phone || '',
          bio: data.bio || '',
          wilaya: data.wilaya || '',
          commune: data.commune || '',
          wilaya_id: '', 
          commune_id: '', 
        });
      }
    } catch {
      showToast('Impossible de charger le profil.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Pre-populate wilaya_id and commune_id once wilayas and profile are loaded
  useEffect(() => {
    if (profile && wilayas.length > 0) {
      const matchedWilaya = wilayas.find(
        w => w.wilaya_name_latin.toLowerCase() === (profile.wilaya || '').toLowerCase()
      );
      if (matchedWilaya) {
        setForm(prev => {
          if (prev.wilaya_id) return prev; // already set or modified by user
          let matchedCommuneId = '';
          if (allCommunes.length > 0 && profile.commune) {
            const matchedCommune = allCommunes.find(
              c => c.wilaya_id === matchedWilaya.wilaya_id &&
                   c.commune_name_latin.toLowerCase() === profile.commune.toLowerCase()
            );
            if (matchedCommune) {
              matchedCommuneId = matchedCommune.commune_id;
            }
          }
          return {
            ...prev,
            wilaya_id: String(matchedWilaya.wilaya_id),
            commune_id: String(matchedCommuneId),
          };
        });
      }
    }
  }, [profile, wilayas, allCommunes]);

  useEffect(() => { fetchProfile(); }, []);

  // When wilaya_id changes in form, reset commune_id
  const handleWilayaChange = (val) => {
    const wId = val && val.target ? val.target.value : val;
    const selectedWilaya = wilayas.find(w => w.wilaya_id === parseInt(wId));
    setForm(prev => ({
      ...prev,
      wilaya_id: wId,
      wilaya: selectedWilaya ? selectedWilaya.wilaya_name_latin : '',
      commune_id: '',
      commune: '',
    }));
  };

  const handleCommuneChange = (val) => {
    const cId = val && val.target ? val.target.value : val;
    const selectedCommune = communes.find(c => c.commune_id === parseInt(cId));
    setForm(prev => ({
      ...prev,
      commune_id: cId,
      commune: selectedCommune ? selectedCommune.commune_name_latin : '',
    }));
  };

  const handlePhoneChange = (e) => {
    setForm(prev => ({ ...prev, phone: e.target.value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let phoneToSave = form.phone || '';
      if (phoneToSave && !phoneToSave.startsWith('+')) {
        phoneToSave = `+213${phoneToSave.replace(/^0/, '').replace(/\s/g, '')}`;
      }

      const payload = {
        name: form.name,
        phone: phoneToSave,
        bio: form.bio,
        wilaya: form.wilaya,
        commune: form.commune,
      };

      const res = await fetch(`${BACKEND_URL}/api/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setProfile(prev => ({ ...prev, ...payload }));
        onUserUpdate({ ...initialUser, name: form.name });
        setEditing(false);
        showToast('Profil mis à jour avec succès.');
      } else {
        showToast(data.error || 'Erreur lors de la sauvegarde.', 'error');
      }
    } catch {
      showToast('Erreur de connexion.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      showToast('Format non supporté. Utilisez JPEG, PNG ou WebP.', 'error');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      showToast('Fichier trop volumineux (maximum 20 Mo).', 'error');
      return;
    }

    setUploadingPhoto(true);
    const formData = new FormData();
    formData.append('photo', file);

    try {
      const res = await fetch(`${BACKEND_URL}/api/profile/photo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setProfile(prev => ({ ...prev, profilePhoto: data.photoUrl.split('/uploads/')[1] }));
        showToast('Photo de profil mise à jour.');
      } else {
        showToast(data.error || 'Erreur lors de l\'envoi.', 'error');
      }
    } catch {
      showToast('Erreur lors de l\'envoi de la photo.', 'error');
    } finally {
      setUploadingPhoto(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          Chargement du profil…
        </div>
      </div>
    );
  }

  const displayPhone = profile?.phone || null;
  const locationParts = [profile?.commune, profile?.wilaya].filter(Boolean);
  const displayLocation = locationParts.length > 0 ? locationParts.join(', ') : null;

  // Map lists to searchable options format
  const wilayaOptions = wilayas.map(w => ({
    value: w.wilaya_id,
    label: `${String(w.wilaya_id).padStart(2, '0')} - ${w.wilaya_name_latin}`,
  }));

  const communeOptions = communes.map(c => ({
    value: c.commune_id,
    label: c.commune_name_latin,
  }));

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px' }}>
      {/* Toast notification */}
      {toast && (
        <div style={{
          position: 'fixed', top: '80px', right: '24px', zIndex: 1000,
          background: toast.type === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
          border: `1px solid ${toast.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
          color: toast.type === 'success' ? 'var(--primary)' : 'var(--danger)',
          padding: '12px 20px', borderRadius: '10px',
          display: 'flex', alignItems: 'center', gap: '8px',
          backdropFilter: 'blur(10px)', animation: 'fadeIn 0.3s ease',
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        }}>
          {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          {toast.message}
        </div>
      )}

      {/* Profile Header Card */}
      <div className="glass-panel" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '28px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <Avatar photoUrl={photoUrl} name={profile?.name} size={96} />
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handlePhotoChange} />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto}
              title="Modifier la photo de profil"
              style={{
                position: 'absolute', bottom: '0', right: '0',
                width: '32px', height: '32px', borderRadius: '50%',
                background: 'var(--primary)', border: '2px solid var(--bg-main)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', transition: 'transform 0.2s ease',
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              {uploadingPhoto
                ? <div style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                : <Camera size={14} style={{ color: 'white' }} />
              }
            </button>
          </div>

          <div style={{ flex: 1, minWidth: '200px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.6rem', margin: 0 }}>{profile?.name}</h1>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                padding: '3px 10px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: '700',
                background: profile?.role === 'buyer' ? 'rgba(59,130,246,0.15)' : 'rgba(245,158,11,0.15)',
                color: profile?.role === 'buyer' ? '#3b82f6' : '#f59e0b',
                border: `1px solid ${profile?.role === 'buyer' ? 'rgba(59,130,246,0.3)' : 'rgba(245,158,11,0.3)'}`,
              }}>
                {profile?.role === 'buyer' ? <ShoppingBag size={11} /> : <Tractor size={11} />}
                {profile?.role === 'buyer' ? 'Acheteur' : 'Producteur'}
              </span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '0 0 4px' }}>{profile?.email}</p>
            {displayPhone && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px', margin: '0 0 2px' }}>
                <Phone size={13} /> {displayPhone}
              </p>
            )}
            {displayLocation && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px', margin: 0 }}>
                <MapPin size={13} /> {displayLocation}
              </p>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            {!editing ? (
              <>
                <button onClick={() => setEditing(true)} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.875rem' }}>
                  <Edit3 size={15} /> Modifier
                </button>
                <button onClick={onNavigateToDashboard} className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.875rem' }}>
                  Tableau de bord
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setEditing(false)} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.875rem' }}>
                  <X size={15} /> Annuler
                </button>
                <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.875rem' }}>
                  {saving ? <div style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> : <Save size={15} />}
                  Enregistrer
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '24px', flexWrap: 'wrap' }}>
        <div className="glass-panel">
          <h3 style={{ fontSize: '0.8rem', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <User size={14} /> Informations personnelles
          </h3>

          {!editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {[
                { icon: <User size={16} />, label: 'Nom', value: profile?.name },
                { icon: <Mail size={16} />, label: 'E-mail', value: profile?.email },
                { icon: <Phone size={16} />, label: 'Téléphone', value: displayPhone || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Non renseigné</span> },
                { icon: <MapPin size={16} />, label: 'Wilaya', value: profile?.wilaya || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Non renseignée</span> },
                { icon: <MapPin size={16} />, label: 'Commune', value: profile?.commune || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Non renseignée</span> },
                { icon: <FileText size={16} />, label: 'Bio', value: profile?.bio || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Aucune description</span> },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
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
                <label htmlFor="edit-name">Nom complet / Dénomination</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="edit-name" type="text" placeholder="Votre nom ou organisation"
                    value={form.name || ''}
                    onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                    style={{ width: '100%', paddingLeft: '40px' }}
                  />
                  <User size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                </div>
              </div>

              {/* Phone with +213 prefix */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="edit-phone">Téléphone</label>
                <div style={{ display: 'flex' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '0 12px', background: 'rgba(255,255,255,0.04)',
                    border: '1px solid var(--border)', borderRight: 'none',
                    borderRadius: '8px 0 0 8px', whiteSpace: 'nowrap',
                    color: 'var(--text-muted)', fontSize: '0.88rem', minWidth: '80px',
                  }}>
                    <svg width="20" height="14" viewBox="0 0 22 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '2px', flexShrink: 0 }}>
                      <rect width="11" height="16" fill="#006233"/>
                      <rect x="11" width="11" height="16" fill="white"/>
                      <path d="M13.5 8C13.5 9.65685 12.1569 11 10.5 11C8.84315 11 7.5 9.65685 7.5 8C7.5 6.34315 8.84315 5 10.5 5C12.1569 5 13.5 6.34315 13.5 8Z" fill="#D21034"/>
                      <path d="M12 8C12 9.10457 11.1046 10 10 10C8.89543 10 8 9.10457 8 8C8 6.89543 8.89543 6 10 6C11.1046 6 12 6.89543 12 8Z" fill="white"/>
                      <path d="M12.5 6.5L13.5 8L12.5 9L13.8 8.5L13.8 7.5L12.5 6.5Z" fill="#D21034"/>
                    </svg>
                    +213
                  </div>
                  <input
                    id="edit-phone" type="tel"
                    placeholder="06 12 34 56 78"
                    value={form.phone ? form.phone.replace(/^\+213/, '0') : ''}
                    onChange={handlePhoneChange}
                    style={{
                      flex: 1, background: 'var(--bg-input)',
                      border: '1px solid var(--border)', borderLeft: 'none',
                      borderRadius: '0 8px 8px 0', padding: '11px 14px',
                      color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none',
                    }}
                  />
                </div>
              </div>

              {/* Wilaya Searchable Dropdown */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Wilaya</label>
                <SearchableSelect
                  options={wilayaOptions}
                  value={form.wilaya_id}
                  onChange={handleWilayaChange}
                  placeholder="Sélectionner une wilaya..."
                />
                {profile?.wilaya && !form.wilaya_id && (
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Actuellement : <strong>{profile.wilaya}</strong>
                  </p>
                )}
              </div>

              {/* Commune Searchable Dropdown */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Commune</label>
                <SearchableSelect
                  options={communeOptions}
                  value={form.commune_id}
                  onChange={handleCommuneChange}
                  placeholder={form.wilaya_id ? "Sélectionner une commune..." : "Sélectionnez d'abord une wilaya..."}
                  disabled={communes.length === 0}
                />
                {profile?.commune && !form.commune_id && (
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Actuellement : <strong>{profile.commune}</strong>
                  </p>
                )}
              </div>

              {/* Bio */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="edit-bio">Bio / Description</label>
                <textarea
                  id="edit-bio"
                  placeholder="Décrivez votre activité, vos spécialités, vos produits…"
                  value={form.bio || ''}
                  onChange={e => setForm(prev => ({ ...prev, bio: e.target.value }))}
                  rows={4}
                  maxLength={500}
                  style={{ width: '100%', resize: 'vertical' }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right', display: 'block' }}>
                  {(form.bio || '').length}/500
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Stats Card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="glass-panel">
            <h3 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BarChart2 size={14} /> Statistiques
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {profile?.role === 'buyer' ? (
                <StatItem value={profile?.stats?.auctionsCount ?? 0} label="Enchères créées" color="var(--secondary)" />
              ) : (
                <StatItem value={profile?.stats?.bidsCount ?? 0} label="Offres soumises" color="var(--accent)" />
              )}
              <StatItem
                value={profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('fr-DZ', { month: 'long', year: 'numeric' }) : '—'}
                label="Membre depuis"
                color="var(--primary)"
                isText
              />
            </div>
          </div>

          <div className="glass-panel" style={{ textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', padding: '12px', borderRadius: '50%', background: 'rgba(16,185,129,0.1)', marginBottom: '12px' }}>
              <CheckCircle size={24} style={{ color: 'var(--primary)' }} />
            </div>
            <p style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--primary)', margin: '0 0 4px' }}>Compte vérifié</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Adresse e-mail confirmée</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatItem({ value, label, color, isText }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontWeight: '800', color, fontSize: isText ? '0.85rem' : '1.25rem' }}>{value}</span>
    </div>
  );
}
