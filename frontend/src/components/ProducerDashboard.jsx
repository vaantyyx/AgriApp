import React, { useState } from 'react';
import { Send, Tag, MessageSquare, Check, User, Tractor, Inbox, Trophy, X } from 'lucide-react';

export default function ProducerDashboard({ user, auctions, onPlaceBid, newBidFlashIds }) {
  const [inputs, setInputs] = useState({});
  const [activeZoomImage, setActiveZoomImage] = useState(null);

  const handleInputChange = (auctionId, field, value) => {
    setInputs(prev => ({
      ...prev,
      [auctionId]: {
        ...prev[auctionId],
        [field]: value
      }
    }));
  };

  const handleSubmitBid = (e, auctionId) => {
    e.preventDefault();
    const auctionInput = inputs[auctionId];
    if (!auctionInput || !auctionInput.price || parseFloat(auctionInput.price) <= 0) {
      alert('Veuillez entrer un prix valide.');
      return;
    }

    onPlaceBid({
      auctionId,
      producerName: user.name,
      price: parseFloat(auctionInput.price),
      comments: auctionInput.comments || ''
    });

    setInputs(prev => ({
      ...prev,
      [auctionId]: {
        price: '',
        comments: ''
      }
    }));
  };

  const activeBidsCount = auctions.filter(a => 
    a.status === 'open' && a.bids.some(b => b.producerName === user.name)
  ).length;

  const wonAuctionsCount = auctions.filter(a => 
    a.status === 'closed' && a.bids.some(b => b.id === a.acceptedBidId && b.producerName === user.name)
  ).length;

  return (
    <div className="dashboard-grid has-sidebar">
      {/* Sidebar: Producer Stats & Info */}
      <div className="glass-panel animate-fade-in" style={{ height: 'fit-content' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <div style={{ padding: '10px', borderRadius: '50%', background: 'var(--primary-glow)', color: 'var(--primary)' }}>
            <Tractor size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.25rem' }}>Espace Producteur</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{user.name}</p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>
              Enchères actives avec vos offres
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

      {/* Main Content: List of active buyer auctions */}
      <div>
        <h2 style={{ fontSize: '1.75rem', marginBottom: '24px' }}>Demandes Publiques Disponibles</h2>

        {auctions.length === 0 ? (
          <div className="glass-panel empty-state">
            <Inbox className="empty-icon" size={48} />
            <div>
              <h4 style={{ fontSize: '1.25rem', marginBottom: '6px', color: 'var(--text-main)' }}>Aucune enchère en cours</h4>
              <p>Dès qu'un acheteur publiera un besoin, il apparaîtra ici en temps réel pour que vous puissiez faire une offre.</p>
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
              const myBidOnThis = auction.bids.find(b => b.producerName === user.name);
              const auctionInput = inputs[auction.id] || { price: '', comments: '' };
              const isClosed = auction.status === 'closed';
              
              const winningBid = isClosed ? auction.bids.find(b => b.id === auction.acceptedBidId) : null;
              const isWinner = winningBid && winningBid.producerName === user.name;

              return (
                <div key={auction.id} className="auction-card animate-fade-in" style={{
                  borderLeft: isWinner ? '4px solid var(--primary)' : (myBidOnThis ? '4px solid var(--secondary)' : '1px solid var(--border)')
                }}>
                  <div className="auction-header">
                    <div>
                      <h3 className="auction-title">
                        {auction.product} - {auction.quantity} {auction.unit}
                      </h3>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <User size={14} /> Acheteur: <strong style={{ color: 'var(--text-main)' }}>{auction.buyerName}</strong> 
                        &bull; Publié à {new Date(auction.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                    <div>
                      <span className={`badge ${isClosed ? 'badge-closed' : 'badge-open'}`}>
                        {isClosed ? 'Validée' : 'En cours'}
                      </span>
                    </div>
                  </div>

                  {auction.description && (
                    <p style={{ background: 'rgba(255,255,255,0.01)', padding: '10px 14px', borderRadius: '8px', fontSize: '0.9rem', marginBottom: '16px', borderLeft: '3px solid rgba(255,255,255,0.1)' }}>
                      <strong>Spécifications :</strong> {auction.description}
                    </p>
                  )}

                  {/* Photo gallery display for producer */}
                  {auction.images && auction.images.length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ fontSize: '0.75rem', display: 'block', marginBottom: '6px' }}>Photos jointes :</label>
                      <div className="auction-gallery">
                        {auction.images.map((img, idx) => (
                          <div 
                            key={idx} 
                            className="gallery-thumb"
                            onClick={() => setActiveZoomImage(img)}
                          >
                            <img src={img} alt={`Produit ${idx + 1}`} />
                          </div>
                        ))}
                      </div>
                    </div>
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

                  {/* Form to submit bid if open */}
                  {!isClosed ? (
                    <form onSubmit={(e) => handleSubmitBid(e, auction.id)} style={{
                      background: 'rgba(255,255,255,0.02)',
                      padding: '16px',
                      borderRadius: '10px',
                      border: '1px solid var(--border)',
                      marginBottom: '16px',
                      marginTop: '16px'
                    }}>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: '700', marginBottom: '10px', color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                        Faire une offre
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr auto', gap: '12px', alignItems: 'end' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label style={{ fontSize: '0.75rem' }}>Prix (DA / {auction.unit}) *</label>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="Prix"
                            value={auctionInput.price}
                            onChange={(e) => handleInputChange(auction.id, 'price', e.target.value)}
                            required
                          />
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label style={{ fontSize: '0.75rem' }}>Commentaire (Dispo, délai, qualité...)</label>
                          <input
                            type="text"
                            placeholder="Ex: Récolté ce matin, Bio..."
                            value={auctionInput.comments}
                            onChange={(e) => handleInputChange(auction.id, 'comments', e.target.value)}
                          />
                        </div>

                        <button type="submit" className="btn btn-primary" style={{ height: '45px', padding: '0 16px' }}>
                          <Send size={16} />
                          Proposer
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div style={{
                      background: isWinner ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      border: isWinner ? '1px solid var(--primary)' : '1px solid var(--border)',
                      marginBottom: '16px',
                      marginTop: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}>
                      {isWinner ? (
                        <>
                          <Trophy style={{ color: 'var(--accent)' }} size={20} />
                          <div>
                            <strong className="text-success">Félicitations !</strong> Votre offre de <strong>{winningBid.price} DA/{auction.unit}</strong> a été validée par l'acheteur.
                          </div>
                        </>
                      ) : (
                        <>
                          <Check size={20} style={{ color: 'var(--text-muted)' }} />
                          <div>
                            L'enchère est clôturée. L'offre de <strong>{winningBid?.producerName}</strong> à <strong>{winningBid?.price} DA/{auction.unit}</strong> a été retenue.
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* List of existing bids for transparency */}
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
                            const isMyBid = bid.producerName === user.name;
                            const isSelected = auction.acceptedBidId === bid.id;
                            const isNew = newBidFlashIds.includes(bid.id);
                            
                            return (
                              <div
                                key={bid.id}
                                className={`bid-item ${isSelected ? 'accepted' : ''} ${isNew ? 'bid-flash-new' : ''}`}
                                style={{
                                  padding: '8px 12px',
                                  fontSize: '0.85rem',
                                  background: isMyBid ? 'rgba(59, 130, 246, 0.04)' : 'rgba(255,255,255,0.01)',
                                  borderColor: isMyBid ? 'rgba(59, 130, 246, 0.25)' : 'var(--border)'
                                }}
                              >
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontWeight: 600, color: isMyBid ? 'var(--secondary)' : 'var(--text-main)' }}>
                                      {bid.producerName} {isMyBid && '(Vous)'}
                                    </span>
                                    {isSelected && (
                                      <span className="badge badge-open" style={{ fontSize: '0.6rem', padding: '1px 4px', background: 'var(--primary)', color: 'var(--text-inverse)', border: 'none' }}>
                                        Gagnant
                                      </span>
                                    )}
                                  </div>
                                  {bid.comments && (
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                      <MessageSquare size={10} />
                                      {bid.comments}
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontWeight: '800', color: 'var(--accent)', fontSize: '0.95rem' }}>
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

      {/* Lightbox Modal overlay for producer */}
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
