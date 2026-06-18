import React, { useState } from 'react';
import { Send, Tag, MessageSquare, Check, User, Tractor, Inbox, Trophy, X } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';

export default function ProducerDashboard({ user, auctions, onPlaceBid, newBidFlashIds }) {
  const { t, dir, locale } = useTranslation();
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
      alert(t('enterValidPrice'));
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
    <div className="dashboard-grid has-sidebar" style={{ direction: dir }}>
      {/* Sidebar: Producer Stats & Info */}
      <div className="glass-panel animate-fade-in" style={{ height: 'fit-content', textAlign: 'start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}>
          <div style={{ padding: '10px', borderRadius: '50%', background: 'var(--primary-glow)', color: 'var(--primary)' }}>
            <Tractor size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.25rem' }}>{t('producerSpace')}</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{user.name}</p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>
              {t('activeBidsProducer')}
            </div>
            <div style={{ fontSize: '2rem', fontWeight: '800', marginTop: '4px', color: 'var(--secondary)' }}>
              {activeBidsCount}
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>
              {t('wonAuctions')}
            </div>
            <div style={{ fontSize: '2rem', fontWeight: '800', marginTop: '4px', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px', flexDirection: dir === 'rtl' ? 'row-reverse' : 'row', justifyContent: 'flex-start' }}>
              <span>{wonAuctionsCount}</span>
              {wonAuctionsCount > 0 && <Trophy size={24} style={{ color: 'var(--accent)' }} />}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content: List of active buyer auctions */}
      <div style={{ textAlign: 'start' }}>
        <h2 style={{ fontSize: '1.75rem', marginBottom: '24px' }}>{t('availablePublicDemands')}</h2>

        {auctions.length === 0 ? (
          <div className="glass-panel empty-state">
            <Inbox className="empty-icon" size={48} />
            <div>
              <h4 style={{ fontSize: '1.25rem', marginBottom: '6px', color: 'var(--text-main)' }}>{t('noAuctionInCurrent')}</h4>
              <p>{t('noAuctionInCurrentSub')}</p>
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
                  borderLeft: dir === 'ltr' ? (isWinner ? '4px solid var(--primary)' : (myBidOnThis ? '4px solid var(--secondary)' : '1px solid var(--border)')) : '1px solid var(--border)',
                  borderRight: dir === 'rtl' ? (isWinner ? '4px solid var(--primary)' : (myBidOnThis ? '4px solid var(--secondary)' : '1px solid var(--border)')) : '1px solid var(--border)',
                  textAlign: 'start'
                }}>
                  <div className="auction-header" style={{ flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}>
                    <div>
                      <h3 className="auction-title">
                        {auction.product} - {auction.quantity} {t('unit_' + auction.unit)}
                      </h3>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px', flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}>
                        <User size={14} /> 
                        <span>
                          {t('buyerLabelText', { name: auction.buyerName })}
                          {' '}&bull;{' '}
                          {t('publishedAt', { time: new Date(auction.createdAt).toLocaleTimeString() })}
                        </span>
                      </p>
                    </div>
                    <div>
                      <span className={`badge ${isClosed ? 'badge-closed' : 'badge-open'}`}>
                        {isClosed ? t('statusClosed') : t('statusOpen')}
                      </span>
                    </div>
                  </div>

                  {auction.description && (
                    <p style={{
                      background: 'rgba(255,255,255,0.01)',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      fontSize: '0.9rem',
                      marginBottom: '16px',
                      borderLeft: dir === 'ltr' ? '3px solid rgba(255,255,255,0.1)' : 'none',
                      borderRight: dir === 'rtl' ? '3px solid rgba(255,255,255,0.1)' : 'none',
                    }}>
                      <strong>{locale === 'fr' ? 'Spécifications :' : (locale === 'ar' ? 'المواصفات :' : 'Specifications:')}</strong> {auction.description}
                    </p>
                  )}

                  {/* Photo gallery display for producer */}
                  {auction.images && auction.images.length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ fontSize: '0.75rem', display: 'block', marginBottom: '6px' }}>{t('photosAttached')}</label>
                      <div className="auction-gallery" style={{ flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}>
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

                  <div className="auction-details" style={{ flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}>
                    {auction.targetPrice && (
                      <div className="detail-item" style={{ flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}>
                        <Tag size={16} />
                        <span>{t('targetBudget', { price: auction.targetPrice, unit: t('unit_' + auction.unit) })}</span>
                      </div>
                    )}
                    <div className="detail-item">
                      <span>{locale === 'fr' ? 'Total Offres :' : (locale === 'ar' ? 'إجمالي العروض :' : 'Total Bids:')} <span className="detail-highlight">{auction.bids.length}</span></span>
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
                      <h4 style={{ fontSize: '0.9rem', fontWeight: '700', marginBottom: '10px', color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.03em', textAlign: 'start' }}>
                        {t('makeOfferTitle')}
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr auto', gap: '12px', alignItems: 'end' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label style={{ fontSize: '0.75rem', textAlign: 'start' }}>{t('priceLabel', { unit: t('unit_' + auction.unit) })}</label>
                          <input
                            type="number"
                            step="0.01"
                            placeholder={t('pricePlaceholder')}
                            value={auctionInput.price}
                            onChange={(e) => handleInputChange(auction.id, 'price', e.target.value)}
                            required
                            style={{ textAlign: 'start' }}
                          />
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label style={{ fontSize: '0.75rem', textAlign: 'start' }}>{t('commentLabel')}</label>
                          <input
                            type="text"
                            placeholder={t('commentPlaceholder')}
                            value={auctionInput.comments}
                            onChange={(e) => handleInputChange(auction.id, 'comments', e.target.value)}
                            style={{ textAlign: 'start' }}
                          />
                        </div>

                        <button type="submit" className="btn btn-primary" style={{ height: '45px', padding: '0 16px', flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}>
                          <Send size={16} />
                          {t('submitBidBtn')}
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
                      gap: '12px',
                      flexDirection: dir === 'rtl' ? 'row-reverse' : 'row',
                      textAlign: 'start'
                    }}>
                      {isWinner ? (
                        <>
                          <Trophy style={{ color: 'var(--accent)' }} size={20} />
                          <div>
                            {t('bidWinnerCongrats', { price: winningBid.price, unit: t('unit_' + auction.unit) })}
                          </div>
                        </>
                      ) : (
                        <>
                          <Check size={20} style={{ color: 'var(--text-muted)' }} />
                          <div>
                            {t('bidClosedWinner', { name: winningBid?.producerName, price: winningBid?.price, unit: t('unit_' + auction.unit) })}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* List of existing bids for transparency */}
                  <div className="bids-container">
                    <h5 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: '700', textTransform: 'uppercase', textAlign: 'start' }}>
                      {t('historyOffers', { count: auction.bids.length })}
                    </h5>
                    
                    {auction.bids.length === 0 ? (
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'start' }}>
                        {t('noOfferYet')}
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
                                  borderColor: isMyBid ? 'rgba(59, 130, 246, 0.25)' : 'var(--border)',
                                  flexDirection: dir === 'rtl' ? 'row-reverse' : 'row'
                                }}
                              >
                                <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'start' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}>
                                    <span style={{ fontWeight: 600, color: isMyBid ? 'var(--secondary)' : 'var(--text-main)' }}>
                                      {bid.producerName} {isMyBid && t('youLabel')}
                                    </span>
                                    {isSelected && (
                                      <span className="badge badge-open" style={{ fontSize: '0.6rem', padding: '1px 4px', background: 'var(--primary)', color: 'var(--text-inverse)', border: 'none' }}>
                                        {t('winnerLabel')}
                                      </span>
                                    )}
                                  </div>
                                  {bid.comments && (
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px', flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}>
                                      <MessageSquare size={10} />
                                      {bid.comments}
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontWeight: '800', color: 'var(--accent)', fontSize: '0.95rem', direction: 'ltr' }}>
                                  {bid.price} DA/{t('unit_' + auction.unit)}
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
            <button className="lightbox-close" onClick={() => setActiveZoomImage(null)} style={{ right: dir === 'ltr' ? 0 : 'auto', left: dir === 'rtl' ? 0 : 'auto' }}>
              <X size={20} />
            </button>
            <img src={activeZoomImage} alt="Zoom produit" />
          </div>
        </div>
      )}
    </div>
  );
}
