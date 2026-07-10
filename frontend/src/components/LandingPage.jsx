import React, { useEffect, useRef, useState } from 'react';
import {
  Leaf, Info, Users, HelpCircle, ShieldCheck, LayoutGrid, Phone,
  ChevronDown, Search, Wheat, ShoppingBag, Droplet,
  Scale, Eye, Headset, Star, Tractor, BarChart3, Quote, Gavel,
  ArrowUp, MapPin, Mail, Sun, Moon, Sprout, Apple,
} from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import '../landing.css';

/* Simplified Union Jack — no external asset needed for the English option */
function UKFlag({ size = 18 }) {
  return (
    <svg width={size} height={size * 0.65} viewBox="0 0 60 36" style={{ borderRadius: 3, flexShrink: 0, display: 'block' }}>
      <rect width="60" height="36" fill="#00247d" />
      <path d="M0,0 L60,36 M60,0 L0,36" stroke="#fff" strokeWidth="7" />
      <path d="M0,0 L60,36 M60,0 L0,36" stroke="#cf142b" strokeWidth="2.6" />
      <path d="M30,0 L30,36 M0,18 L60,18" stroke="#fff" strokeWidth="11" />
      <path d="M30,0 L30,36 M0,18 L60,18" stroke="#cf142b" strokeWidth="6.5" />
    </svg>
  );
}

const LANGS = [
  { code: 'fr', label: 'Français', flag: '/img/flags/fr.png' },
  { code: 'ar', label: 'العربية', flag: '/img/flags/dz.png' },
  { code: 'en', label: 'English', flag: null },
];

const NAV_ITEMS = [
  { labelKey: 'landingNavAbout', icon: Info, anchor: 'slp-about' },
  { labelKey: 'landingNavWho', icon: Users, anchor: 'slp-roles' },
  { labelKey: 'landingNavHow', icon: HelpCircle, anchor: 'slp-how' },
  { labelKey: 'landingNavSecurity', icon: ShieldCheck, anchor: 'slp-why' },
  { labelKey: 'landingNavServices', icon: LayoutGrid, anchor: 'slp-categories' },
  { labelKey: 'landingNavContact', icon: Phone, anchor: 'slp-footer' },
];

const CATEGORIES = [
  { nameKey: 'landingCatFruitsVegName', count: '1248', img: '/img/categories/category-fruits-vegetables.jpg' },
  { nameKey: 'landingCatCerealsName', count: '856', img: '/img/categories/category-cereals.jpg' },
  { nameKey: 'landingCatOilseedsName', count: '432', img: '/img/categories/category-oilseeds.jpg' },
  { nameKey: 'landingCatLegumesName', count: '398', img: '/img/categories/category-legumes.jpg' },
  { nameKey: 'landingCatOrganicName', count: '215', img: '/img/categories/category-organic.jpg' },
];

const WHY_CARDS = [
  { titleKey: 'landingWhy1Title', descKey: 'landingWhy1Desc', icon: ShieldCheck },
  { titleKey: 'landingWhy2Title', descKey: 'landingWhy2Desc', icon: Scale },
  { titleKey: 'landingWhy3Title', descKey: 'landingWhy3Desc', icon: Eye },
  { titleKey: 'landingWhy4Title', descKey: 'landingWhy4Desc', icon: Headset },
];

const STATS = [
  { value: '2 450+', labelKey: 'landingStat1Label', icon: Users },
  { value: '8 760+', labelKey: 'landingStat2Label', icon: Tractor },
  { value: '12 500+', labelKey: 'landingStat3Label', icon: BarChart3 },
  { value: '98%', labelKey: 'landingStat4Label', icon: Star },
];

const HOW_STEPS = [
  { n: 1, titleKey: 'landingHowStep1Title', descKey: 'landingHowStep1Desc' },
  { n: 2, titleKey: 'landingHowStep2Title', descKey: 'landingHowStep2Desc' },
  { n: 3, titleKey: 'landingHowStep3Title', descKey: 'landingHowStep3Desc' },
  { n: 4, titleKey: 'landingHowStep4Title', descKey: 'landingHowStep4Desc' },
];

