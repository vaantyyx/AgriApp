import React, { useState } from 'react';
import { Plus, Tag, Calendar, MessageSquare, Check, Package, Image as ImageIcon, X } from 'lucide-react';

export default function BuyerDashboard({ user, auctions, onCreateAuction, onAcceptBid, newBidFlashIds }) {
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
          
          // Convert to JPEG with 70% quality
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
      alert('Vous pouvez télécharger un maximum de 5 photos.');
      return;
    }

    setIsUploading(true);
    try {
      const compressedPromises = files.map(file => compressImage(file));
      const newImages = await Promise.all(compressedPromises);
      setImages(prev => [...prev, ...newImages]);
    } catch (err) {
      console.error('Error uploading/compressing images:', err);
      alert('Une erreur est survenue lors de la compression des images.');
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
      alert('Veuillez remplir les champs obligatoires correctement.');
      return;
    }

    onCreateAuction({
      buyerName: user.name,
      product: product.trim(),
      quantity: parseFloat(quantity),
      unit,
      targetPrice: targetPrice ? parseFloat(targetPrice) : null,
      description: description.trim(),
      images: images // Send Base64 images array
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
    <div className="dashboard-grid has-sidebar">
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
            <label htmlFor="target-price">Prix Max Target (DA / unité) (Optionnel)</label>
            <input
              id="target-price"
              type="number"
              step="0.01"
              placeholder="Ex: 450 (Optionnel)"
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

          {/* Photo upload field */}
          <div className="form-group">
            <label>Photos du produit (Optionnel)</label>
            <div 
              className="image-upload-zone"
              onClick={() => document.getElementById('photo-upload-input').click()}
            >
              <ImageIcon size={24} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontSize: '0.85rem' }}>
                {isUploading ? 'Traitement...' : 'Cliquer pour ajouter des photos (Max 5)'}
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
                      title="Supprimer"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }} disabled={isUploading}>
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
                    {auction.product} - {auction.quantity} {auction.unit}
                  </h3>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Publié le {new Date(auction.createdAt).toLocaleTimeString()}
                  </p>
                </div>
                <div>
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

              {/* Auction gallery display */}
              {auction.images && auction.images.length > 0 && (
                <div>
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
                            <div className="bid-info">
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span className="bid-producer">{bid.producerName}</span>
                                {isAccepted && (
                                  <span className="badge badge-open" style={{ fontSize: '0.65rem', background: 'var(--primary)', color: 'var(--text-inverse)', border: 'none', padding: '2px 6px' }}>
                                    Offre Retenue
                                  </span>
                                )}
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
                            </div>

                            <div className="text-right">
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
                                  <div style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold', fontSize: '0.9rem' }}>
                                    <Check size={18} />
                                    Confirmé
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
