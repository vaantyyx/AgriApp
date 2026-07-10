import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Tag, MessageSquare, Check, Package, X, Star, MapPin,
  ChevronDown, ChevronUp, Image as ImageIcon,
  ClipboardList, Layers, CalendarClock, FileSearch,
  ChevronRight, ChevronLeft, AlertTriangle,
  Gavel, Clock, Repeat2, TrendingDown, TrendingUp, Hash,
  MoreVertical, Eye, Pencil, Trash2,
} from 'lucide-react';
import { WILAYA_COORDS, getCommuneCoords, getCoordsForWilayaName } from '../utils/wilayaCoordinates.js';
import { cultureTypes, products } from '../utils/referenceData.js';
import { BACKEND_URL } from '../utils/config.js';
import { useTranslation } from '../context/LanguageContext';
import { computeBuyerCompletion } from './BuyerProfilePage';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow });

const AUCTION_TYPES = [
  { value: 'open', labelFr: 'Enchère ouverte', labelAr: 'مزاد مفتوح', labelEn: 'Open auction' },
  { value: 'smart', labelFr: 'Enchère intelligente', labelAr: 'مزاد ذكي', labelEn: 'Smart auction' },
];

const WILAYA_LIST = Object.entries(WILAYA_COORDS).map(([id, w]) => ({ id: parseInt(id), name: w.name })).sort((a, b) => a.id - b.id);

function newLot(seq) {
  return { seq, designation: '', cultureTypeId: '', productId: '', wilayaId: '', unit: 'tonnes', quantity: '', priceCeiling: '', priceReserve: '' };
}

/** Formats an ISO date string for a <input type="datetime-local"> value. */
function toDatetimeLocalValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const STEPS = [
  { id: 1, icon: ClipboardList, labelFr: 'Informations générales', labelAr: 'معلومات عامة', labelEn: 'General information' },
  { id: 2, icon: Layers, labelFr: 'Lots', labelAr: 'الأقسام', labelEn: 'Lots' },
  { id: 3, icon: MapPin, labelFr: 'Zone géographique', labelAr: 'المنطقة الجغرافية', labelEn: 'Geographic zone' },
  { id: 4, icon: CalendarClock, labelFr: 'Dates & Paramètres', labelAr: 'التواريخ والإعدادات', labelEn: 'Dates & Parameters' },
  { id: 5, icon: FileSearch, labelFr: 'Récapitulatif', labelAr: 'ملخص', labelEn: 'Summary' },
];

function StepIndicator({ currentStep, locale }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, background: 'rgba(255,255,255,0.03)', borderRadius: 14, padding: '12px 16px', border: '1px solid var(--border)', marginBottom: 28, overflowX: 'auto' }}>
      {STEPS.map((step, idx) => {
        const Icon = step.icon;
        const isActive = currentStep === step.id;
        const isDone = currentStep > step.id;
        return (
          <React.Fragment key={step.id}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 80 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isDone || isActive ? 'var(--primary)' : 'var(--bg-input)', border: `2px solid ${isDone || isActive ? 'var(--primary)' : 'var(--border)'}`, transition: 'all 0.3s ease', boxShadow: isActive ? '0 0 12px rgba(16,185,129,0.4)' : 'none' }}>
                {isDone ? <Check size={18} color="white" /> : <Icon size={18} color={isActive ? 'white' : 'var(--text-muted)'} />}
              </div>
              <span style={{ fontSize: '0.7rem', fontWeight: isActive ? 700 : 500, color: isActive ? 'var(--primary)' : isDone ? 'var(--text-body)' : 'var(--text-muted)', textAlign: 'center', whiteSpace: 'nowrap' }}>
                {locale === 'ar' ? step.labelAr : (locale === 'en' ? step.labelEn : step.labelFr)}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div style={{ flex: 1, height: 2, margin: '0 4px', marginBottom: 24, background: currentStep > step.id ? 'var(--primary)' : 'var(--border)', transition: 'background 0.3s ease', minWidth: 16 }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 6, fontSize: '0.875rem' }}>
      <span style={{ color: 'var(--text-muted)', minWidth: 140, flexShrink: 0 }}>{label}</span>
      <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function StarDisplay({ rating, count }) {
  const { t } = useTranslation();
  if (rating === null || rating === undefined) return <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('noReviews')}</span>;
  const full = Math.floor(rating);
  const half = rating - full >= 0.25 && rating - full < 0.75;
  const stars = Array.from({ length: 5 }, (_, i) => i < full ? 'full' : (i === full && half ? 'half' : 'empty'));
  return (
    <span className="star-display">
      {stars.map((s, i) => <span key={i} className={`star star-${s}`}>★</span>)}
      <span className="star-label">{rating.toFixed(1)}<span style={{ opacity: 0.6 }}>/5</span> ({count})</span>
    </span>
  );
}

function StarPicker({ value, onChange }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="star-picker">
      {[1,2,3,4,5].map(n => (
        <button key={n} type="button" className={`star-pick-btn ${(hover || value) >= n ? 'active' : ''}`}
          onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)} onClick={() => onChange(n)}>★</button>
      ))}
    </div>
  );
}