const SOCIALS = ['FB', 'in', 'X', 'IG', 'YT'];

/* ─── Scroll-reveal wrapper ─────────────────────────────────────────────── */
function Reveal({ children, className = '', stagger = false, ...rest }) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true);
        observer.disconnect();
      }
    }, { threshold: 0.15 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const cls = ['slp-reveal', stagger ? 'slp-stagger' : '', inView ? 'slp-in-view' : '', className].filter(Boolean).join(' ');
  return <div ref={ref} className={cls} {...rest}>{children}</div>;
}

/* ─── Image reveal on scroll (clip-path wipe + zoom settle) ────────────── */
function ImageReveal({ src, alt, className = '' }) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true);
        observer.disconnect();
      }
    }, { threshold: 0.2 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const cls = ['slp-img-reveal', inView ? 'slp-img-in-view' : '', className].filter(Boolean).join(' ');
  return (
    <div ref={ref} className={cls}>
      <img src={src} alt={alt} />
    </div>
  );
}

/* ─── Animated stat number (counts up once visible) ────────────────────── */
function AnimatedStat({ value }) {
  const match = value.match(/^([\d\s]+)(.*)$/);
  const target = match ? parseInt(match[1].replace(/\s/g, ''), 10) : 0;
  const suffix = match ? match[2] : value;
  const [display, setDisplay] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const duration = 1600;
        const start = performance.now();
        const tick = (now) => {
          const t = Math.min((now - start) / duration, 1);
          const ease = 1 - Math.pow(1 - t, 3);
          setDisplay(Math.floor(ease * target));
          if (t < 1) requestAnimationFrame(tick);
          else setDisplay(target);
        };
        requestAnimationFrame(tick);
      }
    }, { threshold: 0.4 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [target]);

  return <strong ref={ref}>{display.toLocaleString('fr-FR')}{suffix}</strong>;
}

