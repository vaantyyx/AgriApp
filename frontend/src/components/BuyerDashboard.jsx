import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Routes, Route, Navigate } from 'react-router-dom';
import {
  Plus, Tag, MessageSquare, Check, Package, X, Star, MapPin,
  ChevronDown, ChevronUp, Image as ImageIcon,
  ClipboardList, Layers, CalendarClock, FileSearch,
  ChevronRight, ChevronLeft, AlertTriangle, Info,
  Gavel, Clock, Repeat2, TrendingDown, TrendingUp, Hash,
  ArrowRight, LayoutDashboard, ListOrdered, BarChart2, User,
} from 'lucide-react';
import { WILAYA_COORDS, getCommuneCoords, getCoordsForWilayaName, haversineKm } from '../utils/wilayaCoordinates.js';
import { cultureTypes, products } from '../utils/referenceData.js';
import { useTranslation } from '../context/LanguageContext';
import { computeBuyerCompletion as computeProfileCompletion } from './BuyerProfilePage';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// ─── Fix Leaflet default icon paths broken by Vite bundler ─────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

// ─── Star Rating Display ────────────────────────────────────────────────────
function StarDisplay({ rating, count }) {
  const { t } = useTranslation();
  if (rating === null || rating === undefined) {
    return <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('noReviews')}</span>;
  }
  const full = Math.floor(rating);
  const half = rating - full >= 0.25 && rating - full < 0.75;
  const stars = Array.from({ length: 5 }, (_, i) => {
    if (i < full) return 'full';
    if (i === full && half) return 'half';
    return 'empty';
  });
  return (
    <span className="star-display" title={t('reviewsCountTitle', { rating: rating.toFixed(1), count })}>
      {stars.map((s, i) => (
        <span key={i} className={`star star-${s}`}>★</span>
      ))}
      <span className="star-label">{rating.toFixed(1)}<span style={{ opacity: 0.6 }}>/5</span> ({count})</span>
    </span>
  );
}

// ─── Star Picker (interactive) ─────────────────────────────────────────────
function StarPicker({ value, onChange }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="star-picker" role="group" aria-label="Note sur 5 étoiles">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          className={`star-pick-btn ${(hover || value) >= n ? 'active' : ''}`}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(n)}
          aria-label={`${n} étoile${n > 1 ? 's' : ''}`}
        >★</button>
      ))}
    </div>
  );
}

