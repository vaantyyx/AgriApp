import React, { useState } from 'react';
import { Plus, Tag, Calendar, MessageSquare, Check, Package, Image as ImageIcon, X } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';

export default function BuyerDashboard({ user, auctions, onCreateAuction, onAcceptBid, newBidFlashIds }) {
  const { t, dir, locale } = useTranslation();
  const [product, setProduct] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('tonnes');
  const [targetPrice, setTargetPrice] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [activeZoomImage, setActiveZoomImage] = useState(null);

  // Helper to compress and convert images to Base64
  const compressImage = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
          resolve(compressedBase64);
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleImageChange = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    if (images.length + files.length > 5) {
      alert(t('limitPhotosError'));
      return;
    }

    setIsUploading(true);
    try {
      const compressedPromises = files.map(file => compressImage(file));
      const newImages = await Promise.all(compressedPromises);
      setImages(prev => [...prev, ...newImages]);
    } catch (err) {
      console.error('Error uploading/compressing images:', err);
      alert(t('uploadPhotosError'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = (indexToRemove) => {
    setImages(prev => prev.filter((_, i) => i !== indexToRemove));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!product.trim() || !quantity || parseFloat(quantity) <= 0) {
      alert(t('formFieldsError'));
      return;
    }

    onCreateAuction({
      buyerName: user.name,
      product: product.trim(),
      quantity: parseFloat(quantity),
      unit,
      targetPrice: targetPrice ? parseFloat(targetPrice) : null,
      description: description.trim(),
      images: images 
    });

    // Reset form
    setProduct('');
    setQuantity('');
    setTargetPrice('');
    setDescription('');
    setImages([]);
  };

  const myAuctions = auctions.filter(a => a.buyerName === user.name);

  return (
    <div className="dashboard-grid has-sidebar" style={{ direction: dir }}>
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
            <label htmlFor="target-price">{t('budgetLabel')}</label>
            <input
              id="target-price"
              type="number"
              step="0.01"
              placeholder={t('budgetPlaceholder')}
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              style={{ textAlign: 'start' }}
            />
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

          {/* Photo upload field */}
          <div className="form-group">
            <label>{t('photosLabel')}</label>
            <div 
              className="image-upload-zone"
              onClick={() => document.getElementById('photo-upload-input').click()}
            >
              <ImageIcon size={24} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontSize: '0.85rem' }}>
                {isUploading ? t('photosUploading') : t('photosUploadZone')}
              </span>
              <input
                id="photo-upload-input"
                type="file"
                multiple
                accept="image/*"
                onChange={handleImageChange}
                style={{ display: 'none' }}
                disabled={isUploading}
              />
            </div>

            {/* Display local previews */}
            {images.length > 0 && (
              <div className="image-previews-grid">
                {images.map((img, index) => (
                  <div key={index} className="image-preview-wrapper">
                    <img src={img} alt="Aperçu" />
                    <button 
                      type="button" 
                      onClick={() => handleRemoveImage(index)}
                      className="image-preview-remove"
                      title={locale === 'fr' ? 'Supprimer' : 'حذف'}
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }} disabled={isUploading}>
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
                    {auction.product} - {auction.quantity} {t('unit_' + auction.unit)}
                  </h3>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {t('publishedAt', { time: new Date(auction.createdAt).toLocaleTimeString() })}
                  </p>
                </div>
                <div>
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

              {/* Auction gallery display */}
              {auction.images && auction.images.length > 0 && (
                <div>
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
                      .sort((a, b) => a.price - b.price)
                      .map((bid) => {
                        const isAccepted = auction.acceptedBidId === bid.id;
                        const isNew = newBidFlashIds.includes(bid.id);
                        
                        return (
                          <div
                            key={bid.id}
                            className={`bid-item ${isAccepted ? 'accepted' : ''} ${isNew ? 'bid-flash-new' : ''}`}
                            style={{ flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}
                          >
                            <div className="bid-info" style={{ textAlign: 'start' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}>
                                <span className="bid-producer">{bid.producerName}</span>
                                {isAccepted && (
                                  <span className="badge badge-open" style={{ fontSize: '0.65rem', background: 'var(--primary)', color: 'var(--text-inverse)', border: 'none', padding: '2px 6px' }}>
                                    {t('bidSelected')}
                                  </span>
                                )}
                              </div>
                              <span className="bid-price" style={{ display: 'block', direction: 'ltr', textAlign: dir === 'rtl' ? 'right' : 'left' }}>
                                {bid.price} DA <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>/ {t('unit_' + auction.unit)}</span>
                              </span>
                              {bid.comments && (
                                <div className="bid-comment" style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px', flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}>
                                  <MessageSquare size={12} />
                                  <span>{bid.comments}</span>
                                </div>
                              )}
                            </div>

                            <div style={{ textAlign: dir === 'rtl' ? 'left' : 'right' }}>
                              {auction.status === 'open' ? (
                                <button
                                  type="button"
                                  className="btn btn-primary"
                                  style={{ padding: '6px 12px', fontSize: '0.85rem', gap: '4px', flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}
                                  onClick={() => onAcceptBid(auction.id, bid.id)}
                                >
                                  <Check size={14} />
                                  {t('validateBtn')}
                                </button>
                              ) : (
                                isAccepted && (
                                  <div style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold', fontSize: '0.9rem', flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}>
                                    <Check size={18} />
                                    {t('bidConfirmed')}
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

      {/* Lightbox Modal overlay */}
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
