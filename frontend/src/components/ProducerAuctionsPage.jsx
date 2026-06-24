import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from '../context/LanguageContext';
import { Inbox, MessageSquare, Check, Trophy, X, Image as ImageIcon, Send, Star } from 'lucide-react';

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

const emptyLine = () => ({ quality: '', price: '', quantity: '', unit: '', comments: '', images: [], isUploading: false });

export default function ProducerAuctionsPage({ user, auctions, onPlaceBid, newBidFlashIds, highlightAuctionId, token }) {
  const { locale, t } = useTranslation();
  
  const [inputs, setInputs] = useState({});
  const [activeZoomImage, setActiveZoomImage] = useState(null);
  const auctionRefs = useRef({});

  useEffect(() => {
    if (highlightAuctionId) {
      setTimeout(() => {
        const el = auctionRefs.current[highlightAuctionId];
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  }, [highlightAuctionId]);

  const getLines = (auctionId) => inputs[auctionId]?.lines || [emptyLine()];
  const setLine = (auctionId, lineIdx, field, value) => {
    setInputs(prev => {
      const lines = [...(prev[auctionId]?.lines || [emptyLine()])];
      lines[lineIdx] = { ...lines[lineIdx], [field]: value };
      return { ...prev, [auctionId]: { lines } };
    });
  };
  const addLine = (auctionId) => setInputs(prev => { const lines = [...(prev[auctionId]?.lines || [emptyLine()]), emptyLine()]; return { ...prev, [auctionId]: { lines } }; });
  const removeLine = (auctionId, lineIdx) => setInputs(prev => { const lines = (prev[auctionId]?.lines || [emptyLine()]).filter((_, i) => i !== lineIdx); return { ...prev, [auctionId]: { lines: lines.length > 0 ? lines : [emptyLine()] } }; });

  const handleImageChange = async (auctionId, lineIdx, files) => {
    const existing = getLines(auctionId)[lineIdx]?.images || [];
    if (existing.length + files.length > 5) { alert(locale === 'ar' ? 'يمكنك إضافة 5 صور كحد أقصى لكل خيار.' : 'Maximum 5 photos par option.'); return; }
    setLine(auctionId, lineIdx, 'isUploading', true);
    try {
      const compressed = await Promise.all(files.map(f => compressImage(f)));
      setInputs(prev => {
        const lines = [...(prev[auctionId]?.lines || [emptyLine()])];
        lines[lineIdx] = { ...lines[lineIdx], images: [...(lines[lineIdx]?.images || []), ...compressed], isUploading: false };
        return { ...prev, [auctionId]: { lines } };
      });
    } catch { setLine(auctionId, lineIdx, 'isUploading', false); }
  };
  const handleRemoveImage = (auctionId, lineIdx, imgIdx) => setInputs(prev => {
    const lines = [...(prev[auctionId]?.lines || [emptyLine()])];
    lines[lineIdx] = { ...lines[lineIdx], images: (lines[lineIdx]?.images || []).filter((_, i) => i !== imgIdx) };
    return { ...prev, [auctionId]: { lines } };
  });

  const handleSubmitBid = (e, auctionId) => {
    e.preventDefault();
    const lines = getLines(auctionId);
    const validLines = lines.filter(l => l.price && parseFloat(l.price) > 0);
    if (validLines.length === 0) { alert(t('enterValidPrice')); return; }
    const auction = auctions.find(a => a.id === auctionId);
    onPlaceBid({
      auctionId,
      lines: validLines.map(line => ({
        price: parseFloat(line.price), quantity: line.quantity ? parseFloat(line.quantity) : null,
        optionName: (line.quality || '').trim(), unit: line.unit || auction?.unit || 'tonnes',
        comments: (line.comments || '').trim(), images: line.images || [],
      }))
    });
    setInputs(prev => ({ ...prev, [auctionId]: { lines: [emptyLine()] } }));
  };

  return (
    <div style={{ flex: 1, padding: '32px 40px', overflowY: 'auto', textAlign: 'start' }}>
      
      {activeZoomImage && (
        <div className="lightbox-modal" onClick={() => setActiveZoomImage(null)}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button className="lightbox-close" onClick={() => setActiveZoomImage(null)}><X size={20} /></button>
            <img src={activeZoomImage} alt={t('zoomProduct')} />
          </div>
        </div>
      )}

      <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: 8 }}>{t('availablePublicDemands')}</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: 28, fontSize: '0.85rem' }}>
        {locale === 'ar' ? 'تصفح عروض الشراء القريبة وقدم مقترحات الأسعار الخاصة بك.' : "Consultez les appels d'offres à proximité et soumettez vos offres."}
      </p>

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
            const myBid = auction.bids.find(b => b.producerAlias === 'Vous');
            const isClosed = auction.status === 'closed';
            const isWinner = isClosed && auction.myBidId && auction.acceptedBidId === auction.myBidId;
            const winningBid = isClosed ? auction.bids.find(b => b.id === auction.acceptedBidId) : null;
            const winningLine = isClosed && isWinner ? myBid?.lines?.find(l => l.id === auction.acceptedLineId) : null;
            const winningLineCompetitor = isClosed && winningBid ? winningBid?.lines?.find(l => l.id === auction.acceptedLineId) : null;
            const lines = getLines(auction.id);
            const isHighlighted = highlightAuctionId === auction.id;

            return (
              <div key={auction.id} ref={el => auctionRefs.current[auction.id] = el}
                className={`auction-card animate-fade-in ${isHighlighted ? 'auction-card-highlighted' : ''}`}
                style={{ borderLeft: isWinner ? '4px solid var(--primary)' : myBid ? '4px solid var(--secondary)' : '1px solid var(--border)', marginBottom: 20 }}>
                
                <div className="auction-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 className="auction-title" style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{auction.product} — {auction.quantity} {t('unit_' + auction.unit)}</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>{t('anonymousDemand', { time: new Date(auction.createdAt).toLocaleTimeString() })}</p>
                  </div>
                  <span className={`badge ${isClosed ? 'badge-closed' : 'badge-open'}`}>{isClosed ? t('statusClosed') : t('statusOpen')}</span>
                </div>

                {auction.description && (
                  <p style={{ background: 'rgba(255,255,255,0.01)', padding: '10px 14px', borderRadius: '8px', fontSize: '0.9rem', margin: '12px 0', borderLeft: locale === 'fr' ? '3px solid rgba(255,255,255,0.1)' : 'none', borderRight: locale === 'ar' ? '3px solid rgba(255,255,255,0.1)' : 'none' }}>
                    <strong>{locale === 'fr' ? 'Spécifications :' : (locale === 'ar' ? 'المواصفات :' : 'Specifications:')}</strong> {auction.description}
                  </p>
                )}

                <div className="auction-details" style={{ display: 'flex', gap: 14, fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                  <span>Lieu de livraison: <strong>{auction.deliveryLocation || '—'}</strong></span>
                  <span>|</span>
                  <span>Offres reçues: <strong style={{ color: 'var(--primary)' }}>{auction.bids.length}</strong></span>
                </div>

                {/* Form to submit bid */}
                {!isClosed ? (
                  <>
                    {myBid && auction.myRank !== null && auction.myRank !== undefined && (
                      <div style={{ background: 'rgba(34, 163, 98, 0.08)', border: '1px solid rgba(34, 163, 98, 0.25)', color: 'var(--secondary)', padding: '10px 14px', borderRadius: '8px', fontSize: '0.88rem', fontWeight: 'bold', marginBottom: '16px', display: 'inline-flex', alignItems: 'center', gap: '8px', width: '100%', boxSizing: 'border-box' }}>
                        <Trophy size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                        <span>{locale === 'ar' ? `ترتيبك: ${auction.myRank} من ${auction.totalBidders}` : `Votre classement : ${auction.myRank === 1 ? '1er' : `${auction.myRank}e`} sur ${auction.totalBidders}`}</span>
                      </div>
                    )}
                    <form onSubmit={(e) => handleSubmitBid(e, auction.id)} style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border)', marginBottom: '16px', marginTop: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <h4 style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{t('makeOfferTitle')}</h4>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: 'var(--primary-soft)', padding: '2px 8px', borderRadius: '999px' }}>{lines.length} {lines.length > 1 ? 'options' : 'option'}</span>
                      </div>
                      
                      {lines.length === 1 && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '12px', padding: '8px 12px', background: 'rgba(244,160,28,0.07)', border: '1px solid rgba(244,160,28,0.2)', borderRadius: '8px' }}>{t('proposeMultipleOptionsTip')}</div>
                      )}

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        {lines.map((line, lineIdx) => (
                          <div key={lineIdx} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px', position: 'relative' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('lineLabel', { number: lineIdx + 1 })}</span>
                              {lines.length > 1 && (
                                <button type="button" onClick={() => removeLine(auction.id, lineIdx)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.75rem', padding: '2px 6px' }}>
                                  <X size={12} /> {t('delete')}
                                </button>
                              )}
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <label style={{ fontSize: '0.72rem', textAlign: 'start' }}>{t('optionVariety')}</label>
                                <input type="text" placeholder={t('optionVarietyPlaceholder')} value={line.quality} onChange={e => setLine(auction.id, lineIdx, 'quality', e.target.value)} style={{ textAlign: 'start', fontSize: '0.85rem', padding: '8px 10px' }} />
                              </div>
                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <label style={{ fontSize: '0.72rem', textAlign: 'start' }}>{t('lineQuantity')}</label>
                                <input type="number" step="any" placeholder={t('lineQuantityPlaceholder')} value={line.quantity} onChange={e => setLine(auction.id, lineIdx, 'quantity', e.target.value)} style={{ textAlign: 'start', fontSize: '0.85rem', padding: '8px 10px' }} />
                              </div>
                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <label style={{ fontSize: '0.72rem', textAlign: 'start' }}>{t('priceDAOnly')}</label>
                                <input type="number" step="0.01" placeholder={t('pricePlaceholder')} value={line.price} onChange={e => setLine(auction.id, lineIdx, 'price', e.target.value)} required={lineIdx === 0} style={{ textAlign: 'start', fontSize: '0.85rem', padding: '8px 10px' }} />
                              </div>
                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <label style={{ fontSize: '0.72rem', textAlign: 'start' }}>{t('unitLabel')}</label>
                                <select value={line.unit || auction.unit} onChange={e => setLine(auction.id, lineIdx, 'unit', e.target.value)} style={{ textAlign: 'start', fontSize: '0.85rem', padding: '8px 10px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-main)', width: '100%', height: '38px', cursor: 'pointer' }}>
                                  <option value="tonnes">{t('unit_tonnes')}</option>
                                  <option value="kg">{t('unit_kg')}</option>
                                  <option value="cagettes">{t('unit_cagettes')}</option>
                                  <option value="palettes">{t('unit_palettes')}</option>
                                  <option value="sacs">{t('unit_sacs')}</option>
                                </select>
                              </div>
                            </div>

                            <div className="form-group" style={{ marginBottom: '10px' }}>
                              <label style={{ fontSize: '0.72rem' }}>{t('commentLabel')}</label>
                              <input type="text" placeholder={t('commentPlaceholder')} value={line.comments} onChange={e => setLine(auction.id, lineIdx, 'comments', e.target.value)} style={{ fontSize: '0.85rem', padding: '8px 10px' }} />
                            </div>

                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <div className="image-upload-zone" style={{ padding: '8px', cursor: line.isUploading ? 'not-allowed' : 'pointer', fontSize: '0.75rem' }} onClick={() => !line.isUploading && document.getElementById(`photo-${auction.id}-${lineIdx}`)?.click()}>
                                <ImageIcon size={15} style={{ color: 'var(--text-muted)' }} />
                                <span>{line.isUploading ? t('photosUploading') : t('photosOptionalMax')}</span>
                                <input id={`photo-${auction.id}-${lineIdx}`} type="file" multiple accept="image/*" style={{ display: 'none' }} disabled={line.isUploading} onChange={async e => { const files = Array.from(e.target.files); if (files.length > 0) await handleImageChange(auction.id, lineIdx, files); e.target.value = ''; }} />
                              </div>
                              {line.images && line.images.length > 0 && (
                                <div className="image-previews-grid" style={{ marginTop: '8px' }}>
                                  {line.images.map((img, idx) => (
                                    <div key={idx} className="image-preview-wrapper">
                                      <img src={img} alt={t('preview')} />
                                      <button type="button" onClick={() => handleRemoveImage(auction.id, lineIdx, idx)} className="image-preview-remove" title={t('delete')}><X size={10} /></button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div style={{ display: 'flex', gap: '10px', marginTop: '14px', alignItems: 'center' }}>
                        <button type="button" onClick={() => addLine(auction.id)} className="btn btn-secondary" style={{ fontSize: '0.82rem', padding: '8px 14px', gap: '5px' }} disabled={lines.length >= 5}>
                          + {t('addOptionBtn')}
                        </button>
                        <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={lines.some(l => l.isUploading)}>
                          <Send size={15} /> {lines.length > 1 ? t('submitMultipleBidsBtn', { count: lines.filter(l => l.price && parseFloat(l.price) > 0).length }) : t('submitBidBtn')}
                        </button>
                      </div>
                    </form>
                  </>
                ) : (
                  <div style={{ background: isWinner ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.02)', padding: '12px 16px', borderRadius: '8px', border: isWinner ? '1px solid var(--primary)' : '1px solid var(--border)', marginBottom: '16px', marginTop: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {isWinner ? (
                      <>
                        <Trophy style={{ color: 'var(--accent)' }} size={20} />
                        <div>{winningLine?.optionName ? t('bidWinnerCongratsOption', { option: winningLine.optionName, price: winningLine.price, unit: t('unit_' + (winningLine.unit || auction.unit)) }) : t('bidWinnerCongrats', { price: winningLine?.price, unit: t('unit_' + (winningLine?.unit || auction.unit)) })}</div>
                      </>
                    ) : (
                      <>
                        <Check size={20} style={{ color: 'var(--text-muted)' }} />
                        <div>
                          {winningLineCompetitor?.price || (winningBid && !winningLineCompetitor?.optionName) ? (
                            winningLineCompetitor?.optionName ? t('bidClosedWinnerOption', { name: winningBid?.producerAlias, option: winningLineCompetitor.optionName, price: winningLineCompetitor.price, unit: t('unit_' + (winningLineCompetitor.unit || auction.unit)) }) : t('bidClosedWinner', { name: winningBid?.producerAlias, price: winningLineCompetitor?.price || winningBid?.price, unit: t('unit_' + (winningLineCompetitor?.unit || winningBid?.unit || auction.unit)) })
                          ) : (
                            winningLineCompetitor?.optionName ? (locale === 'ar' ? `تم إغلاق المناقصة. تم قبول عرض ${winningBid?.producerAlias} للخيار "${winningLineCompetitor.optionName}".` : `L'enchère est clôturée. L'offre de ${winningBid?.producerAlias} pour l'option "${winningLineCompetitor.optionName}" a été acceptée.`) : (locale === 'ar' ? `تم إغلاق المناقصة. تم قبول عرض ${winningBid?.producerAlias || 'المنافس'}.` : `L'enchère est clôturée. L'offre de ${winningBid?.producerAlias || 'concurrent'} a été acceptée.`)
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Offer History */}
                <div className="bids-container">
                  <h5 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: '700', textTransform: 'uppercase', textAlign: 'start' }}>
                    {locale === 'fr' ? 'Historique des offres' : 'سجل العروض'} ({auction.bids.length})
                  </h5>
                  {auction.bids.length === 0 ? (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'start' }}>{t('noOfferYet')}</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {[...auction.bids].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)).map(bid => {
                        const isMe = bid.producerAlias === 'Vous';
                        const isNew = newBidFlashIds.includes(bid.id);
                        const isSelected = auction.acceptedBidId === bid.id;
                        return (
                          <div key={bid.id} className={`bid-item ${isNew ? 'bid-flash-new' : ''}`} style={{ padding: '12px 14px', fontSize: '0.85rem', background: isMe ? 'rgba(34, 163, 98, 0.04)' : 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border)', borderColor: isMe ? 'rgba(34, 163, 98, 0.25)' : 'var(--border)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.04)', paddingBottom: '6px' }}>
                              <span style={{ fontWeight: 600, color: isMe ? 'var(--secondary)' : 'var(--text-main)' }}>{bid.producerAlias}</span>
                              {isSelected && <span className="badge badge-open" style={{ fontSize: '0.6rem', padding: '1px 6px', background: 'var(--primary)', color: 'var(--text-inverse)', border: 'none' }}>{t('winnerLabel')}</span>}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {(bid.lines || []).map(line => {
                                const isThisLineAccepted = auction.acceptedBidId === bid.id && auction.acceptedLineId === line.id;
                                return (
                                  <div key={line.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: isThisLineAccepted ? 'rgba(34, 163, 98, 0.08)' : 'transparent', border: isThisLineAccepted ? '1px solid var(--primary)' : '1px dotted var(--border)', borderRadius: '6px' }}>
                                    <div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        {line.optionName && <span style={{ fontSize: '0.75rem', fontWeight: 'bold', background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: '4px' }}>{line.optionName}</span>}
                                        <span style={{ fontWeight: '800', color: 'var(--secondary)', fontSize: '0.85rem' }}>
                                          {line.price !== null && line.price !== undefined ? `${line.price} DA/${t('unit_' + (line.unit || auction.unit))}` : `— DA/${t('unit_' + (line.unit || auction.unit))} (${locale === 'ar' ? 'مخفي' : 'Masqué'})`}
                                        </span>
                                      </div>
                                      {line.comments && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}><MessageSquare size={10} /> {line.comments}</div>}
                                    </div>
                                    {line.images?.length > 0 && (
                                      <div style={{ display: 'flex', gap: '3px' }}>
                                        {line.images.map((img, idx) => (
                                          <div key={idx} className="bid-photo-thumb" style={{ width: '28px', height: '28px', borderRadius: '4px' }} onClick={() => setActiveZoomImage(img)} role="button" tabIndex={0}>
                                            <img src={img} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
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
  );
}