// ─── Rating Modal ──────────────────────────────────────────────────────────
function RatingModal({ auctionId, onSubmit, onClose }) {
  const [rating, setRating] = useState(0);
  const { t } = useTranslation();
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card animate-fade-in" onClick={e => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose}><X size={18} /></button>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>⭐</div>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '6px' }}>{t('rateProducerTitle')}</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t('rateProducerDesc')}</p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
          <StarPicker value={rating} onChange={setRating} />
        </div>
        {rating > 0 && (
          <p style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
            {t('rating_' + rating)}
          </p>
        )}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>{t('rateLaterBtn')}</button>
          <button className="btn btn-primary" style={{ flex: 1 }} disabled={rating === 0} onClick={() => { if (rating > 0) onSubmit(auctionId, rating); }}>
            {t('confirmBtn')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Leaflet Map component ─────────────────────────────────────────────────
function AuctionMap({ centerLat, centerLng, radiusKm, onRadiusChange, producerCount }) {
  const mapRef = useRef(null);
  const leafletMapRef = useRef(null);
  const circleRef = useRef(null);
  const markerRef = useRef(null);
  const { locale } = useTranslation();

  useEffect(() => {
    if (leafletMapRef.current) return;
    if (!mapRef.current) return;
    const lat = isNaN(centerLat) ? 36.73 : centerLat;
    const lng = isNaN(centerLng) ? 3.09 : centerLng;
    const map = L.map(mapRef.current, { center: [lat, lng], zoom: 8, zoomControl: true });
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
      maxZoom: 18,
    }).addTo(map);
    // Add label overlay for place names on top of satellite
    L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 18, opacity: 0.7,
    }).addTo(map);
    const buyerIcon = L.divIcon({
      className: '',
      html: '<div class="map-buyer-marker"><div class="map-buyer-pulse"></div></div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
    markerRef.current = L.marker([lat, lng], { icon: buyerIcon }).addTo(map).bindPopup('📍 Votre position (approximative)');
    circleRef.current = L.circle([lat, lng], {
      radius: radiusKm * 1000, color: '#10b981', fillColor: '#10b981', fillOpacity: 0.12, weight: 2.5,
    }).addTo(map);
    leafletMapRef.current = map;
    const fitTimer = setTimeout(() => {
      try {
        map.invalidateSize();
        if (circleRef.current && map.getContainer().clientHeight > 0) {
          map.fitBounds(circleRef.current.getBounds(), { padding: [30, 30], animate: false });
        }
      } catch (_) {}
    }, 400);
    return () => { clearTimeout(fitTimer); map.remove(); leafletMapRef.current = null; circleRef.current = null; markerRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!circleRef.current || !leafletMapRef.current) return;
    circleRef.current.setRadius(radiusKm * 1000);
    leafletMapRef.current.fitBounds(circleRef.current.getBounds(), { padding: [30, 30] });
  }, [radiusKm]);

  useEffect(() => {
    if (!leafletMapRef.current || !circleRef.current || !markerRef.current) return;
    if (isNaN(centerLat) || isNaN(centerLng)) return;
    const newLatLng = [centerLat, centerLng];
    leafletMapRef.current.setView(newLatLng);
    markerRef.current.setLatLng(newLatLng);
    circleRef.current.setLatLng(newLatLng);
  }, [centerLat, centerLng]);

  return (
    <div className="auction-map-wrapper">
      <div ref={mapRef} className="auction-map-container" />
      <div className="map-controls">
        <div className="map-radius-row">
          <MapPin size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {locale === 'ar' ? 'نطاق البحث :' : (locale === 'fr' ? 'Rayon de recherche :' : 'Search radius:')}
          </span>
          <strong style={{ color: 'var(--primary)', fontSize: '0.9rem' }}>{radiusKm} km</strong>
        </div>
        <input
          type="range" min="10" max="2000" step="10" value={radiusKm}
          onChange={e => onRadiusChange(Number(e.target.value))}
          className="radius-slider" aria-label="Rayon de recherche en kilomètres"
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          <span>10 km</span><span>2 000 km</span>
        </div>
        <div className="map-producer-count">
          <span style={{ fontSize: '1.1rem' }}>🌱</span>
          <span>
            <strong style={{ color: 'var(--primary)' }}>{producerCount}</strong>{' '}
            {locale === 'ar' ? 'منتج في هذه المنطقة' : (locale === 'fr' ? `producteur${producerCount !== 1 ? 's' : ''} dans cette zone` : `producer${producerCount !== 1 ? 's' : ''} in this area`)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Step Indicator ─────────────────────────────────────────────────────────
const STEPS = [
  { id: 1, icon: ClipboardList, labelFr: 'Informations générales', labelAr: 'معلومات عامة' },
  { id: 2, icon: Layers,       labelFr: 'Lots',                    labelAr: 'الأقسام' },
  { id: 3, icon: MapPin,       labelFr: 'Zone géographique',       labelAr: 'المنطقة الجغرافية' },
  { id: 4, icon: CalendarClock,labelFr: 'Dates & Paramètres',      labelAr: 'التواريخ والإعدادات' },
  { id: 5, icon: FileSearch,   labelFr: 'Récapitulatif',           labelAr: 'ملخص' },
];

function StepIndicator({ currentStep, locale }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 0,
      background: 'rgba(255,255,255,0.03)', borderRadius: 14, padding: '12px 16px',
      border: '1px solid var(--border)', marginBottom: 28, overflowX: 'auto',
    }}>
      {STEPS.map((step, idx) => {
        const Icon = step.icon;
        const isActive = currentStep === step.id;
        const isDone = currentStep > step.id;
        return (
          <React.Fragment key={step.id}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 80 }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isDone ? 'var(--primary)' : isActive ? 'var(--primary)' : 'var(--bg-input)',
                border: `2px solid ${isDone || isActive ? 'var(--primary)' : 'var(--border)'}`,
                transition: 'all 0.3s ease',
                boxShadow: isActive ? '0 0 12px rgba(16,185,129,0.4)' : 'none',
              }}>
                {isDone
                  ? <Check size={18} color="white" />
                  : <Icon size={18} color={isActive ? 'white' : 'var(--text-muted)'} />
                }
              </div>
              <span style={{
                fontSize: '0.7rem', fontWeight: isActive ? 700 : 500,
                color: isActive ? 'var(--primary)' : isDone ? 'var(--text-body)' : 'var(--text-muted)',
                textAlign: 'center', whiteSpace: 'nowrap',
              }}>
                {locale === 'ar' ? step.labelAr : step.labelFr}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div style={{
                flex: 1, height: 2, margin: '0 4px', marginBottom: 24,
                background: currentStep > step.id ? 'var(--primary)' : 'var(--border)',
                transition: 'background 0.3s ease',
                minWidth: 16,
              }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── AUCTION TYPES ─────────────────────────────────────────────────────────
const AUCTION_TYPES = [
  { value: 'open', labelFr: 'Enchère ouverte', labelAr: 'مزad مفتوح' },
  { value: 'smart', labelFr: 'Enchère intelligente', labelAr: 'مزاد ذكي' },
];

// ─── WILAYA LIST ────────────────────────────────────────────────────────────
const WILAYA_LIST = Object.entries(WILAYA_COORDS).map(([id, w]) => ({ id: parseInt(id), name: w.name })).sort((a, b) => a.id - b.id);

// ─── Default lot ─────────────────────────────────────────────────────────
function newLot(seq) {
  return {
    seq,
    designation: '',
    cultureTypeId: '',
    productId: '',
    wilayaId: '',
    unit: 'tonnes',
    quantity: '',
    priceCeiling: '',
    priceReserve: '',
  };
}

// ─── Sidebar Navigation ─────────────────────────────────────────────────────
// Sidebar has been moved to DashboardLayout.jsx
function getMissingFieldsList(user, locale) {
  const missing = [];
  const labels = {
    profilePhoto: { fr: 'Photo de profil', ar: 'الصورة الشخصية' },
    wilaya: { fr: 'Wilaya', ar: 'الولاية' },
    commune: { fr: 'Commune', ar: 'البلدية' },
    phone: { fr: 'Téléphone', ar: 'الهاتف' },
    forme_juridique: { fr: 'Forme juridique', ar: 'الشكل القانوني' },
    rc: { fr: 'Registre de commerce (RC)', ar: 'السجل التجاري (RC)' },
    nif: { fr: 'NIF', ar: 'الرقم الضريبي (NIF)' },
    secteur_activite: { fr: 'Secteur d\'activité', ar: 'قطاع النشاط' },
    nom_commercial: { fr: 'Nom commercial', ar: 'الاسم التجاري' }
  };
  
  if (!user) return [];
  if (!user.profilePhoto) missing.push(labels.profilePhoto[locale] || labels.profilePhoto.fr);
  if (!user.wilaya || !user.wilaya.trim()) missing.push(labels.wilaya[locale] || labels.wilaya.fr);
  if (!user.commune || !user.commune.trim()) missing.push(labels.commune[locale] || labels.commune.fr);
  if (!user.phone || !user.phone.trim()) missing.push(labels.phone[locale] || labels.phone.fr);
  
  const isEntreprise = user.entity_type === 'entreprise';
  if (isEntreprise) {
    if (!user.forme_juridique || !user.forme_juridique.trim()) missing.push(labels.forme_juridique[locale] || labels.forme_juridique.fr);
    if (!user.rc || !user.rc.trim()) missing.push(labels.rc[locale] || labels.rc.fr);
    if (!user.nif || !user.nif.trim()) missing.push(labels.nif[locale] || labels.nif.fr);
    if (!user.secteur_activite || !user.secteur_activite.trim()) missing.push(labels.secteur_activite[locale] || labels.secteur_activite.fr);
    if (!user.nom_commercial || !user.nom_commercial.trim()) missing.push(labels.nom_commercial[locale] || labels.nom_commercial.fr);
  }
  
  return missing;
}

// ─── Main BuyerDashboard ───────────────────────────────────────────────────
export default function BuyerDashboard({ user, auctions, onCreateAuction, onAcceptBid, onRateProducer, newBidFlashIds, onNavigateToProfile, highlightAuctionId }) {
  const { t, dir, locale } = useTranslation();

  // 5-step wizard state
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardOpen, setWizardOpen] = useState(false);

  useEffect(() => {
    if (highlightAuctionId) {
      setWizardOpen(false);
      navigate('?tab=auctions', { replace: true });
    }
  }, [highlightAuctionId]);

  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const urlTab = searchParams.get('tab') || 'dashboard';

  // Sidebar active section
  const [activeSection, setActiveSection] = useState(urlTab);
  
  useEffect(() => {
    if (!wizardOpen) {
      setActiveSection(urlTab);
    }
  }, [urlTab, wizardOpen]);

  const [showBlockWarningModal, setShowBlockWarningModal] = useState(false);

  // 5-step wizard state (moved to top)

  // Step 1 – General info
  const [title, setTitle] = useState('');
  const [auctionType, setAuctionType] = useState('open');
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [generalDescription, setGeneralDescription] = useState('');

  // Step 2 – Lots
  const [lots, setLots] = useState([newLot(1)]);

  // Step 3 – Geographic zone
  const [radiusKm, setRadiusKm] = useState(100);
  const [isSearchZoneChanged, setIsSearchZoneChanged] = useState(false);

  // Step 4 – Dates & settings
  const [startDatetime, setStartDatetime] = useState('');
  const [endDatetime, setEndDatetime] = useState('');
  const [autoProlongate, setAutoProlongate] = useState(false);
  const [prolongationMinutes, setProlongationMinutes] = useState(10);
  const [maxProlongations, setMaxProlongations] = useState(3);

  // Step validation errors
  const [stepError, setStepError] = useState('');

  // Rating modal
  const [ratingAuctionId, setRatingAuctionId] = useState(null);

  // Lightbox for bid photos
  const [activeZoomImage, setActiveZoomImage] = useState(null);

  // Resolve user's coordinates for the map
  const userCoords = React.useMemo(() => {
    if (user.commune && user.wilaya) return getCommuneCoords(user.wilaya, user.commune);
    if (user.wilaya) return getCoordsForWilayaName(user.wilaya);
    return { lat: 36.73, lng: 3.09 };
  }, [user.wilaya, user.commune]);

  const [producerCount, setProducerCount] = useState(0);

  useEffect(() => {
    if (!userCoords?.lat || !userCoords?.lng) return;
    let active = true;
    fetch(`http://127.0.0.1:3001/api/producers/count?lat=${userCoords.lat}&lng=${userCoords.lng}&radius=${radiusKm}`)
      .then(res => res.ok ? res.json() : { count: 0 })
      .then(data => { if (active) setProducerCount(data.count); })
      .catch(() => { if (active) setProducerCount(0); });
    return () => { active = false; };
  }, [userCoords, radiusKm]);

  // ── Lot helpers ──
  const updateLot = (idx, field, value) => {
    setLots(prev => prev.map((l, i) => {
      if (i !== idx) return l;
      const updated = { ...l, [field]: value };
      if (field === 'cultureTypeId') updated.productId = ''; // reset product when culture changes
      return updated;
    }));
  };

  const addLot = () => setLots(prev => [...prev, newLot(prev.length + 1)]);
  const removeLot = (idx) => setLots(prev => {
    const next = prev.filter((_, i) => i !== idx).map((l, i) => ({ ...l, seq: i + 1 }));
    return next.length === 0 ? [newLot(1)] : next;
  });

  // ── Step navigation ──
  const validateStep = (step) => {
    setStepError('');
    if (step === 1) {
      if (!title.trim()) { setStepError('Le titre de l\'enchère est obligatoire.'); return false; }
      if (!auctionType) { setStepError('Veuillez sélectionner un type d\'enchère.'); return false; }
      if (!deliveryLocation.trim()) { setStepError('Le lieu de livraison est obligatoire.'); return false; }
    }
    if (step === 2) {
      for (let i = 0; i < lots.length; i++) {
        const l = lots[i];
        if (!l.designation.trim()) { setStepError(`Lot ${l.seq} : la désignation est obligatoire.`); return false; }
        if (!l.cultureTypeId) { setStepError(`Lot ${l.seq} : sélectionnez un type de culture.`); return false; }
        if (!l.productId) { setStepError(`Lot ${l.seq} : sélectionnez un produit.`); return false; }
        if (!l.wilayaId) { setStepError(`Lot ${l.seq} : sélectionnez la wilaya d'origine.`); return false; }
        if (!l.quantity || parseFloat(l.quantity) <= 0) { setStepError(`Lot ${l.seq} : quantité invalide.`); return false; }
        if (!l.priceCeiling || parseFloat(l.priceCeiling) <= 0) { setStepError(`Lot ${l.seq} : prix plafond invalide.`); return false; }
        if (!l.priceReserve || parseFloat(l.priceReserve) < 0) { setStepError(`Lot ${l.seq} : prix de réserve invalide.`); return false; }
        if (parseFloat(l.priceReserve) > parseFloat(l.priceCeiling)) { setStepError(`Lot ${l.seq} : le prix de réserve ne peut pas dépasser le prix plafond.`); return false; }
      }
    }
    if (step === 4) {
      if (!startDatetime) { setStepError('La date de début est obligatoire.'); return false; }
      if (!endDatetime) { setStepError('La date de fin est obligatoire.'); return false; }
      if (new Date(endDatetime) <= new Date(startDatetime)) { setStepError('La date de fin doit être postérieure à la date de début.'); return false; }
    }
    return true;
  };

  const goNext = () => {
    if (!validateStep(wizardStep)) return;
    setWizardStep(s => Math.min(s + 1, 5));
  };
  const goPrev = () => { setStepError(''); setWizardStep(s => Math.max(s - 1, 1)); };

  const openWizard = () => {
    if (computeProfileCompletion(user) < 70) {
      setShowBlockWarningModal(true);
      return;
    }
    setWizardStep(1);
    setWizardOpen(true);
    setStepError('');
    setActiveSection('create');
  };
  const closeWizard = () => {
    setWizardOpen(false);
    setWizardStep(1);
    resetWizard();
  };

  const resetWizard = () => {
    setTitle(''); setAuctionType('open'); setDeliveryLocation(''); setGeneralDescription('');
    setLots([newLot(1)]);
    setRadiusKm(100); setIsSearchZoneChanged(false);
    setStartDatetime(''); setEndDatetime('');
    setAutoProlongate(false); setProlongationMinutes(10); setMaxProlongations(3);
    setStepError('');
  };

  const handleSubmit = () => {
    if (!validateStep(4)) return;
    const payload = {
      title: title.trim(),
      auctionType,
      deliveryLocation: deliveryLocation.trim(),
      description: generalDescription.trim(),
      lots: lots.map(l => ({
        seq: l.seq,
        designation: l.designation.trim(),
        cultureTypeId: l.cultureTypeId,
        productId: l.productId,
        wilayaId: l.wilayaId,
        unit: l.unit,
        quantity: parseFloat(l.quantity),
        priceCeiling: parseFloat(l.priceCeiling),
        priceReserve: parseFloat(l.priceReserve),
      })),
      radius: radiusKm,
      isSearchZoneChanged,
      startAt: new Date(startDatetime).toISOString(),
      endAt: new Date(endDatetime).toISOString(),
      autoProlongate,
      prolongationMinutes: autoProlongate ? parseInt(prolongationMinutes) : null,
      maxProlongations: autoProlongate ? parseInt(maxProlongations) : null,
      // backwards compat fields
      product: lots[0]?.designation || title,
      quantity: lots[0]?.quantity || 1,
      unit: lots[0]?.unit || 'tonnes',
    };
    onCreateAuction(payload);
    closeWizard();
    navigate('?tab=auctions');
  };

  const myAuctions = auctions.filter(a => a.isOwner);

  // ─── Sidebar layout ──────────────────────────────────────────────────────
  const sidebarLabel = (item) => locale === 'ar' ? item.labelAr : item.labelFr;

  // ─── Summary helpers ─────────────────────────────────────────────────────
  const getAuctionTypeLabel = (val) => {
    const found = AUCTION_TYPES.find(t => t.value === val);
    return found ? (locale === 'ar' ? found.labelAr : found.labelFr) : val;
  };
  const getProductName = (productId) => {
    const p = products.find(p => p.id === productId);
    return p ? (p.name[locale] || p.name.fr) : productId;
  };
  const getCultureName = (cid) => {
    const c = cultureTypes.find(c => c.id === cid);
    return c ? (c.name[locale] || c.name.fr) : cid;
  };
  const getWilayaName = (wid) => {
    const w = WILAYA_COORDS[parseInt(wid)];
    return w ? w.name : wid;
  };

  // ─── RENDER ──────────────────────────────────────────────────────────────
  return (
      <div style={{ flex: 1, padding: '32px 40px', overflowY: 'auto', textAlign: 'start', height: '100%' }}>


        {/* Rating Modal */}
        {ratingAuctionId && (
          <RatingModal
            auctionId={ratingAuctionId}
            onSubmit={(aId, r) => { onRateProducer(aId, r); setRatingAuctionId(null); }}
            onClose={() => setRatingAuctionId(null)}
          />
        )}

        {/* Lightbox Modal */}
        {activeZoomImage && (
          <div className="lightbox-modal" onClick={() => setActiveZoomImage(null)}>
            <div className="lightbox-content" onClick={e => e.stopPropagation()}>
              <button className="lightbox-close" onClick={() => setActiveZoomImage(null)}><X size={20} /></button>
              <img src={activeZoomImage} alt={t('zoomProduct')} />
            </div>
          </div>
        )}

        {/* Block Warning Modal */}
        {showBlockWarningModal && (
          <div className="modal-overlay" onClick={() => setShowBlockWarningModal(false)}>
            <div className="modal-card animate-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
              <button className="modal-close-btn" onClick={() => setShowBlockWarningModal(false)}><X size={18} /></button>
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🔒</div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '8px', color: 'var(--text-main)' }}>
                  {locale === 'ar' ? 'حساب غير مكتمل' : (locale === 'fr' ? 'Profil incomplet' : 'Incomplete profile')}
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.5 }}>
                  {locale === 'ar' 
                    ? `نسبة اكتمال ملفك الشخصي الحالية هي ${computeProfileCompletion(user)}% ويجب أن تصل إلى 70% على الأقل لتتمكن من إنشاء مزاد جديد.` 
                    : (locale === 'fr' 
                        ? `Votre taux de complétion de profil est actuellement de ${computeProfileCompletion(user)}%. Un minimum de 70% est requis pour créer une enchère.`
                        : `Your profile completion rate is currently ${computeProfileCompletion(user)}%. A minimum of 70% is required to create an auction.`)}
                </p>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: 16, border: '1px solid var(--border)', marginBottom: 20 }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8, textAlign: 'start' }}>
                  {locale === 'ar' ? 'الحقول الناقصة :' : (locale === 'fr' ? 'Champs manquants :' : 'Missing fields:')}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'flex-start' }}>
                  {getMissingFieldsList(user, locale).map((field, idx) => (
                    <span key={idx} style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>
                      {field}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowBlockWarningModal(false)}>
                  {locale === 'ar' ? 'إغلاق' : (locale === 'fr' ? 'Fermer' : 'Close')}
                </button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => { setShowBlockWarningModal(false); onNavigateToProfile(); }}>
                  {locale === 'ar' ? 'إكمال الملف' : (locale === 'fr' ? 'Compléter le profil' : 'Complete profile')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══ WIZARD ══════════════════════════════════════════════════ */}
        {wizardOpen && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <Gavel size={24} style={{ color: 'var(--primary)' }} />
                {locale === 'ar' ? 'إنشاء مزاد جديد' : 'Créer une enchère'}
              </h2>
              <button onClick={closeWizard} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={22} />
              </button>
            </div>

            <StepIndicator currentStep={wizardStep} locale={locale} />

            <div className="glass-panel animate-fade-in" style={{ padding: '28px 32px' }}>

              {/* ── STEP 1: General Info ──────────────────────────────── */}
              {wizardStep === 1 && (
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 20, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ClipboardList size={20} style={{ color: 'var(--primary)' }} />
                    {locale === 'ar' ? 'المعلومات العامة' : 'Informations générales'}
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label htmlFor="auction-title">
                        {locale === 'ar' ? 'عنوان المزاد' : 'Titre de l\'enchère'} <span style={{ color: 'var(--danger)' }}>*</span>
                      </label>
                      <input
                        id="auction-title" type="text"
                        placeholder={locale === 'ar' ? 'مثال: طلب بطاطس درجة أولى' : 'Ex: Demande de pommes de terre qualité 1'}
                        value={title} onChange={e => setTitle(e.target.value)}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label htmlFor="auction-type">
                        {locale === 'ar' ? 'نوع المزاد' : 'Type d\'enchère'} <span style={{ color: 'var(--danger)' }}>*</span>
                      </label>
                      <select id="auction-type" value={auctionType} onChange={e => setAuctionType(e.target.value)}>
                        {AUCTION_TYPES.map(at => (
                          <option key={at.value} value={at.value}>
                            {locale === 'ar' ? at.labelAr : at.labelFr}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label htmlFor="delivery-location">
                        {locale === 'ar' ? 'مكان التسليم' : 'Lieu de livraison'} <span style={{ color: 'var(--danger)' }}>*</span>
                      </label>
                      <input
                        id="delivery-location" type="text"
                        placeholder={locale === 'ar' ? 'مثال: ورقلة، حي الرياض' : 'Ex: Alger, Zone industrielle de Rouiba'}
                        value={deliveryLocation} onChange={e => setDeliveryLocation(e.target.value)}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label htmlFor="general-description">
                        {locale === 'ar' ? 'وصف تفصيلي' : 'Description détaillée'}
                      </label>
                      <textarea
                        id="general-description" rows={4}
                        placeholder={locale === 'ar' ? 'وصف تفصيلي للمزاد...' : 'Décrivez votre besoin en détail…'}
                        value={generalDescription} onChange={e => setGeneralDescription(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ── STEP 2: Lots ──────────────────────────────────────── */}
              {wizardStep === 2 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Layers size={20} style={{ color: 'var(--primary)' }} />
                      {locale === 'ar' ? 'الأقسام (Lots)' : 'Lots'}
                    </h3>
                    <button type="button" onClick={addLot} className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '6px 14px', gap: 6 }}>
                      <Plus size={14} /> {locale === 'ar' ? 'إضافة قسم' : 'Ajouter un lot'}
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {lots.map((lot, idx) => {
                      const filteredProducts = products.filter(p => p.cultureTypeId === lot.cultureTypeId);
                      return (
                        <div key={idx} style={{
                          border: '1px solid var(--border)', borderRadius: 12,
                          padding: '20px 24px', background: 'rgba(255,255,255,0.02)',
                          position: 'relative',
                        }}>
                          {/* Lot header */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                            <div style={{
                              width: 32, height: 32, borderRadius: 8,
                              background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              <Hash size={16} color="white" />
                            </div>
                            <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)' }}>
                              Lot N° {lot.seq}
                            </span>
                            {lots.length > 1 && (
                              <button type="button" onClick={() => removeLot(idx)} style={{
                                marginLeft: 'auto', background: 'none', border: 'none',
                                color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center',
                              }}>
                                <X size={16} />
                              </button>
                            )}
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 20px' }}>
                            {/* Designation */}
                            <div className="form-group" style={{ margin: 0, gridColumn: '1 / -1' }}>
                              <label>
                                {locale === 'ar' ? 'التسمية' : 'Désignation'} <span style={{ color: 'var(--danger)' }}>*</span>
                              </label>
                              <input
                                type="text"
                                placeholder={locale === 'ar' ? 'مثال: بطاطس مميزة' : 'Ex: Pommes de terre calibre supérieur'}
                                value={lot.designation}
                                onChange={e => updateLot(idx, 'designation', e.target.value)}
                              />
                            </div>

                            {/* Culture type */}
                            <div className="form-group" style={{ margin: 0 }}>
                              <label>
                                {locale === 'ar' ? 'نوع الزراعة' : 'Type de culture'} <span style={{ color: 'var(--danger)' }}>*</span>
                              </label>
                              <select value={lot.cultureTypeId} onChange={e => updateLot(idx, 'cultureTypeId', e.target.value)}>
                                <option value="">{locale === 'ar' ? '-- اختر --' : '-- Choisir --'}</option>
                                {cultureTypes.map(ct => (
                                  <option key={ct.id} value={ct.id}>{ct.name[locale] || ct.name.fr}</option>
                                ))}
                              </select>
                            </div>

                            {/* Product */}
                            <div className="form-group" style={{ margin: 0 }}>
                              <label>
                                {locale === 'ar' ? 'المنتج المحدد' : 'Produit spécifique'} <span style={{ color: 'var(--danger)' }}>*</span>
                              </label>
                              <select
                                value={lot.productId}
                                onChange={e => updateLot(idx, 'productId', e.target.value)}
                                disabled={!lot.cultureTypeId}
                              >
                                <option value="">{lot.cultureTypeId ? (locale === 'ar' ? '-- اختر المنتج --' : '-- Choisir produit --') : (locale === 'ar' ? 'اختر النوع أولاً' : 'Choisir type d\'abord')}</option>
                                {filteredProducts.map(p => (
                                  <option key={p.id} value={p.id}>{p.name[locale] || p.name.fr}</option>
                                ))}
                              </select>
                            </div>

                            {/* Wilaya d'origine */}
                            <div className="form-group" style={{ margin: 0 }}>
                              <label>
                                {locale === 'ar' ? 'ولاية المنشأ' : 'Wilaya d\'origine'} <span style={{ color: 'var(--danger)' }}>*</span>
                              </label>
                              <select value={lot.wilayaId} onChange={e => updateLot(idx, 'wilayaId', e.target.value)}>
                                <option value="">{locale === 'ar' ? '-- اختر الولاية --' : '-- Choisir wilaya --'}</option>
                                {WILAYA_LIST.map(w => (
                                  <option key={w.id} value={w.id}>{w.id < 10 ? `0${w.id}` : w.id} – {w.name}</option>
                                ))}
                              </select>
                            </div>

                            {/* Unit + Quantity */}
                            <div className="form-group" style={{ margin: 0 }}>
                              <label>
                                {locale === 'ar' ? 'الوحدة' : 'Unité'} <span style={{ color: 'var(--danger)' }}>*</span>
                              </label>
                              <select value={lot.unit} onChange={e => updateLot(idx, 'unit', e.target.value)}>
                                <option value="tonnes">{t('unit_tonnes')}</option>
                                <option value="kg">{t('unit_kg')}</option>
                                <option value="cagettes">{t('unit_cagettes')}</option>
                                <option value="palettes">{t('unit_palettes')}</option>
                                <option value="sacs">{t('unit_sacs')}</option>
                              </select>
                            </div>

                            <div className="form-group" style={{ margin: 0 }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                {locale === 'ar' ? 'الكمية المطلوبة' : 'Quantité demandée'}
                                <span style={{ color: 'var(--danger)' }}>*</span>
                                {lot.unit && (
                                  <span style={{
                                    marginLeft: 4, fontSize: '0.72rem', fontWeight: 700,
                                    background: 'var(--primary)', color: 'white',
                                    borderRadius: 4, padding: '1px 7px', letterSpacing: '0.02em',
                                  }}>{t('unit_' + lot.unit)}</span>
                                )}
                              </label>
                              <input
                                type="number" step="any" min="0" placeholder="0"
                                value={lot.quantity} onChange={e => updateLot(idx, 'quantity', e.target.value)}
                              />
                            </div>

                            {/* Price ceiling */}
                            <div className="form-group" style={{ margin: 0 }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <TrendingDown size={13} style={{ color: 'var(--danger)' }} />
                                {locale === 'ar' ? 'السعر الأقصى (سقف)' : 'Prix plafond (max)'} <span style={{ color: 'var(--danger)' }}>*</span>
                              </label>
                              <div style={{ position: 'relative' }}>
                                <input
                                  type="number" step="any" min="0" placeholder="Ex: 50000"
                                  value={lot.priceCeiling} onChange={e => updateLot(idx, 'priceCeiling', e.target.value)}
                                  style={{ paddingRight: 44 }}
                                />
                                <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>DA</span>
                              </div>
                            </div>

                            {/* Price reserve */}
                            <div className="form-group" style={{ margin: 0 }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <TrendingUp size={13} style={{ color: 'var(--primary)' }} />
                                {locale === 'ar' ? 'سعر الاحتياط (حد أدنى)' : 'Prix de réserve (min)'}
                              </label>
                              <div style={{ position: 'relative' }}>
                                <input
                                  type="number" step="any" min="0" placeholder="Ex: 30000"
                                  value={lot.priceReserve} onChange={e => updateLot(idx, 'priceReserve', e.target.value)}
                                  style={{ paddingRight: 44 }}
                                />
                                <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>DA</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── STEP 3: Geographic zone ───────────────────────────── */}
              {wizardStep === 3 && (
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <MapPin size={20} style={{ color: 'var(--primary)' }} />
                    {locale === 'ar' ? 'المنطقة الجغرافية' : 'Zone géographique'}
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 20 }}>
                    {locale === 'ar'
                      ? 'حدد نطاق البحث لإيجاد المنتجين القريبين.'
                      : 'Définissez le rayon de recherche pour trouver les producteurs à proximité.'}
                  </p>
                  {userCoords ? (
                    <AuctionMap
                      centerLat={userCoords.lat}
                      centerLng={userCoords.lng}
                      radiusKm={radiusKm}
                      onRadiusChange={val => { setRadiusKm(val); setIsSearchZoneChanged(true); }}
                      producerCount={producerCount}
                    />
                  ) : (
                    <div style={{ padding: 14, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, fontSize: '0.85rem', color: '#f59e0b' }}>
                      ⚠️ {locale === 'ar' ? 'أكمل ملفك الشخصي (الولاية) لعرض الخريطة.' : 'Complétez votre profil (wilaya) pour afficher la carte.'}
                    </div>
                  )}
                </div>
              )}

              {/* ── STEP 4: Dates & Settings ─────────────────────────── */}
              {wizardStep === 4 && (
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CalendarClock size={20} style={{ color: 'var(--primary)' }} />
                    {locale === 'ar' ? 'التواريخ والإعدادات' : 'Dates & Paramètres'}
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 20px' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label htmlFor="start-dt">
                          {locale === 'ar' ? 'تاريخ + وقت البداية' : 'Date + heure de début'} <span style={{ color: 'var(--danger)' }}>*</span>
                        </label>
                        <input
                          id="start-dt" type="datetime-local"
                          value={startDatetime} onChange={e => setStartDatetime(e.target.value)}
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label htmlFor="end-dt">
                          {locale === 'ar' ? 'تاريخ + وقت النهاية' : 'Date + heure de fin'} <span style={{ color: 'var(--danger)' }}>*</span>
                        </label>
                        <input
                          id="end-dt" type="datetime-local"
                          value={endDatetime} onChange={e => setEndDatetime(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Auto prolongation */}
                    <div style={{
                      border: '1px solid var(--border)', borderRadius: 12, padding: '18px 22px',
                      background: 'rgba(255,255,255,0.02)',
                    }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                        <div style={{
                          width: 44, height: 24, borderRadius: 99,
                          background: autoProlongate ? 'var(--primary)' : 'var(--border)',
                          position: 'relative', transition: 'background 0.25s ease',
                          flexShrink: 0,
                        }} onClick={() => setAutoProlongate(p => !p)}>
                          <div style={{
                            width: 18, height: 18, borderRadius: '50%', background: 'white',
                            position: 'absolute', top: 3, left: autoProlongate ? 23 : 3,
                            transition: 'left 0.25s ease',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                          }} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 7 }}>
                            <Repeat2 size={16} style={{ color: 'var(--primary)' }} />
                            {locale === 'ar' ? 'تمديد تلقائي' : 'Prolongation automatique'}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                            {locale === 'ar' ? 'تمديد المزاد تلقائيًا عند وجود عرض في اللحظة الأخيرة.' : 'Prolonge l\'enchère automatiquement si une offre arrive en fin de session.'}
                          </div>
                        </div>
                      </label>

                      {autoProlongate && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 20px', marginTop: 20 }}>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label htmlFor="prolong-minutes">
                              <Clock size={13} style={{ color: 'var(--primary)', marginRight: 5, verticalAlign: 'middle' }} />
                              {locale === 'ar' ? 'مدة التمديد (دقائق)' : 'Durée prolongation (min)'}
                            </label>
                            <input
                              id="prolong-minutes" type="number" min="1" max="120"
                              value={prolongationMinutes} onChange={e => setProlongationMinutes(e.target.value)}
                            />
                          </div>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label htmlFor="max-prolongs">
                              <Hash size={13} style={{ color: 'var(--primary)', marginRight: 5, verticalAlign: 'middle' }} />
                              {locale === 'ar' ? 'الحد الأقصى للتمديدات' : 'Nombre max de prolongations'}
                            </label>
                            <input
                              id="max-prolongs" type="number" min="1" max="20"
                              value={maxProlongations} onChange={e => setMaxProlongations(e.target.value)}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── STEP 5: Summary ──────────────────────────────────── */}
              {wizardStep === 5 && (
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FileSearch size={20} style={{ color: 'var(--primary)' }} />
                    {locale === 'ar' ? 'ملخص المزاد' : 'Récapitulatif de l\'enchère'}
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* General info summary */}
                    <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', background: 'rgba(255,255,255,0.02)' }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
                        {locale === 'ar' ? 'المعلومات العامة' : 'Informations générales'}
                      </div>
                      <SummaryRow label={locale === 'ar' ? 'العنوان' : 'Titre'} value={title} />
                      <SummaryRow label={locale === 'ar' ? 'النوع' : 'Type'} value={getAuctionTypeLabel(auctionType)} />
                      <SummaryRow label={locale === 'ar' ? 'مكان التسليم' : 'Lieu de livraison'} value={deliveryLocation} />
                      {generalDescription && <SummaryRow label={locale === 'ar' ? 'الوصف' : 'Description'} value={generalDescription} />}
                    </div>

                    {/* Lots summary */}
                    <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', background: 'rgba(255,255,255,0.02)' }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
                        {locale === 'ar' ? 'الأقسام' : 'Lots'} ({lots.length})
                      </div>
                      {lots.map(lot => (
                        <div key={lot.seq} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
                          <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: 4, fontSize: '0.9rem' }}>
                            Lot {lot.seq} — {lot.designation}
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', fontSize: '0.8rem', color: 'var(--text-body)' }}>
                            <span>🌿 {getCultureName(lot.cultureTypeId)} / {getProductName(lot.productId)}</span>
                            <span>📍 {getWilayaName(lot.wilayaId)}</span>
                            <span>📦 {lot.quantity} {t('unit_' + lot.unit)}</span>
                            <span style={{ color: 'var(--danger)' }}>⬆ {lot.priceCeiling} DA</span>
                            <span style={{ color: 'var(--primary)' }}>⬇ {lot.priceReserve || '—'} DA</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Zone & dates */}
                    <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', background: 'rgba(255,255,255,0.02)' }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
                        {locale === 'ar' ? 'المنطقة والتواريخ' : 'Zone & Dates'}
                      </div>
                      <SummaryRow label={locale === 'ar' ? 'نطاق البحث' : 'Rayon de recherche'} value={`${radiusKm} km`} />
                      <SummaryRow label={locale === 'ar' ? 'منتجون في المنطقة' : 'Producteurs dans la zone'} value={`${producerCount}`} />
                      <SummaryRow label={locale === 'ar' ? 'بداية' : 'Début'} value={startDatetime ? new Date(startDatetime).toLocaleString('fr-DZ') : '—'} />
                      <SummaryRow label={locale === 'ar' ? 'نهاية' : 'Fin'} value={endDatetime ? new Date(endDatetime).toLocaleString('fr-DZ') : '—'} />
                      {autoProlongate && (
                        <SummaryRow
                          label={locale === 'ar' ? 'تمديد تلقائي' : 'Prolongation auto'}
                          value={`${prolongationMinutes} min × ${maxProlongations} fois`}
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Error message ── */}
              {stepError && (
                <div style={{
                  marginTop: 20, padding: '10px 14px', borderRadius: 8, fontSize: '0.875rem',
                  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                  color: '#ef4444', display: 'flex', alignItems: 'flex-start', gap: 8,
                }}>
                  <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                  {stepError}
                </div>
              )}
            </div>

            {/* ── Wizard Nav Buttons ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, gap: 12 }}>
              <button
                type="button" onClick={goPrev} disabled={wizardStep === 1}
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: wizardStep === 1 ? 0.4 : 1 }}
              >
                <ChevronLeft size={16} />
                {locale === 'ar' ? 'السابق' : 'Précédent'}
              </button>

              {wizardStep < 5 ? (
                <button type="button" onClick={goNext} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {locale === 'ar' ? 'التالي' : 'Suivant'}
                  <ChevronRight size={16} />
                </button>
              ) : (
                <button type="button" onClick={handleSubmit} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Gavel size={16} />
                  {locale === 'ar' ? 'نشر المزاد' : 'Publier l\'enchère'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ══ DASHBOARD VIEW ══════════════════════════════════════════ */}
        {!wizardOpen && activeSection === 'dashboard' && (
          <div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: 8, color: 'var(--text-main)' }}>
              {locale === 'ar' ? `مرحباً، ${user.name} 👋` : `Bienvenue, ${user.name} 👋`}
            </h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 32, fontSize: '0.95rem' }}>
              {locale === 'ar' ? 'إليك ملخص نشاطك.' : 'Voici un aperçu de votre activité.'}
            </p>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 36 }}>
              {[
                { icon: Gavel, label: locale === 'ar' ? 'إجمالي المزادات' : 'Total enchères', value: myAuctions.length, color: 'var(--primary)' },
                { icon: ListOrdered, label: locale === 'ar' ? 'مزادات مفتوحة' : 'Enchères ouvertes', value: myAuctions.filter(a => a.status === 'open').length, color: '#f59e0b' },
                { icon: Check, label: locale === 'ar' ? 'منجزة' : 'Clôturées', value: myAuctions.filter(a => a.status === 'closed').length, color: '#3b82f6' },
              ].map((stat, i) => {
                const Icon = stat.icon;
                return (
                  <div key={i} className="glass-panel" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: `${stat.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={24} style={{ color: stat.color }} />
                    </div>
                    <div>
                      <div style={{ fontSize: '1.75rem', fontWeight: 800, color: stat.color }}>{stat.value}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{stat.label}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Profile Completion Widget */}
            <div className="glass-panel" style={{ padding: '24px', marginBottom: '28px', display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap', textAlign: 'start' }}>
              <div style={{ position: 'relative', width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {/* Circular Progress (SVG) */}
                <svg width="80" height="80" viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="40" cy="40" r="34" stroke="rgba(255,255,255,0.05)" strokeWidth="6" fill="transparent" />
                  <circle cx="40" cy="40" r="34" stroke="var(--primary)" strokeWidth="6" fill="transparent"
                    strokeDasharray={`${2 * Math.PI * 34}`}
                    strokeDashoffset={`${2 * Math.PI * 34 * (1 - computeProfileCompletion(user) / 100)}`}
                    style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                  />
                </svg>
                <div style={{ position: 'absolute', fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)' }}>
                  {computeProfileCompletion(user)}%
                </div>
              </div>

              <div style={{ flex: 1, minWidth: '240px', textAlign: 'start' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-main)' }}>
                  {locale === 'ar' ? 'مستوى اكتمال ملفك الشخصي' : (locale === 'fr' ? 'Taux de complétion de votre profil' : 'Profile completion level')}
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: 0, lineHeight: 1.4 }}>
                  {computeProfileCompletion(user) < 70 ? (
                    locale === 'ar' 
                      ? '⚠️ ملفك الشخصي غير مكتمل بعد. يجب أن يصل إلى 70% لتتمكن من إطلاق المزادات (تحتاج إلى ملء الحقول المطلوبة).'
                      : (locale === 'fr' 
                          ? '⚠️ Votre profil est incomplet (< 70%). Vous devez le compléter pour pouvoir créer des enchères.'
                          : '⚠️ Your profile is incomplete (< 70%). You must complete it to be able to create auctions.')
                  ) : (
                    locale === 'ar'
                      ? '✓ ملفك الشخصي مكتمل بما يكفي لإطلاق المزادات!'
                      : (locale === 'fr'
                          ? '✓ Votre profil est suffisant pour lancer des enchères !'
                          : '✓ Your profile is complete enough to launch auctions!')
                  )}
                </p>
                {computeProfileCompletion(user) < 70 && (
                  <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '0.72rem', justifyContent: 'flex-start' }}>
                    {getMissingFieldsList(user, locale).map((field, idx) => (
                      <span key={idx} style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', padding: '2px 8px', borderRadius: '4px' }}>
                        {field}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <button onClick={onNavigateToProfile} className="btn btn-secondary" style={{ fontSize: '0.85rem', padding: '8px 16px', whiteSpace: 'nowrap' }}>
                {locale === 'ar' ? 'تعديل الملف الشخصي' : (locale === 'fr' ? 'Compléter mon profil' : 'Complete my profile')}
              </button>
            </div>

            {/* CTA */}
            <div className="glass-panel" style={{ padding: '28px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 6, color: 'var(--text-main)' }}>
                  {locale === 'ar' ? 'أنشئ مزادًا جديدًا' : 'Lancez une nouvelle enchère'}
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  {locale === 'ar' ? 'حدد الكميات والمواصفات وانتظر عروض المنتجين.' : 'Définissez vos besoins et recevez les offres des producteurs.'}
                </p>
              </div>
              <button onClick={openWizard} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
                <Plus size={18} />
                {locale === 'ar' ? 'إنشاء مزاد' : 'Créer enchère'}
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ══ AUCTIONS VIEW ═══════════════════════════════════════════ */}
        {!wizardOpen && activeSection === 'auctions' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 12 }}>
                {locale === 'ar' ? 'مزاداتي' : 'Mes enchères'}
                <span className="badge badge-open" style={{ borderRadius: '20px', fontSize: '0.8rem' }}>
                  {myAuctions.length}
                </span>
              </h2>
              <button onClick={openWizard} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Plus size={16} /> {locale === 'ar' ? 'مزاد جديد' : 'Nouvelle enchère'}
              </button>
            </div>

            {myAuctions.length === 0 ? (
              <div className="glass-panel empty-state">
                <Package className="empty-icon" size={48} />
                <div>
                  <h4 style={{ fontSize: '1.25rem', marginBottom: '6px', color: 'var(--text-main)' }}>{t('noDemandPosted')}</h4>
                  <p>{t('noDemandPostedSub')}</p>
                </div>
              </div>
            ) : (
              <AuctionsTable
                auctions={myAuctions}
                locale={locale}
                t={t}
                newBidFlashIds={newBidFlashIds}
                onAcceptBid={onAcceptBid}
                onRateProducer={(aId) => setRatingAuctionId(aId)}
                onZoomImage={setActiveZoomImage}
                onOpenWizard={openWizard}
                getAuctionTypeLabel={getAuctionTypeLabel}
              />
            )}
          </div>
        )}

      </div>
  );
}

// ─── Summary Row helper ─────────────────────────────────────────────────────
function SummaryRow({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 6, fontSize: '0.875rem' }}>
      <span style={{ color: 'var(--text-muted)', minWidth: 140, flexShrink: 0 }}>{label}</span>
      <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{value}</span>
    </div>
  );
}

// ─── Auctions Table ─────────────────────────────────────────────────────────
function AuctionsTable({ auctions, locale, t, newBidFlashIds, onAcceptBid, onRateProducer, onZoomImage, onOpenWizard, getAuctionTypeLabel, highlightAuctionId }) {
  const [expandedId, setExpandedId] = useState(null);

  const statusColors = {
    open:    { bg: 'rgba(16,185,129,0.12)', color: '#10b981', label: (locale) => locale === 'ar' ? 'مفتوح' : (locale === 'fr' ? 'Ouvert' : 'Open') },
    closed:  { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6', label: (locale) => locale === 'ar' ? 'مغلق' : (locale === 'fr' ? 'Clôturé' : 'Closed') },
    pending: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', label: (locale) => locale === 'ar' ? 'معلق' : (locale === 'fr' ? 'En attente' : 'Pending') },
  };

  useEffect(() => {
    if (highlightAuctionId) {
      setExpandedId(highlightAuctionId);
    }
  }, [highlightAuctionId]);

  return (
    <div style={{ borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden', background: 'var(--bg-panel)' }}>
      {/* Table Header */}
      <div style={{
        display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 80px 80px 40px',
        padding: '10px 20px',
        background: 'rgba(255,255,255,0.03)',
        borderBottom: '1px solid var(--border)',
        fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: '0.06em',
      }}>
        <span>{locale === 'ar' ? 'العنوان' : 'Titre'}</span>
        <span>{locale === 'ar' ? 'النوع' : 'Type'}</span>
        <span>{locale === 'ar' ? 'التاريخ' : 'Date'}</span>
        <span style={{ textAlign: 'center' }}>{locale === 'ar' ? 'عروض' : 'Offres'}</span>
        <span style={{ textAlign: 'center' }}>{locale === 'ar' ? 'الحالة' : 'Statut'}</span>
        <span></span>
      </div>

      {auctions.map((auction, idx) => {
        const isExpanded = expandedId === auction.id;
        const isNew = newBidFlashIds.some(id => auction.bids.some(b => b.id === id));
        const status = statusColors[auction.status] || statusColors.closed;
        const dateStr = new Date(auction.createdAt).toLocaleDateString('fr-DZ', { day: '2-digit', month: '2-digit', year: '2-digit' });

        return (
          <div 
            key={auction.id} 
            ref={el => {
              if (highlightAuctionId === auction.id && el) {
                setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
              }
            }}
            style={{ borderBottom: idx < auctions.length - 1 ? '1px solid var(--border)' : 'none' }}
          >
            {/* Row */}
            <div
              onClick={() => setExpandedId(isExpanded ? null : auction.id)}
              style={{
                display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 80px 80px 40px',
                padding: '14px 20px', alignItems: 'center', cursor: 'pointer',
                background: isNew ? 'rgba(16,185,129,0.06)' : isExpanded ? 'rgba(255,255,255,0.04)' : 'transparent',
                transition: 'background 0.2s',
              }}
              onMouseEnter={e => { if (!isExpanded && !isNew) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
              onMouseLeave={e => { if (!isExpanded && !isNew) e.currentTarget.style.background = 'transparent'; }}
            >
              {/* Title */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <span style={{
                  fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {isNew && <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#10b981', marginRight: 6, verticalAlign: 'middle', boxShadow: '0 0 6px #10b981' }} />}
                  {auction.title || auction.product}
                </span>
                {auction.deliveryLocation && (
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                    <MapPin size={10} /> {auction.deliveryLocation}
                  </span>
                )}
              </div>

              {/* Type */}
              <span style={{ fontSize: '0.8rem', color: 'var(--text-body)' }}>
                {getAuctionTypeLabel(auction.auctionType)}
              </span>

              {/* Date */}
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{dateStr}</span>

              {/* Bids count */}
              <div style={{ textAlign: 'center' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 28, height: 28, borderRadius: '50%',
                  background: auction.bids.length > 0 ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)',
                  color: auction.bids.length > 0 ? 'var(--primary)' : 'var(--text-muted)',
                  fontWeight: 800, fontSize: '0.85rem',
                }}>
                  {auction.bids.length}
                </span>
              </div>

              {/* Status */}
              <div style={{ textAlign: 'center' }}>
                <span style={{
                  display: 'inline-block', padding: '3px 10px', borderRadius: 99,
                  background: status.bg, color: status.color,
                  fontSize: '0.72rem', fontWeight: 700,
                }}>
                  {status.label(locale)}
                </span>
              </div>

              {/* Expand chevron */}
              <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--text-muted)' }}>
                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </div>

            {/* Expanded detail panel */}
            {isExpanded && (
              <div style={{
                padding: '16px 24px 24px',
                background: 'rgba(255,255,255,0.02)',
                borderTop: '1px solid var(--border)',
                animationName: 'fadeIn', animationDuration: '0.2s',
              }}>
                {/* Description */}
                {auction.description && (
                  <p style={{
                    fontSize: '0.875rem', color: 'var(--text-body)',
                    borderLeft: '3px solid var(--primary)', paddingLeft: 12,
                    marginBottom: 20, background: 'rgba(16,185,129,0.05)',
                    padding: '8px 12px', borderRadius: '0 8px 8px 0',
                  }}>
                    {auction.description}
                  </p>
                )}

                {/* Bids area */}
                <div>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: 12, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Gavel size={14} style={{ color: 'var(--primary)' }} />
                    {t('proposalsProducers')} ({auction.bids.length})
                  </h4>

                  {auction.bids.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                      {t('waitingProposals')}
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {[...auction.bids]
                        .sort((a, b) => {
                          const minA = Math.min(...(a.lines || []).map(l => l.price || Infinity));
                          const minB = Math.min(...(b.lines || []).map(l => l.price || Infinity));
                          return minA - minB;
                        })
                        .map(bid => {
                          const isBidNew = newBidFlashIds.includes(bid.id);
                          const isAccepted = auction.acceptedBidId === bid.id;
                          return (
                            <div
                              key={bid.id}
                              className={isBidNew ? 'bid-flash-new' : ''}
                              style={{
                                border: `1px solid ${isAccepted ? 'var(--primary)' : 'var(--border)'}`,
                                borderRadius: 10, padding: '12px 16px',
                                background: isAccepted ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.02)',
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-main)' }}>{bid.producerAlias}</span>
                                  <StarDisplay rating={bid.producerRating} count={bid.producerRatingCount} />
                                </div>
                                {isAccepted && (
                                  <span style={{ fontSize: '0.7rem', fontWeight: 700, background: 'var(--primary)', color: 'white', borderRadius: 99, padding: '2px 8px' }}>
                                    {t('bidSelected')}
                                  </span>
                                )}
                              </div>

                              {/* Bid lines */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                                {(bid.lines || []).map(line => (
                                  <div key={line.id} style={{
                                    display: 'flex', alignItems: 'flex-start', gap: 8,
                                    padding: '6px 10px', background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid var(--border)', borderRadius: 7, flexWrap: 'wrap',
                                  }}>
                                    <div style={{ flex: 1 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                        {line.optionName && <strong style={{ fontSize: '0.8rem', color: 'var(--text-main)', background: 'var(--primary-soft)', padding: '1px 7px', borderRadius: 4 }}>{line.optionName}</strong>}
                                        {line.quantity && <span style={{ fontSize: '0.8rem', color: 'var(--text-body)' }}>{line.quantity} {t('unit_' + (line.unit || auction.unit))}</span>}
                                        <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--secondary)' }}>
                                          {line.price} DA <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>/ {t('unit_' + (line.unit || auction.unit))}</span>
                                        </span>
                                      </div>
                                      {line.comments && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3, fontSize: '0.76rem', color: 'var(--text-body)' }}>
                                          <MessageSquare size={10} style={{ color: 'var(--text-muted)' }} />
                                          <span>{line.comments}</span>
                                        </div>
                                      )}
                                      {line.images && line.images.length > 0 && (
                                        <div style={{ marginTop: 6 }}>
                                          <div className="bid-photos-grid">
                                            {line.images.map((img, i) => (
                                              <div key={i} className="bid-photo-thumb" onClick={() => onZoomImage(img)} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && onZoomImage(img)}>
                                                <img src={img} alt={`Photo ${i + 1}`} />
                                                <div className="bid-photo-overlay"><ImageIcon size={12} /></div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* Action */}
                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                {auction.status === 'open' ? (
                                  <button className="btn btn-primary" style={{ padding: '7px 14px', fontSize: '0.82rem', gap: 5 }} onClick={() => onAcceptBid(auction.id, bid.id)}>
                                    <Check size={13} /> {t('validateBtn')}
                                  </button>
                                ) : (
                                  isAccepted && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <span style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 'bold', fontSize: '0.82rem' }}>
                                        <Check size={14} /> {t('bidConfirmed')}
                                      </span>
                                      {!auction.alreadyRated && (
                                        <button className="btn btn-secondary" style={{ fontSize: '0.7rem', padding: '3px 8px', gap: 3 }} onClick={() => onRateProducer(auction.id)}>
                                          <Star size={11} /> {locale === 'ar' ? 'تقييم' : (locale === 'fr' ? 'Noter' : 'Rate')}
                                        </button>
                                      )}
                                      {auction.alreadyRated && (
                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 2 }}>
                                          <Star size={10} style={{ color: '#f59e0b' }} /> {locale === 'ar' ? 'تم التقييم ✓' : (locale === 'fr' ? 'Noté ✓' : 'Rated ✓')}
                                        </span>
                                      )}
                                    </div>
                                  )
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Auction Card ────────────────────────────────────────────────────────────
function AuctionCard({ auction, dir, locale, t, newBidFlashIds, onAcceptBid, onRateProducer, onZoomImage }) {
  return (
    <div className="auction-card animate-fade-in">
      <div className="auction-header" style={{ flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}>
        <div>
          <h3 className="auction-title">
            {auction.title || auction.product} — {auction.quantity} {t('unit_' + auction.unit)}
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {t('publishedAt', { time: new Date(auction.createdAt).toLocaleTimeString() })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span className={`badge ${auction.status === 'open' ? 'badge-open' : 'badge-closed'}`}>
            {auction.status === 'open' ? t('statusOpen') : t('statusClosed')}
          </span>
        </div>
      </div>

      {auction.description && (
        <p style={{
          background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: '8px',
          fontSize: '0.9rem', marginBottom: '16px',
          borderLeft: dir === 'ltr' ? '3px solid var(--primary)' : 'none',
          borderRight: dir === 'rtl' ? '3px solid var(--primary)' : 'none',
        }}>
          <strong>{t('detailsLabel')}</strong> {auction.description}
        </p>
      )}

      <div className="auction-details" style={{ flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}>
        <div className="detail-item">
          <span>{t('bidsReceivedCount', { count: auction.bids.length })}</span>
        </div>
        {auction.deliveryLocation && (
          <div className="detail-item">
            <MapPin size={12} /> <span>{auction.deliveryLocation}</span>
          </div>
        )}
      </div>

      {/* Bids area */}
      <div className="bids-container">
        <h4 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '12px', color: 'var(--text-main)', textAlign: 'start' }}>
          {t('proposalsProducers')}
        </h4>

        {auction.bids.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontStyle: 'italic', padding: '8px 0', textAlign: 'start' }}>
            {t('waitingProposals')}
          </p>
        ) : (
          <div>
            {[...auction.bids]
              .sort((a, b) => {
                const minA = Math.min(...(a.lines || []).map(l => l.price || Infinity));
                const minB = Math.min(...(b.lines || []).map(l => l.price || Infinity));
                return minA - minB;
              })
              .map((bid) => {
                const isNew = newBidFlashIds.includes(bid.id);
                const isAccepted = auction.acceptedBidId === bid.id;
                return (
                  <div
                    key={bid.id}
                    className={`bid-item ${isNew ? 'bid-flash-new' : ''}`}
                    style={{ display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px', marginBottom: '12px' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                      <div>
                        <span className="bid-producer">{bid.producerAlias}</span>
                        <div style={{ marginTop: '2px' }}><StarDisplay rating={bid.producerRating} count={bid.producerRatingCount} /></div>
                      </div>
                      {isAccepted && (
                        <span className="badge badge-open" style={{ fontSize: '0.7rem', background: 'var(--primary)', color: 'var(--text-inverse)', border: 'none', padding: '3px 8px' }}>
                          {t('bidSelected')}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                        {t('bidQualitiesTitle')}
                      </div>
                      {(bid.lines || []).map((line) => (
                        <div key={line.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '8px', flexWrap: 'wrap' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              {line.optionName && <strong style={{ fontSize: '0.82rem', color: 'var(--text-main)', background: 'var(--primary-soft)', padding: '2px 8px', borderRadius: '4px' }}>{line.optionName}</strong>}
                              {line.quantity && <span style={{ fontSize: '0.82rem', color: 'var(--text-body)' }}>{line.quantity} {t('unit_' + (line.unit || auction.unit))}</span>}
                              <span className="bid-price" style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--secondary)' }}>
                                {line.price} DA <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>/ {t('unit_' + (line.unit || auction.unit))}</span>
                              </span>
                            </div>
                            {line.comments && (
                              <div className="bid-comment" style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', fontSize: '0.78rem', color: 'var(--text-body)' }}>
                                <MessageSquare size={10} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                <span>{line.comments}</span>
                              </div>
                            )}
                            {line.images && line.images.length > 0 && (
                              <div style={{ marginTop: '6px' }}>
                                <div className="bid-photos-grid">
                                  {line.images.map((img, idx) => (
                                    <div key={idx} className="bid-photo-thumb" onClick={() => onZoomImage(img)} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && onZoomImage(img)} aria-label={`Photo ${idx + 1}`}>
                                      <img src={img} alt={`Photo produit ${idx + 1}`} />
                                      <div className="bid-photo-overlay"><ImageIcon size={14} /></div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px' }}>
                      {auction.status === 'open' ? (
                        <button type="button" className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem', gap: '6px' }} onClick={() => onAcceptBid(auction.id, bid.id)}>
                          <Check size={14} /> {t('validateBtn')}
                        </button>
                      ) : (
                        isAccepted && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold', fontSize: '0.85rem' }}>
                              <Check size={16} /> {t('bidConfirmed')}
                            </span>
                            {!auction.alreadyRated && (
                              <button type="button" className="btn btn-secondary" style={{ fontSize: '0.7rem', padding: '3px 8px', gap: '3px' }} onClick={() => onRateProducer(auction.id)}>
                                <Star size={11} /> {locale === 'ar' ? 'تقييم' : (locale === 'fr' ? 'Noter' : 'Rate')}
                              </button>
                            )}
                            {auction.alreadyRated && (
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                <Star size={10} style={{ color: '#f59e0b' }} /> {locale === 'ar' ? 'تم التقييم ✓' : (locale === 'fr' ? 'Noté ✓' : 'Rated ✓')}
                              </span>
                            )}
                          </div>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
