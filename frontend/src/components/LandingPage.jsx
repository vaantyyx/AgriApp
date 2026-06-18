import React from 'react';
import {
  Leaf, Tractor, ShoppingBag, Zap, ShieldCheck, ImageIcon,
  ArrowRight, TrendingUp, Users, Clock, CheckCircle2
} from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';

export default function LandingPage({ onNavigateToLogin, onNavigateToRegister }) {
  const { t, dir } = useTranslation();

  const features = [
    {
      icon: <ShoppingBag size={22} />,
      titleKey: 'stepBuyerTitle',
      descKey: 'stepBuyerDesc',
    },
    {
      icon: <Tractor size={22} />,
      titleKey: 'stepProducerTitle',
      descKey: 'stepProducerDesc',
    },
    {
      icon: <Zap size={22} />,
      titleKey: 'stepSocketTitle',
      descKey: 'stepSocketDesc',
    },
    {
      icon: <ImageIcon size={22} />,
      titleKey: 'stepGalleryTitle',
      descKey: 'stepGalleryDesc',
    },
  ];

  const trust = [
    { icon: <ShieldCheck size={18} />, key: 'trustSafe' },
    { icon: <Clock size={18} />, key: 'trustRealtime' },
    { icon: <Users size={18} />, key: 'trustCommunity' },
    { icon: <TrendingUp size={18} />, key: 'trustGrowth' },
  ];

  return (
    <div className="animate-fade-in" dir={dir}>

      {/* ── HERO ── */}
      <section className="hero-section">
        <div className="hero-inner">
          <div className="hero-eyebrow">
            <Leaf size={13} />
            {t('heroBadge')}
          </div>

          <h1 className="hero-title">
            {t('heroTitlePart1')}{' '}
            <em>{t('heroTitleAccent')}</em>
            {t('heroTitlePart2') ? <><br />{t('heroTitlePart2')}</> : null}
          </h1>

          <p className="hero-subtitle">{t('heroSubtitle')}</p>

          <div className="hero-cta">
            <button
              id="hero-cta-primary"
              className="btn-hero-primary"
              onClick={onNavigateToRegister || onNavigateToLogin}
            >
              {t('joinPlatform')}
              <ArrowRight size={17} style={{ transform: dir === 'rtl' ? 'rotate(180deg)' : 'none' }} />
            </button>
            <button
              id="hero-cta-login"
              className="btn-hero-secondary"
              onClick={onNavigateToLogin}
            >
              {t('accessLogin')}
            </button>
          </div>

          {/* Trust badges */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            flexWrap: 'wrap',
            gap: '20px',
            marginTop: '40px',
          }}>
            {trust.map((item) => (
              <div key={item.key} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: 'rgba(255,255,255,0.75)',
                fontSize: '0.82rem',
                fontWeight: 500,
              }}>
                {item.icon}
                {t(item.key)}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS BAND ── */}
      <div className="stats-band">
        <div className="stats-band-inner">
          <div className="stat-item">
            <div className="stat-number">{t('statProducts')}</div>
            <div className="stat-label">{t('statProductsLabel')}</div>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <div className="stat-number">{t('statCommission')}</div>
            <div className="stat-label">{t('statCommissionLabel')}</div>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <div className="stat-number">{t('statDirect')}</div>
            <div className="stat-label">{t('statDirectLabel')}</div>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <div className="stat-number">{t('statCountries') || '10+'}</div>
            <div className="stat-label">{t('statCountriesLabel') || t('statDirectLabel')}</div>
          </div>
        </div>
      </div>

      {/* ── HOW IT WORKS ── */}
      <section className="how-section">
        <div style={{ textAlign: 'center', marginBottom: '0' }}>
          <span className="section-label">{t('howItWorksTag')}</span>
          <h2 className="section-title">{t('howItWorks')}</h2>
          <p className="section-sub">{t('howItWorksSub')}</p>
        </div>

        <div className="features-grid" style={{ maxWidth: 1240, padding: '0 24px' }}>
          {features.map((f, i) => (
            <div key={i} className="feature-card">
              <div className="feature-icon-box">{f.icon}</div>
              <h3>{t(f.titleKey)}</h3>
              <p>{t(f.descKey)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW TO JOIN (2 columns) ── */}
      <section style={{
        background: 'var(--bg-white)',
        padding: '72px 24px',
        borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <span className="section-label">{t('getStartedTag')}</span>
            <h2 className="section-title">{t('getStartedTitle')}</h2>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '24px',
          }}>
            {/* Buyer card */}
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '32px',
              borderTop: '4px solid var(--primary)',
            }}>
              <div style={{
                width: 52, height: 52,
                borderRadius: 14,
                background: 'var(--primary-soft)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--primary)',
                marginBottom: 20,
              }}>
                <ShoppingBag size={24} />
              </div>
              <h3 style={{ fontSize: '1.2rem', marginBottom: 12 }}>{t('buyerRoleTitle')}</h3>
              {[t('buyerBenefit1'), t('buyerBenefit2'), t('buyerBenefit3')].filter(Boolean).map((b, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                  <CheckCircle2 size={15} style={{ color: 'var(--primary)', marginTop: 2, flexShrink: 0 }} />
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{b}</span>
                </div>
              ))}
              <button
                id="join-as-buyer"
                className="btn btn-primary w-full mt-4"
                style={{ marginTop: 20 }}
                onClick={onNavigateToRegister || onNavigateToLogin}
              >
                {t('joinAsBuyer')}
              </button>
            </div>

            {/* Producer card */}
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '32px',
              borderTop: '4px solid var(--accent)',
            }}>
              <div style={{
                width: 52, height: 52,
                borderRadius: 14,
                background: 'var(--accent-soft)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--accent)',
                marginBottom: 20,
              }}>
                <Tractor size={24} />
              </div>
              <h3 style={{ fontSize: '1.2rem', marginBottom: 12 }}>{t('producerRoleTitle')}</h3>
              {[t('producerBenefit1'), t('producerBenefit2'), t('producerBenefit3')].filter(Boolean).map((b, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                  <CheckCircle2 size={15} style={{ color: 'var(--accent)', marginTop: 2, flexShrink: 0 }} />
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{b}</span>
                </div>
              ))}
              <button
                id="join-as-producer"
                className="btn btn-accent w-full"
                style={{ marginTop: 20 }}
                onClick={onNavigateToRegister || onNavigateToLogin}
              >
                {t('joinAsProducer')}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="cta-section">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <Leaf size={40} style={{ color: 'rgba(255,255,255,0.5)', marginBottom: '16px' }} />
          <h2>{t('readyToModernize')}</h2>
          <p>{t('readyToModernizeSub')}</p>
          <button
            id="cta-final"
            className="btn-hero-primary"
            onClick={onNavigateToRegister || onNavigateToLogin}
            style={{ margin: '0 auto' }}
          >
            {t('joinPlatform')}
            <ArrowRight size={17} style={{ transform: dir === 'rtl' ? 'rotate(180deg)' : 'none' }} />
          </button>
        </div>
      </section>

    </div>
  );
}
