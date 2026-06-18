import React, { useState } from 'react';
import { Send, Tag, MessageSquare, Check, Tractor, Inbox, Trophy, X, Image as ImageIcon } from 'lucide-react';

// ─── Star Display (read-only) ───────────────────────────────────────────────
function StarDisplay({ rating, count }) {
  if (rating === null || rating === undefined) {
    return <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Aucun avis</span>;
  }
  const full = Math.floor(rating);
  const half = rating - full >= 0.25 && rating - full < 0.75;
  const stars = Array.from({ length: 5 }, (_, i) => {
    if (i < full) return 'full';
    if (i === full && half) return 'half';
    return 'empty';
  });
  return (
    <span className="star-display" title={`Votre note moyenne : ${rating.toFixed(1)} / 5`}>
      {stars.map((s, i) => <span key={i} className={`star star-${s}`}>★</span>)}
      <span className="star-label">{rating.toFixed(1)}/5 ({count} avis)</span>
    </span>
  );
}

// ─── Image Compressor ───────────────────────────────────────────────────────
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 800;
        let { width, height } = img;
        if (width > height) {
          if (width > MAX) { height *= MAX / width; width = MAX; }
        } else {
          if (height > MAX) { width *= MAX / height; height = MAX; }
        }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
}

// ─── Main ProducerDashboard ─────────────────────────────────────────────────
export default function ProducerDashboard({ user, auctions, onPlaceBid, newBidFlashIds }) {
  // Per-auction bid inputs: { [auctionId]: { price, comments, images, isUploading } }
  const [inputs, setInputs] = useState({});
  const [activeZoomImage, setActiveZoomImage] = useState(null);

  const setInput = (auctionId, field, value) => {
    setInputs(prev => ({
      ...prev,
      [auctionId]: { ...prev[auctionId], [field]: value },
    }));
  };

  const handleImageChange = async (auctionId, files) => {
    const existing = inputs[auctionId]?.images || [];
    if (existing.length + files.length > 5) {
      alert('Maximum 5 photos par offre.');
      return;
    }
    setInput(auctionId, 'isUploading', true);
    try {
      const compressed = await Promise.all(files.map(f => compressImage(f)));
      setInputs(prev => ({
        ...prev,
        [auctionId]: {
          ...prev[auctionId],
          images: [...(prev[auctionId]?.images || []), ...compressed],
          isUploading: false,
        },
      }));
    } catch {
      setInput(auctionId, 'isUploading', false);
    }
  };

  const handleRemoveImage = (auctionId, index) => {
    setInputs(prev => ({
      ...prev,
      [auctionId]: {
        ...prev[auctionId],
        images: (prev[auctionId]?.images || []).filter((_, i) => i !== index),
      },
    }));
  };

  const handleSubmitBid = (e, auctionId) => {
    e.preventDefault();
    const inp = inputs[auctionId] || {};
    if (!inp.price || parseFloat(inp.price) <= 0) {
      alert('Veuillez entrer un prix valide.');
      return;
    }
    onPlaceBid({
      auctionId,
      price: parseFloat(inp.price),
      comments: inp.comments || '',
      images: inp.images || [],
    });
    setInputs(prev => ({
      ...prev,
      [auctionId]: { price: '', comments: '', images: [], isUploading: false },
    }));
  };

  // Stats
  const activeBidsCount = auctions.filter(a =>
    a.status === 'open' && a.myBidId !== null
  ).length;

  const wonAuctionsCount = auctions.filter(a =>
    a.status === 'closed' && a.myBidId && a.acceptedBidId === a.myBidId
  ).length;

  return (
    <div className="dashboard-grid has-sidebar">

      {/* Sidebar: Producer Stats */}
      <div className="glass-panel animate-fade-in" style={{ height: 'fit-content' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <div style={{ padding: '10px', borderRadius: '50%', background: 'var(--primary-glow)', color: 'var(--primary)' }}>
            <Tractor size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.25rem' }}>Espace Producteur</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Vos activités</p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>
              Offres en cours
            </div>
            <div style={{ fontSize: '2rem', fontWeight: '800', marginTop: '4px', color: 'var(--secondary)' }}>
              {activeBidsCount}
            </div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>
              Enchères remportées
            </div>
            <div style={{ fontSize: '2rem', fontWeight: '800', marginTop: '4px', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {wonAuctionsCount}
              {wonAuctionsCount > 0 && <Trophy size={24} style={{ color: 'var(--accent)' }} />}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div>
        <h2 style={{ fontSize: '1.75rem', marginBottom: '24px' }}>Demandes Disponibles</h2>

        {auctions.length === 0 ? (
          <div className="glass-panel empty-state">
            <Inbox className="empty-icon" size={48} />
            <div>
              <h4 style={{ fontSize: '1.25rem', marginBottom: '6px', color: 'var(--text-main)' }}>Aucune enchère en cours</h4>
              <p>Dès qu'un acheteur publiera un besoin à proximité, il apparaîtra ici en temps réel.</p>
            </div>
          </div>
        ) : (
          [...auctions]
            .sort((a, b) => {
              if (a.status === 'open' && b.status !== 'open') return -1;
              if (a.status !== 'open' && b.status === 'open') return 1;
              return new Date(b.createdAt) - new Date(a.createdAt);
            })
            .map(auction => {
              const myBid = auction.bids.find(b => b.producerAlias === 'Vous');
              const isClosed = auction.status === 'closed';
              const isWinner = isClosed && auction.myBidId && auction.acceptedBidId === auction.myBidId;
              const winningBid = isClosed ? auction.bids.find(b => b.id === auction.acceptedBidId) : null;
              const inp = inputs[auction.id] || { price: '', comments: '', images: [], isUploading: false };

              return (
                <div
                  key={auction.id}
                  className="auction-card animate-fade-in"
                  style={{
                    borderLeft: isWinner
                      ? '4px solid var(--primary)'
                      : myBid ? '4px solid var(--secondary)' : '1px solid var(--border)',
                  }}
                >
                  <div className="auction-header">
                    <div>
                      <h3 className="auction-title">
                        {auction.product} — {auction.quantity} {auction.unit}
                      </h3>
                      {/* Buyer is always shown anonymously */}
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        Demande anonyme &bull; Publié à {new Date(auction.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                    <span className={`badge ${isClosed ? 'badge-closed' : 'badge-open'}`}>
                      {isClosed ? 'Validée' : 'En cours'}
                    </span>
                  </div>

                  {auction.description && (
                    <p style={{ background: 'rgba(255,255,255,0.01)', padding: '10px 14px', borderRadius: '8px', fontSize: '0.9rem', marginBottom: '16px', borderLeft: '3px solid rgba(255,255,255,0.1)' }}>
                      <strong>Spécifications :</strong> {auction.description}
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
                      <span>Total Offres : <span className="detail-highlight">{auction.bids.length}</span></span>
                    </div>
                  </div>

                  {/* Bid submission form */}
                  {!isClosed ? (
                    <form
                      onSubmit={(e) => handleSubmitBid(e, auction.id)}
                      style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border)', marginBottom: '16px', marginTop: '16px' }}
                    >
                      <h4 style={{ fontSize: '0.9rem', fontWeight: '700', marginBottom: '12px', color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                        Faire une offre
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr auto', gap: '12px', alignItems: 'end', marginBottom: '12px' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label style={{ fontSize: '0.75rem' }}>Prix (DA / {auction.unit}) *</label>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="Prix"
                            value={inp.price}
                            onChange={(e) => setInput(auction.id, 'price', e.target.value)}
                            required
                          />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label style={{ fontSize: '0.75rem' }}>Commentaire (qualité, dispo, délai…)</label>
                          <input
                            type="text"
                            placeholder="Ex: Récolté ce matin, Bio, Livraison J+1..."
                            value={inp.comments}
                            onChange={(e) => setInput(auction.id, 'comments', e.target.value)}
                          />
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ height: '45px', padding: '0 16px' }} disabled={inp.isUploading}>
                          <Send size={16} /> Proposer
                        </button>
                      </div>

                      {/* Photo upload for bid */}
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '0.75rem', marginBottom: '6px', display: 'block' }}>
                          Photos du produit <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optionnel, max 5)</span>
                        </label>
                        <div
                          className="image-upload-zone"
                          onClick={() => !inp.isUploading && document.getElementById(`photo-input-${auction.id}`)?.click()}
                          style={{ padding: '10px', cursor: inp.isUploading ? 'not-allowed' : 'pointer' }}
                        >
                          <ImageIcon size={18} style={{ color: 'var(--text-muted)' }} />
                          <span style={{ fontSize: '0.78rem' }}>
                            {inp.isUploading ? 'Traitement...' : 'Cliquer pour ajouter des photos'}
                          </span>
                          <input
                            id={`photo-input-${auction.id}`}
                            type="file"
                            multiple
                            accept="image/*"
                            style={{ display: 'none' }}
                            disabled={inp.isUploading}
                            onChange={async (e) => {
                              const files = Array.from(e.target.files);
                              if (files.length > 0) await handleImageChange(auction.id, files);
                              e.target.value = '';
                            }}
                          />
                        </div>

                        {inp.images && inp.images.length > 0 && (
                          <div className="image-previews-grid" style={{ marginTop: '8px' }}>
                            {inp.images.map((img, idx) => (
                              <div key={idx} className="image-preview-wrapper">
                                <img src={img} alt="Aperçu" />
                                <button
                                  type="button"
                                  onClick={() => handleRemoveImage(auction.id, idx)}
                                  className="image-preview-remove"
                                  title="Supprimer"
                                  aria-label="Supprimer la photo"
                                >
                                  <X size={10} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </form>
                  ) : (
                    <div style={{
                      background: isWinner ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.02)',
                      padding: '12px 16px', borderRadius: '8px',
                      border: isWinner ? '1px solid var(--primary)' : '1px solid var(--border)',
                      marginBottom: '16px', marginTop: '16px',
                      display: 'flex', alignItems: 'center', gap: '12px',
                    }}>
                      {isWinner ? (
                        <>
                          <Trophy style={{ color: 'var(--accent)' }} size={20} />
                          <div>
                            <strong className="text-success">Félicitations !</strong> Votre offre de <strong>{myBid?.price} DA/{auction.unit}</strong> a été validée par l'acheteur.
                          </div>
                        </>
                      ) : (
                        <>
                          <Check size={20} style={{ color: 'var(--text-muted)' }} />
                          <div>
                            L'enchère est clôturée. Une offre a été retenue à <strong>{winningBid?.price} DA/{auction.unit}</strong>.
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Bids history — competitors are anonymous */}
                  <div className="bids-container">
                    <h5 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: '700', textTransform: 'uppercase' }}>
                      Historique des offres ({auction.bids.length})
                    </h5>
                    {auction.bids.length === 0 ? (
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        Aucune offre pour le moment. Soyez le premier à proposer !
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {[...auction.bids]
                          .sort((a, b) => a.price - b.price)
                          .map(bid => {
                            const isMe = bid.producerAlias === 'Vous';
                            const isSelected = auction.acceptedBidId === bid.id;
                            const isNew = newBidFlashIds.includes(bid.id);

                            return (
                              <div
                                key={bid.id}
                                className={`bid-item ${isSelected ? 'accepted' : ''} ${isNew ? 'bid-flash-new' : ''}`}
                                style={{
                                  padding: '8px 12px',
                                  fontSize: '0.85rem',
                                  background: isMe ? 'rgba(59,130,246,0.04)' : 'rgba(255,255,255,0.01)',
                                  borderColor: isMe ? 'rgba(59,130,246,0.25)' : 'var(--border)',
                                }}
                              >
                                <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontWeight: 600, color: isMe ? 'var(--secondary)' : 'var(--text-main)' }}>
                                      {bid.producerAlias}
                                    </span>
                                    {isSelected && (
                                      <span className="badge badge-open" style={{ fontSize: '0.6rem', padding: '1px 4px', background: 'var(--primary)', color: 'var(--text-inverse)', border: 'none' }}>
                                        Gagnant
                                      </span>
                                    )}
                                  </div>
                                  {bid.comments && (
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                      <MessageSquare size={10} /> {bid.comments}
                                    </span>
                                  )}
                                  {/* Thumbnail previews of bid photos in history */}
                                  {bid.images && bid.images.length > 0 && (
                                    <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
                                      {bid.images.map((img, idx) => (
                                        <div
                                          key={idx}
                                          className="bid-photo-thumb"
                                          style={{ width: '36px', height: '36px' }}
                                          onClick={() => setActiveZoomImage(img)}
                                          role="button"
                                          tabIndex={0}
                                          onKeyDown={e => e.key === 'Enter' && setActiveZoomImage(img)}
                                          aria-label={`Photo ${idx + 1}`}
                                        >
                                          <img src={img} alt={`Photo ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }} />
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <div style={{ fontWeight: '800', color: 'var(--accent)', fontSize: '0.95rem', flexShrink: 0 }}>
                                  {bid.price} DA/{auction.unit}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
        )}
      </div>

      {/* Lightbox */}
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
