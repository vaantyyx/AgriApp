import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Plus, MessageSquare, Check, Package, X, Star, MapPin,
  ChevronDown, ChevronUp, Image as ImageIcon,
  ClipboardList, Layers, CalendarClock, FileSearch,
  ChevronRight, ChevronLeft, AlertTriangle,
  Gavel, Clock, Repeat2, TrendingDown, TrendingUp, Hash,
  ArrowRight, ListOrdered,
} from 'lucide-react';
import { WILAYA_COORDS, getCommuneCoords, getCoordsForWilayaName } from '../utils/wilayaCoordinates.js';
import { cultureTypes, products } from '../utils/referenceData.js';
import { useTranslation } from '../context/LanguageContext';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { computeBuyerCompletion as computeProfileCompletion } from '../utils/profileCompletion.js';
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
  const cardRef = useRef(null);
  useEscapeKey(true, onClose);
  useFocusTrap(cardRef, true);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div ref={cardRef} className="modal-card animate-fade-in" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t('rateProducerTitle')}>
        <button className="modal-close-btn" onClick={onClose} aria-label={t('captchaClose')}><X size={18} /></button>
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
      } catch { /* map may already be torn down */ }
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
            {locale === 'ar' ? 'نطاق البحث :' : (locale === 'en' ? 'Search radius:' : 'Rayon de recherche :')}
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
            {locale === 'ar' ? 'منتج في هذه المنطقة' : (locale === 'en' ? `producer${producerCount !== 1 ? 's' : ''} in this area` : `producteur${producerCount !== 1 ? 's' : ''} dans cette zone`)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Step Indicator ─────────────────────────────────────────────────────────
const STEPS = [
  { id: 1, icon: ClipboardList, labelFr: 'Informations générales', labelAr: 'معلومات عامة', labelEn: 'General information' },
  { id: 2, icon: Layers,       labelFr: 'Lots',                    labelAr: 'الأقسام', labelEn: 'Lots' },
  { id: 3, icon: MapPin,       labelFr: 'Zone géographique',       labelAr: 'المنطقة الجغرافية', labelEn: 'Geographic zone' },
  { id: 4, icon: CalendarClock,labelFr: 'Dates & Paramètres',      labelAr: 'التواريخ والإعدادات', labelEn: 'Dates & Parameters' },
  { id: 5, icon: FileSearch,   labelFr: 'Récapitulatif',           labelAr: 'ملخص', labelEn: 'Summary' },
];

function StepIndicator({ currentStep, locale }) {
  return (
    <div className="wizard-step-indicator">
      {STEPS.map((step, idx) => {
        const Icon = step.icon;
        const isActive = currentStep === step.id;
        const isDone = currentStep > step.id;
        return (
          <React.Fragment key={step.id}>
            <div className="wizard-step-item">
              <div className={`wizard-step-circle ${isDone ? 'done' : ''} ${isActive ? 'active' : ''}`}>
                {isDone
                  ? <Check size={18} color="white" />
                  : <Icon size={18} color={isActive ? 'white' : 'var(--text-muted)'} />
                }
              </div>
              <span className={`wizard-step-label ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}>
                {locale === 'ar' ? step.labelAr : (locale === 'en' ? step.labelEn : step.labelFr)}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div className={`wizard-step-connector ${currentStep > step.id ? 'done' : ''}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── AUCTION TYPES ─────────────────────────────────────────────────────────
const AUCTION_TYPES = [
  { value: 'open', labelFr: 'Enchère ouverte', labelAr: 'مزاد مفتوح', labelEn: 'Open auction' },
  { value: 'smart', labelFr: 'Enchère intelligente', labelAr: 'مزاد ذكي', labelEn: 'Smart auction' },
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
  const { t, locale } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const urlTab = searchParams.get('tab') || 'dashboard';

  // 5-step wizard state
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardOpen, setWizardOpen] = useState(false);

  useEffect(() => {
    if (highlightAuctionId) {
      // React to an external navigation event (notification click), not
      // deriving state from a prop.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWizardOpen(false);
      navigate('?tab=auctions', { replace: true });
    }
  }, [highlightAuctionId, navigate]);

  // Sidebar active section
  const [activeSection, setActiveSection] = useState(urlTab);

  useEffect(() => {
    if (!wizardOpen) {
      // Syncing local UI state to the URL (an external system), not derived
      // render-time state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const productIdsJoined = React.useMemo(() => {
    return lots.map(l => l.productId).filter(Boolean).join(',');
  }, [lots]);

  useEffect(() => {
    if (!userCoords?.lat || !userCoords?.lng) return;
    let active = true;
    let url = `http://127.0.0.1:3001/api/producers/count?lat=${userCoords.lat}&lng=${userCoords.lng}&radius=${radiusKm}`;
    if (auctionType === 'smart') {
      url += `&auctionType=smart&productIds=${productIdsJoined}`;
    }
    fetch(url)
      .then(res => res.ok ? res.json() : { count: 0 })
      .then(data => { if (active) setProducerCount(data.count); })
      .catch(() => { if (active) setProducerCount(0); });
    return () => { active = false; };
  }, [userCoords, radiusKm, auctionType, productIdsJoined]);

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
  const resetWizard = () => {
    setTitle(''); setAuctionType('open'); setDeliveryLocation(''); setGeneralDescription('');
    setLots([newLot(1)]);
    setRadiusKm(100); setIsSearchZoneChanged(false);
    setStartDatetime(''); setEndDatetime('');
    setAutoProlongate(false); setProlongationMinutes(10); setMaxProlongations(3);
    setStepError('');
  };

  const closeWizard = () => {
    setWizardOpen(false);
    setWizardStep(1);
    resetWizard();
  };

  useEscapeKey(wizardOpen, closeWizard);
  useEscapeKey(showBlockWarningModal, () => setShowBlockWarningModal(false));
  useEscapeKey(!!activeZoomImage, () => setActiveZoomImage(null));
  const blockModalRef = useRef(null);
  useFocusTrap(blockModalRef, showBlockWarningModal);

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

  // ─── Summary helpers ─────────────────────────────────────────────────────
  const getAuctionTypeLabel = (val) => {
    const found = AUCTION_TYPES.find(t => t.value === val);
    return found ? (locale === 'ar' ? found.labelAr : (locale === 'en' ? found.labelEn : found.labelFr)) : val;
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
      <div className="dash-page-scroll" style={{ flex: 1, padding: '32px 40px', overflowY: 'auto', textAlign: 'start', height: '100%' }}>


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
              <button className="lightbox-close" onClick={() => setActiveZoomImage(null)} aria-label={t('captchaClose')}><X size={20} /></button>
              <img src={activeZoomImage} alt={t('zoomProduct')} />
            </div>
          </div>
        )}

        {/* Block Warning Modal */}
        {showBlockWarningModal && (
          <div className="modal-overlay" onClick={() => setShowBlockWarningModal(false)}>
            <div ref={blockModalRef} className="modal-card animate-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }} role="dialog" aria-modal="true" aria-label={locale === 'ar' ? 'حساب غير مكتمل' : (locale === 'en' ? 'Incomplete profile' : 'Profil incomplet')}>
              <button className="modal-close-btn" onClick={() => setShowBlockWarningModal(false)} aria-label={t('captchaClose')}><X size={18} /></button>
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🔒</div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '8px', color: 'var(--text-main)' }}>
                  {locale === 'ar' ? 'حساب غير مكتمل' : (locale === 'en' ? 'Incomplete profile' : 'Profil incomplet')}
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.5 }}>
                  {locale === 'ar' 
                    ? `نسبة اكتمال ملفك الشخصي الحالية هي ${computeProfileCompletion(user)}% ويجب أن تصل إلى 70% على الأقل لتتمكن من إنشاء مزاد جديد.` 
                    : (locale === 'en' 
                        ? `Your profile completion rate is currently ${computeProfileCompletion(user)}%. A minimum of 70% is required to create an auction.`
                        : `Votre taux de complétion de profil est actuellement de ${computeProfileCompletion(user)}%. Un minimum de 70% est requis pour créer une enchère.`)}
                </p>
              </div>
              <div className="bordered-card-sm" style={{ marginBottom: 20 }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8, textAlign: 'start' }}>
                  {locale === 'ar' ? 'الحقول الناقصة :' : (locale === 'en' ? 'Missing fields:' : 'Champs manquants :')}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'flex-start' }}>
                  {getMissingFieldsList(user, locale).map((field, idx) => (
                    <span key={idx} className="missing-field-chip">
                      {field}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowBlockWarningModal(false)}>
                  {locale === 'ar' ? 'إغلاق' : (locale === 'en' ? 'Close' : 'Fermer')}
                </button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => { setShowBlockWarningModal(false); onNavigateToProfile(); }}>
                  {locale === 'ar' ? 'إكمال الملف' : (locale === 'en' ? 'Complete profile' : 'Compléter le profil')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══ WIZARD ══════════════════════════════════════════════════ */}
        {wizardOpen && (
          <div>
            <div className="wizard-header-row">
              <h2 className="wizard-header-title">
                <Gavel size={24} style={{ color: 'var(--primary)' }} />
                {locale === 'ar' ? 'إنشاء مزاد جديد' : (locale === 'en' ? 'Create new auction' : 'Créer une enchère')}
              </h2>
              <button onClick={closeWizard} className="wizard-close-btn" aria-label={t('captchaClose')}>
                <X size={22} />
              </button>
            </div>

            <StepIndicator currentStep={wizardStep} locale={locale} />

            <div className="glass-panel animate-fade-in" style={{ padding: '28px 32px' }}>

              {/* ── STEP 1: General Info ──────────────────────────────── */}
              {wizardStep === 1 && (
                <div>
                  <h3 className="wizard-section-title mb-20">
                    <ClipboardList size={20} style={{ color: 'var(--primary)' }} />
                    {locale === 'ar' ? 'المعلومات العامة' : (locale === 'en' ? 'General information' : 'Informations générales')}
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label htmlFor="auction-title">
                        {locale === 'ar' ? 'عنوان المزاد' : (locale === 'en' ? 'Auction title' : 'Titre de l\'enchère')} <span className="required-asterisk">*</span>
                      </label>
                      <input
                        id="auction-title" type="text"
                        placeholder={locale === 'ar' ? 'مثال: طلب بطاطس درجة أولى' : (locale === 'en' ? 'Ex: Potato request grade 1' : 'Ex: Demande de pommes de terre qualité 1')}
                        value={title} onChange={e => setTitle(e.target.value)}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label htmlFor="auction-type">
                        {locale === 'ar' ? 'نوع المزاد' : (locale === 'en' ? 'Auction type' : 'Type d\'enchère')} <span className="required-asterisk">*</span>
                      </label>
                      <select id="auction-type" value={auctionType} onChange={e => setAuctionType(e.target.value)}>
                        {AUCTION_TYPES.map(at => (
                          <option key={at.value} value={at.value}>
                            {locale === 'ar' ? at.labelAr : (locale === 'en' ? at.labelEn : at.labelFr)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label htmlFor="delivery-location">
                        {locale === 'ar' ? 'مكان التسليم' : (locale === 'en' ? 'Delivery location' : 'Lieu de livraison')} <span className="required-asterisk">*</span>
                      </label>
                      <input
                        id="delivery-location" type="text"
                        placeholder={locale === 'ar' ? 'مثال: ورقلة، حي الرياض' : (locale === 'en' ? 'Ex: Algiers, Rouiba industrial zone' : 'Ex: Alger, Zone industrielle de Rouiba')}
                        value={deliveryLocation} onChange={e => setDeliveryLocation(e.target.value)}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label htmlFor="general-description">
                        {locale === 'ar' ? 'وصف تفصيلي' : (locale === 'en' ? 'Detailed description' : 'Description détaillée')}
                      </label>
                      <textarea
                        id="general-description" rows={4}
                        placeholder={locale === 'ar' ? 'وصف تفصيلي للمزاد...' : (locale === 'en' ? 'Describe your need in detail...' : 'Décrivez votre besoin en détail…')}
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
                    <h3 className="wizard-section-title">
                      <Layers size={20} style={{ color: 'var(--primary)' }} />
                      {locale === 'ar' ? 'الأقسام (Lots)' : (locale === 'en' ? 'Lots' : 'Lots')}
                    </h3>
                    <button type="button" onClick={addLot} className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '6px 14px', gap: 6 }}>
                      <Plus size={14} /> {locale === 'ar' ? 'إضافة قسم' : (locale === 'en' ? 'Add lot' : 'Ajouter un lot')}
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {lots.map((lot, idx) => {
                      const filteredProducts = products.filter(p => p.cultureTypeId === lot.cultureTypeId);
                      return (
                        <div key={idx} className="bordered-card" style={{ position: 'relative' }}>
                          {/* Lot header */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                            <div style={{
                              width: 32, height: 32, borderRadius: 8,
                              background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              <Hash size={16} color="white" />
                            </div>
                            <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)' }}>
                              {locale === 'ar' ? 'قسم رقم' : (locale === 'en' ? 'Lot N°' : 'Lot N°')} {lot.seq}
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
                                {locale === 'ar' ? 'التسمية' : (locale === 'en' ? 'Designation' : 'Désignation')} <span className="required-asterisk">*</span>
                              </label>
                              <input
                                type="text"
                                placeholder={locale === 'ar' ? 'مثال: بطاطس مميزة' : (locale === 'en' ? 'Ex: Premium potatoes' : 'Ex: Pommes de terre calibre supérieur')}
                                value={lot.designation}
                                onChange={e => updateLot(idx, 'designation', e.target.value)}
                              />
                            </div>

                            {/* Culture type */}
                            <div className="form-group" style={{ margin: 0 }}>
                              <label>
                                {locale === 'ar' ? 'نوع الزراعة' : (locale === 'en' ? 'Crop type' : 'Type de culture')} <span className="required-asterisk">*</span>
                              </label>
                              <select value={lot.cultureTypeId} onChange={e => updateLot(idx, 'cultureTypeId', e.target.value)}>
                                <option value="">{locale === 'ar' ? '-- اختر --' : (locale === 'en' ? '-- Select --' : '-- Choisir --')}</option>
                                {cultureTypes.map(ct => (
                                  <option key={ct.id} value={ct.id}>{ct.name[locale] || ct.name.fr}</option>
                                ))}
                              </select>
                            </div>

                            {/* Product */}
                            <div className="form-group" style={{ margin: 0 }}>
                              <label>
                                {locale === 'ar' ? 'المنتج المحدد' : (locale === 'en' ? 'Specific product' : 'Produit spécifique')} <span className="required-asterisk">*</span>
                              </label>
                              <select
                                value={lot.productId}
                                onChange={e => updateLot(idx, 'productId', e.target.value)}
                                disabled={!lot.cultureTypeId}
                              >
                                <option value="">{lot.cultureTypeId ? (locale === 'ar' ? '-- اختر المنتج --' : (locale === 'en' ? '-- Select product --' : '-- Choisir produit --')) : (locale === 'ar' ? 'اختر النوع أولاً' : (locale === 'en' ? 'Choose type first' : 'Choisir type d\'abord'))}</option>
                                {filteredProducts.map(p => (
                                  <option key={p.id} value={p.id}>{p.name[locale] || p.name.fr}</option>
                                ))}
                              </select>
                            </div>

                            {/* Wilaya d'origine */}
                            <div className="form-group" style={{ margin: 0 }}>
                              <label>
                                {locale === 'ar' ? 'ولاية المنشأ' : (locale === 'en' ? 'Origin wilaya' : 'Wilaya d\'origine')} <span className="required-asterisk">*</span>
                              </label>
                              <select value={lot.wilayaId} onChange={e => updateLot(idx, 'wilayaId', e.target.value)}>
                                <option value="">{locale === 'ar' ? '-- اختر الولاية --' : (locale === 'en' ? '-- Select wilaya --' : '-- Choisir wilaya --')}</option>
                                {WILAYA_LIST.map(w => (
                                  <option key={w.id} value={w.id}>{w.id < 10 ? `0${w.id}` : w.id} – {w.name}</option>
                                ))}
                              </select>
                            </div>

                            {/* Unit + Quantity */}
                            <div className="form-group" style={{ margin: 0 }}>
                              <label>
                                {locale === 'ar' ? 'الوحدة' : (locale === 'en' ? 'Unit' : 'Unité')} <span className="required-asterisk">*</span>
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
                                {locale === 'ar' ? 'الكمية المطلوبة' : (locale === 'en' ? 'Required quantity' : 'Quantité demandée')}
                                <span className="required-asterisk">*</span>
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
                                {locale === 'ar' ? 'السعر الأقصى (سقف)' : (locale === 'en' ? 'Maximum price (ceiling)' : 'Prix plafond (max)')} <span className="required-asterisk">*</span>
                              </label>
              <div className="input-suffix-wrap">
                                <input
                                  type="number" step="any" min="0" placeholder="Ex: 50000"
                                  value={lot.priceCeiling} onChange={e => updateLot(idx, 'priceCeiling', e.target.value)}
                                  className="input-with-suffix"
                                />
                                <span className="input-suffix-label">DA</span>
                              </div>
                            </div>

                            {/* Price reserve */}
                            <div className="form-group" style={{ margin: 0 }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <TrendingUp size={13} style={{ color: 'var(--primary)' }} />
                                {locale === 'ar' ? 'سعر الاحتياط (حد أدنى)' : (locale === 'en' ? 'Reserve price (min)' : 'Prix de réserve (min)')}
                              </label>
                              <div className="input-suffix-wrap">
                                <input
                                  type="number" step="any" min="0" placeholder="Ex: 30000"
                                  value={lot.priceReserve} onChange={e => updateLot(idx, 'priceReserve', e.target.value)}
                                  className="input-with-suffix"
                                />
                                <span className="input-suffix-label">DA</span>
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
                  <h3 className="wizard-section-title mb-8">
                    <MapPin size={20} style={{ color: 'var(--primary)' }} />
                    {locale === 'ar' ? 'المنطقة الجغرافية' : (locale === 'en' ? 'Geographic zone' : 'Zone géographique')}
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 20 }}>
                    {locale === 'ar'
                      ? 'حدد نطاق البحث لإيجاد المنتجين القريبين.'
                      : (locale === 'en' ? 'Define the search radius to find nearby producers.' : 'Définissez le rayon de recherche pour trouver les producteurs à proximité.')}
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
                    <div className="inline-alert-warning">
                      ⚠️ {locale === 'ar' ? 'أكمل ملفك الشخصي (الولاية) لعرض الخريطة.' : (locale === 'en' ? 'Complete your profile (wilaya) to display the map.' : 'Complétez votre profil (wilaya) pour afficher la carte.')}
                    </div>
                  )}
                </div>
              )}

              {/* ── STEP 4: Dates & Settings ─────────────────────────── */}
              {wizardStep === 4 && (
                <div>
                  <h3 className="wizard-section-title mb-20">
                    <CalendarClock size={20} style={{ color: 'var(--primary)' }} />
                    {locale === 'ar' ? 'التواريخ والإعدادات' : (locale === 'en' ? 'Dates & Settings' : 'Dates & Paramètres')}
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 20px' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label htmlFor="start-dt">
                          {locale === 'ar' ? 'تاريخ + وقت البداية' : (locale === 'en' ? 'Start date + time' : 'Date + heure de début')} <span className="required-asterisk">*</span>
                        </label>
                        <input
                          id="start-dt" type="datetime-local"
                          value={startDatetime} onChange={e => setStartDatetime(e.target.value)}
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label htmlFor="end-dt">
                          {locale === 'ar' ? 'تاريخ + وقت النهاية' : (locale === 'en' ? 'End date + time' : 'Date + heure de fin')} <span className="required-asterisk">*</span>
                        </label>
                        <input
                          id="end-dt" type="datetime-local"
                          value={endDatetime} onChange={e => setEndDatetime(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Auto prolongation */}
                    <div className="bordered-card" style={{ padding: '18px 22px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={autoProlongate}
                          onChange={() => setAutoProlongate(p => !p)}
                        />
                        <div className={`toggle-switch-track ${autoProlongate ? 'on' : ''}`}>
                          <div className={`toggle-switch-knob ${autoProlongate ? 'on' : ''}`} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 7 }}>
                            <Repeat2 size={16} style={{ color: 'var(--primary)' }} />
                            {locale === 'ar' ? 'تمديد تلقائي' : (locale === 'en' ? 'Auto prolongation' : 'Prolongation automatique')}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                            {locale === 'ar' ? 'تمديد المزاد تلقائيًا عند وجود عرض في اللحظة الأخيرة.' : (locale === 'en' ? 'Automatically extend the auction if a bid arrives at the last moment.' : 'Prolonge l\'enchère automatiquement si une offre arrive en fin de session.')}
                          </div>
                        </div>
                      </label>

                      {autoProlongate && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 20px', marginTop: 20 }}>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label htmlFor="prolong-minutes">
                              <Clock size={13} style={{ color: 'var(--primary)', marginRight: 5, verticalAlign: 'middle' }} />
                              {locale === 'ar' ? 'مدة التمديد (دقائق)' : (locale === 'en' ? 'Extension duration (min)' : 'Durée prolongation (min)')}
                            </label>
                            <input
                              id="prolong-minutes" type="number" min="1" max="120"
                              value={prolongationMinutes} onChange={e => setProlongationMinutes(e.target.value)}
                            />
                          </div>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label htmlFor="max-prolongs">
                              <Hash size={13} style={{ color: 'var(--primary)', marginRight: 5, verticalAlign: 'middle' }} />
                              {locale === 'ar' ? 'الحد الأقصى للتمديدات' : (locale === 'en' ? 'Max number of extensions' : 'Nombre max de prolongations')}
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
                  <h3 className="wizard-section-title mb-20">
                    <FileSearch size={20} style={{ color: 'var(--primary)' }} />
                    {locale === 'ar' ? 'ملخص المزاد' : (locale === 'en' ? 'Auction summary' : 'Récapitulatif de l\'enchère')}
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* General info summary */}
                    <div className="bordered-card-sm">
                      <div className="summary-box-title">
                        {locale === 'ar' ? 'المعلومات العامة' : (locale === 'en' ? 'General information' : 'Informations générales')}
                      </div>
                      <SummaryRow label={locale === 'ar' ? 'العنوان' : (locale === 'en' ? 'Title' : 'Titre')} value={title} />
                      <SummaryRow label={locale === 'ar' ? 'النوع' : (locale === 'en' ? 'Type' : 'Type')} value={getAuctionTypeLabel(auctionType)} />
                      <SummaryRow label={locale === 'ar' ? 'مكان التسليم' : (locale === 'en' ? 'Delivery location' : 'Lieu de livraison')} value={deliveryLocation} />
                      {generalDescription && <SummaryRow label={locale === 'ar' ? 'الوصف' : (locale === 'en' ? 'Description' : 'Description')} value={generalDescription} />}
                    </div>

                    {/* Lots summary */}
                    <div className="bordered-card-sm">
                      <div className="summary-box-title">
                        {locale === 'ar' ? 'الأقسام' : (locale === 'en' ? 'Lots' : 'Lots')} ({lots.length})
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
                    <div className="bordered-card-sm">
                      <div className="summary-box-title">
                        {locale === 'ar' ? 'المنطقة والتواريخ' : (locale === 'en' ? 'Zone & Dates' : 'Zone & Dates')}
                      </div>
                      <SummaryRow label={locale === 'ar' ? 'نطاق البحث' : (locale === 'en' ? 'Search radius' : 'Rayon de recherche')} value={`${radiusKm} km`} />
                      <SummaryRow label={locale === 'ar' ? 'منتجون في المنطقة' : (locale === 'en' ? 'Producers in zone' : 'Producteurs dans la zone')} value={`${producerCount}`} />
                      <SummaryRow label={locale === 'ar' ? 'بداية' : (locale === 'en' ? 'Start' : 'Début')} value={startDatetime ? new Date(startDatetime).toLocaleString('fr-DZ') : '—'} />
                      <SummaryRow label={locale === 'ar' ? 'نهاية' : (locale === 'en' ? 'End' : 'Fin')} value={endDatetime ? new Date(endDatetime).toLocaleString('fr-DZ') : '—'} />
                      {autoProlongate && (
                        <SummaryRow
                          label={locale === 'ar' ? 'تمديد تلقائي' : (locale === 'en' ? 'Auto prolongation' : 'Prolongation auto')}
                          value={`${prolongationMinutes} min × ${maxProlongations} fois`}
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Error message ── */}
              {stepError && (
                <div className="inline-alert-danger mt-20">
                  <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                  {stepError}
                </div>
              )}
            </div>

            {/* ── Wizard Nav Buttons ── */}
            <div className="wizard-nav-row">
              <button
                type="button" onClick={goPrev} disabled={wizardStep === 1}
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: wizardStep === 1 ? 0.4 : 1 }}
              >
                <ChevronLeft size={16} />
                {locale === 'ar' ? 'السابق' : (locale === 'en' ? 'Previous' : 'Précédent')}
              </button>

              {wizardStep < 5 ? (
                <button type="button" onClick={goNext} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {locale === 'ar' ? 'التالي' : (locale === 'en' ? 'Next' : 'Suivant')}
                  <ChevronRight size={16} />
                </button>
              ) : (
                <button type="button" onClick={handleSubmit} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Gavel size={16} />
                  {locale === 'ar' ? 'نشر المزاد' : (locale === 'en' ? 'Publish auction' : 'Publier l\'enchère')}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ══ DASHBOARD VIEW ══════════════════════════════════════════ */}
        {!wizardOpen && activeSection === 'dashboard' && (
          <div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: 8, color: 'var(--text-main)' }}>
              {locale === 'ar' ? `مرحباً، ${user.name} 👋` : (locale === 'en' ? `Welcome, ${user.name} 👋` : `Bienvenue, ${user.name} 👋`)}
            </h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 32, fontSize: '0.95rem' }}>
              {locale === 'ar' ? 'إليك ملخص نشاطك.' : (locale === 'en' ? 'Here is an overview of your activity.' : 'Voici un aperçu de votre activité.')}
            </p>

            {/* Stats */}
            <div className="stats-mini-grid">
              {[
                { icon: Gavel, label: locale === 'ar' ? 'إجمالي المزادات' : (locale === 'en' ? 'Total auctions' : 'Total enchères'), value: myAuctions.length, color: 'var(--primary)' },
                { icon: ListOrdered, label: locale === 'ar' ? 'مزادات مفتوحة' : (locale === 'en' ? 'Open auctions' : 'Enchères ouvertes'), value: myAuctions.filter(a => a.status === 'open').length, color: '#f59e0b' },
                { icon: Check, label: locale === 'ar' ? 'منجزة' : (locale === 'en' ? 'Completed' : 'Clôturées'), value: myAuctions.filter(a => a.status === 'closed').length, color: '#3b82f6' },
              ].map((stat, i) => {
                const Icon = stat.icon;
                return (
                  <div key={i} className="glass-panel stat-mini-card">
                    <div className="stat-mini-icon-box" style={{ background: `${stat.color}22` }}>
                      <Icon size={24} style={{ color: stat.color }} />
                    </div>
                    <div>
                      <div className="stat-mini-value" style={{ color: stat.color }}>{stat.value}</div>
                      <div className="stat-mini-label">{stat.label}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Profile Completion Widget */}
            <div className="glass-panel completion-widget" style={{ marginBottom: '28px' }}>
              <div className="completion-ring-wrap">
                {/* Circular Progress (SVG) */}
                <svg width="80" height="80" viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="40" cy="40" r="34" stroke="rgba(255,255,255,0.05)" strokeWidth="6" fill="transparent" />
                  <circle cx="40" cy="40" r="34" stroke="var(--primary)" strokeWidth="6" fill="transparent"
                    strokeDasharray={`${2 * Math.PI * 34}`}
                    strokeDashoffset={`${2 * Math.PI * 34 * (1 - computeProfileCompletion(user) / 100)}`}
                    style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                  />
                </svg>
                <div className="completion-ring-value">
                  {computeProfileCompletion(user)}%
                </div>
              </div>

              <div className="completion-widget-body">
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-main)' }}>
                  {locale === 'ar' ? 'مستوى اكتمال ملفك الشخصي' : (locale === 'en' ? 'Profile completion level' : 'Taux de complétion de votre profil')}
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: 0, lineHeight: 1.4 }}>
                  {computeProfileCompletion(user) < 70 ? (
                    locale === 'ar'
                      ? '⚠️ ملفك الشخصي غير مكتمل بعد. يجب أن يصل إلى 70% لتتمكن من إطلاق المزادات (تحتاج إلى ملء الحقول المطلوبة).'
                      : (locale === 'en'
                          ? '⚠️ Your profile is incomplete (< 70%). You must complete it to be able to create auctions.'
                          : '⚠️ Votre profil est incomplet (< 70%). Vous devez le compléter pour pouvoir créer des enchères.')
                  ) : (
                    locale === 'ar'
                      ? '✓ ملفك الشخصي مكتمل بما يكفي لإطلاق المزادات!'
                      : (locale === 'en'
                          ? '✓ Your profile is complete enough to launch auctions!'
                          : '✓ Votre profil est suffisant pour lancer des enchères !')
                  )}
                </p>
                {computeProfileCompletion(user) < 70 && (
                  <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '0.72rem', justifyContent: 'flex-start' }}>
                    {getMissingFieldsList(user, locale).map((field, idx) => (
                      <span key={idx} className="missing-field-chip">
                        {field}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {computeProfileCompletion(user) < 100 && (
                <button onClick={onNavigateToProfile} className="btn btn-secondary" style={{ fontSize: '0.85rem', padding: '8px 16px', whiteSpace: 'nowrap' }}>
                  {locale === 'ar' ? 'تعديل الملف الشخصي' : (locale === 'en' ? 'Complete my profile' : 'Compléter mon profil')}
                </button>
              )}
            </div>

            {/* CTA */}
            <div className="glass-panel" style={{ padding: '28px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 6, color: 'var(--text-main)' }}>
                  {locale === 'ar' ? 'أنشئ مزادًا جديدًا' : (locale === 'en' ? 'Create a new auction' : 'Lancez une nouvelle enchère')}
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  {locale === 'ar' ? 'حدد الكميات والمواصفات وانتظر عروض المنتجين.' : (locale === 'en' ? 'Define quantities and specifications, then wait for producer offers.' : 'Définissez vos besoins et recevez les offres des producteurs.')}
                </p>
              </div>
              <button onClick={openWizard} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
                <Plus size={18} />
                {locale === 'ar' ? 'إنشاء مزاد' : (locale === 'en' ? 'Create auction' : 'Créer enchère')}
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
                {locale === 'ar' ? 'مزاداتي' : (locale === 'en' ? 'My auctions' : 'Mes enchères')}
                <span className="badge badge-open" style={{ borderRadius: '20px', fontSize: '0.8rem' }}>
                  {myAuctions.length}
                </span>
              </h2>
              <button onClick={openWizard} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Plus size={16} /> {locale === 'ar' ? 'مزاد جديد' : (locale === 'en' ? 'New auction' : 'Nouvelle enchère')}
              </button>
            </div>

            {myAuctions.length === 0 ? (
              <div className="glass-panel empty-state">
                <div className="empty-state-icon"><Package size={28} /></div>
                <h3>{t('noDemandPosted')}</h3>
                <p>{t('noDemandPostedSub')}</p>
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
    <div className="summary-row">
      <span className="summary-row-label">{label}</span>
      <span className="summary-row-value">{value}</span>
    </div>
  );
}

// ─── Auctions Table ─────────────────────────────────────────────────────────
function AuctionsTable({ auctions, locale, t, newBidFlashIds, onAcceptBid, onRateProducer, onZoomImage, getAuctionTypeLabel, highlightAuctionId }) {
  const [expandedId, setExpandedId] = useState(null);

  const statusColors = {
    open:    { cls: 'status-pill-open', label: (locale) => locale === 'ar' ? 'مفتوح' : (locale === 'en' ? 'Open' : 'Ouvert') },
    closed:  { cls: 'status-pill-closed', label: (locale) => locale === 'ar' ? 'مغلق' : (locale === 'en' ? 'Closed' : 'Clôturé') },
    pending: { cls: 'status-pill-pending', label: (locale) => locale === 'ar' ? 'معلق' : (locale === 'en' ? 'Pending' : 'En attente') },
  };

  useEffect(() => {
    if (highlightAuctionId) {
      // React to an external navigation event (notification click), not
      // deriving state from a prop.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setExpandedId(highlightAuctionId);
    }
  }, [highlightAuctionId]);

  return (
    <div className="data-table">
      {/* Table Header */}
      <div className="data-table-header-row auctions-table-grid">
        <span>{locale === 'ar' ? 'العنوان' : 'Titre'}</span>
        <span>{locale === 'ar' ? 'النوع' : 'Type'}</span>
        <span>{locale === 'ar' ? 'التاريخ' : 'Date'}</span>
        <span style={{ textAlign: 'center' }}>{locale === 'ar' ? 'عروض' : 'Offres'}</span>
        <span style={{ textAlign: 'center' }}>{locale === 'ar' ? 'الحالة' : 'Statut'}</span>
        <span></span>
      </div>

      {auctions.map((auction) => {
        const isExpanded = expandedId === auction.id;
        const isNew = newBidFlashIds.some(id => auction.bids.some(b => b.id === id));
        const status = statusColors[auction.status] || statusColors.closed;
        const dateStr = new Date(auction.createdAt).toLocaleDateString('fr-DZ', { day: '2-digit', month: '2-digit', year: '2-digit' });

        return (
          <div
            key={auction.id}
            className="data-table-row-wrap"
            ref={el => {
              if (highlightAuctionId === auction.id && el) {
                setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
              }
            }}
          >
            {/* Row */}
            <div
              onClick={() => setExpandedId(isExpanded ? null : auction.id)}
              className={`data-table-row auctions-table-grid ${isNew ? 'is-new' : ''} ${isExpanded ? 'is-expanded' : ''}`}
            >
              {/* Title */}
              <div className="data-table-cell-title">
                <span className="data-table-cell-title-text">
                  {isNew && <span className="new-dot" />}
                  {auction.title || auction.product}
                </span>
                {auction.deliveryLocation && (
                  <span className="data-table-cell-sub">
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
              <div className="data-table-cell-center">
                <span className={`count-pill ${auction.bids.length > 0 ? 'has-count' : ''}`}>
                  {auction.bids.length}
                </span>
              </div>

              {/* Status */}
              <div className="data-table-cell-center">
                <span className={`status-pill ${status.cls}`}>
                  {status.label(locale)}
                </span>
              </div>

              {/* Expand chevron */}
              <div className="expand-chevron-cell">
                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </div>

            {/* Expanded detail panel */}
            {isExpanded && (
              <div className="data-table-expanded-panel">
                {/* Description */}
                {auction.description && (
                  <p className="data-table-description">
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
                              className={`mini-bid-card ${isAccepted ? 'accepted' : ''} ${isBidNew ? 'bid-flash-new' : ''}`}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-main)' }}>{bid.producerAlias}</span>
                                  <StarDisplay rating={bid.producerRating} count={bid.producerRatingCount} />
                                </div>
                                {isAccepted && (
                                  <span className="mini-bid-selected-tag">
                                    {t('bidSelected')}
                                  </span>
                                )}
                              </div>

                              {/* Bid lines */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                                {(bid.lines || []).map(line => (
                                  <div key={line.id} className="mini-bid-line">
                                    <div style={{ flex: 1 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                        {line.optionName && <strong className="mini-bid-option-tag">{line.optionName}</strong>}
                                        {line.quantity && <span style={{ fontSize: '0.8rem', color: 'var(--text-body)' }}>{line.quantity} {t('unit_' + (line.unit || auction.unit))}</span>}
                                        <span className="mini-bid-price">
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
                                          <Star size={11} /> {locale === 'ar' ? 'تقييم' : (locale === 'en' ? 'Rate' : 'Noter')}
                                        </button>
                                      )}
                                      {auction.alreadyRated && (
                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 2 }}>
                                          <Star size={10} style={{ color: '#f59e0b' }} /> {locale === 'ar' ? 'تم التقييم ✓' : (locale === 'en' ? 'Rated ✓' : 'Noté ✓')}
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