export default function LandingPage({ onNavigateToLogin, onNavigateToRegister }) {
  const { t, dir, locale, setLocale } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const [espaceOpen, setEspaceOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const espaceRef = useRef(null);
  const langRef = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (espaceRef.current && !espaceRef.current.contains(e.target)) setEspaceOpen(false);
      if (langRef.current && !langRef.current.contains(e.target)) setLangOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    function onScroll() { setShowScrollTop(window.scrollY > 600); }
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const goRegister = onNavigateToRegister || onNavigateToLogin;

  const scrollToAnchor = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const scrollTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  const currentLang = LANGS.find(l => l.code === locale) || LANGS[0];
  const trustLogoAghtia = locale === 'ar' ? 'أغذية' : 'Aghtia';
  const TRUST_LOGOS = ['MADAR', 'Cevital', 'GROUPE SMA', trustLogoAghtia, 'Tchin-Lait'];

  return (
    <div className="landing-root" dir={dir}>

      {/* ══════════════ NAVBAR ══════════════ */}
      <nav className="slp-navbar">
        <div className="slp-logo">
          <img src="/logo.png" alt="Sougra" />
          <div className="slp-logo-text">
            <strong>SOUGRA</strong>
            <span>{t('landingLogoTagline')}</span>
          </div>
        </div>

        <div className="slp-nav-links">
          {NAV_ITEMS.map(item => (
            <button key={item.labelKey} className="slp-nav-link" onClick={() => scrollToAnchor(item.anchor)}>
              <item.icon size={14} /> {t(item.labelKey)}
            </button>
          ))}
        </div>

        <div className="slp-navbar-actions">
          <button className="slp-btn-accent slp-pulse" onClick={goRegister}>
            <Gavel size={14} /> {t('landingNavLaunchAuction')}
          </button>

          <div className="slp-espace-wrap" ref={espaceRef}>
            <button className="slp-btn-white" onClick={() => setEspaceOpen(o => !o)}>
              {t('landingNavClientArea')} <ChevronDown size={13} />
            </button>
            {espaceOpen && (
              <div className="slp-dropdown">
                <button onClick={onNavigateToLogin}>{t('landingNavLogin')}</button>
                <button onClick={onNavigateToRegister}>{t('landingNavRegister')}</button>
              </div>
            )}
          </div>

          <div className="slp-espace-wrap" ref={langRef}>
            <button className="slp-globe-btn" onClick={() => setLangOpen(o => !o)} title="Language">
              {currentLang.flag ? <img src={currentLang.flag} alt="" style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover' }} /> : <UKFlag size={18} />}
            </button>
            {langOpen && (
              <div className="slp-dropdown">
                {LANGS.map(l => (
                  <button
                    key={l.code}
                    onClick={() => { setLocale(l.code); setLangOpen(false); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    {l.flag ? <img src={l.flag} alt="" style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} /> : <UKFlag size={18} />}
                    {l.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button className="slp-globe-btn" onClick={toggleTheme} title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </nav>

      {/* ══════════════ HERO (full-bleed, content centered as a column) ══════════════ */}
      <section className="slp-hero" id="slp-about">
        <div className="slp-hero-inner">
          <div className="slp-hero-content">
            <h1 className="slp-hero-title">
              {t('landingHeroTitleMain')}<em>{t('landingHeroTitleAccent')}</em>
            </h1>
            <p className="slp-hero-sub">{t('landingHeroSub')}</p>

            <div className="slp-hero-trust">
              <div className="slp-hero-trust-item">
                <span className="slp-hero-trust-icon"><ShieldCheck size={18} /></span>
                <div><strong>{t('landingTrustSecureTitle')}</strong><span>{t('landingTrustSecureSub')}</span></div>
              </div>
              <div className="slp-hero-trust-item">
                <span className="slp-hero-trust-icon"><Scale size={18} /></span>
                <div><strong>{t('landingTrustFairTitle')}</strong><span>{t('landingTrustFairSub')}</span></div>
              </div>
              <div className="slp-hero-trust-item">
                <span className="slp-hero-trust-icon"><Eye size={18} /></span>
                <div><strong>{t('landingTrustTransparentTitle')}</strong><span>{t('landingTrustTransparentSub')}</span></div>
              </div>
            </div>
          </div>

          <div className="slp-search-card">
            <div className="slp-search-field">
              <label>{t('landingSearchCategory')}</label>
              <select defaultValue=""><option value="">{t('landingSearchCategoryValue')}</option></select>
              <ChevronDown size={13} className="slp-search-field-chevron" />
            </div>
            <div className="slp-search-divider" />
            <div className="slp-search-field">
              <label>{t('landingSearchRegion')}</label>
              <select defaultValue=""><option value="">{t('landingSearchRegionValue')}</option></select>
              <ChevronDown size={13} className="slp-search-field-chevron" />
            </div>
            <div className="slp-search-divider" />
            <div className="slp-search-field">
              <label>{t('landingSearchProduct')}</label>
              <select defaultValue=""><option value="">{t('landingSearchProductValue')}</option></select>
              <ChevronDown size={13} className="slp-search-field-chevron" />
            </div>
            <button className="slp-search-btn" onClick={goRegister}>
              <Search size={15} /> {t('landingSearchBtn')}
            </button>
          </div>
        </div>
      </section>

      {/* ══════════════ POPULAR CATEGORY PILLS ══════════════ */}
      <section className="slp-pills-section">
        <div className="slp-container">
          <div className="slp-cat-pills-row">
            <span className="slp-cat-pills-label">{t('landingPopularCatLabel')}</span>
            <button className="slp-cat-pill" onClick={goRegister}><Sprout size={13} /> {t('landingCatHarvest')}</button>
            <button className="slp-cat-pill" onClick={goRegister}><Leaf size={13} /> {t('landingCatBio')}</button>
            <button className="slp-cat-pill" onClick={goRegister}><Apple size={13} /> {t('landingCatFruitsVeg')}</button>
            <button className="slp-cat-pill" onClick={goRegister}><Wheat size={13} /> {t('landingCatCerealsName')}</button>
            <button className="slp-cat-pill" onClick={goRegister}><Droplet size={13} /> {t('landingCatOilseedsName')}</button>
          </div>
        </div>
      </section>

      {/* ══════════════ CATEGORIES ══════════════ */}
      <section className="slp-section" id="slp-categories">
        <div className="slp-container">
          <Reveal className="slp-section-head-row">
            <div>
              <h2 className="slp-section-title">{t('landingCategoriesTitle')}</h2>
              <p className="slp-section-sub">{t('landingCategoriesSub')}</p>
            </div>
            <button className="slp-btn-white" style={{ color: 'var(--primary)', border: '1px solid var(--border)' }} onClick={goRegister}>
              {t('landingViewAllAuctions')}
            </button>
          </Reveal>

          <Reveal stagger className="slp-categories-grid">
            {CATEGORIES.map((cat, i) => (
              <div key={i} className="slp-cat-card" onClick={goRegister}>
                <ImageReveal className="slp-cat-card-img" src={cat.img} alt={t(cat.nameKey)} />
                <div className="slp-cat-card-body">
                  <div>
                    <h4>{t(cat.nameKey)}</h4>
                    <p>{cat.count} {t('landingOffersSuffix')}</p>
                  </div>
                  <span className="slp-cat-card-arrow"><ChevronDown size={13} style={{ transform: dir === 'rtl' ? 'rotate(90deg)' : 'rotate(-90deg)' }} /></span>
                </div>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ══════════════ HOW IT WORKS ══════════════ */}
      <section className="slp-section slp-section-alt" id="slp-how">
        <div className="slp-container">
          <Reveal className="slp-section-head-center">
            <h2 className="slp-section-title">{t('landingHowTitle')}</h2>
          </Reveal>
          <Reveal stagger className="slp-how-grid">
            {HOW_STEPS.map(step => (
              <div key={step.n} className="slp-how-step">
                <div className="slp-how-icon">{step.n}</div>
                <h4>{t(step.titleKey)}</h4>
                <p>{t(step.descKey)}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ══════════════ WHY CHOOSE ══════════════ */}
      <section className="slp-section" id="slp-why">
        <div className="slp-container">
          <Reveal className="slp-section-head-center">
            <h2 className="slp-section-title">{t('landingWhyTitle')}</h2>
          </Reveal>
          <Reveal stagger className="slp-why-grid">
            {WHY_CARDS.map((card, i) => (
              <div key={i} className="slp-why-card">
                <div className="slp-why-icon"><card.icon size={22} /></div>
                <h5>{t(card.titleKey)}</h5>
                <p>{t(card.descKey)}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ══════════════ STATS ══════════════ */}
      <section className="slp-stats-dark">
        <div className="slp-container">
          <Reveal>
            <h3>{t('landingStatsTitle')}</h3>
          </Reveal>
          <Reveal stagger className="slp-stats-dark-grid">
            {STATS.map((s, i) => (
              <div key={i} className="slp-stat-dark-item">
                <s.icon size={22} />
                <AnimatedStat value={s.value} />
                <span>{t(s.labelKey)}</span>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ══════════════ TESTIMONIAL + CTA ══════════════ */}
      <section className="slp-section" id="slp-roles">
        <div className="slp-container">
          <Reveal stagger className="slp-testi-cta-grid">
            <div className="slp-testi-card">
              <Quote size={22} className="quote-icon" />
              <p className="slp-testi-quote">« {t('landingTestimonialQuote')} »</p>
              <div className="slp-testi-author">
                <div className="slp-testi-avatar">MA</div>
                <div>
                  <strong>{t('landingTestimonialName')}</strong>
                  <span>{t('landingTestimonialRole')}</span>
                </div>
              </div>
              <div className="slp-testi-dots">
                <span className="active" /><span /><span /><span />
              </div>
            </div>

            <div className="slp-cta-card">
              <h4>{t('landingCtaTitle')}</h4>
              <p>{t('landingCtaDesc')}</p>
              <div className="slp-cta-card-actions">
                <button className="slp-btn-accent" onClick={goRegister}>{t('landingCtaBtnLaunch')}</button>
                <button className="slp-btn-ghost-sm" onClick={() => scrollToAnchor('slp-how')}>{t('landingCtaBtnMore')}</button>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══════════════ TRUST LOGOS ══════════════ */}
      <section className="slp-section slp-section-alt">
        <div className="slp-container">
          <Reveal className="slp-trust-strip">
            <h5>{t('landingTrustLogosTitle')}</h5>
            <div className="slp-trust-logos">
              {TRUST_LOGOS.map((logo, i) => (
                <span key={i} className="slp-trust-logo">{logo}</span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══════════════ FOOTER ══════════════ */}
      <footer className="slp-footer" id="slp-footer">
        <div className="slp-footer-grid">
          <div className="slp-footer-brand">
            <div className="slp-logo">
              <img src="/logo.png" alt="Sougra" />
              <div className="slp-logo-text">
                <strong>SOUGRA</strong>
                <span>{t('landingLogoTagline')}</span>
              </div>
            </div>
            <p>{t('landingFooterDesc')}</p>
            <div className="slp-footer-badge"><ShieldCheck size={13} /> {t('landingFooterBadge')}</div>
          </div>

          <div>
            <h6>{t('landingFooterNavTitle')}</h6>
            <ul className="slp-footer-links">
              <li><Leaf size={13} /><button onClick={scrollTop}>{t('landingFooterNavHome')}</button></li>
              <li><Info size={13} /><button onClick={() => scrollToAnchor('slp-about')}>{t('landingFooterNavAbout')}</button></li>
              <li><HelpCircle size={13} /><button onClick={() => scrollToAnchor('slp-how')}>{t('landingFooterNavHow')}</button></li>
              <li><Users size={13} /><button onClick={() => scrollToAnchor('slp-roles')}>{t('landingFooterNavWho')}</button></li>
              <li><ShoppingBag size={13} /><button onClick={() => scrollToAnchor('slp-categories')}>{t('landingFooterNavMarket')}</button></li>
              <li><Gavel size={13} /><button onClick={goRegister}>{t('landingFooterNavAuctions')}</button></li>
            </ul>
          </div>

          <div>
            <h6>{t('landingFooterResourcesTitle')}</h6>
            <ul className="slp-footer-links">
              <li><a href="/terms">{t('landingFooterTerms')}</a></li>
              <li><button onClick={() => scrollToAnchor('slp-footer')}>{t('landingFooterPrivacy')}</button></li>
              <li><button onClick={() => scrollToAnchor('slp-footer')}>{t('landingFooterHelp')}</button></li>
              <li><button onClick={() => scrollToAnchor('slp-footer')}>{t('landingFooterBlog')}</button></li>
              <li><button onClick={() => scrollToAnchor('slp-footer')}>{t('landingFooterSupport')}</button></li>
            </ul>
          </div>

          <div>
            <h6>{t('landingFooterContactTitle')}</h6>
            <div className="slp-footer-contact-item"><Mail size={14} /><span>contact@sougra.dz</span></div>
            <div className="slp-footer-contact-item"><Phone size={14} /><span>+213 (0) XX XX XX XX</span></div>
            <div className="slp-footer-contact-item"><MapPin size={14} /><span>{t('landingFooterAddress')}</span></div>
            <div className="slp-social-row">
              {SOCIALS.map((s, i) => <button key={i} className="slp-social-btn">{s}</button>)}
            </div>
          </div>
        </div>

        <div className="slp-footer-bottom">
          <span>© {new Date().getFullYear()} {t('landingFooterCopyright')}</span>
          <div className="slp-footer-bottom-links">
            <button onClick={() => scrollToAnchor('slp-footer')}>{t('landingFooterLegal')}</button>
            <button onClick={() => scrollToAnchor('slp-footer')}>{t('landingFooterCookies')}</button>
            <button onClick={() => scrollToAnchor('slp-footer')}>{t('landingFooterSitemap')}</button>
          </div>
        </div>
      </footer>

      {showScrollTop && (
        <button className="slp-scroll-top" onClick={scrollTop} title="Scroll to top">
          <ArrowUp size={18} />
        </button>
      )}
    </div>
  );
}
