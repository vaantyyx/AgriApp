import React, { useState, useEffect, useRef } from 'react';
import { Plus, Tag, MessageSquare, Check, Package, X, Star, MapPin, ChevronDown, ChevronUp, Image as ImageIcon } from 'lucide-react';
import { WILAYA_COORDS, getCommuneCoords, getCoordsForWilayaName, haversineKm } from '../utils/wilayaCoordinates.js';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// ─── Star Rating Display ────────────────────────────────────────────────────
function StarDisplay({ rating, count }) {
  if (rating === null || rating === undefined) {
    return <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Aucun avis</span>;
  }
  const full = Math.floor(rating);
  const half = rating - full >= 0.25 && rating - full < 0.75;
  const stars = Array.from({ length: 5 }, (_, i) => {
    if (i < full) return 'full';
    if (i === full && half) return 'half';
    return 'empty';
  });
  return (
    <span className="star-display" title={`${rating.toFixed(1)} / 5 (${count} avis)`}>
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
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card animate-fade-in" onClick={e => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose}><X size={18} /></button>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>⭐</div>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '6px' }}>Notez le producteur</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Votre avis aide les autres acheteurs à choisir. Le producteur reste anonyme.
          </p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
          <StarPicker value={rating} onChange={setRating} />
        </div>
        {rating > 0 && (
          <p style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
            {{1:'Très insatisfait',2:'Insatisfait',3:'Correct',4:'Satisfait',5:'Excellent !'}[rating]}
          </p>
        )}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>
            Plus tard
          </button>
          <button
            className="btn btn-primary"
            style={{ flex: 1 }}
            disabled={rating === 0}
            onClick={() => { if (rating > 0) onSubmit(auctionId, rating); }}
          >
            Confirmer
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
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Rayon de recherche :</span>
          <strong style={{ color: 'var(--primary)', fontSize: '0.9rem' }}>{radiusKm} km</strong>
        </div>
        <input
          type="range"
          min="10"
          max="600"
          step="10"
          value={radiusKm}
          onChange={e => onRadiusChange(Number(e.target.value))}
          className="radius-slider"
          aria-label="Rayon de recherche en kilomètres"
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          <span>10 km</span><span>600 km</span>
        </div>
        <div className="map-producer-count">
          <span style={{ fontSize: '1.1rem' }}>🌱</span>
          <span><strong style={{ color: 'var(--primary)' }}>{producerCount}</strong> producteur{producerCount !== 1 ? 's' : ''} dans cette zone</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main BuyerDashboard ───────────────────────────────────────────────────
export default function BuyerDashboard({ user, auctions, onCreateAuction, onAcceptBid, onRateProducer, newBidFlashIds }) {
  const [product, setProduct] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('tonnes');
  const [targetPrice, setTargetPrice] = useState('');
  const [description, setDescription] = useState('');
  const [radiusKm, setRadiusKm] = useState(100);
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
      alert('Veuillez remplir les champs obligatoires correctement.');
      return;
    }
    onCreateAuction({
      product: product.trim(),
      quantity: parseFloat(quantity),
      unit,
      targetPrice: targetPrice ? parseFloat(targetPrice) : null,
      description: description.trim(),
      radius: radiusKm,
    });
    setProduct('');
    setQuantity('');
    setTargetPrice('');
    setDescription('');
    setRadiusKm(100);
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
      <div className="glass-panel animate-fade-in" style={{ height: 'fit-content' }}>
        <h3 style={{ fontSize: '1.25rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={20} style={{ color: 'var(--primary)' }} />
          Exprimer un besoin
        </h3>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="product">Produit *</label>
            <input
              id="product"
              type="text"
              placeholder="Ex: Pomme de terre, Carottes"
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              required
            />
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label htmlFor="quantity">Quantité *</label>
              <input
                id="quantity"
                type="number"
                step="any"
                placeholder="Ex: 50"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="unit">Unité *</label>
              <select id="unit" value={unit} onChange={(e) => setUnit(e.target.value)}>
                <option value="tonnes">Tonnes</option>
                <option value="kg">Kilogrammes (kg)</option>
                <option value="cagettes">Cagettes</option>
                <option value="palettes">Palettes</option>
                <option value="sacs">Sacs</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="target-price">Prix Max Target (DA / unité) <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.8rem' }}>(Optionnel)</span></label>
            <input
              id="target-price"
              type="number"
              step="0.01"
              placeholder="Ex: 450"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Spécifications / Détails</label>
            <textarea
              id="description"
              rows="3"
              placeholder="Ex: Calibre 40+, variété Agata, livraison avant vendredi..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
                onRadiusChange={setRadiusKm}
                producerCount={producerCount}
              />
            )}

            {!userCoords && showMap && (
              <div style={{ padding: '12px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '8px', fontSize: '0.85rem', color: '#f59e0b' }}>
                ⚠️ Complétez votre profil (wilaya/commune) pour afficher la carte.
              </div>
            )}
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }}>
            Publier la demande
          </button>
        </form>
      </div>

      {/* Main Content: List of buyer's auctions */}
      <div>
        <h2 style={{ fontSize: '1.75rem', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span>Vos Demandes de Marché</span>
          <span className="badge badge-open" style={{ borderRadius: '20px', fontSize: '0.8rem' }}>
            {myAuctions.length} Total
          </span>
        </h2>

        {myAuctions.length === 0 ? (
          <div className="glass-panel empty-state">
            <Package className="empty-icon" size={48} />
            <div>
              <h4 style={{ fontSize: '1.25rem', marginBottom: '6px', color: 'var(--text-main)' }}>Aucune demande publiée</h4>
              <p>Remplissez le formulaire de gauche pour publier votre premier besoin agricole en temps réel.</p>
            </div>
          </div>
        ) : (
          myAuctions.map(auction => (
            <div key={auction.id} className="auction-card animate-fade-in">
              <div className="auction-header">
                <div>
                  <h3 className="auction-title">
                    {auction.product} — {auction.quantity} {auction.unit}
                  </h3>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Publié le {new Date(auction.createdAt).toLocaleTimeString()}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span className={`badge ${auction.status === 'open' ? 'badge-open' : 'badge-closed'}`}>
                    {auction.status === 'open' ? 'En cours' : 'Validée'}
                  </span>
                </div>
              </div>

              {auction.description && (
                <p style={{ background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: '8px', fontSize: '0.9rem', marginBottom: '16px', borderLeft: '3px solid var(--primary)' }}>
                  <strong>Détails :</strong> {auction.description}
                </p>
              )}

              <div className="auction-details">
                {auction.targetPrice && (
                  <div className="detail-item">
                    <Tag size={16} />
                    <span>Budget Cible : <span className="detail-highlight">{auction.targetPrice} DA/{auction.unit}</span></span>
                  </div>
                )}
                <div className="detail-item">
                  <span>Offres reçues : <span className="detail-highlight">{auction.bids.length}</span></span>
                </div>
              </div>

              {/* Bids area */}
              <div className="bids-container">
                <h4 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '12px', color: 'var(--text-main)' }}>
                  Propositions des Producteurs :
                </h4>

                {auction.bids.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontStyle: 'italic', padding: '8px 0' }}>
                    En attente de propositions en temps réel...
                  </p>
                ) : (
                  <div>
                    {[...auction.bids]
                      .sort((a, b) => a.price - b.price)
                      .map((bid) => {
                        const isAccepted = auction.acceptedBidId === bid.id;
                        const isNew = newBidFlashIds.includes(bid.id);

                        return (
                          <div
                            key={bid.id}
                            className={`bid-item ${isAccepted ? 'accepted' : ''} ${isNew ? 'bid-flash-new' : ''}`}
                          >
                            <div className="bid-info" style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <span className="bid-producer">{bid.producerAlias}</span>
                                {isAccepted && (
                                  <span className="badge badge-open" style={{ fontSize: '0.65rem', background: 'var(--primary)', color: 'var(--text-inverse)', border: 'none', padding: '2px 6px' }}>
                                    Offre Retenue
                                  </span>
                                )}
                              </div>

                              {/* Producer rating */}
                              <div style={{ marginTop: '4px' }}>
                                <StarDisplay rating={bid.producerRating} count={bid.producerRatingCount} />
                              </div>

                              <span className="bid-price">
                                {bid.price} DA <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>/ {auction.unit}</span>
                              </span>

                              {bid.comments && (
                                <div className="bid-comment" style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                  <MessageSquare size={12} />
                                  <span>{bid.comments}</span>
                                </div>
                              )}

                              {/* Bid photos (producer may have attached photos) */}
                              {bid.images && bid.images.length > 0 && (
                                <div style={{ marginTop: '8px' }}>
                                  <div className="bid-photos-grid">
                                    {bid.images.map((img, idx) => (
                                      <div
                                        key={idx}
                                        className="bid-photo-thumb"
                                        onClick={() => setActiveZoomImage(img)}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={e => e.key === 'Enter' && setActiveZoomImage(img)}
                                        aria-label={`Photo ${idx + 1} du producteur`}
                                      >
                                        <img src={img} alt={`Photo produit ${idx + 1}`} />
                                        <div className="bid-photo-overlay"><ImageIcon size={14} /></div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="text-right" style={{ flexShrink: 0 }}>
                              {auction.status === 'open' ? (
                                <button
                                  type="button"
                                  className="btn btn-primary"
                                  style={{ padding: '6px 12px', fontSize: '0.85rem', gap: '4px' }}
                                  onClick={() => onAcceptBid(auction.id, bid.id)}
                                >
                                  <Check size={14} />
                                  Valider
                                </button>
                              ) : (
                                isAccepted && (
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                    <div style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold', fontSize: '0.9rem' }}>
                                      <Check size={18} /> Confirmé
                                    </div>
                                    {!auction.alreadyRated && (
                                      <button
                                        type="button"
                                        className="btn btn-secondary"
                                        style={{ fontSize: '0.75rem', padding: '4px 10px', gap: '4px' }}
                                        onClick={() => setRatingAuctionId(auction.id)}
                                      >
                                        <Star size={12} /> Noter
                                      </button>
                                    )}
                                    {auction.alreadyRated && (
                                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                        <Star size={11} style={{ color: '#f59e0b' }} /> Noté
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
            <button className="lightbox-close" onClick={() => setActiveZoomImage(null)}>
              <X size={20} />
            </button>
            <img src={activeZoomImage} alt="Zoom produit" />
          </div>
        </div>
      )}
    </div>
  );
}
