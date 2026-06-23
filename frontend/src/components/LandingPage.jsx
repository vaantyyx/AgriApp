import React, { useEffect, useRef, useState } from 'react';
import {
  ShoppingBag, Tractor, Zap, ArrowRight, CheckCircle2,
  TrendingUp, Users, Clock, ShieldCheck, MapPin, Star,
  ChevronDown, Wheat, Package, BarChart3, Gavel
} from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';
import '../landing.css';

const landTrans = {
  fr: {
    heroBrand: "SOUGRA",
    heroSubtitle: "La première plateforme algérienne d'enchères inversées B2B agricole",
    heroTagline: "Publiez votre besoin, Recevez des offres. Comparez. Choisissez.",
    popularCategories: "Catégories populaires :",
    catHarvest: "Les récoltes",
    catOrganic: "Bios",
    catFruitsVeg: "Fruits/Légumes",
    btnLaunchAuction: "LANCER UNE ENCHÈRE",
    statProducers: "500+",
    statProducersLabel: "Producteurs",
    statTransactions: "200+",
    statTransactionsLabel: "Transactions",
    statSecure: "100%",
    statSecureLabel: "Sécurisé"
  },
  ar: {
    heroBrand: "سوقرى",
    heroSubtitle: "أول منصة جزائرية للمزادات العكسية الزراعية B2B",
    heroTagline: "انشر احتياجك، استقبل العروض. قارن. اختر.",
    popularCategories: "الفئات الشائعة:",
    catHarvest: "الحصاد",
    catOrganic: "عضوي",
    catFruitsVeg: "فواكه/خضروات",
    btnLaunchAuction: "إطلاق مزاد",
    statProducers: "500+",
    statProducersLabel: "منتجون",
    statTransactions: "200+",
    statTransactionsLabel: "معاملات",
    statSecure: "100%",
    statSecureLabel: "آمن"
  },
  en: {
    heroBrand: "SOUGRA",
    heroSubtitle: "The first Algerian B2B crop reverse auction marketplace",
    heroTagline: "Publish your need, receive offers. Compare. Choose.",
    popularCategories: "Popular categories:",
    catHarvest: "Crops / Harvest",
    catOrganic: "Organic",
    catFruitsVeg: "Fruits/Vegetables",
    btnLaunchAuction: "LAUNCH AN AUCTION",
    statProducers: "500+",
    statProducersLabel: "Producers",
    statTransactions: "200+",
    statTransactionsLabel: "Transactions",
    statSecure: "100%",
    statSecureLabel: "Secure"
  }
};

/* ─── Animated counter ─────────────────────────────────────────────────────── */
function AnimatedNumber({ target, suffix = '' }) {
  const [val, setVal] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const duration = 1800;
        const start = performance.now();
        const num = parseFloat(target);
        const tick = (now) => {
          const t = Math.min((now - start) / duration, 1);
          const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
          setVal(Math.floor(ease * num));
          if (t < 1) requestAnimationFrame(tick);
          else setVal(num);
        };
        requestAnimationFrame(tick);
      }
    }, { threshold: 0.4 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);

  return <span ref={ref}>{val}{suffix}</span>;
}

