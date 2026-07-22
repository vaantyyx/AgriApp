import { useState, useRef, useEffect } from 'react';
import { useTranslation } from '../context/LanguageContext';
import { Inbox, MessageSquare, Check, Trophy, X, Image as ImageIcon, Send, Eye, ChevronLeft, ChevronRight, ClipboardList, Layers, CalendarClock, Hash, FileSearch, Percent } from 'lucide-react';
import { getWinnerCongratsMessage, getBidClosedWinnerMessage, isBidLineAccepted } from '../utils/auctionHelpers';
import { cultureTypes, products } from '../utils/referenceData.js';
import { WILAYA_COORDS } from '../utils/wilayaCoordinates.js';
import { useEscapeKey } from '../hooks/useEscapeKey';

function SummaryRow({ label, value }) {
  return (
    <div className="summary-row" style={{ marginBottom: 4, fontSize: '0.82rem' }}>
      <span className="summary-row-label" style={{ minWidth: 120 }}>{label}</span>
      <span className="summary-row-value">{value}</span>
    </div>
  );
}

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

const emptyLine = () => ({ quality: '', price: '', quantity: '', unit: '', comments: '', images: [], isUploading: false });

export default function ProducerAuctionsPage({ auctions, onPlaceBid, newBidFlashIds, highlightAuctionId, hasMoreAuctions, loadingMoreAuctions, onLoadMoreAuctions }) {
  const { locale, t } = useTranslation();
  
  const [inputs, setInputs] = useState({});
  const [activeZoomImage, setActiveZoomImage] = useState(null);
  const [viewingAuction, setViewingAuction] = useState(null);
  const [viewStep, setViewStep] = useState(1);
  const [expandedAuctionId, setExpandedAuctionId] = useState(null);
  const auctionRefs = useRef({});

  const openConsultation = (auction) => {
    setViewingAuction(auction);
    setViewStep(1);
  };
  const closeConsultation = () => {
    setViewingAuction(null);
    setViewStep(1);
  };

  useEscapeKey(!!viewingAuction, closeConsultation);
  useEscapeKey(!!activeZoomImage, () => setActiveZoomImage(null));

  const getAuctionTypeLabel = (val) => {
    if (val === 'open') return locale === 'ar' ? 'مزاد مفتوح' : (locale === 'en' ? 'Open auction' : 'Enchère ouverte');
    if (val === 'smart') return locale === 'ar' ? 'مزاد ذكي' : (locale === 'en' ? 'Smart auction' : 'Enchère intelligente');
    return val;
  };
  const getProductName = (pid) => { const p = products.find(p => p.id === pid); return p ? (p.name[locale] || p.name.fr) : pid; };
  const getCultureName = (cid) => { const c = cultureTypes.find(c => c.id === cid); return c ? (c.name[locale] || c.name.fr) : cid; };
  const getWilayaName = (wid) => { const w = WILAYA_COORDS[parseInt(wid)]; return w ? w.name : wid; };

  useEffect(() => {
    if (highlightAuctionId) {
      // React to an external navigation event (notification click), not
      // deriving state from a prop.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setExpandedAuctionId(highlightAuctionId);
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
    if (existing.length + files.length > 5) { alert(locale === 'ar' ? 'يمكنك إضافة 5 صور كحد أقصى لكل خيار.' : (locale === 'en' ? 'You can add a maximum of 5 photos per option.' : 'Maximum 5 photos par option.')); return; }
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
    const bounds = auction?.myRoundBounds;
    if (bounds) {
      const price = parseFloat(validLines[0].price);
      if (price < bounds.min - 0.01 || price > bounds.max + 0.01) {
        alert(t('roundPriceBoundsHint', { min: bounds.min.toFixed(2), max: bounds.max.toFixed(2), round: bounds.round }));
        return;
      }
    }
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
    <div className="dash-page-scroll" style={{ flex: 1, padding: '32px 40px', overflowY: 'auto', textAlign: 'start' }}>
      
      {activeZoomImage && (
        <div className="lightbox-modal" onClick={() => setActiveZoomImage(null)}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button className="lightbox-close" onClick={() => setActiveZoomImage(null)} aria-label={t('captchaClose')}><X size={20} /></button>
            <img src={activeZoomImage} alt={t('zoomProduct')} />
          </div>
        </div>
      )}
      {/* Consultation Wizard View */}
      {viewingAuction && (() => {
        const a = viewingAuction;
        const aLots = a.lots || [];
        const STEPS = [
          { icon: <ClipboardList size={16} />, label: locale === 'ar' ? 'عام' : (locale === 'en' ? 'General' : 'Général') },
          { icon: <Layers size={16} />, label: locale === 'ar' ? 'الأقسام' : 'Lots' },
          { icon: <FileSearch size={16} />, label: locale === 'ar' ? 'المنطقة' : 'Zone' },
          { icon: <CalendarClock size={16} />, label: locale === 'ar' ? 'التواريخ' : 'Dates' },
        ];
        return (
          <div style={{ marginBottom: 40 }}>
            <div className="wizard-header-row">
              <h2 className="wizard-header-title">
                <Eye size={24} style={{ color: '#3b82f6' }} />
                {locale === 'ar' ? 'تفاصيل المزاد' : (locale === 'en' ? 'Auction details' : "Détails de l'enchère")}
              </h2>
              <button onClick={closeConsultation} className="wizard-close-btn" aria-label={t('captchaClose')}>
                <X size={22} />
              </button>
            </div>

            {/* Step Indicator */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 0, marginBottom: 28, position: 'relative' }}>
              {STEPS.map((step, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
                  <div onClick={() => setViewStep(i + 1)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer', minWidth: 80 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: viewStep === i + 1 ? 'var(--primary)' : viewStep > i + 1 ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.06)', color: viewStep === i + 1 ? 'white' : 'var(--text-muted)', border: viewStep === i + 1 ? '2px solid var(--primary)' : '1px solid var(--border)', fontWeight: 800, fontSize: '0.85rem', transition: 'all 0.2s' }}>
                      {viewStep > i + 1 ? <Check size={16} /> : step.icon}
                    </div>
                    <span style={{ fontSize: '0.68rem', fontWeight: viewStep === i + 1 ? 700 : 500, color: viewStep === i + 1 ? 'var(--primary)' : 'var(--text-muted)' }}>{step.label}</span>
                  </div>
                  {i < STEPS.length - 1 && <div style={{ width: 48, height: 2, background: viewStep > i + 1 ? 'var(--primary)' : 'var(--border)', marginTop: -20, transition: 'background 0.3s' }} />}
                </div>
              ))}
            </div>

            <div className="glass-panel animate-fade-in" style={{ padding: '28px 32px' }}>
              {/* Step 1 - General */}
              {viewStep === 1 && (
                <div>
                  <h3 className="wizard-section-title mb-20">
                    <ClipboardList size={20} style={{ color: 'var(--primary)' }} />
                    {locale === 'ar' ? 'المعلومات العامة' : (locale === 'en' ? 'General information' : 'Informations générales')}
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label>{locale === 'ar' ? 'عنوان المزاد' : (locale === 'en' ? "Auction title" : "Titre de l'enchère")}</label>
                      <input type="text" value={a.title || a.product || ''} disabled />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label>{locale === 'ar' ? 'نوع المزاد' : (locale === 'en' ? "Auction type" : "Type d'enchère")}</label>
                      <input type="text" value={getAuctionTypeLabel(a.auctionType)} disabled />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label>{locale === 'ar' ? 'مكان التسليم' : (locale === 'en' ? 'Delivery location' : 'Lieu de livraison')}</label>
                      <input type="text" value={a.deliveryLocation || '-'} disabled />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label>{locale === 'ar' ? 'وصف تفصيلي' : (locale === 'en' ? 'Detailed description' : 'Description détaillée')}</label>
                      <textarea rows={3} value={a.description || ''} disabled />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2 - Lots */}
              {viewStep === 2 && (
                <div>
                  <h3 className="wizard-section-title mb-20">
                    <Layers size={20} style={{ color: 'var(--primary)' }} />
                    {locale === 'ar' ? 'الأقسام (Lots)' : (locale === 'en' ? 'Lots' : 'Lots')}
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {aLots.map((lot, idx) => (
                      <div key={idx} className="bordered-card">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Hash size={16} color="white" />
                          </div>
                          <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)' }}>{locale === 'ar' ? 'قسم رقم' : (locale === 'en' ? 'Lot No.' : 'Lot N°')} {lot.seq || idx + 1}</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 20px' }}>
                          <div className="form-group" style={{ margin: 0, gridColumn: '1 / -1' }}>
                            <label>{locale === 'ar' ? 'التسمية' : (locale === 'en' ? 'Designation' : 'Désignation')}</label>
                            <input type="text" value={lot.designation || ''} disabled />
                          </div>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label>{locale === 'ar' ? 'نوع الزراعة' : (locale === 'en' ? 'Crop type' : 'Type de culture')}</label>
                            <input type="text" value={getCultureName(lot.cultureTypeId)} disabled />
                          </div>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label>{locale === 'ar' ? 'المنتج المحدد' : (locale === 'en' ? 'Product' : 'Produit')}</label>
                            <input type="text" value={getProductName(lot.productId)} disabled />
                          </div>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label>{locale === 'ar' ? 'الكمية' : (locale === 'en' ? 'Quantity' : 'Quantité')}</label>
                            <input type="text" value={`${lot.quantity || 0} ${t('unit_' + (lot.unit || a.unit))}`} disabled />
                          </div>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label>{locale === 'ar' ? 'الولاية الأصلية' : (locale === 'en' ? 'Origin wilaya' : "Wilaya d'origine")}</label>
                            <input type="text" value={getWilayaName(lot.wilayaId)} disabled />
                          </div>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label>{locale === 'ar' ? 'سعر السقف' : (locale === 'en' ? 'Ceiling price' : 'Prix plafond')}</label>
                            <input type="text" value={lot.priceCeiling ? `${lot.priceCeiling} ${t('currencyDA')}` : '-'} disabled />
                          </div>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label>{locale === 'ar' ? 'سعر الاحتياط' : (locale === 'en' ? 'Reserve price' : 'Prix de réserve')}</label>
                            <input type="text" value={lot.priceReserve ? `${lot.priceReserve} ${t('currencyDA')}` : '-'} disabled />
                          </div>
                        </div>
                      </div>
                    ))}
                    {aLots.length === 0 && <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{locale === 'ar' ? 'لا توجد أقسام' : (locale === 'en' ? 'No lots defined.' : 'Aucun lot défini.')}</p>}
                  </div>
                </div>
              )}

              {/* Step 3 - Zone */}
              {viewStep === 3 && (
                <div>
                  <h3 className="wizard-section-title mb-20">
                    <FileSearch size={20} style={{ color: 'var(--primary)' }} />
                    {locale === 'ar' ? 'المنطقة الجغرافية' : (locale === 'en' ? 'Geographic zone' : 'Zone géographique')}
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    <SummaryRow label={locale === 'ar' ? 'نطاق البحث' : (locale === 'en' ? 'Search radius' : 'Rayon de recherche')} value={`${a.radiusKm || 0} ${t('unitKm')}`} />
                  </div>
                </div>
              )}

              {/* Step 4 - Dates */}
              {viewStep === 4 && (
                <div>
                  <h3 className="wizard-section-title mb-20">
                    <CalendarClock size={20} style={{ color: 'var(--primary)' }} />
                    {locale === 'ar' ? 'التواريخ والإعدادات' : (locale === 'en' ? 'Dates & settings' : 'Dates & paramètres')}
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label>{locale === 'ar' ? 'تاريخ البدء' : (locale === 'en' ? 'Start' : 'Début')}</label>
                      <input type="text" value={a.startAt ? new Date(a.startAt).toLocaleString(locale === 'ar' ? 'ar-DZ' : locale === 'en' ? 'en-US' : 'fr-DZ', { dateStyle: 'medium', timeStyle: 'short' }) : '-'} disabled />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label>{locale === 'ar' ? 'تاريخ الانتهاء' : (locale === 'en' ? 'End' : 'Fin')}</label>
                      <input type="text" value={a.endAt ? new Date(a.endAt).toLocaleString(locale === 'ar' ? 'ar-DZ' : locale === 'en' ? 'en-US' : 'fr-DZ', { dateStyle: 'medium', timeStyle: 'short' }) : '-'} disabled />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label>{locale === 'ar' ? 'تمديد تلقائي' : (locale === 'en' ? 'Automatic extension' : 'Prolongation automatique')}</label>
                      <input type="text" value={a.autoProlongate ? `${a.prolongationMinutes || 0} min, ${a.maxProlongations || 0} ${locale === 'ar' ? 'مرات' : (locale === 'en' ? 'times' : 'fois')}` : (locale === 'ar' ? 'لا' : (locale === 'en' ? 'No' : 'Non'))} disabled />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Navigation */}
            <div className="wizard-nav-row">
              <button type="button" onClick={() => setViewStep(s => Math.max(s - 1, 1))} disabled={viewStep === 1} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: viewStep === 1 ? 0.4 : 1 }}>
                <ChevronLeft size={16} /> {locale === 'ar' ? 'السابق' : (locale === 'en' ? 'Previous' : 'Précédent')}
              </button>
              {viewStep < 4 ? (
                <button type="button" onClick={() => setViewStep(s => Math.min(s + 1, 4))} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {locale === 'ar' ? 'التالي' : (locale === 'en' ? 'Next' : 'Suivant')} <ChevronRight size={16} />
                </button>
              ) : (
                <button type="button" onClick={closeConsultation} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <X size={16} /> {locale === 'ar' ? 'إغلاق' : (locale === 'en' ? 'Close' : 'Fermer')}
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {!viewingAuction && (<>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: 8 }}>{t('availablePublicDemands')}</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: 28, fontSize: '0.85rem' }}>
        {locale === 'ar' ? 'تصفح عروض الشراء القريبة وقدم مقترحات الأسعار الخاصة بك.' : (locale === 'en' ? 'Browse nearby requests and submit your price bids.' : "Consultez les appels d'offres à proximité et soumettez vos offres.")}
      </p>

      {auctions.length === 0 ? (
        <div className="glass-panel empty-state">
          <div className="empty-state-icon"><Inbox size={28} /></div>
          <h3>{t('noAuctionInCurrent')}</h3>
          <p>{t('noAuctionInCurrentSub')}</p>
        </div>
      ) : (
        <>
        {[...auctions]
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
            const lines = getLines(auction.id);
            const isNew = newBidFlashIds.includes(auction.id) || (myBid && newBidFlashIds.includes(myBid.id));

            return (
              <div key={auction.id} ref={el => auctionRefs.current[auction.id] = el}
                style={{ marginBottom: 12, borderRadius: 12, border: '1px solid var(--border)', overflowX: 'auto', overflowY: 'hidden', background: 'var(--bg-panel)' }}>

                {/* Clickable Line Row */}
                <div onClick={() => setExpandedAuctionId(expandedAuctionId === auction.id ? null : auction.id)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1.2fr 1fr 1fr 1fr 40px',
                    minWidth: 620,
                    padding: '16px 20px',
                    alignItems: 'center',
                    cursor: 'pointer',
                    background: isNew ? 'rgba(16,185,129,0.06)' : expandedAuctionId === auction.id ? 'rgba(255,255,255,0.04)' : 'transparent',
                    transition: 'all 0.2s',
                    borderLeft: isWinner ? '4px solid var(--primary)' : myBid ? '4px solid var(--secondary)' : 'none',
                  }}
                >
                  {/* Left: Product & Quantity */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                    <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {isNew && <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981' }} />}
                      {auction.product}
                    </span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-body)' }}>
                      {auction.quantity} {t('unit_' + auction.unit)}
                    </span>
                  </div>

                  {/* Delivery Location */}
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-body)' }}>
                    📍 {auction.deliveryLocation || '—'}
                  </span>

                  {/* Offres reçues */}
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    💬 {auction.bids.length} {auction.bids.length > 1 ? (locale === 'ar' ? 'عروض' : (locale === 'en' ? 'bids' : 'offres')) : (locale === 'ar' ? 'عرض' : (locale === 'en' ? 'bid' : 'offre'))}
                  </span>

                  {/* Status Badge */}
                  <div>
                    {isClosed ? (
                      <span className="status-pill status-pill-closed">
                        {t('statusClosed')}
                      </span>
                    ) : (
                      <span className="status-pill status-pill-open">
                        {t('statusOpen')}
                      </span>
                    )}
                  </div>

                  {/* Bidding Badge */}
                  <div>
                    {myBid && (
                      isWinner ? (
                        <span className="status-pill status-pill-winner">
                          🏆 {t('winnerLabel')}
                        </span>
                      ) : (
                        <span className="status-pill status-pill-submitted">
                          {locale === 'ar' ? 'تم التقديم' : (locale === 'en' ? 'Submitted' : 'Soumis')}
                        </span>
                      )
                    )}
                  </div>

                  {/* Arrow Toggle */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', color: 'var(--text-muted)' }}>
                    {expandedAuctionId === auction.id ? <X size={16} /> : <Eye size={16} style={{ opacity: 0.7 }} />}
                  </div>
                </div>

                {/* Expanded Details Section */}
                {expandedAuctionId === auction.id && (
                  <div style={{ padding: '20px 24px', borderTop: '1px solid var(--border)', background: 'rgba(255,255,255,0.01)' }}>
                    {auction.description && (
                      <p style={{ background: 'rgba(255,255,255,0.01)', padding: '10px 14px', borderRadius: '8px', fontSize: '0.9rem', marginBottom: 16, borderLeft: locale === 'fr' ? '3px solid rgba(255,255,255,0.1)' : 'none', borderRight: locale === 'ar' ? '3px solid rgba(255,255,255,0.1)' : 'none' }}>
                        <strong>{locale === 'fr' ? 'Spécifications :' : (locale === 'ar' ? 'المواصفات :' : 'Specifications:')}</strong> {auction.description}
                      </p>
                    )}

                    {/* Metadata boxes */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 20 }}>
                      <div className="metadata-box">
                        <div className="metadata-box-title">{locale === 'ar' ? 'المعلومات الأساسية' : (locale === 'en' ? 'General information' : 'Informations générales')}</div>
                        <div style={{ display: 'grid', gap: 8 }}>
                          <SummaryRow label={locale === 'ar' ? 'نوع المزاد' : (locale === 'en' ? 'Auction type' : 'Type d’enchère')} value={getAuctionTypeLabel(auction.auctionType)} />
                          <SummaryRow label={locale === 'ar' ? 'المنتج الرئيس' : (locale === 'en' ? 'Main product' : 'Produit principal')} value={auction.product || '-'} />
                          <SummaryRow label={locale === 'ar' ? 'الكمية الإجمالية' : (locale === 'en' ? 'Total quantity' : 'Quantité totale')} value={`${auction.quantity || 0} ${t('unit_' + auction.unit)}`} />
                          <SummaryRow label={locale === 'ar' ? 'مكان التسليم' : (locale === 'en' ? 'Delivery location' : 'Lieu de livraison')} value={auction.deliveryLocation || '-'} />
                          <SummaryRow label={locale === 'ar' ? 'الحد الأقصى للسعر' : (locale === 'en' ? 'Ceiling price' : 'Prix plafond')} value={auction.targetPrice ? `${auction.targetPrice} ${t('currencyDA')}` : (locale === 'ar' ? 'غير محدد' : (locale === 'en' ? 'Not set' : 'Non défini'))} />
                          {auction.roundConfig?.enabled && auction.currentRound && (
                            <SummaryRow label={t('roundModeToggleTitle')} value={t('roundBadge', { current: auction.currentRound, total: auction.roundConfig.totalRounds })} />
                          )}
                        </div>
                      </div>
                      <div className="metadata-box">
                        <div className="metadata-box-title">{locale === 'ar' ? 'التوقيت والإعدادات' : (locale === 'en' ? 'Timing & settings' : 'Dates & paramètres')}</div>
                        <div style={{ display: 'grid', gap: 8 }}>
                          <SummaryRow label={locale === 'ar' ? 'تاريخ البدء' : (locale === 'en' ? 'Start' : 'Début')} value={auction.startAt ? new Date(auction.startAt).toLocaleString(locale === 'ar' ? 'ar-DZ' : locale === 'en' ? 'en-US' : 'fr-DZ', { dateStyle: 'medium', timeStyle: 'short' }) : '-'} />
                          <SummaryRow label={locale === 'ar' ? 'تاريخ الانتهاء' : (locale === 'en' ? 'End' : 'Fin')} value={auction.endAt ? new Date(auction.endAt).toLocaleString(locale === 'ar' ? 'ar-DZ' : locale === 'en' ? 'en-US' : 'fr-DZ', { dateStyle: 'medium', timeStyle: 'short' }) : '-'} />
                          <SummaryRow label={locale === 'ar' ? 'تمديد تلقائي' : (locale === 'en' ? 'Auto extension' : 'Prolongation auto')} value={auction.autoProlongate ? `${auction.prolongationMinutes || 0} min, ${auction.maxProlongations || 0} ${locale === 'en' ? 'times' : 'fois'}` : (locale === 'ar' ? 'لا' : (locale === 'en' ? 'No' : 'Non'))} />
                          <SummaryRow label={locale === 'ar' ? 'نطاق البحث' : (locale === 'en' ? 'Search radius' : 'Rayon de recherche')} value={`${auction.radiusKm || 0} ${t('unitKm')}`} />
                          <SummaryRow label={locale === 'ar' ? 'عدد الأقسام' : (locale === 'en' ? 'Number of lots' : 'Nombre de lots')} value={`${(auction.lots || []).length}`} />
                        </div>
                      </div>
                    </div>

                    {/* Lots */}
                    {(auction.lots || []).length > 0 && (
                      <div style={{ padding: 14, borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: 20 }}>
                        <div style={{ marginBottom: 12, fontSize: '0.82rem', color: 'var(--text-main)', fontWeight: 800, textTransform: 'uppercase' }}>{locale === 'ar' ? 'تفاصيل الأقسام (اللوت)' : (locale === 'en' ? 'Lot details' : 'Détails des lots')}</div>
                        <div style={{ display: 'grid', gap: 10 }}>
                          {auction.lots.map((lot, idx) => (
                            <div key={idx} style={{ padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 8 }}>
                                <strong style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>{lot.designation || `Lot ${idx + 1}`}</strong>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{lot.quantity || 0} {t('unit_' + (lot.unit || auction.unit))}</span>
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '6px 12px', color: 'var(--text-body)', fontSize: '0.8rem' }}>
                                {lot.cultureTypeId && <div>🌿 {locale === 'ar' ? 'نوع الزراعة' : (locale === 'en' ? 'Crop type' : 'Type de culture')} : <strong>{getCultureName(lot.cultureTypeId)}</strong></div>}
                                {lot.productId && <div>📦 {locale === 'ar' ? 'المنتج' : (locale === 'en' ? 'Product' : 'Produit')} : <strong>{getProductName(lot.productId)}</strong></div>}
                                {lot.wilayaId && <div>📍 {locale === 'ar' ? 'الولاية الأصلية' : (locale === 'en' ? 'Origin wilaya' : 'Wilaya d’origine')} : <strong>{getWilayaName(lot.wilayaId)}</strong></div>}
                                {lot.priceCeiling && <div style={{ color: 'var(--danger)' }}>⬇ {locale === 'ar' ? 'سعر السقف' : (locale === 'en' ? 'Ceiling price' : 'Prix plafond')} : <strong>{lot.priceCeiling} {t('currencyDA')}</strong></div>}
                                {lot.priceReserve && <div style={{ color: 'var(--primary)' }}>⬆ {locale === 'ar' ? 'سعر الاحتياط' : (locale === 'en' ? 'Reserve price' : 'Prix de réserve')} : <strong>{lot.priceReserve} {t('currencyDA')}</strong></div>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Consultation/Wizard Button */}
                    <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'flex-start' }}>
                      <button
                        type="button"
                        onClick={() => openConsultation(auction)}
                        className="btn-view-details"
                      >
                        <Eye size={15} />
                        <span>{locale === 'ar' ? 'استشارة التفاصيل الكاملة' : (locale === 'en' ? 'View full details' : 'Consulter les détails complets')}</span>
                      </button>
                    </div>

                    {/* Form to submit bid */}
                    {!isClosed ? (
                      <>
                        {myBid && auction.myRank !== null && auction.myRank !== undefined && (
                          <div style={{ background: 'rgba(34, 163, 98, 0.08)', border: '1px solid rgba(34, 163, 98, 0.25)', color: 'var(--secondary)', padding: '10px 14px', borderRadius: '8px', fontSize: '0.88rem', fontWeight: 'bold', marginBottom: '16px', display: 'inline-flex', alignItems: 'center', gap: '8px', width: '100%', boxSizing: 'border-box' }}>
                            <Trophy size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                            <span>{locale === 'ar' ? `ترتيبك: ${auction.myRank} من ${auction.totalBidders}` : locale === 'en' ? `Your ranking: ${auction.myRank} of ${auction.totalBidders}` : `Votre classement : ${auction.myRank === 1 ? '1er' : `${auction.myRank}e`} sur ${auction.totalBidders}`}</span>
                          </div>
                        )}
                        <form onSubmit={(e) => handleSubmitBid(e, auction.id)} style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border)', marginBottom: '16px', marginTop: '16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                            <h4 style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{t('makeOfferTitle')}</h4>
                            {auction.roundConfig?.enabled && auction.currentRound ? (
                              <span style={{ fontSize: '0.72rem', color: 'var(--primary)', background: 'var(--primary-soft)', padding: '2px 8px', borderRadius: '999px', fontWeight: 700 }}>
                                {t('roundBadge', { current: auction.currentRound, total: auction.roundConfig.totalRounds })}
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: 'var(--primary-soft)', padding: '2px 8px', borderRadius: '999px' }}>{lines.length} {lines.length > 1 ? 'options' : 'option'}</span>
                            )}
                          </div>

                          {auction.roundConfig?.enabled ? (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '12px', padding: '8px 12px', background: 'rgba(244,160,28,0.07)', border: '1px solid rgba(244,160,28,0.2)', borderRadius: '8px' }}>
                              <div>{t('roundSingleOptionNotice')}</div>
                              {auction.myRoundBounds && (
                                <div style={{ marginTop: 4, fontWeight: 700, color: 'var(--text-main)' }}>
                                  {t('roundPriceBoundsHint', {
                                    min: auction.myRoundBounds.min.toFixed(2),
                                    max: auction.myRoundBounds.max.toFixed(2),
                                    round: auction.myRoundBounds.round,
                                  })}
                                </div>
                              )}
                            </div>
                          ) : lines.length === 1 && (
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
                                    <input type="number" step="0.01" min={auction.myRoundBounds?.min} max={auction.myRoundBounds?.max} placeholder={t('pricePlaceholder')} value={line.price} onChange={e => setLine(auction.id, lineIdx, 'price', e.target.value)} required={lineIdx === 0} style={{ textAlign: 'start', fontSize: '0.85rem', padding: '8px 10px' }} />
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
                            {!auction.roundConfig?.enabled && (
                              <button type="button" onClick={() => addLine(auction.id)} className="btn btn-secondary" style={{ fontSize: '0.82rem', padding: '8px 14px', gap: '5px' }} disabled={lines.length >= 5}>
                                + {t('addOptionBtn')}
                              </button>
                            )}
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
                            <div>{getWinnerCongratsMessage({ bid: myBid, acceptedLineId: auction.acceptedLineId, auction, t })}</div>
                          </>
                        ) : (
                          <>
                            <Check size={20} style={{ color: 'var(--text-muted)' }} />
                            <div>{getBidClosedWinnerMessage({ winningBid, acceptedLineId: auction.acceptedLineId, auction, t, locale })}</div>
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
                                    const isThisLineAccepted = isBidLineAccepted(auction, bid, line);
                                    return (
                                      <div key={line.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: isThisLineAccepted ? 'rgba(34, 163, 98, 0.08)' : 'transparent', border: isThisLineAccepted ? '1px solid var(--primary)' : '1px dotted var(--border)', borderRadius: '6px' }}>
                                        <div>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            {line.optionName && <span style={{ fontSize: '0.75rem', fontWeight: 'bold', background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: '4px' }}>{line.optionName}</span>}
                                            <span style={{ fontWeight: '800', color: 'var(--secondary)', fontSize: '0.85rem' }}>
                                              {line.price !== null && line.price !== undefined ? `${line.price} ${t('currencyDA')}/${t('unit_' + (line.unit || auction.unit))}` : `— ${t('currencyDA')}/${t('unit_' + (line.unit || auction.unit))} (${locale === 'ar' ? 'مخفي' : (locale === 'en' ? 'Hidden' : 'Masqué')})`}
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
                                {isMe && bid.roundHistory?.length > 0 && (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', paddingTop: '6px', borderTop: '1px dotted var(--border)' }}>
                                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                                      <Percent size={10} style={{ verticalAlign: 'middle', marginRight: 3 }} />{t('roundHistoryTitle')} :
                                    </span>
                                    {[...bid.roundHistory].sort((a, b) => a.round - b.round).map(h => (
                                      <span key={h.round} style={{ fontSize: '0.7rem', background: 'rgba(255,255,255,0.05)', padding: '1px 7px', borderRadius: '999px', color: 'var(--text-body)' }}>
                                        {t('roundBadge', { current: h.round, total: auction.roundConfig?.totalRounds || h.round })}: {h.price} {t('currencyDA')}
                                      </span>
                                    ))}
                                  </div>
                                )}
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
        {hasMoreAuctions && (
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <button onClick={onLoadMoreAuctions} disabled={loadingMoreAuctions} className="btn btn-secondary" style={{ padding: '8px 20px', fontSize: '0.85rem' }}>
              {loadingMoreAuctions ? t('loadingMoreBtn') : t('loadMoreBtn')}
            </button>
          </div>
        )}
        </>
      )}</>)}
    </div>
  );
}
