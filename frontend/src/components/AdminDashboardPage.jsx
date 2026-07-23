import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Users, Gavel, Search, ChevronLeft, ChevronRight, CheckCircle2, XCircle, KeyRound, X, Eye, EyeOff, FileText, MapPin, Menu, Ban, RotateCcw, MessageSquare } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';
import { BACKEND_URL } from '../utils/config.js';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useClickOutside } from '../hooks/useClickOutside';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

function StatTile({ label, value }) {
  return (
    <div className="glass-panel" style={{ padding: '16px 20px' }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', marginTop: 4 }}>{value}</div>
    </div>
  );
}

function ChangePasswordModal({ user, onSubmit, onClose }) {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const cardRef = useRef(null);
  useEscapeKey(true, onClose);
  useFocusTrap(cardRef, true);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 8) { setError(t('passwordMinChar')); return; }
    if (password !== confirmPassword) { setError(t('passwordMismatch')); return; }
    setError('');
    setSubmitting(true);
    await onSubmit(password);
    setSubmitting(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div ref={cardRef} className="modal-card animate-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }} role="dialog" aria-modal="true" aria-label={t('adminChangePasswordTitle')}>
        <button className="modal-close-btn" onClick={onClose} aria-label={t('captchaClose')}><X size={18} /></button>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🔑</div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: 6, color: 'var(--text-main)' }}>{t('adminChangePasswordTitle')}</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t('adminChangePasswordDesc', { name: user.name })}</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="admin-new-password">{t('passwordLabel')}</label>
            <div style={{ position: 'relative' }}>
              <input
                id="admin-new-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder={t('passwordHelpPlaceholder')}
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoFocus
              />
              <button type="button" onClick={() => setShowPassword(p => !p)}
                aria-label={showPassword ? t('hidePasswordLabel') : t('showPasswordLabel')}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="admin-confirm-password">{t('confirmPasswordLabel')}</label>
            <input
              id="admin-confirm-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder={t('confirmPasswordPlaceholder')}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
            />
          </div>
          {error && <div className="inline-alert-danger" style={{ marginBottom: 16 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>{t('cancelBtn')}</button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={submitting || !password || !confirmPassword}>
              {t('confirmBtn')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}>
      <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{label}</span>
      <span style={{ color: 'var(--text-main)', fontWeight: 600, textAlign: 'right' }}>{value ?? '-'}</span>
    </div>
  );
}

function DetailSection({ title, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

// Document keys are stored as "<uuid>.<ext>" (see backend storage.js) — the
// extension alone tells us whether it's safe to render as an <img> or whether
// it's a PDF (rcDocument/ficheSignaletiqueDocument/carteAgriculteurDocument
// accept both; profilePhoto is always an image).
function isPdfKey(key) {
  return /\.pdf$/i.test(key || '');
}

function DocumentThumbnail({ label, url, isPdf }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', width: 96 }}>
      <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 700, textAlign: 'center' }}>{label}</div>
      <div style={{ width: 96, height: 96, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'border-color 0.2s' }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}>
        {isPdf ? <FileText size={30} style={{ color: 'var(--text-muted)' }} /> : <img src={url} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
      </div>
    </a>
  );
}

// Small read-only satellite/street map for a single parcelle, defaulting to
// satellite — same tile layers and toggle pattern as the producer's own
// parcelle editor (ProducerParcellesPage.jsx), minus the editing (no
// draggable marker, no click-to-set).
function ParcelleMiniMap({ lat, lng }) {
  const mapRef = useRef(null);
  const leafletMapRef = useRef(null);
  const { locale } = useTranslation();
  const [mapLayer, setMapLayer] = useState('satellite');

  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current) return;
    const map = L.map(mapRef.current, { center: [lat, lng], zoom: 14, zoomControl: false, attributionControl: false });

    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18 });
    const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 });
    satelliteLayer.addTo(map);
    map.satelliteLayer = satelliteLayer;
    map.streetLayer = streetLayer;

    const labelLayer = L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18, opacity: 0.7 });
    labelLayer.addTo(map);
    map.labelLayer = labelLayer;

    L.marker([lat, lng]).addTo(map);
    leafletMapRef.current = map;
    const t = setTimeout(() => map.invalidateSize(), 200);
    return () => { clearTimeout(t); map.remove(); leafletMapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSwitchLayer = (layerType) => {
    setMapLayer(layerType);
    const map = leafletMapRef.current;
    if (!map) return;
    if (layerType === 'satellite') {
      if (map.hasLayer(map.streetLayer)) map.removeLayer(map.streetLayer);
      map.satelliteLayer.addTo(map);
      map.labelLayer.addTo(map);
    } else {
      if (map.hasLayer(map.satelliteLayer)) map.removeLayer(map.satelliteLayer);
      if (map.hasLayer(map.labelLayer)) map.removeLayer(map.labelLayer);
      map.streetLayer.addTo(map);
    }
  };

  return (
    <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', marginTop: 8 }}>
      <div ref={mapRef} style={{ height: 160, width: '100%' }} />
      <div style={{ position: 'absolute', top: 8, insetInlineEnd: 8, zIndex: 1000, display: 'flex', gap: 4, background: 'rgba(10,15,25,0.85)', backdropFilter: 'blur(8px)', padding: 2, borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)' }}>
        <button type="button" onClick={() => handleSwitchLayer('satellite')} style={{ border: 'none', background: mapLayer === 'satellite' ? 'var(--primary)' : 'transparent', color: mapLayer === 'satellite' ? 'white' : 'var(--text-muted)', fontSize: '0.65rem', padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>{locale === 'ar' ? 'قمر صناعي' : 'Satellite'}</button>
        <button type="button" onClick={() => handleSwitchLayer('street')} style={{ border: 'none', background: mapLayer === 'street' ? 'var(--primary)' : 'transparent', color: mapLayer === 'street' ? 'white' : 'var(--text-muted)', fontSize: '0.65rem', padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>{locale === 'ar' ? 'خريطة' : 'Plan'}</button>
      </div>
    </div>
  );
}

// Hamburger menu holding every row action (view, password reset,
// deactivate/reactivate) behind a single click, so the table row stays compact.
function ActionMenu({ user, onView, onChangePassword, onToggleActive, t }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  useClickOutside(wrapRef, open, () => setOpen(false));

  return (
    <div className="action-menu-wrap" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`action-menu-btn ${open ? 'open' : ''}`}
        aria-label={t('adminActionsMenu')}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Menu size={15} />
      </button>
      {open && (
        <div className="action-menu-dropdown">
          <button type="button" onClick={() => { setOpen(false); onView(user); }}>
            <Eye size={14} /> {t('adminViewBtn')}
          </button>
          <button type="button" onClick={() => { setOpen(false); onChangePassword(user); }}>
            <KeyRound size={14} /> {t('adminChangePasswordBtn')}
          </button>
          {user.role !== 'admin' && (
            <button type="button" className={user.isActive ? 'danger' : ''} onClick={() => { setOpen(false); onToggleActive(user); }}>
              {user.isActive ? <Ban size={14} /> : <RotateCcw size={14} />} {user.isActive ? t('adminDeactivateBtn') : t('adminReactivateBtn')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function UserDetailModal({ userId, token, authHeaders, onClose }) {
  const { t, locale, dir } = useTranslation();
  const localeTag = locale === 'ar' ? 'ar-DZ' : locale === 'en' ? 'en-US' : 'fr-DZ';
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAiChats, setShowAiChats] = useState(false);
  const cardRef = useRef(null);
  useEscapeKey(true, onClose);
  useFocusTrap(cardRef, true);

  useEffect(() => {
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetch(`${BACKEND_URL}/api/admin/users/${userId}`, { headers: authHeaders })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (active) setDetail(data); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId, authHeaders]);

  const docUrl = (key) => `${BACKEND_URL}/uploads/${key}?token=${token}`;
  const yesNo = (v) => v ? (locale === 'ar' ? 'نعم' : (locale === 'en' ? 'Yes' : 'Oui')) : (locale === 'ar' ? 'لا' : (locale === 'en' ? 'No' : 'Non'));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div ref={cardRef} className="modal-card animate-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: 560, maxHeight: '85vh', overflowY: 'auto' }} role="dialog" aria-modal="true" aria-label={t('adminUserDetailTitle')}>
        <button className="modal-close-btn" onClick={onClose} aria-label={t('captchaClose')}><X size={18} /></button>
        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>{t('adminLoading')}</p>
        ) : !detail ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>{t('adminNoUsers')}</p>
        ) : (
          <div dir={dir}>
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: 6 }}>{detail.name}</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 700, background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}>
                  {detail.role === 'buyer' ? t('role_buyer') : detail.role === 'producer' ? t('role_producer') : detail.role}
                </span>
                <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 700, background: detail.isVerified ? 'rgba(16,185,129,0.12)' : 'rgba(148,163,184,0.12)', color: detail.isVerified ? 'var(--primary)' : 'var(--text-muted)' }}>
                  {detail.isVerified ? t('adminColVerified') : (locale === 'ar' ? 'غير مفعّل' : (locale === 'en' ? 'Not verified' : 'Non vérifié'))}
                </span>
                <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 700, background: detail.isActive ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', color: detail.isActive ? 'var(--primary)' : '#ef4444' }}>
                  {detail.isActive ? t('adminStatusActive') : t('adminStatusDeactivated')}
                </span>
              </div>
            </div>

            <DetailSection title={locale === 'ar' ? 'معلومات الاتصال' : (locale === 'en' ? 'Contact' : 'Contact')}>
              <DetailRow label={t('adminColEmail')} value={detail.email} />
              <DetailRow label={locale === 'ar' ? 'الهاتف' : (locale === 'en' ? 'Phone' : 'Téléphone')} value={detail.phone || '-'} />
              <DetailRow label={locale === 'ar' ? 'الولاية' : (locale === 'en' ? 'Wilaya' : 'Wilaya')} value={detail.wilaya || '-'} />
              <DetailRow label={locale === 'ar' ? 'البلدية' : (locale === 'en' ? 'Commune' : 'Commune')} value={detail.commune || '-'} />
              {detail.bio && <DetailRow label={locale === 'ar' ? 'نبذة' : (locale === 'en' ? 'Bio' : 'Bio')} value={detail.bio} />}
            </DetailSection>

            <DetailSection title={locale === 'ar' ? 'الحساب' : (locale === 'en' ? 'Account' : 'Compte')}>
              <DetailRow label={t('adminColJoined')} value={detail.createdAt ? new Date(detail.createdAt).toLocaleDateString(localeTag) : '-'} />
              <DetailRow label={locale === 'ar' ? 'التحقق بخطوتين' : (locale === 'en' ? '2FA enabled' : 'Double authentification')} value={yesNo(detail.two_factor_enabled)} />
              {!detail.isActive && detail.deactivatedAt && (
                <DetailRow label={locale === 'ar' ? 'تاريخ التعطيل' : (locale === 'en' ? 'Deactivated on' : 'Désactivé le')} value={new Date(detail.deactivatedAt).toLocaleDateString(localeTag)} />
              )}
            </DetailSection>

            <DetailSection title={t('adminIpHistoryTitle')}>
              {(detail.loginIps || []).length === 0 ? (
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('adminNoIpHistory')}</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {detail.loginIps.map(entry => (
                    <div key={entry.ip} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)', fontSize: '0.8rem' }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-main)', fontFamily: 'monospace' }}>{entry.ip || (locale === 'ar' ? 'غير معروف' : 'Inconnue')}</span>
                      <span style={{ color: 'var(--text-muted)', textAlign: 'right' }}>
                        {t('adminIpLastSeen', { date: new Date(entry.lastSeen).toLocaleDateString(localeTag) })} · {t('adminIpCount', { count: entry.count })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </DetailSection>

            <DetailSection title={t('adminAiChatsTitle')}>
              {detail.aiChatCount > 0 ? (
                <button type="button" className="btn btn-secondary" style={{ fontSize: '0.82rem', padding: '8px 14px', gap: 8 }} onClick={() => setShowAiChats(true)}>
                  <MessageSquare size={14} /> {t('adminViewAiChatsBtn', { count: detail.aiChatCount })}
                </button>
              ) : (
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('adminNoAiChats')}</p>
              )}
            </DetailSection>

            {detail.role === 'producer' && (
              <DetailSection title={locale === 'ar' ? 'التقييم' : (locale === 'en' ? 'Rating' : 'Notation')}>
                <DetailRow
                  label={locale === 'ar' ? 'متوسط التقييم' : (locale === 'en' ? 'Average rating' : 'Note moyenne')}
                  value={detail.averageRating != null ? `${detail.averageRating.toFixed(1)}/5 (${detail.ratingCount})` : (locale === 'ar' ? 'لا يوجد تقييم' : (locale === 'en' ? 'No reviews yet' : 'Aucune évaluation'))}
                />
              </DetailSection>
            )}

            {detail.entity_type === 'entreprise' && (
              <DetailSection title={locale === 'ar' ? 'معلومات مهنية' : (locale === 'en' ? 'Professional information' : 'Informations professionnelles')}>
                <DetailRow label={locale === 'ar' ? 'الاسم التجاري' : (locale === 'en' ? 'Business name' : 'Nom commercial')} value={detail.nom_commercial || '-'} />
                <DetailRow label={locale === 'ar' ? 'الشكل القانوني' : (locale === 'en' ? 'Legal form' : 'Forme juridique')} value={detail.forme_juridique || '-'} />
                <DetailRow label={locale === 'ar' ? 'قطاع النشاط' : (locale === 'en' ? 'Business sector' : "Secteur d'activité")} value={detail.secteur_activite || '-'} />
                <DetailRow label="RC" value={detail.rc || '-'} />
                <DetailRow label="NIF" value={detail.nif || '-'} />
                <DetailRow label={locale === 'ar' ? 'وسيلة نقل' : (locale === 'en' ? 'Has transport' : 'Possède un transport')} value={yesNo(detail.possede_transport)} />
                <DetailRow label={locale === 'ar' ? 'غرفة تبريد' : (locale === 'en' ? 'Has cold storage' : 'Possède une chambre froide')} value={yesNo(detail.possede_chambre_froide)} />
              </DetailSection>
            )}

            {(detail.profilePhoto || detail.rcDocument || detail.ficheSignaletiqueDocument || detail.carteAgriculteurDocument) && (
              <DetailSection title={locale === 'ar' ? 'المستندات' : (locale === 'en' ? 'Documents' : 'Documents')}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
                  {detail.profilePhoto && (
                    <DocumentThumbnail
                      label={locale === 'ar' ? 'صورة الملف الشخصي' : (locale === 'en' ? 'Profile photo' : 'Photo de profil')}
                      url={docUrl(detail.profilePhoto)}
                      isPdf={false}
                    />
                  )}
                  {detail.rcDocument && (
                    <DocumentThumbnail
                      label={locale === 'ar' ? 'السجل التجاري' : (locale === 'en' ? 'Trade register (RC)' : 'Registre de commerce (RC)')}
                      url={docUrl(detail.rcDocument)}
                      isPdf={isPdfKey(detail.rcDocument)}
                    />
                  )}
                  {detail.ficheSignaletiqueDocument && (
                    <DocumentThumbnail
                      label={locale === 'ar' ? 'البطاقة التعريفية' : (locale === 'en' ? 'Identification sheet' : 'Fiche signalétique')}
                      url={docUrl(detail.ficheSignaletiqueDocument)}
                      isPdf={isPdfKey(detail.ficheSignaletiqueDocument)}
                    />
                  )}
                  {detail.carteAgriculteurDocument && (
                    <DocumentThumbnail
                      label={locale === 'ar' ? 'بطاقة الفلاح' : (locale === 'en' ? "Farmer's card" : "Carte d'agriculteur")}
                      url={docUrl(detail.carteAgriculteurDocument)}
                      isPdf={isPdfKey(detail.carteAgriculteurDocument)}
                    />
                  )}
                </div>
              </DetailSection>
            )}

            {detail.role === 'producer' && (
              <DetailSection title={locale === 'ar' ? 'الحقول' : (locale === 'en' ? 'Parcels' : 'Parcelles')}>
                {detail.parcelles.length === 0 ? (
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>{locale === 'ar' ? 'لا توجد حقول' : (locale === 'en' ? 'No parcels registered' : 'Aucune parcelle enregistrée')}</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {detail.parcelles.map(p => (
                      <div key={p.id} style={{ padding: 12, borderRadius: 10, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <MapPin size={13} style={{ color: 'var(--primary)' }} /> {p.intitule} — {p.wilayaName || '-'}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-body)', display: 'flex', flexWrap: 'wrap', gap: '4px 14px' }}>
                          <span>{locale === 'ar' ? 'المساحة' : (locale === 'en' ? 'Area' : 'Superficie')}: {p.superficie ?? '-'} ha</span>
                          {p.irrigationMethod && <span>{locale === 'ar' ? 'الري' : (locale === 'en' ? 'Irrigation' : 'Irrigation')}: {p.irrigationMethod}</span>}
                          {p.soilType && <span>{locale === 'ar' ? 'نوع التربة' : (locale === 'en' ? 'Soil' : 'Sol')}: {p.soilType}</span>}
                        </div>
                        {p.cultures.length > 0 && (
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-body)', marginTop: 6 }}>
                            {p.cultures.map((c, i) => (
                              <span key={i} style={{ display: 'inline-block', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 999, marginRight: 4, marginBottom: 4 }}>
                                {c.type_culture}{c.sous_type_culture?.length > 0 ? ` (${c.sous_type_culture.join(', ')})` : ''}
                              </span>
                            ))}
                          </div>
                        )}
                        {p.latitude != null && p.longitude != null && (
                          <ParcelleMiniMap lat={p.latitude} lng={p.longitude} />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </DetailSection>
            )}
          </div>
        )}
      </div>
      {showAiChats && (
        <AiChatHistoryModal userId={userId} userName={detail?.name} authHeaders={authHeaders} onClose={() => setShowAiChats(false)} />
      )}
    </div>
  );
}

function AiChatHistoryModal({ userId, userName, authHeaders, onClose }) {
  const { t, locale, dir } = useTranslation();
  const localeTag = locale === 'ar' ? 'ar-DZ' : locale === 'en' ? 'en-US' : 'fr-DZ';
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const cardRef = useRef(null);
  useEscapeKey(true, onClose);
  useFocusTrap(cardRef, true);

  useEffect(() => {
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    const params = new URLSearchParams({ page, limit: 10 });
    fetch(`${BACKEND_URL}/api/admin/users/${userId}/ai-chats?${params}`, { headers: authHeaders })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!active || !data) return;
        setChats(data.chats);
        setTotalPages(data.totalPages);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId, page, authHeaders]);

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 600 }}>
      <div ref={cardRef} className="modal-card animate-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: 560, maxHeight: '85vh', overflowY: 'auto' }} role="dialog" aria-modal="true" aria-label={t('adminAiChatsTitle')}>
        <button className="modal-close-btn" onClick={onClose} aria-label={t('captchaClose')}><X size={18} /></button>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: 16 }} dir={dir}>{t('adminAiChatsTitle')} — {userName}</h3>
        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>{t('adminLoading')}</p>
        ) : (
          <div dir={dir}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {chats.map((c, i) => (
                <div key={i} style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 6 }}>{new Date(c.createdAt).toLocaleString(localeTag, { dateStyle: 'medium', timeStyle: 'short' })}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-main)', fontWeight: 700, marginBottom: 4 }}>{c.userMessage}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-body)' }}>{c.assistantReply}</div>
                </div>
              ))}
            </div>
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                <button onClick={() => setPage(p => Math.max(p - 1, 1))} disabled={page <= 1} className="btn btn-secondary" style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {dir === 'rtl' ? <ChevronRight size={14} /> : <ChevronLeft size={14} />} {t('adminPrevPage')}
                </button>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{t('adminPageOf', { page, totalPages })}</span>
                <button onClick={() => setPage(p => Math.min(p + 1, totalPages))} disabled={page >= totalPages} className="btn btn-secondary" style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {t('adminNextPage')} {dir === 'rtl' ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AuctionDetailModal({ auctionId, authHeaders, onClose }) {
  const { t, locale, dir } = useTranslation();
  const localeTag = locale === 'ar' ? 'ar-DZ' : locale === 'en' ? 'en-US' : 'fr-DZ';
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const cardRef = useRef(null);
  useEscapeKey(true, onClose);
  useFocusTrap(cardRef, true);

  useEffect(() => {
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetch(`${BACKEND_URL}/api/admin/auctions/${auctionId}`, { headers: authHeaders })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (active) setDetail(data); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [auctionId, authHeaders]);

  const fmtDate = (iso) => iso ? new Date(iso).toLocaleString(localeTag, { dateStyle: 'medium', timeStyle: 'short' }) : '-';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div ref={cardRef} className="modal-card animate-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: 640, maxHeight: '85vh', overflowY: 'auto' }} role="dialog" aria-modal="true" aria-label={t('adminAuctionDetailTitle')}>
        <button className="modal-close-btn" onClick={onClose} aria-label={t('captchaClose')}><X size={18} /></button>
        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>{t('adminLoading')}</p>
        ) : !detail ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>{t('adminNoAuctions')}</p>
        ) : (
          <div dir={dir}>
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: 6 }}>{detail.title || detail.product}</h3>
              <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 700, background: detail.status === 'open' ? 'rgba(16,185,129,0.12)' : detail.status === 'pending' ? 'rgba(245,158,11,0.12)' : 'rgba(148,163,184,0.12)', color: detail.status === 'open' ? 'var(--primary)' : detail.status === 'pending' ? '#f59e0b' : 'var(--text-muted)' }}>
                {detail.status}
              </span>
            </div>

            <DetailSection title={locale === 'ar' ? 'المشتري' : (locale === 'en' ? 'Buyer' : 'Acheteur')}>
              <DetailRow label={t('adminColName')} value={detail.buyerName} />
              <DetailRow label={locale === 'ar' ? 'الولاية' : (locale === 'en' ? 'Wilaya' : 'Wilaya')} value={detail.buyerWilaya || '-'} />
              <DetailRow label={locale === 'ar' ? 'البلدية' : (locale === 'en' ? 'Commune' : 'Commune')} value={detail.buyerCommune || '-'} />
            </DetailSection>

            <DetailSection title={locale === 'ar' ? 'معلومات عامة' : (locale === 'en' ? 'General' : 'Général')}>
              <DetailRow label={locale === 'ar' ? 'نوع المزاد' : (locale === 'en' ? 'Type' : 'Type')} value={detail.auctionType} />
              <DetailRow label={locale === 'ar' ? 'المنتج' : (locale === 'en' ? 'Product' : 'Produit')} value={`${detail.product} (${detail.quantity} ${detail.unit})`} />
              <DetailRow label={locale === 'ar' ? 'مكان التسليم' : (locale === 'en' ? 'Delivery location' : 'Lieu de livraison')} value={detail.deliveryLocation || '-'} />
              <DetailRow label={locale === 'ar' ? 'السعر المرجعي' : (locale === 'en' ? 'Reference price' : 'Prix de référence')} value={detail.targetPrice ? `${detail.targetPrice} ${t('currencyDA')}` : '-'} />
              <DetailRow label={locale === 'ar' ? 'نطاق البحث' : (locale === 'en' ? 'Search radius' : 'Rayon de recherche')} value={`${detail.radiusKm || 0} ${t('unitKm')}`} />
              {detail.description && <DetailRow label={locale === 'ar' ? 'الوصف' : (locale === 'en' ? 'Description' : 'Description')} value={detail.description} />}
            </DetailSection>

            <DetailSection title={locale === 'ar' ? 'التواريخ' : (locale === 'en' ? 'Dates' : 'Dates')}>
              <DetailRow label={locale === 'ar' ? 'البداية' : (locale === 'en' ? 'Start' : 'Début')} value={fmtDate(detail.startAt)} />
              <DetailRow label={locale === 'ar' ? 'النهاية' : (locale === 'en' ? 'End' : 'Fin')} value={fmtDate(detail.endAt)} />
              <DetailRow label={locale === 'ar' ? 'تاريخ الإنشاء' : (locale === 'en' ? 'Created' : 'Créée le')} value={fmtDate(detail.createdAt)} />
            </DetailSection>

            {detail.roundConfig?.enabled && (
              <DetailSection title={t('roundModeToggleTitle')}>
                <DetailRow label={t('roundTotalRoundsLabel')} value={detail.roundConfig.totalRounds} />
                <DetailRow label={t('roundDurationLabel')} value={detail.roundConfig.roundDurationHours} />
                <DetailRow label={t('roundMaxDecreaseLabel')} value={`${detail.roundConfig.maxDecreasePercent}%`} />
                <DetailRow label={t('roundInitialMinLabel')} value={`${detail.roundConfig.initialMinPercent}%`} />
                {detail.currentRound && <DetailRow label={locale === 'ar' ? 'الجولة الحالية' : (locale === 'en' ? 'Current round' : 'Tour actuel')} value={t('roundBadge', { current: detail.currentRound, total: detail.roundConfig.totalRounds })} />}
              </DetailSection>
            )}

            {(detail.lots || []).length > 0 && (
              <DetailSection title={locale === 'ar' ? 'الأقسام' : (locale === 'en' ? 'Lots' : 'Lots')}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {detail.lots.map((lot, idx) => (
                    <div key={idx} style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)', fontSize: '0.8rem', color: 'var(--text-body)' }}>
                      <strong style={{ color: 'var(--text-main)' }}>{lot.designation || `Lot ${idx + 1}`}</strong> — {lot.quantity} {lot.unit}
                      {lot.priceCeiling && <span> · {locale === 'ar' ? 'سقف' : 'plafond'}: {lot.priceCeiling} {t('currencyDA')}</span>}
                      {lot.priceReserve && <span> · {locale === 'ar' ? 'احتياط' : 'réserve'}: {lot.priceReserve} {t('currencyDA')}</span>}
                    </div>
                  ))}
                </div>
              </DetailSection>
            )}

            <DetailSection title={`${locale === 'ar' ? 'العروض' : (locale === 'en' ? 'Bids' : 'Offres')} (${(detail.bids || []).length})`}>
              {(detail.bids || []).length === 0 ? (
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('noOfferYet')}</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[...detail.bids].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)).map(bid => {
                    const isAccepted = detail.acceptedBidId === bid.id;
                    return (
                      <div key={bid.id} style={{ padding: 12, borderRadius: 10, border: isAccepted ? '1px solid var(--primary)' : '1px solid var(--border)', background: isAccepted ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.02)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-main)' }}>{bid.producerName} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({bid.producerEmail})</span></span>
                          {isAccepted && <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--primary)' }}>{t('winnerLabel')}</span>}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {(bid.lines || []).map(line => (
                            <div key={line.id} style={{ fontSize: '0.8rem', color: 'var(--text-body)' }}>
                              {line.optionName && <strong>{line.optionName}: </strong>}
                              {line.price} {t('currencyDA')} / {line.unit} {line.quantity ? `· ${line.quantity} ${line.unit}` : ''}
                              {line.comments && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{line.comments}</div>}
                            </div>
                          ))}
                        </div>
                        {bid.roundHistory?.length > 0 && (
                          <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {[...bid.roundHistory].sort((a, b) => a.round - b.round).map(h => (
                              <span key={h.round} style={{ fontSize: '0.7rem', background: 'rgba(255,255,255,0.05)', padding: '1px 7px', borderRadius: 999, color: 'var(--text-body)' }}>
                                {t('roundBadge', { current: h.round, total: detail.roundConfig?.totalRounds || h.round })}: {h.price} {t('currencyDA')}
                              </span>
                            ))}
                          </div>
                        )}
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 6 }}>{fmtDate(bid.timestamp)}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </DetailSection>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminDashboardPage({ token }) {
  const { t, dir, locale } = useTranslation();
  const localeTag = locale === 'ar' ? 'ar-DZ' : locale === 'en' ? 'en-US' : 'fr-DZ';

  const [tab, setTab] = useState('users');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [auctions, setAuctions] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [changingPasswordUser, setChangingPasswordUser] = useState(null);
  const [viewingUserId, setViewingUserId] = useState(null);
  const [viewingAuctionId, setViewingAuctionId] = useState(null);

  const showToast = (message, type = 'success') => { setToast({ message, type }); setTimeout(() => setToast(null), 3000); };

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/stats`, { headers: authHeaders });
      if (res.ok) setStats(await res.json());
    } catch { /* stats are non-critical */ }
  }, [authHeaders]);

  const fetchUsers = useCallback(async (targetPage, searchTerm) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: targetPage, limit: 20, search: searchTerm || '' });
      const res = await fetch(`${BACKEND_URL}/api/admin/users?${params}`, { headers: authHeaders });
      const data = await res.json();
      if (res.ok) {
        setUsers(data.users);
        setTotalPages(data.totalPages);
      }
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  const fetchAuctions = useCallback(async (targetPage) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: targetPage, limit: 20 });
      const res = await fetch(`${BACKEND_URL}/api/admin/auctions?${params}`, { headers: authHeaders });
      const data = await res.json();
      if (res.ok) {
        setAuctions(data.auctions);
        setTotalPages(data.totalPages);
      }
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  // Data-fetching-on-dependency-change effects: each callback sets a loading
  // flag / result state after its own fetch, not derived-state-from-props.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchStats(); }, [fetchStats]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
    if (tab === 'users') fetchUsers(1, search);
    else fetchAuctions(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (tab === 'users') fetchUsers(page, search);
    else fetchAuctions(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchUsers(1, search);
  };

  const toggleUserActive = async (u) => {
    const action = u.isActive ? 'deactivate' : 'reactivate';
    const confirmMsg = u.isActive ? t('adminConfirmDeactivate') : t('adminConfirmReactivate');
    if (!window.confirm(confirmMsg)) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/users/${u.id}/${action}`, { method: 'POST', headers: authHeaders });
      const data = await res.json();
      if (res.ok) {
        showToast(t('adminActionSuccess'));
        setUsers(prev => prev.map(x => x.id === u.id ? { ...x, isActive: !u.isActive } : x));
        fetchStats();
      } else {
        showToast(data.error || t('adminActionError'), 'error');
      }
    } catch {
      showToast(t('adminActionError'), 'error');
    }
  };

  const handleSetPassword = async (password) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/users/${changingPasswordUser.id}/set-password`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(t('adminActionSuccess'));
        setChangingPasswordUser(null);
      } else {
        showToast(data.error || t('adminActionError'), 'error');
      }
    } catch {
      showToast(t('adminActionError'), 'error');
    }
  };

  return (
    <div dir={dir} style={{ minHeight: '100vh', background: 'var(--bg-main)' }}>
      {changingPasswordUser && (
        <ChangePasswordModal
          user={changingPasswordUser}
          onSubmit={handleSetPassword}
          onClose={() => setChangingPasswordUser(null)}
        />
      )}
      {viewingUserId && (
        <UserDetailModal
          userId={viewingUserId}
          token={token}
          authHeaders={authHeaders}
          onClose={() => setViewingUserId(null)}
        />
      )}
      {viewingAuctionId && (
        <AuctionDetailModal
          auctionId={viewingAuctionId}
          authHeaders={authHeaders}
          onClose={() => setViewingAuctionId(null)}
        />
      )}
      <div style={{ padding: '28px 32px', maxWidth: 1200, margin: '0 auto' }}>
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 28 }}>
            <StatTile label={t('adminStatUsers')} value={stats.totalUsers} />
            <StatTile label={t('adminStatBuyers')} value={stats.buyerCount} />
            <StatTile label={t('adminStatProducers')} value={stats.producerCount} />
            <StatTile label={t('adminStatOpenAuctions')} value={stats.openAuctions} />
            <StatTile label={t('adminStatClosedAuctions')} value={stats.closedAuctions} />
            <StatTile label={t('adminStatDeactivated')} value={stats.deactivatedUsers} />
            <StatTile label={t('adminStatTotalVisits')} value={stats.totalVisits} />
            <StatTile label={t('adminStatUniqueVisitors')} value={stats.uniqueVisitors} />
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <button
            onClick={() => setTab('users')}
            className={tab === 'users' ? 'btn btn-primary' : 'btn btn-secondary'}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: '0.875rem' }}
          >
            <Users size={15} /> {t('adminUsersTab')}
          </button>
          <button
            onClick={() => setTab('auctions')}
            className={tab === 'auctions' ? 'btn btn-primary' : 'btn btn-secondary'}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: '0.875rem' }}
          >
            <Gavel size={15} /> {t('adminAuctionsTab')}
          </button>
        </div>

        {tab === 'users' && (
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: 8, marginBottom: 16, maxWidth: 360 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('searchPlaceholder')}
                style={{ width: '100%', paddingLeft: dir === 'ltr' ? 36 : 14, paddingRight: dir === 'rtl' ? 36 : 14 }}
              />
              <Search size={15} style={{ position: 'absolute', left: dir === 'ltr' ? 12 : 'auto', right: dir === 'rtl' ? 12 : 'auto', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>
          </form>
        )}

        <div style={{ borderRadius: 14, border: '1px solid var(--border)', overflowX: 'auto', background: 'var(--bg-panel)' }}>
          {tab === 'users' ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720, fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)', textAlign: dir === 'rtl' ? 'right' : 'left' }}>
                  <th style={{ padding: '10px 16px' }}>{t('adminColName')}</th>
                  <th style={{ padding: '10px 16px' }}>{t('adminColEmail')}</th>
                  <th style={{ padding: '10px 16px' }}>{t('adminColRole')}</th>
                  <th style={{ padding: '10px 16px' }}>{t('adminColVerified')}</th>
                  <th style={{ padding: '10px 16px' }}>{t('adminColStatus')}</th>
                  <th style={{ padding: '10px 16px' }} title={t('adminColUsedAiFull')}>{t('adminColUsedAi')}</th>
                  <th style={{ padding: '10px 16px' }}>{t('adminColJoined')}</th>
                  <th style={{ padding: '10px 16px' }}>{t('adminColActions')}</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 600 }}>{u.name}</td>
                    <td style={{ padding: '10px 16px', color: 'var(--text-muted)' }}>{u.email}</td>
                    <td style={{ padding: '10px 16px' }}>{u.role === 'buyer' ? t('role_buyer') : u.role === 'producer' ? t('role_producer') : u.role}</td>
                    <td style={{ padding: '10px 16px' }}>{u.isVerified ? <CheckCircle2 size={16} style={{ color: 'var(--primary)' }} /> : <XCircle size={16} style={{ color: 'var(--text-muted)' }} />}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: '0.75rem', fontWeight: 700, background: u.isActive ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', color: u.isActive ? 'var(--primary)' : '#ef4444' }}>
                        {u.isActive ? t('adminStatusActive') : t('adminStatusDeactivated')}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px' }} title={u.usedAi ? t('adminColUsedAiFull') : ''}>
                      {u.usedAi ? <MessageSquare size={16} style={{ color: 'var(--primary)' }} /> : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 16px', color: 'var(--text-muted)' }}>{u.createdAt ? new Date(u.createdAt).toLocaleDateString(localeTag) : '-'}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <ActionMenu user={u} onView={u2 => setViewingUserId(u2.id)} onChangePassword={setChangingPasswordUser} onToggleActive={toggleUserActive} t={t} />
                    </td>
                  </tr>
                ))}
                {!loading && users.length === 0 && (
                  <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>{t('adminNoUsers')}</td></tr>
                )}
              </tbody>
            </table>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640, fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)', textAlign: dir === 'rtl' ? 'right' : 'left' }}>
                  <th style={{ padding: '10px 16px' }}>{t('adminColTitle')}</th>
                  <th style={{ padding: '10px 16px' }}>{t('adminColStatus')}</th>
                  <th style={{ padding: '10px 16px' }}>{t('adminColBuyer')}</th>
                  <th style={{ padding: '10px 16px' }}>{t('adminColBids')}</th>
                  <th style={{ padding: '10px 16px' }}>{t('adminColDate')}</th>
                  <th style={{ padding: '10px 16px' }}>{t('adminColActions')}</th>
                </tr>
              </thead>
              <tbody>
                {auctions.map(a => (
                  <tr key={a.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 600 }}>{a.title}</td>
                    <td style={{ padding: '10px 16px' }}>{a.status}</td>
                    <td style={{ padding: '10px 16px', color: 'var(--text-muted)' }}>{a.buyerName}</td>
                    <td style={{ padding: '10px 16px' }}>{a.bidsCount}</td>
                    <td style={{ padding: '10px 16px', color: 'var(--text-muted)' }}>{a.createdAt ? new Date(a.createdAt).toLocaleDateString(localeTag) : '-'}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <button
                        onClick={() => setViewingAuctionId(a.id)}
                        className="btn btn-secondary"
                        title={locale === 'ar' ? 'عرض' : (locale === 'en' ? 'View' : 'Voir')}
                        aria-label={locale === 'ar' ? 'عرض' : (locale === 'en' ? 'View' : 'Voir')}
                        style={{ padding: '5px 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 5 }}
                      >
                        <Eye size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
                {!loading && auctions.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>{t('adminNoAuctions')}</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 20 }}>
            <button onClick={() => setPage(p => Math.max(p - 1, 1))} disabled={page <= 1} className="btn btn-secondary" style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 4 }}>
              {dir === 'rtl' ? <ChevronRight size={14} /> : <ChevronLeft size={14} />} {t('adminPrevPage')}
            </button>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{t('adminPageOf', { page, totalPages })}</span>
            <button onClick={() => setPage(p => Math.min(p + 1, totalPages))} disabled={page >= totalPages} className="btn btn-secondary" style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 4 }}>
              {t('adminNextPage')} {dir === 'rtl' ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
            </button>
          </div>
        )}
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: dir === 'ltr' ? 24 : 'auto', left: dir === 'rtl' ? 24 : 'auto', zIndex: 1000, background: toast.type === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', border: `1px solid ${toast.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`, color: toast.type === 'success' ? 'var(--primary)' : 'var(--danger)', padding: '12px 20px', borderRadius: 10 }}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