export default function LandingPage({ onNavigateToLogin, onNavigateToRegister }) {
  const { t, dir, locale } = useTranslation();
  const landT = landTrans[locale] || landTrans['fr'] || landTrans['en'];

  const steps = [
    {
      number: '01',
      icon: <ShoppingBag size={26} />,
      color: 'var(--primary)',
      bgColor: 'var(--primary-soft)',
      titleKey: 'stepBuyerTitle',
      descKey: 'stepBuyerDesc',
    },
    {
      number: '02',
      icon: <Tractor size={26} />,
      color: '#f59e0b',
      bgColor: 'rgba(245,158,11,0.1)',
      titleKey: 'stepProducerTitle',
      descKey: 'stepProducerDesc',
    },
    {
      number: '03',
      icon: <Zap size={26} />,
      color: '#3b82f6',
      bgColor: 'rgba(59,130,246,0.1)',
      titleKey: 'stepSocketTitle',
      descKey: 'stepSocketDesc',
    },
    {
      number: '04',
      icon: <BarChart3 size={26} />,
      color: '#8b5cf6',
      bgColor: 'rgba(139,92,246,0.1)',
      titleKey: 'stepGalleryTitle',
      descKey: 'stepGalleryDesc',
    },
  ];

  const stats = [
    { value: 50, suffix: 'k+', unit: 'Tonnes', labelKey: 'statProductsLabel', icon: <Wheat size={20} /> },
    { value: 0, suffix: '', unit: 'DA', labelKey: 'statCommissionLabel', icon: <ShieldCheck size={20} /> },
    { value: 100, suffix: '%', unit: 'Direct', labelKey: 'statDirectLabel', icon: <TrendingUp size={20} /> },
    { value: 48, suffix: '', unit: 'Wilayas', labelKey: 'statCountriesLabel', icon: <MapPin size={20} /> },
  ];

  const trust = [
    { icon: <ShieldCheck size={16} />, key: 'trustSafe' },
    { icon: <Clock size={16} />, key: 'trustRealtime' },
    { icon: <Users size={16} />, key: 'trustCommunity' },
    { icon: <TrendingUp size={16} />, key: 'trustGrowth' },
  ];

  const scrollDown = () => {
    document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="landing-root" dir={dir}>

      {/* ══════════════════════════════════════════════
          HERO
      ══════════════════════════════════════════════ */}
      <section className="landing-hero" style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
        minHeight: '85vh',
        padding: '100px 24px 80px',
        background: 'none',
        position: 'relative'
      }}>
        {/* Background Image */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: "url('/img/background_10.jpg')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
          zIndex: 0
        }} />

        {/* Dark overlay for readability */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.65), rgba(0,0,0,0.55), rgba(0,0,0,0.45))',
          zIndex: 1
        }} />

        <div style={{
          position: 'relative',
          zIndex: 2,
          maxWidth: '850px',
          margin: '0 auto',
          color: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}>
          {/* Brand Title */}
          <h1 style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontWeight: 800,
            fontSize: 'clamp(3rem, 8vw, 6rem)',
            color: '#ffffff',
            letterSpacing: '0.05em',
            textShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
            lineHeight: 1.1,
            marginBottom: '16px'
          }}>
            {landT.heroBrand}
          </h1>

          {/* Subtitle */}
          <p style={{
            fontSize: 'clamp(1rem, 2.5vw, 1.25rem)',
            fontWeight: 500,
            lineHeight: 1.6,
            color: 'rgba(255, 255, 255, 0.95)',
            textShadow: '0 2px 10px rgba(0,0,0,0.5)',
            marginBottom: '24px',
            maxWidth: '650px'
          }}>
            {landT.heroSubtitle}
          </p>

          {/* Tagline */}
          <h2 style={{
            fontSize: 'clamp(1.1rem, 2.8vw, 1.5rem)',
            fontWeight: 600,
            lineHeight: 1.4,
            color: 'rgba(255, 255, 255, 0.9)',
            textShadow: '0 2px 10px rgba(0,0,0,0.5)',
            marginBottom: '32px',
            maxWidth: '750px'
          }}>
            {landT.heroTagline}
          </h2>

          {/* Popular Categories */}
          <div style={{ marginBottom: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'rgba(255, 255, 255, 0.8)', marginBottom: '12px' }}>
              {landT.popularCategories}
            </p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
              {[
                { label: landT.catHarvest, icon: <Wheat size={14} style={{ color: '#059669' }} /> },
                { label: landT.catOrganic, icon: <Star size={14} style={{ color: '#f59e0b' }} fill="#f59e0b" /> },
                { label: landT.catFruitsVeg, icon: <ShoppingBag size={14} style={{ color: '#10b981' }} /> }
              ].map((cat, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: '#ffffff',
                    color: '#064e3b',
                    padding: '8px 16px',
                    borderRadius: '24px',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    cursor: 'pointer',
                    transition: 'transform 0.2s ease'
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                  onClick={onNavigateToRegister || onNavigateToLogin}
                >
                  {cat.icon}
                  <span>{cat.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* CTA Button */}
          <button
            onClick={onNavigateToRegister || onNavigateToLogin}
            style={{
              background: '#ffffff',
              color: '#047857',
              border: 'none',
              padding: '16px 44px',
              borderRadius: '16px',
              fontSize: '1.05rem',
              fontWeight: 800,
              letterSpacing: '0.04em',
              cursor: 'pointer',
              boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              transition: 'all 0.2s ease',
              marginBottom: '48px'
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.4)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 10px 25px rgba(0,0,0,0.3)'; }}
          >
            <Gavel size={18} />
            <span>{landT.btnLaunchAuction}</span>
          </button>

          {/* Quick Stats */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '24px',
            width: '100%',
            maxWidth: '600px',
            borderTop: '1px solid rgba(255,255,255,0.2)',
            paddingTop: '24px',
            marginTop: '12px'
          }}>
            {[
              { value: landT.statProducers, label: landT.statProducersLabel },
              { value: landT.statTransactions, label: landT.statTransactionsLabel },
              { value: landT.statSecure, label: landT.statSecureLabel }
            ].map((stat, idx) => (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: 'clamp(1.5rem, 3.5vw, 2.2rem)', fontWeight: 800, color: '#ffffff', textShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
                  {stat.value}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.85)', fontWeight: 500, marginTop: '2px' }}>
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          STATS BAND
      ══════════════════════════════════════════════ */}
      <div className="landing-stats-band">
        {stats.map((s, i) => (
          <React.Fragment key={i}>
            <div className="landing-stat-item">
              <div className="landing-stat-icon">{s.icon}</div>
              <div>
                <div className="landing-stat-number">
                  <AnimatedNumber target={s.value} suffix={s.suffix} />
                  {' '}<span style={{ fontSize: '0.6em', opacity: 0.7 }}>{s.unit}</span>
                </div>
                <div className="landing-stat-label">{t(s.labelKey)}</div>
              </div>
            </div>
            {i < stats.length - 1 && <div className="landing-stat-divider" />}
          </React.Fragment>
        ))}
      </div>

      {/* ══════════════════════════════════════════════
          HOW IT WORKS
      ══════════════════════════════════════════════ */}
      <section className="landing-how" id="how-it-works">
        <div className="landing-section-head">
          <span className="landing-section-tag">{t('howItWorksTag')}</span>
          <h2 className="landing-section-title">{t('howItWorks')}</h2>
          <p className="landing-section-sub">{t('howItWorksSub')}</p>
        </div>

        <div className="landing-steps-grid">
          {steps.map((step, i) => (
            <div key={i} className="landing-step-card">
              <div className="landing-step-number">{step.number}</div>
              <div
                className="landing-step-icon"
                style={{ background: step.bgColor, color: step.color }}
              >
                {step.icon}
              </div>
              <h3 className="landing-step-title">{t(step.titleKey)}</h3>
              <p className="landing-step-desc">{t(step.descKey)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          CHOOSE YOUR ROLE
      ══════════════════════════════════════════════ */}
      <section className="landing-roles">
        <div className="landing-section-head">
          <span className="landing-section-tag">{t('getStartedTag')}</span>
          <h2 className="landing-section-title">{t('getStartedTitle')}</h2>
        </div>

        <div className="landing-roles-grid">
          {/* Buyer */}
          <div className="landing-role-card landing-role-buyer">
            <div className="landing-role-top">
              <div className="landing-role-icon" style={{ background: 'rgba(16,185,129,0.12)', color: 'var(--primary)' }}>
                <ShoppingBag size={28} />
              </div>
              <div>
                <h3>{t('buyerRoleTitle')}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 4 }}>
                  {t('buyerDesc')}
                </p>
              </div>
            </div>
            <ul className="landing-benefits">
              {[t('buyerBenefit1'), t('buyerBenefit2'), t('buyerBenefit3')].filter(Boolean).map((b, i) => (
                <li key={i}>
                  <CheckCircle2 size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            <button
              id="join-as-buyer"
              className="landing-role-btn landing-role-btn-primary"
              onClick={onNavigateToRegister || onNavigateToLogin}
            >
              {t('joinAsBuyer')}
              <ArrowRight size={16} style={{ transform: dir === 'rtl' ? 'rotate(180deg)' : 'none' }} />
            </button>
          </div>

          {/* Producer */}
          <div className="landing-role-card landing-role-producer">
            <div className="landing-role-top">
              <div className="landing-role-icon" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>
                <Tractor size={28} />
              </div>
              <div>
                <h3>{t('producerRoleTitle')}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 4 }}>
                  {t('producerDesc')}
                </p>
              </div>
            </div>
            <ul className="landing-benefits">
              {[t('producerBenefit1'), t('producerBenefit2'), t('producerBenefit3')].filter(Boolean).map((b, i) => (
                <li key={i}>
                  <CheckCircle2 size={16} style={{ color: '#f59e0b', flexShrink: 0 }} />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            <button
              id="join-as-producer"
              className="landing-role-btn landing-role-btn-accent"
              onClick={onNavigateToRegister || onNavigateToLogin}
            >
              {t('joinAsProducer')}
              <ArrowRight size={16} style={{ transform: dir === 'rtl' ? 'rotate(180deg)' : 'none' }} />
            </button>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          FINAL CTA
      ══════════════════════════════════════════════ */}
      <section className="landing-final-cta">
        <div className="landing-cta-blob-1" />
        <div className="landing-cta-blob-2" />
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>🌿</div>
          <h2 className="landing-cta-title">{t('readyToModernize')}</h2>
          <p className="landing-cta-sub">{t('readyToModernizeSub')}</p>
          <button
            id="cta-final"
            className="landing-btn-primary"
            onClick={onNavigateToRegister || onNavigateToLogin}
          >
            {t('joinPlatform')}
            <ArrowRight size={18} style={{ transform: dir === 'rtl' ? 'rotate(180deg)' : 'none' }} />
          </button>
        </div>
      </section>

    </div>
  );
}
