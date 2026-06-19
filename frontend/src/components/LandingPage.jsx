import React, { useEffect, useRef, useState } from 'react';
import {
  ShoppingBag, Tractor, Zap, ArrowRight, CheckCircle2,
  TrendingUp, Users, Clock, ShieldCheck, MapPin, Star,
  ChevronDown, Wheat, Package, BarChart3
} from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';
import '../landing.css';

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
  const { t, dir } = useTranslation();

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
      <section className="landing-hero">
        {/* Decorative blobs */}
        <div className="hero-blob hero-blob-1" />
        <div className="hero-blob hero-blob-2" />
        <div className="hero-blob hero-blob-3" />

        <div className="landing-hero-inner">
          {/* Badge */}
          <div className="landing-hero-badge">
            <span className="badge-dot" />
            {t('heroBadge')}
          </div>

          {/* Title */}
          <h1 className="landing-hero-title">
            {t('heroTitlePart1')}{' '}
            <span className="landing-hero-accent">{t('heroTitleAccent')}</span>
            {t('heroTitlePart2') ? <><br />{t('heroTitlePart2')}</> : null}
          </h1>

          {/* Subtitle */}
          <p className="landing-hero-subtitle">{t('heroSubtitle')}</p>

          {/* CTAs */}
          <div className="landing-hero-cta">
            <button
              id="hero-cta-primary"
              className="landing-btn-primary"
              onClick={onNavigateToRegister || onNavigateToLogin}
            >
              {t('joinPlatform')}
              <ArrowRight size={18} style={{ transform: dir === 'rtl' ? 'rotate(180deg)' : 'none' }} />
            </button>
            <button
              id="hero-cta-login"
              className="landing-btn-ghost"
              onClick={onNavigateToLogin}
            >
              {t('accessLogin')}
            </button>
          </div>

          {/* Trust row */}
          <div className="landing-trust-row">
            {trust.map((item) => (
              <div key={item.key} className="landing-trust-chip">
                {item.icon}
                <span>{t(item.key)}</span>
              </div>
            ))}
          </div>

          {/* Scroll cue */}
          <button
            className="landing-scroll-cue"
            onClick={scrollDown}
            aria-label="Défiler vers le bas"
          >
            <ChevronDown size={20} />
          </button>
        </div>

        {/* Hero visual card */}
        <div className="landing-hero-visual">
          <div className="hero-card">
            <div className="hero-card-header">
              <div className="hero-card-dot green" />
              <div className="hero-card-dot amber" />
              <div className="hero-card-dot red" />
              <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', marginLeft: 'auto' }}>sougra.com</span>
            </div>
            <div className="hero-card-body">
              {/* Mock auction demand */}
              <div className="hero-card-auction">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '1rem', color: '#fff' }}>{t('mockProduct')}</div>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{t('mockUnit')}</div>
                  </div>
                  <span className="hero-badge-live">{t('mockLive')}</span>
                </div>
                {/* Bids */}
                {[
                  { alias: t('mockProducer1'), price: 42, active: false },
                  { alias: t('mockProducer2'), price: 38, active: false },
                  { alias: t('mockProducerMe'), price: 35, active: true },
                ].map((b, i) => (
                  <div key={i} className={`hero-bid-row ${b.active ? 'hero-bid-row-active' : ''}`}>
                    <span>{b.alias}</span>
                    <strong style={{ color: b.active ? '#10b981' : 'rgba(255,255,255,0.7)' }}>
                      {b.price} {t('delete') === 'Supprimer' ? 'DA/kg' : (t('delete') === 'Delete' ? 'DA/kg' : 'د.ج/كغ')}
                    </strong>
                  </div>
                ))}
                <button className="hero-accept-btn">{t('mockValidateBtn')}</button>
              </div>
            </div>
          </div>
          {/* Floating badge */}
          <div className="hero-float-badge">
            <Star size={14} style={{ color: '#f59e0b' }} fill="#f59e0b" />
            <span>{t('trustRealtime')}</span>
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