function RatingModal({ auctionId, onSubmit, onClose }) {
  const [rating, setRating] = useState(0);
  const { t, locale } = useTranslation();
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
    const map = L.map(mapRef.current, { center: [lat, lng], zoom: 8 });
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18 }).addTo(map);
    L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18, opacity: 0.7 }).addTo(map);
    const buyerIcon = L.divIcon({ className: '', html: '<div class="map-buyer-marker"><div class="map-buyer-pulse"></div></div>', iconSize: [20, 20], iconAnchor: [10, 10] });
    markerRef.current = L.marker([lat, lng], { icon: buyerIcon }).addTo(map);
    circleRef.current = L.circle([lat, lng], { radius: radiusKm * 1000, color: '#10b981', fillColor: '#10b981', fillOpacity: 0.12, weight: 2.5 }).addTo(map);
    leafletMapRef.current = map;
    const t = setTimeout(() => { try { map.invalidateSize(); if (circleRef.current) map.fitBounds(circleRef.current.getBounds(), { padding: [30, 30], animate: false }); } catch (_) {} }, 400);
    return () => { clearTimeout(t); map.remove(); leafletMapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!circleRef.current || !leafletMapRef.current) return;
    circleRef.current.setRadius(radiusKm * 1000);
    leafletMapRef.current.fitBounds(circleRef.current.getBounds(), { padding: [30, 30] });
  }, [radiusKm]);

  return (
    <div className="auction-map-wrapper">
      <div ref={mapRef} className="auction-map-container" />
      <div className="map-controls">
        <div className="map-radius-row">
          <MapPin size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{locale === 'ar' ? 'نطاق البحث :' : 'Rayon de recherche :'}</span>
          <strong style={{ color: 'var(--primary)', fontSize: '0.9rem' }}>{radiusKm} km</strong>
        </div>
        <input type="range" min="10" max="2000" step="10" value={radiusKm} onChange={e => onRadiusChange(Number(e.target.value))} className="radius-slider" />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          <span>10 km</span><span>2 000 km</span>
        </div>
        <div className="map-producer-count">
          <span style={{ fontSize: '1.1rem' }}>🌱</span>
          <span><strong style={{ color: 'var(--primary)' }}>{producerCount}</strong>{' '}{locale === 'ar' ? 'منتج في هذه المنطقة' : `producteur${producerCount !== 1 ? 's' : ''} dans cette zone`}</span>
        </div>
      </div>
    </div>
  );
}

