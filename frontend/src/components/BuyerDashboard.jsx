import React, { useState, useEffect, useRef } from 'react';
import { Plus, Tag, MessageSquare, Check, Package, X, Star, MapPin, ChevronDown, ChevronUp, Image as ImageIcon } from 'lucide-react';
import { WILAYA_COORDS, getCommuneCoords, getCoordsForWilayaName, haversineKm } from '../utils/wilayaCoordinates.js';
import { useTranslation } from '../context/LanguageContext';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

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
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            {t('rateProducerDesc')}
          </p>
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
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>
            {t('rateLaterBtn')}
          </button>
          <button
            className="btn btn-primary"
            style={{ flex: 1 }}
            disabled={rating === 0}
            onClick={() => { if (rating > 0) onSubmit(auctionId, rating); }}
          >
            {t('confirmBtn')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Fix Leaflet default icon paths broken by Vite bundler ─────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

// ─── Leaflet Map component ─────────────────────────────────────────────────
function AuctionMap({ centerLat, centerLng, radiusKm, onRadiusChange, producerCount }) {
  const mapRef = useRef(null);
  const leafletMapRef = useRef(null);
  const circleRef = useRef(null);
  const markerRef = useRef(null);

  useEffect(() => {
    if (leafletMapRef.current) return; // already initialized
    if (!mapRef.current) return;

    const lat = isNaN(centerLat) ? 36.73 : centerLat;
    const lng = isNaN(centerLng) ? 3.09 : centerLng;

    const map = L.map(mapRef.current, {
      center: [lat, lng],
      zoom: 8,
      zoomControl: true,
    });

    // OpenStreetMap tiles — no API key required
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(map);

    // Buyer marker (pulsing green)
    const buyerIcon = L.divIcon({
      className: '',
      html: '<div class="map-buyer-marker"><div class="map-buyer-pulse"></div></div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    markerRef.current = L.marker([lat, lng], { icon: buyerIcon })
      .addTo(map)
      .bindPopup('📍 Votre position (approximative)');

    circleRef.current = L.circle([lat, lng], {
      radius: radiusKm * 1000,
      color: '#10b981',
      fillColor: '#10b981',
      fillOpacity: 0.12,
      weight: 2.5,
    }).addTo(map);

    leafletMapRef.current = map;

    // After panel animates open, recalculate map size.
    // fitBounds will be triggered by the radiusKm useEffect once the map has real dimensions.
    const fitTimer = setTimeout(() => {
      try {
        map.invalidateSize();
        const container = map.getContainer();
        if (circleRef.current && container && container.clientHeight > 0) {
          map.fitBounds(circleRef.current.getBounds(), { padding: [30, 30], animate: false });
        }
      } catch (_) { /* ignore if map already destroyed */ }
    }, 400);

    return () => {
      clearTimeout(fitTimer);
      map.remove();
      leafletMapRef.current = null;
      circleRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update circle when radius changes
  useEffect(() => {
    if (!circleRef.current || !leafletMapRef.current) return;
    circleRef.current.setRadius(radiusKm * 1000);
    leafletMapRef.current.fitBounds(circleRef.current.getBounds(), { padding: [30, 30] });
  }, [radiusKm]);

  // Update center and marker when coordinates change
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
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{locale === 'ar' ? 'نطاق البحث :' : (locale === 'fr' ? 'Rayon de recherche :' : 'Search radius:')}</span>
          <strong style={{ color: 'var(--primary)', fontSize: '0.9rem' }}>{radiusKm} km</strong>
        </div>
        <input
          type="range"
          min="10"
          max="2000"
          step="10"
          value={radiusKm}
          onChange={e => onRadiusChange(Number(e.target.value))}
          className="radius-slider"
          aria-label="Rayon de recherche en kilomètres"
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          <span>10 km</span><span>2 000 km</span>
        </div>
        <div className="map-producer-count">
          <span style={{ fontSize: '1.1rem' }}>🌱</span>
          <span><strong style={{ color: 'var(--primary)' }}>{producerCount}</strong> {locale === 'ar' ? 'منتج في هذه المنطقة' : (locale === 'fr' ? `producteur${producerCount !== 1 ? 's' : ''} dans cette zone` : `producer${producerCount !== 1 ? 's' : ''} in this area`)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main BuyerDashboard ───────────────────────────────────────────────────
export default function BuyerDashboard({ user, auctions, onCreateAuction, onAcceptBid, onRateProducer, newBidFlashIds }) {
  const { t, dir, locale } = useTranslation();
  const [product, setProduct] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('tonnes');
  const [description, setDescription] = useState('');
  const [radiusKm, setRadiusKm] = useState(100);
  const [isSearchZoneChanged, setIsSearchZoneChanged] = useState(false);
  const [showMap, setShowMap] = useState(false);

  // Rating modal
  const [ratingAuctionId, setRatingAuctionId] = useState(null);

  // Lightbox for bid photos
  const [activeZoomImage, setActiveZoomImage] = useState(null);

  // Resolve user's coordinates for the map
  const userCoords = React.useMemo(() => {
    if (user.commune && user.wilaya) {
      return getCommuneCoords(user.wilaya, user.commune);
    }
    if (user.wilaya) {
      return getCoordsForWilayaName(user.wilaya);
    }
    // Default to Algiers if no location set
    return { lat: 36.73, lng: 3.09 };
  }, [user.wilaya, user.commune]);

  const [producerCount, setProducerCount] = useState(0);

  // Fetch actual count of producers in radius from backend
  useEffect(() => {
    if (!userCoords || !userCoords.lat || !userCoords.lng) return;
    let active = true;

    fetch(`http://127.0.0.1:3001/api/producers/count?lat=${userCoords.lat}&lng=${userCoords.lng}&radius=${radiusKm}`)
      .then(res => res.ok ? res.json() : { count: 0 })
      .then(data => {
        if (active) {
          setProducerCount(data.count);
        }
      })
      .catch(() => {
        if (active) setProducerCount(0);
      });

    return () => { active = false; };
  }, [userCoords, radiusKm]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!product.trim() || !quantity || parseFloat(quantity) <= 0) {
      alert(t('formFieldsError'));
      return;
    }
    onCreateAuction({
      product: product.trim(),
      quantity: parseFloat(quantity),
      unit,
      description: description.trim(),
      radius: radiusKm,
      isSearchZoneChanged,
    });
    setProduct('');
    setQuantity('');
    setDescription('');
    setRadiusKm(100);
    setIsSearchZoneChanged(false);
    setShowMap(false);
  };

  const myAuctions = auctions.filter(a => a.isOwner);

  return (
    <div className="dashboard-grid has-sidebar">

      {/* Rating Modal */}
      {ratingAuctionId && (
        <RatingModal
          auctionId={ratingAuctionId}
          onSubmit={(aId, r) => { onRateProducer(aId, r); setRatingAuctionId(null); }}
          onClose={() => setRatingAuctionId(null)}
        />
      )}

      {/* Sidebar: Create Demand Form */}
      <div className="glass-panel animate-fade-in" style={{ height: 'fit-content', textAlign: 'start' }}>
        <h3 style={{ fontSize: '1.25rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}>
          <Plus size={20} style={{ color: 'var(--primary)' }} />
          <span>{locale === 'ar' ? t('expressNeedAr') : t('expressNeed')}</span>
        </h3>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="product">{t('productLabel')}</label>
            <input
              id="product"
              type="text"
              placeholder={t('productPlaceholder')}
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              required
              style={{ textAlign: 'start' }}
            />
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label htmlFor="quantity">{t('quantityLabel')}</label>
              <input
                id="quantity"
                type="number"
                step="any"
                placeholder={t('quantityPlaceholder')}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                style={{ textAlign: 'start' }}
              />
            </div>
            <div className="form-group">
              <label htmlFor="unit">{t('unitLabel')}</label>
              <select id="unit" value={unit} onChange={(e) => setUnit(e.target.value)} style={{ textAlign: 'start' }}>
                <option value="tonnes">{t('unit_tonnes')}</option>
                <option value="kg">{t('unit_kg')}</option>
                <option value="cagettes">{t('unit_cagettes')}</option>
                <option value="palettes">{t('unit_palettes')}</option>
                <option value="sacs">{t('unit_sacs')}</option>
              </select>
            </div>
          </div>



          <div className="form-group">
            <label htmlFor="description">{t('specsLabel')}</label>
            <textarea
              id="description"
              rows="3"
              placeholder={t('specsPlaceholder')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ textAlign: 'start' }}
            />
          </div>

          {/* Map toggle */}
          <div className="form-group">
            <button
              type="button"
              className="btn btn-secondary"
              style={{ width: '100%', justifyContent: 'space-between', marginBottom: showMap ? '12px' : '0' }}
              onClick={() => setShowMap(s => !s)}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MapPin size={15} />
                Zone de recherche — <strong style={{ color: 'var(--primary)' }}>{radiusKm} km</strong>
              </span>
              {showMap ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>

            {showMap && userCoords && (
              <AuctionMap
                centerLat={userCoords.lat}
                centerLng={userCoords.lng}
                radiusKm={radiusKm}
                onRadiusChange={(val) => { setRadiusKm(val); setIsSearchZoneChanged(true); }}
                producerCount={producerCount}
              />
            )}

            {!userCoords && showMap && (
              <div style={{ padding: '12px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '8px', fontSize: '0.85rem', color: '#f59e0b' }}>
              ⚠️ {locale === 'ar' ? 'أكمل ملفك الشخصي (الولاية/البلدية) لعرض الخريطة.' : (locale === 'fr' ? 'Complétez votre profil (wilaya/commune) pour afficher la carte.' : 'Complete your profile (wilaya/commune) to show the map.')}
              </div>
            )}
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }}>
            {t('publishBtn')}
          </button>
        </form>
      </div>

      {/* Main Content: List of buyer's auctions */}
      <div style={{ textAlign: 'start' }}>
        <h2 style={{ fontSize: '1.75rem', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px', flexDirection: dir === 'rtl' ? 'row-reverse' : 'row', justifyContent: 'flex-start' }}>
          <span>{t('myMarketDemands')}</span>
          <span className="badge badge-open" style={{ borderRadius: '20px', fontSize: '0.8rem' }}>
            {t('demandsCount', { count: myAuctions.length })}
          </span>
        </h2>

        {myAuctions.length === 0 ? (
          <div className="glass-panel empty-state">
            <Package className="empty-icon" size={48} />
            <div>
              <h4 style={{ fontSize: '1.25rem', marginBottom: '6px', color: 'var(--text-main)' }}>{t('noDemandPosted')}</h4>
              <p>{t('noDemandPostedSub')}</p>
            </div>
          </div>
        ) : (
          myAuctions.map(auction => (
            <div key={auction.id} className="auction-card animate-fade-in">
              <div className="auction-header" style={{ flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}>
                <div>
                  <h3 className="auction-title">
                    {auction.product} — {auction.quantity} {t('unit_' + auction.unit)}
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
                  background: 'rgba(255,255,255,0.02)',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  marginBottom: '16px',
                  borderLeft: dir === 'ltr' ? '3px solid var(--primary)' : 'none',
                  borderRight: dir === 'rtl' ? '3px solid var(--primary)' : 'none'
                }}>
                  <strong>{t('detailsLabel')}</strong> {auction.description}
                </p>
              )}

              <div className="auction-details" style={{ flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}>
                <div className="detail-item">
                  <span>{t('bidsReceivedCount', { count: auction.bids.length })}</span>
                </div>
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
                            {/* Producer info header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                              <div>
                                <span className="bid-producer">{bid.producerAlias}</span>
                                <div style={{ marginTop: '2px' }}>
                                  <StarDisplay rating={bid.producerRating} count={bid.producerRatingCount} />
                                </div>
                              </div>
                              {isAccepted && (
                                <span className="badge badge-open" style={{ fontSize: '0.7rem', background: 'var(--primary)', color: 'var(--text-inverse)', border: 'none', padding: '3px 8px' }}>
                                  {t('bidSelected')}
                                </span>
                              )}
                            </div>

                            {/* Lines / Qualities display */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
                              <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                                {t('bidQualitiesTitle')}
                              </div>
                              {(bid.lines || []).map((line) => (
                                <div
                                  key={line.id}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '8px',
                                    padding: '8px 12px',
                                    background: 'rgba(255,255,255,0.02)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '8px',
                                    flexWrap: 'wrap',
                                  }}
                                >
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                      {line.optionName && (
                                        <strong style={{ fontSize: '0.82rem', color: 'var(--text-main)', background: 'var(--primary-soft)', padding: '2px 8px', borderRadius: '4px' }}>
                                          {line.optionName}
                                        </strong>
                                      )}
                                      {line.quantity && (
                                        <span style={{ fontSize: '0.82rem', color: 'var(--text-body)' }}>
                                          {line.quantity} {t('unit_' + (line.unit || auction.unit))}
                                        </span>
                                      )}
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
                                    {/* Line photos */}
                                    {line.images && line.images.length > 0 && (
                                      <div style={{ marginTop: '6px' }}>
                                        <div className="bid-photos-grid">
                                          {line.images.map((img, idx) => (
                                            <div
                                              key={idx}
                                              className="bid-photo-thumb"
                                              onClick={() => setActiveZoomImage(img)}
                                              role="button"
                                              tabIndex={0}
                                              onKeyDown={e => e.key === 'Enter' && setActiveZoomImage(img)}
                                              aria-label={`Photo ${idx + 1}`}
                                            >
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

                            {/* Single accept/confirm button per BID */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px' }}>
                              {auction.status === 'open' ? (
                                <button
                                  type="button"
                                  className="btn btn-primary"
                                  style={{ padding: '8px 16px', fontSize: '0.85rem', gap: '6px' }}
                                  onClick={() => onAcceptBid(auction.id, bid.id)}
                                >
                                  <Check size={14} />
                                  {t('validateBtn')}
                                </button>
                              ) : (
                                isAccepted && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold', fontSize: '0.85rem' }}>
                                      <Check size={16} /> {t('bidConfirmed')}
                                    </span>
                                    {!auction.alreadyRated && (
                                      <button
                                        type="button"
                                        className="btn btn-secondary"
                                        style={{ fontSize: '0.7rem', padding: '3px 8px', gap: '3px' }}
                                        onClick={() => setRatingAuctionId(auction.id)}
                                      >
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
          ))
        )}
      </div>

      {/* Lightbox Modal */}
      {activeZoomImage && (
        <div className="lightbox-modal" onClick={() => setActiveZoomImage(null)}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button className="lightbox-close" onClick={() => setActiveZoomImage(null)} style={{ right: dir === 'ltr' ? 0 : 'auto', left: dir === 'rtl' ? 0 : 'auto' }}>
              <X size={20} />
            </button>
            <img src={activeZoomImage} alt={t('zoomProduct')} />
          </div>
        </div>
      )}
    </div>
  );
}