function AuctionActionsMenu({ auction, onViewDetails, onEdit, onDelete }) {
  const { t, locale } = useTranslation();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const canManage = auction.status === 'pending';

  useEffect(() => {
    if (!open) return;
    function handler(e) { if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={menuRef} style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        title={t('actionsBtn')}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 6, display: 'flex' }}
      >
        <MoreVertical size={16} />
      </button>
      {open && (
        <div
          className="animate-fade-in"
          style={{
            position: 'absolute', [locale === 'ar' ? 'left' : 'right']: 0, top: '110%', zIndex: 20,
            minWidth: 180, background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)', overflow: 'hidden', textAlign: locale === 'ar' ? 'right' : 'left',
          }}
        >
          <button type="button" onClick={() => { setOpen(false); onViewDetails(); }}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-main)' }}>
            <Eye size={14} /> {t('viewDetailsBtn')}
          </button>
          {canManage && (
            <button type="button" onClick={() => { setOpen(false); onEdit(); }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'none', border: 'none', borderTop: '1px solid var(--border)', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-main)' }}>
              <Pencil size={14} /> {t('editAuctionBtn')}
            </button>
          )}
          {canManage && (
            <button type="button" onClick={() => { setOpen(false); onDelete(); }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'none', border: 'none', borderTop: '1px solid var(--border)', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--danger)' }}>
              <Trash2 size={14} /> {t('deleteAuctionBtn')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function DeleteAuctionModal({ onConfirm, onClose }) {
  const { t } = useTranslation();
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card animate-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <button className="modal-close-btn" onClick={onClose}><X size={18} /></button>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🗑️</div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: 6, color: 'var(--text-main)' }}>{t('deleteAuctionConfirmTitle')}</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t('deleteAuctionConfirmBody')}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>{t('cancelBtn')}</button>
          <button className="btn btn-danger" style={{ flex: 1 }} onClick={onConfirm}>
            <Trash2 size={14} /> {t('deleteAuctionBtn')}
          </button>
        </div>
      </div>
    </div>
  );
}

function getMissingFieldsList(user, locale) {
  const missing = [];
  if (!user) return [];
  if (!user.wilaya?.trim()) missing.push(locale === 'ar' ? 'الولاية' : 'Wilaya');
  if (!user.commune?.trim()) missing.push(locale === 'ar' ? 'البلدية' : 'Commune');
  if (!user.phone?.trim()) missing.push(locale === 'ar' ? 'الهاتف' : 'Téléphone');
  return missing;
}

export default function BuyerAuctionsPage({ user, auctions, onCreateAuction, onUpdateAuction, onDeleteAuction, onAcceptBid, onRateProducer, newBidFlashIds, highlightAuctionId }) {
  const { t, locale, dir } = useTranslation();
  const navigate = useNavigate();

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [editingAuctionId, setEditingAuctionId] = useState(null);
  const [viewingAuctionId, setViewingAuctionId] = useState(null);
  const [showBlockWarningModal, setShowBlockWarningModal] = useState(false);
  const [ratingAuctionId, setRatingAuctionId] = useState(null);
  const [activeZoomImage, setActiveZoomImage] = useState(null);
  const [deleteConfirmAuctionId, setDeleteConfirmAuctionId] = useState(null);

  // Wizard form state
  const [title, setTitle] = useState('');
  const [auctionType, setAuctionType] = useState('open');
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [generalDescription, setGeneralDescription] = useState('');
  const [lots, setLots] = useState([newLot(1)]);
  const [radiusKm, setRadiusKm] = useState(100);
  const [isSearchZoneChanged, setIsSearchZoneChanged] = useState(false);
  const [startDatetime, setStartDatetime] = useState('');
  const [endDatetime, setEndDatetime] = useState('');
  const [autoProlongate, setAutoProlongate] = useState(false);
  const [prolongationMinutes, setProlongationMinutes] = useState(10);
  const [maxProlongations, setMaxProlongations] = useState(3);
  const [stepError, setStepError] = useState('');

  const [producerCount, setProducerCount] = useState(0);
  const userCoords = React.useMemo(() => {
    if (user.commune && user.wilaya) return getCommuneCoords(user.wilaya, user.commune);
    if (user.wilaya) return getCoordsForWilayaName(user.wilaya);
    return { lat: 36.73, lng: 3.09 };
  }, [user.wilaya, user.commune]);

  const productIdsJoined = React.useMemo(() => {
    return lots.map(l => l.productId).filter(Boolean).join(',');
  }, [lots]);

  useEffect(() => {
    if (!userCoords?.lat || !userCoords?.lng) return;
    let active = true;
    let url = `${BACKEND_URL}/api/producers/count?lat=${userCoords.lat}&lng=${userCoords.lng}&radius=${radiusKm}`;
    if (auctionType === 'smart') {
      url += `&auctionType=smart&productIds=${productIdsJoined}`;
    }
    fetch(url)
      .then(r => r.ok ? r.json() : { count: 0 })
      .then(d => { if (active) setProducerCount(d.count); })
      .catch(() => { if (active) setProducerCount(0); });
    return () => { active = false; };
  }, [userCoords, radiusKm, auctionType, productIdsJoined]);

  useEffect(() => {
    if (highlightAuctionId) {
      const found = auctions.find(a => a.id === highlightAuctionId);
      if (found) {
        openViewWizard(found);
        setWizardStep(5);
      }
    }
  }, [highlightAuctionId, auctions]);

  const updateLot = (idx, field, value) => {
    setLots(prev => prev.map((l, i) => {
      if (i !== idx) return l;
      const u = { ...l, [field]: value };
      if (field === 'cultureTypeId') u.productId = '';
      return u;
    }));
  };
  const addLot = () => setLots(prev => [...prev, newLot(prev.length + 1)]);
  const removeLot = (idx) => setLots(prev => { const n = prev.filter((_, i) => i !== idx).map((l, i) => ({ ...l, seq: i + 1 })); return n.length === 0 ? [newLot(1)] : n; });

  const validateStep = (step) => {
    setStepError('');
    if (step === 1) {
      if (!title.trim()) { setStepError("Le titre de l'enchère est obligatoire."); return false; }
      if (!deliveryLocation.trim()) { setStepError('Le lieu de livraison est obligatoire.'); return false; }
    }
    if (step === 2) {
      for (let i = 0; i < lots.length; i++) {
        const l = lots[i];
        if (!l.designation.trim()) { setStepError(`Lot ${l.seq} : désignation obligatoire.`); return false; }
        if (!l.cultureTypeId) { setStepError(`Lot ${l.seq} : sélectionnez un type de culture.`); return false; }
        if (!l.productId) { setStepError(`Lot ${l.seq} : sélectionnez un produit.`); return false; }
        if (!l.wilayaId) { setStepError(`Lot ${l.seq} : sélectionnez la wilaya d'origine.`); return false; }
        if (!l.quantity || parseFloat(l.quantity) <= 0) { setStepError(`Lot ${l.seq} : quantité invalide.`); return false; }
        if (!l.priceCeiling || parseFloat(l.priceCeiling) <= 0) { setStepError(`Lot ${l.seq} : prix plafond invalide.`); return false; }
      }
    }
    if (step === 4) {
      if (!startDatetime) { setStepError('La date de début est obligatoire.'); return false; }
      if (!endDatetime) { setStepError('La date de fin est obligatoire.'); return false; }
      if (new Date(endDatetime) <= new Date(startDatetime)) { setStepError('La date de fin doit être après le début.'); return false; }
    }
    return true;
  };

  const goNext = () => { if (!validateStep(wizardStep)) return; setWizardStep(s => Math.min(s + 1, 5)); };
  const goPrev = () => { setStepError(''); setWizardStep(s => Math.max(s - 1, 1)); };

  const resetWizard = () => {
    setTitle(''); setAuctionType('open'); setDeliveryLocation(''); setGeneralDescription('');
    setLots([newLot(1)]); setRadiusKm(100); setIsSearchZoneChanged(false);
    setStartDatetime(''); setEndDatetime(''); setAutoProlongate(false);
    setProlongationMinutes(10); setMaxProlongations(3); setStepError('');
  };

  const openWizard = () => {
    if (computeBuyerCompletion(user) < 70) { setShowBlockWarningModal(true); return; }
    setEditingAuctionId(null);
    setWizardStep(1); setWizardOpen(true); setStepError('');
  };

  const openEditWizard = (auction) => {
    setEditingAuctionId(auction.id);
    setTitle(auction.title || auction.product || '');
    setAuctionType(auction.auctionType || 'open');
    setDeliveryLocation(auction.deliveryLocation || '');
    setGeneralDescription(auction.description || '');
    setLots(auction.lots && auction.lots.length > 0 ? auction.lots.map(l => ({ ...l })) : [newLot(1)]);
    setRadiusKm(auction.radiusKm || 100);
    setIsSearchZoneChanged(auction.isSearchZoneChanged || false);
    setStartDatetime(toDatetimeLocalValue(auction.startAt));
    setEndDatetime(toDatetimeLocalValue(auction.endAt));
    setAutoProlongate(auction.autoProlongate || false);
    setProlongationMinutes(auction.prolongationMinutes || 10);
    setMaxProlongations(auction.maxProlongations || 3);
    setStepError('');
    setWizardStep(1);
    setWizardOpen(true);
  };

  const closeWizard = () => { setWizardOpen(false); setWizardStep(1); setEditingAuctionId(null); setViewingAuctionId(null); resetWizard(); };

  const openViewWizard = (auction) => {
    setViewingAuctionId(auction.id);
    setEditingAuctionId(null);
    setTitle(auction.title || auction.product || '');
    setAuctionType(auction.auctionType || 'open');
    setDeliveryLocation(auction.deliveryLocation || '');
    setGeneralDescription(auction.description || '');
    setLots(auction.lots && auction.lots.length > 0 ? auction.lots.map(l => ({ ...l })) : [newLot(1)]);
    setRadiusKm(auction.radiusKm || 100);
    setIsSearchZoneChanged(auction.isSearchZoneChanged || false);
    setStartDatetime(toDatetimeLocalValue(auction.startAt));
    setEndDatetime(toDatetimeLocalValue(auction.endAt));
    setAutoProlongate(auction.autoProlongate || false);
    setProlongationMinutes(auction.prolongationMinutes || 10);
    setMaxProlongations(auction.maxProlongations || 3);
    setStepError('');
    setWizardStep(1);
    setWizardOpen(true);
  };

  const handleSubmit = () => {
    if (!validateStep(4)) return;
    const payload = {
      title: title.trim(), auctionType, deliveryLocation: deliveryLocation.trim(),
      description: generalDescription.trim(),
      lots: lots.map(l => ({ seq: l.seq, designation: l.designation.trim(), cultureTypeId: l.cultureTypeId, productId: l.productId, wilayaId: l.wilayaId, unit: l.unit, quantity: parseFloat(l.quantity), priceCeiling: parseFloat(l.priceCeiling), priceReserve: parseFloat(l.priceReserve) })),
      radius: radiusKm, isSearchZoneChanged,
      startAt: new Date(startDatetime).toISOString(), endAt: new Date(endDatetime).toISOString(),
      autoProlongate, prolongationMinutes: autoProlongate ? parseInt(prolongationMinutes) : null,
      maxProlongations: autoProlongate ? parseInt(maxProlongations) : null,
      product: lots[0]?.designation || title, quantity: lots[0]?.quantity || 1, unit: lots[0]?.unit || 'tonnes',
    };
    if (editingAuctionId) {
      onUpdateAuction(editingAuctionId, payload);
    } else {
      onCreateAuction(payload);
    }
    closeWizard();
  };

  const getAuctionTypeLabel = (val) => { const f = AUCTION_TYPES.find(a => a.value === val); return f ? (locale === 'ar' ? f.labelAr : (locale === 'en' ? f.labelEn : f.labelFr)) : val; };
  const getProductName = (pid) => { const p = products.find(p => p.id === pid); return p ? (p.name[locale] || p.name.fr) : pid; };
  const getCultureName = (cid) => { const c = cultureTypes.find(c => c.id === cid); return c ? (c.name[locale] || c.name.fr) : cid; };
  const getWilayaName = (wid) => { const w = WILAYA_COORDS[parseInt(wid)]; return w ? w.name : wid; };

  const myAuctions = auctions.filter(a => a.isOwner);

  // Status colors
  const statusColors = {
    open: { bg: 'rgba(16,185,129,0.12)', color: '#10b981', label: (l) => l === 'ar' ? 'مفتوح' : (l === 'en' ? 'Open' : 'Ouvert') },
    closed: { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6', label: (l) => l === 'ar' ? 'مغلق' : (l === 'en' ? 'Closed' : 'Clôturé') },
    pending: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', label: (l) => l === 'ar' ? 'معلق' : (l === 'en' ? 'Pending' : 'En attente') },
  };

  const [expandedId, setExpandedId] = useState(highlightAuctionId || null);
  useEffect(() => { if (highlightAuctionId) setExpandedId(highlightAuctionId); }, [highlightAuctionId]);

  return (
    <div className="dash-page-scroll" style={{ flex: 1, padding: '32px 40px', overflowY: 'auto', textAlign: 'start' }}>

      {/* Rating Modal */}
      {ratingAuctionId && (
        <RatingModal auctionId={ratingAuctionId}
          onSubmit={(aId, r) => { onRateProducer(aId, r); setRatingAuctionId(null); }}
          onClose={() => setRatingAuctionId(null)} />
      )}

      {/* Delete Auction Confirmation */}
      {deleteConfirmAuctionId && (
        <DeleteAuctionModal
          onConfirm={() => { onDeleteAuction(deleteConfirmAuctionId); setDeleteConfirmAuctionId(null); }}
          onClose={() => setDeleteConfirmAuctionId(null)}
        />
      )}

      {/* Lightbox */}
      {activeZoomImage && (
        <div className="lightbox-modal" onClick={() => setActiveZoomImage(null)}>
          <div className="lightbox-content" onClick={e => e.stopPropagation()}>
            <button className="lightbox-close" onClick={() => setActiveZoomImage(null)}><X size={20} /></button>
            <img src={activeZoomImage} alt="zoom" />
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
                {locale === 'ar' ? 'حساب غير مكتمل' : 'Profil incomplet'}
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.5 }}>
                {locale === 'ar'
                  ? `نسبة اكتمال ملفك الشخصي الحالية هي ${computeBuyerCompletion(user)}%. يجب أن تصل إلى 70%.`
                  : `Votre taux de complétion est de ${computeBuyerCompletion(user)}%. Un minimum de 70% est requis.`}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowBlockWarningModal(false)}>
                {locale === 'ar' ? 'إغلاق' : 'Fermer'}
              </button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => { setShowBlockWarningModal(false); navigate('/profile'); }}>
                {locale === 'ar' ? 'إكمال الملف' : 'Compléter le profil'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 12 }}>
          {locale === 'ar' ? 'مزاداتي' : (locale === 'en' ? 'My auctions' : 'Mes enchères')}
          <span className="badge badge-open" style={{ borderRadius: '20px', fontSize: '0.8rem' }}>{myAuctions.length}</span>
        </h2>
        <button onClick={openWizard} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Plus size={16} /> {locale === 'ar' ? 'مزاد جديد' : (locale === 'en' ? 'New auction' : 'Nouvelle enchère')}
        </button>
      </div>

      {/* WIZARD */}
      {wizardOpen && (
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Gavel size={24} style={{ color: 'var(--primary)' }} />
              {viewingAuctionId
                ? (locale === 'ar' ? 'تفاصيل المزاد' : (locale === 'en' ? 'Auction details' : "Détails de l'enchère"))
                : editingAuctionId ? t('editAuctionTitle') : (locale === 'ar' ? 'إنشاء مزاد جديد' : (locale === 'en' ? 'Create new auction' : 'Créer une enchère'))}
            </h2>
            <button onClick={closeWizard} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <X size={22} />
            </button>
          </div>

          <StepIndicator currentStep={wizardStep} locale={locale} />

          <div className="glass-panel animate-fade-in" style={{ padding: '28px 32px' }}>

            {/* STEP 1 */}
            {wizardStep === 1 && (
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 20, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ClipboardList size={20} style={{ color: 'var(--primary)' }} />
                  {locale === 'ar' ? 'المعلومات العامة' : (locale === 'en' ? 'General information' : 'Informations générales')}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label htmlFor="auction-title">{locale === 'ar' ? 'عنوان المزاد' : (locale === 'en' ? "Auction title" : "Titre de l'enchère")} {!viewingAuctionId && <span style={{ color: 'var(--danger)' }}>*</span>}</label>
                    <input id="auction-title" type="text" placeholder={locale === 'ar' ? 'مثال: طلب بطاطس' : (locale === 'en' ? 'Ex: Potato request' : 'Ex: Demande de pommes de terre')} value={title} onChange={e => setTitle(e.target.value)} disabled={!!viewingAuctionId} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label htmlFor="auction-type">{locale === 'ar' ? 'نوع المزاد' : (locale === 'en' ? "Auction type" : "Type d'enchère")} {!viewingAuctionId && <span style={{ color: 'var(--danger)' }}>*</span>}</label>
                    <select id="auction-type" value={auctionType} onChange={e => setAuctionType(e.target.value)} disabled={!!viewingAuctionId}>
                      {AUCTION_TYPES.map(at => <option key={at.value} value={at.value}>{locale === 'ar' ? at.labelAr : (locale === 'en' ? at.labelEn : at.labelFr)}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label htmlFor="delivery-location">{locale === 'ar' ? 'مكان التسليم' : (locale === 'en' ? 'Delivery location' : 'Lieu de livraison')} {!viewingAuctionId && <span style={{ color: 'var(--danger)' }}>*</span>}</label>
                    <input id="delivery-location" type="text" placeholder={locale === 'ar' ? 'مثال: ورقلة' : (locale === 'en' ? 'Ex: Algiers, industrial zone' : 'Ex: Alger, Zone industrielle')} value={deliveryLocation} onChange={e => setDeliveryLocation(e.target.value)} disabled={!!viewingAuctionId} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>{locale === 'ar' ? 'وصف تفصيلي' : (locale === 'en' ? 'Detailed description' : 'Description détaillée')}</label>
                    <textarea rows={4} placeholder={locale === 'ar' ? 'وصف تفصيلي...' : (locale === 'en' ? 'Describe your need in detail...' : 'Décrivez votre besoin...')} value={generalDescription} onChange={e => setGeneralDescription(e.target.value)} disabled={!!viewingAuctionId} />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2 */}
            {wizardStep === 2 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Layers size={20} style={{ color: 'var(--primary)' }} />
                    {locale === 'ar' ? 'الأقسام (Lots)' : (locale === 'en' ? 'Lots' : 'Lots')}
                  </h3>
                  {!viewingAuctionId && <button type="button" onClick={addLot} className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '6px 14px', gap: 6 }}>
                    <Plus size={14} /> {locale === 'ar' ? 'إضافة قسم' : (locale === 'en' ? 'Add lot' : 'Ajouter un lot')}
                  </button>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  {lots.map((lot, idx) => {
                    const filteredProducts = products.filter(p => p.cultureTypeId === lot.cultureTypeId);
                    return (
                      <div key={idx} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px', background: 'rgba(255,255,255,0.02)', position: 'relative' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Hash size={16} color="white" />
                          </div>
                          <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)' }}>{locale === 'ar' ? 'قسم رقم' : (locale === 'en' ? 'Lot N°' : 'Lot N°')} {lot.seq}</span>
                          {lots.length > 1 && (
                            <button type="button" onClick={() => removeLot(idx)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>
                              <X size={16} />
                            </button>
                          )}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 20px' }}>
                          <div className="form-group" style={{ margin: 0, gridColumn: '1 / -1' }}>
                            <label>{locale === 'ar' ? 'التسمية' : (locale === 'en' ? 'Designation' : 'Désignation')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                            <input type="text" placeholder={locale === 'ar' ? 'مثال: بطاطس مميزة' : (locale === 'en' ? 'Ex: Premium potatoes' : 'Ex: Pommes de terre calibre supérieur')} value={lot.designation} onChange={e => updateLot(idx, 'designation', e.target.value)} />
                          </div>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label>{locale === 'ar' ? 'نوع الزراعة' : (locale === 'en' ? 'Crop type' : 'Type de culture')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                            <select value={lot.cultureTypeId} onChange={e => updateLot(idx, 'cultureTypeId', e.target.value)}>
                              <option value="">{locale === 'ar' ? '-- اختر --' : (locale === 'en' ? '-- Select --' : '-- Choisir --')}</option>
                              {cultureTypes.map(ct => <option key={ct.id} value={ct.id}>{ct.name[locale] || ct.name.fr}</option>)}
                            </select>
                          </div>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label>{locale === 'ar' ? 'المنتج المحدد' : (locale === 'en' ? 'Specific product' : 'Produit')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                            <select value={lot.productId} onChange={e => updateLot(idx, 'productId', e.target.value)} disabled={!lot.cultureTypeId}>
                              <option value="">{lot.cultureTypeId ? (locale === 'ar' ? '-- اختر المنتج --' : (locale === 'en' ? '-- Select product --' : '-- Choisir produit --')) : (locale === 'ar' ? 'اختر النوع أولاً' : (locale === 'en' ? 'Choose type first' : "Choisir type d'abord"))}</option>
                              {filteredProducts.map(p => <option key={p.id} value={p.id}>{p.name[locale] || p.name.fr}</option>)}
                            </select>
                          </div>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label>{locale === 'ar' ? 'ولاية المنشأ' : (locale === 'en' ? 'Origin wilaya' : "Wilaya d'origine")} <span style={{ color: 'var(--danger)' }}>*</span></label>
                            <select value={lot.wilayaId} onChange={e => updateLot(idx, 'wilayaId', e.target.value)}>
                              <option value="">{locale === 'ar' ? '-- اختر الولاية --' : (locale === 'en' ? '-- Select wilaya --' : '-- Choisir wilaya --')}</option>
                              {WILAYA_LIST.map(w => <option key={w.id} value={w.id}>{w.id < 10 ? `0${w.id}` : w.id} – {w.name}</option>)}
                            </select>
                          </div>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label>{locale === 'ar' ? 'الوحدة' : (locale === 'en' ? 'Unit' : 'Unité')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                            <select value={lot.unit} onChange={e => updateLot(idx, 'unit', e.target.value)}>
                              {['tonnes', 'kg', 'cagettes', 'palettes', 'sacs'].map(u => <option key={u} value={u}>{t('unit_' + u)}</option>)}
                            </select>
                          </div>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label>{locale === 'ar' ? 'الكمية المطلوبة' : (locale === 'en' ? 'Required quantity' : 'Quantité')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                            <input type="number" step="any" min="0" placeholder="0" value={lot.quantity} onChange={e => updateLot(idx, 'quantity', e.target.value)} />
                          </div>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label><TrendingDown size={13} style={{ color: 'var(--danger)' }} /> {locale === 'ar' ? 'السعر الأقصى (سقف)' : (locale === 'en' ? 'Maximum price (ceiling)' : 'Prix plafond (max)')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                            <div style={{ position: 'relative' }}>
                              <input type="number" step="any" min="0" placeholder="Ex: 50000" value={lot.priceCeiling} onChange={e => updateLot(idx, 'priceCeiling', e.target.value)} style={{ paddingRight: 44 }} />
                              <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>DA</span>
                            </div>
                          </div>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label><TrendingUp size={13} style={{ color: 'var(--primary)' }} /> {locale === 'ar' ? 'سعر الاحتياط (حد أدنى)' : (locale === 'en' ? 'Reserve price (min)' : 'Prix de réserve (min)')}</label>
                            <div style={{ position: 'relative' }}>
                              <input type="number" step="any" min="0" placeholder="Ex: 30000" value={lot.priceReserve} onChange={e => updateLot(idx, 'priceReserve', e.target.value)} style={{ paddingRight: 44 }} />
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

            {/* STEP 3 */}
            {wizardStep === 3 && (
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MapPin size={20} style={{ color: 'var(--primary)' }} />
                  {locale === 'ar' ? 'المنطقة الجغرافية' : (locale === 'en' ? 'Geographic zone' : 'Zone géographique')}
                </h3>
                {userCoords ? (
                  <AuctionMap centerLat={userCoords.lat} centerLng={userCoords.lng} radiusKm={radiusKm}
                    onRadiusChange={val => { setRadiusKm(val); setIsSearchZoneChanged(true); }} producerCount={producerCount} />
                ) : (
                  <div style={{ padding: 14, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, fontSize: '0.85rem', color: '#f59e0b' }}>
                    ⚠️ {locale === 'ar' ? 'أكمل ملفك الشخصي (الولاية) لعرض الخريطة.' : (locale === 'en' ? 'Complete your profile (wilaya) to display the map.' : 'Complétez votre profil (wilaya) pour afficher la carte.')}
                  </div>
                )}
              </div>
            )}

            {/* STEP 4 */}
            {wizardStep === 4 && (
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CalendarClock size={20} style={{ color: 'var(--primary)' }} />
                  {locale === 'ar' ? 'التواريخ والإعدادات' : (locale === 'en' ? 'Dates & Settings' : 'Dates & Paramètres')}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 20px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label htmlFor="start-dt">{locale === 'ar' ? 'تاريخ + وقت البداية' : (locale === 'en' ? 'Start date + time' : 'Date + heure de début')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                      <input id="start-dt" type="datetime-local" value={startDatetime} onChange={e => setStartDatetime(e.target.value)} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label htmlFor="end-dt">{locale === 'ar' ? 'تاريخ + وقت النهاية' : (locale === 'en' ? 'End date + time' : 'Date + heure de fin')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                      <input id="end-dt" type="datetime-local" value={endDatetime} onChange={e => setEndDatetime(e.target.value)} />
                    </div>
                  </div>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '18px 22px', background: 'rgba(255,255,255,0.02)' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                      <div style={{ width: 44, height: 24, borderRadius: 99, background: autoProlongate ? 'var(--primary)' : 'var(--border)', position: 'relative', transition: 'background 0.25s', flexShrink: 0 }} onClick={() => setAutoProlongate(p => !p)}>
                        <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'white', position: 'absolute', top: 3, left: autoProlongate ? 23 : 3, transition: 'left 0.25s', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 7 }}>
                          <Repeat2 size={16} style={{ color: 'var(--primary)' }} /> {locale === 'ar' ? 'تمديد تلقائي' : (locale === 'en' ? 'Auto prolongation' : 'Prolongation automatique')}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                          {locale === 'ar' ? 'تمديد المزاد تلقائيًا عند وجود عرض في اللحظة الأخيرة.' : (locale === 'en' ? 'Automatically extend the auction if a bid arrives at the last moment.' : 'Prolonge l\'enchère si une offre arrive en fin de session.')}
                        </div>
                      </div>
                    </label>
                    {autoProlongate && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 20px', marginTop: 20 }}>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label htmlFor="prolong-minutes"><Clock size={13} style={{ color: 'var(--primary)', marginRight: 5, verticalAlign: 'middle' }} /> {locale === 'ar' ? 'مدة التمديد (دقائق)' : (locale === 'en' ? 'Extension duration (min)' : 'Durée prolongation (min)')}</label>
                          <input id="prolong-minutes" type="number" min="1" max="120" value={prolongationMinutes} onChange={e => setProlongationMinutes(e.target.value)} />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label htmlFor="max-prolongs"><Hash size={13} style={{ color: 'var(--primary)', marginRight: 5, verticalAlign: 'middle' }} /> {locale === 'ar' ? 'الحد الأقصى للتمديدات' : (locale === 'en' ? 'Max number of extensions' : 'Nombre max de prolongations')}</label>
                          <input id="max-prolongs" type="number" min="1" max="20" value={maxProlongations} onChange={e => setMaxProlongations(e.target.value)} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 5 */}
            {wizardStep === 5 && (() => {
              const activeAuction = myAuctions.find(a => a.id === viewingAuctionId);
              return (
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FileSearch size={20} style={{ color: 'var(--primary)' }} />
                    {locale === 'ar' ? 'ملخص المزاد' : (locale === 'en' ? "Auction summary" : "Récapitulatif de l'enchère")}
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', background: 'rgba(255,255,255,0.02)' }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>{locale === 'ar' ? 'المعلومات العامة' : (locale === 'en' ? 'General information' : 'Informations générales')}</div>
                      <SummaryRow label={locale === 'ar' ? 'العنوان' : (locale === 'en' ? 'Title' : 'Titre')} value={title} />
                      <SummaryRow label={locale === 'ar' ? 'النوع' : (locale === 'en' ? 'Type' : 'Type')} value={getAuctionTypeLabel(auctionType)} />
                      <SummaryRow label={locale === 'ar' ? 'مكان التسليم' : (locale === 'en' ? 'Delivery location' : 'Lieu de livraison')} value={deliveryLocation} />
                    </div>
                    <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', background: 'rgba(255,255,255,0.02)' }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>{locale === 'ar' ? 'الأقسام' : (locale === 'en' ? 'Lots' : 'Lots')} ({lots.length})</div>
                      {lots.map(lot => (
                        <div key={lot.seq} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
                          <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: 4, fontSize: '0.9rem' }}>{locale === 'ar' ? 'قسم' : (locale === 'en' ? 'Lot' : 'Lot')} {lot.seq} — {lot.designation}</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', fontSize: '0.8rem', color: 'var(--text-body)' }}>
                            <span>🌿 {getCultureName(lot.cultureTypeId)} / {getProductName(lot.productId)}</span>
                            <span>📍 {getWilayaName(lot.wilayaId)}</span>
                            <span>📦 {lot.quantity} {t('unit_' + lot.unit)}</span>
                            <span style={{ color: 'var(--danger)' }}>⬆ {lot.priceCeiling} DA</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', background: 'rgba(255,255,255,0.02)' }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>{locale === 'ar' ? 'المنطقة والتواريخ' : (locale === 'en' ? 'Zone & Dates' : 'Zone & Dates')}</div>
                      <SummaryRow label={locale === 'ar' ? 'نطاق البحث' : (locale === 'en' ? 'Search radius' : 'Rayon de recherche')} value={`${radiusKm} km`} />
                      <SummaryRow label={locale === 'ar' ? 'منتجون في المنطقة' : (locale === 'en' ? 'Producers in zone' : 'Producteurs dans la zone')} value={`${producerCount}`} />
                      <SummaryRow label={locale === 'ar' ? 'بداية' : (locale === 'en' ? 'Start' : 'Début')} value={startDatetime ? new Date(startDatetime).toLocaleString('fr-DZ') : '—'} />
                      <SummaryRow label={locale === 'ar' ? 'نهاية' : (locale === 'en' ? 'End' : 'Fin')} value={endDatetime ? new Date(endDatetime).toLocaleString('fr-DZ') : '—'} />
                    </div>

                    {/* Active auction offers list */}
                    {activeAuction && (
                      <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px', background: 'rgba(255,255,255,0.02)', marginTop: 8 }}>
                        <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Gavel size={18} style={{ color: 'var(--primary)' }} /> {t('proposalsProducers')} ({activeAuction.bids.length})
                        </h4>
                        {activeAuction.bids.length === 0 ? (
                          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>{t('waitingProposals')}</p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {[...activeAuction.bids].sort((a, b) => Math.min(...(a.lines||[]).map(l=>l.price||Infinity)) - Math.min(...(b.lines||[]).map(l=>l.price||Infinity))).map(bid => {
                              const isBidNew = newBidFlashIds.includes(bid.id);
                              const isAccepted = activeAuction.acceptedBidId === bid.id;
                              return (
                                <div key={bid.id} className={isBidNew ? 'bid-flash-new' : ''} style={{ border: `1px solid ${isAccepted ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 10, padding: '16px', background: isAccepted ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.02)' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>{bid.producerAlias}</span>
                                      <StarDisplay rating={bid.producerRating} count={bid.producerRatingCount} />
                                    </div>
                                    {isAccepted && <span style={{ fontSize: '0.72rem', fontWeight: 700, background: 'var(--primary)', color: 'white', borderRadius: 99, padding: '3px 10px' }}>{t('bidSelected')}</span>}
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                                    {(bid.lines || []).map(line => (
                                      <div key={line.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 8 }}>
                                        <div style={{ flex: 1 }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                            {line.optionName && <strong style={{ fontSize: '0.8rem', color: 'var(--text-main)', background: 'var(--primary-soft)', padding: '2px 8px', borderRadius: 4 }}>{line.optionName}</strong>}
                                            {line.quantity && <span style={{ fontSize: '0.82rem', color: 'var(--text-body)' }}>{line.quantity} {t('unit_' + (line.unit || activeAuction.unit))}</span>}
                                            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--secondary)' }}>{line.price} DA</span>
                                          </div>
                                          {line.comments && <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: '0.78rem', color: 'var(--text-body)' }}><MessageSquare size={12} /><span>{line.comments}</span></div>}
                                          {line.images?.length > 0 && (
                                            <div className="bid-photos-grid" style={{ marginTop: 8 }}>
                                              {line.images.map((img, i) => (
                                                <div key={i} className="bid-photo-thumb" onClick={() => setActiveZoomImage(img)} role="button" tabIndex={0}>
                                                  <img src={img} alt={`Photo ${i + 1}`} />
                                                  <div className="bid-photo-overlay"><ImageIcon size={14} /></div>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                    {activeAuction.status === 'open' ? (
                                      <button className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem', gap: 6 }} onClick={() => onAcceptBid(activeAuction.id, bid.id)}>
                                        <Check size={14} /> {t('validateBtn')}
                                      </button>
                                    ) : (isAccepted && (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <span style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 'bold', fontSize: '0.85rem' }}><Check size={16} /> {t('bidConfirmed')}</span>
                                        {!activeAuction.alreadyRated && <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '4px 10px', gap: 4 }} onClick={() => setRatingAuctionId(activeAuction.id)}><Star size={12} /> {locale === 'fr' ? 'Noter' : 'تقييم'}</button>}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Error */}
            {stepError && (
              <div style={{ marginTop: 20, padding: '10px 14px', borderRadius: 8, fontSize: '0.875rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />{stepError}
              </div>
            )}
          </div>

          {/* Wizard Nav */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, gap: 12 }}>
            <button type="button" onClick={goPrev} disabled={wizardStep === 1} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: wizardStep === 1 ? 0.4 : 1 }}>
              <ChevronLeft size={16} /> {locale === 'ar' ? 'السابق' : (locale === 'en' ? 'Previous' : 'Précédent')}
            </button>
            {viewingAuctionId ? (
              wizardStep < 5 ? (
                <button type="button" onClick={() => setWizardStep(s => Math.min(s + 1, 5))} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {locale === 'ar' ? 'التالي' : (locale === 'en' ? 'Next' : 'Suivant')} <ChevronRight size={16} />
                </button>
              ) : (
                <button type="button" onClick={closeWizard} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <X size={16} /> {locale === 'ar' ? 'إغلاق' : (locale === 'en' ? 'Close' : 'Fermer')}
                </button>
              )
            ) : (
              wizardStep < 5 ? (
                <button type="button" onClick={goNext} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {locale === 'ar' ? 'التالي' : (locale === 'en' ? 'Next' : 'Suivant')} <ChevronRight size={16} />
                </button>
              ) : (
                <button type="button" onClick={handleSubmit} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Gavel size={16} /> {editingAuctionId ? t('saveChangesBtn') : (locale === 'ar' ? 'نشر المزاد' : (locale === 'en' ? "Publish auction" : "Publier l'enchère"))}
                </button>
              )
            )}
          </div>
        </div>
      )}

      {/* AUCTIONS TABLE */}
      {!wizardOpen && (
        myAuctions.length === 0 ? (
          <div className="glass-panel empty-state">
            <Package className="empty-icon" size={48} />
            <div>
              <h4 style={{ fontSize: '1.25rem', marginBottom: '6px', color: 'var(--text-main)' }}>{t('noDemandPosted')}</h4>
              <p>{t('noDemandPostedSub')}</p>
            </div>
          </div>
        ) : (
          <div style={{ borderRadius: 14, border: '1px solid var(--border)', overflowX: 'auto', overflowY: 'hidden', background: 'var(--bg-panel)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2.2fr 1fr 1fr 80px 80px 95px', minWidth: 680, padding: '10px 20px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border)', fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              <span>{locale === 'ar' ? 'العنوان' : 'Titre'}</span>
              <span>{locale === 'ar' ? 'النوع' : 'Type'}</span>
              <span>{locale === 'ar' ? 'التاريخ' : 'Date'}</span>
              <span style={{ textAlign: 'center' }}>{locale === 'ar' ? 'عروض' : 'Offres'}</span>
              <span style={{ textAlign: 'center' }}>{locale === 'ar' ? 'الحالة' : 'Statut'}</span>
              <span style={{ textAlign: 'center' }}>{locale === 'ar' ? 'إجراء' : 'Actions'}</span>
            </div>
            {myAuctions.map((auction, idx) => {
              const isExpanded = expandedId === auction.id;
              const isNew = newBidFlashIds.some(id => auction.bids.some(b => b.id === id));
              const status = statusColors[auction.status] || statusColors.closed;
              const dateStr = new Date(auction.createdAt).toLocaleDateString('fr-DZ', { day: '2-digit', month: '2-digit', year: '2-digit' });
              return (
                <div key={auction.id} ref={el => { if (highlightAuctionId === auction.id && el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100); }}
                  style={{ borderBottom: idx < myAuctions.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div
                    style={{ display: 'grid', gridTemplateColumns: '2.2fr 1fr 1fr 80px 80px 95px', minWidth: 680, padding: '14px 20px', alignItems: 'center', background: isNew ? 'rgba(16,185,129,0.06)' : 'transparent', transition: 'background 0.2s' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {isNew && <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#10b981', marginRight: 6, verticalAlign: 'middle', boxShadow: '0 0 6px #10b981' }} />}
                        {auction.title || auction.product}
                      </span>
                      {auction.deliveryLocation && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}><MapPin size={10} /> {auction.deliveryLocation}</span>}
                    </div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-body)' }}>{getAuctionTypeLabel(auction.auctionType)}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{dateStr}</span>
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: '50%', background: auction.bids.length > 0 ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)', color: auction.bids.length > 0 ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 800, fontSize: '0.85rem' }}>
                        {auction.bids.length}
                      </span>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 99, background: status.bg, color: status.color, fontSize: '0.72rem', fontWeight: 700 }}>
                        {status.label(locale)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                        <button
                          type="button"
                          onClick={() => openViewWizard(auction)}
                          title={locale === 'ar' ? 'استشارة' : 'Consulter'}
                          style={{
                            background: 'rgba(59,130,246,0.1)',
                            border: '1px solid rgba(59,130,246,0.25)',
                            color: '#3b82f6',
                            padding: '6px 9px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.2)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.1)'; }}
                        >
                          <Eye size={13} />
                        </button>
                        {auction.status === 'pending' && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditWizard(auction)}
                              title={t('editAuctionBtn')}
                              style={{
                                background: 'rgba(245,158,11,0.1)',
                                border: '1px solid rgba(245,158,11,0.25)',
                                color: '#f59e0b',
                                padding: '6px 9px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s',
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(245,158,11,0.2)'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(245,158,11,0.1)'; }}
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmAuctionId(auction.id)}
                              title={t('deleteAuctionBtn')}
                              style={{
                                background: 'rgba(239,68,68,0.1)',
                                border: '1px solid rgba(239,68,68,0.25)',
                                color: '#ef4444',
                                padding: '6px 9px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s',
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.2)'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
