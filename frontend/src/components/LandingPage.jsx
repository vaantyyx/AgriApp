import { Children, useEffect, useRef, useState } from 'react';
import { motion, MotionConfig, useInView, useScroll, useSpring, useTransform } from 'motion/react';
import {
  Leaf, Info, Users, HelpCircle, ShieldCheck, LayoutGrid, Phone,
  ChevronDown, Search, Wheat, ShoppingBag, Droplet,
  Scale, Eye, Headset, Star, Tractor, BarChart3, Quote, Gavel,
  ArrowUp, MapPin, Mail, Sun, Moon, Sprout, Apple,
} from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { UKFlag } from './landingShared';
import { LANGS } from '../utils/languages.js';
import '../landing.css';

/* Official brand marks (Simple Icons paths) — rendered inline so no icon
   library dependency is needed for logos lucide-react doesn't ship. */
function SocialIcon({ path, size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className="icon-block">
      <path d={path} />
    </svg>
  );
}

const SOCIAL_ICON_PATHS = {
  facebook: 'M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.239.386-.334.905-.334 1.577v1.472h3.981l-.238 1.577-.353 2.09h-3.39v8.198C19.396 23.238 24 18.179 24 12.044c0-6.628-5.372-12-12-12s-12 5.372-12 12c0 5.628 3.874 10.35 9.101 11.647Z',
  linkedin: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z',
  x: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z',
  instagram: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z',
  youtube: 'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z',
};

const SOCIAL_HANDLE = 'vaantyyx';
const SOCIALS = [
  { key: 'facebook', url: `https://www.facebook.com/${SOCIAL_HANDLE}/` },
  { key: 'linkedin', url: `https://www.linkedin.com/in/${SOCIAL_HANDLE}/` },
  { key: 'x', url: `https://x.com/${SOCIAL_HANDLE}` },
  { key: 'instagram', url: `https://www.instagram.com/${SOCIAL_HANDLE}/` },
  { key: 'youtube', url: `https://www.youtube.com/@${SOCIAL_HANDLE}` },
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

/* ─── Shared scroll-triggered animation curves ──────────────────────────── */
const EASE_OUT = [0.16, 1, 0.3, 1];

const revealVariants = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE_OUT } },
};

const staggerContainerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09, delayChildren: 0.04 } },
};

/* ─── Fixed top bar that fills with page scroll progress ───────────────── */
function ScrollProgressBar() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 26, restDelta: 0.001 });
  return <motion.div className="slp-scroll-progress" style={{ scaleX }} />;
}

/* ─── Scroll-triggered reveal wrapper (Motion whileInView) ──────────────── */
function Reveal({ children, className = '', stagger = false, ...rest }) {
  if (!stagger) {
    return (
      <motion.div
        className={className}
        variants={revealVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.15 }}
        {...rest}
      >
        {children}
      </motion.div>
    );
  }
  return (
    <motion.div
      className={className}
      variants={staggerContainerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.15 }}
      {...rest}
    >
      {Children.map(children, (child, i) => (
        <motion.div key={i} variants={revealVariants} style={{ height: '100%' }}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}

/* ─── Image reveal scrubbed by the element's own scroll position ───────── */
function ImageReveal({ src, alt, className = '', dir = 'ltr' }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 88%', 'start 45%'] });
  const progress = useSpring(scrollYProgress, { stiffness: 130, damping: 26, mass: 0.4 });
  const clipPath = useTransform(
    progress,
    [0, 1],
    dir === 'rtl' ? ['inset(0 0% 0 100%)', 'inset(0 0% 0 0%)'] : ['inset(0 100% 0 0%)', 'inset(0 0% 0 0%)']
  );
  const scale = useTransform(progress, [0, 1], [1.15, 1]);

  return (
    <div ref={ref} className={`slp-img-reveal ${className}`}>
      <motion.img src={src} alt={alt} style={{ clipPath, scale }} />
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
  const inView = useInView(ref, { once: true, amount: 0.4 });

  useEffect(() => {
    if (!inView) return;
    const duration = 1600;
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.floor(ease * target));
      if (t < 1) raf = requestAnimationFrame(tick);
      else setDisplay(target);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, target]);

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
  const heroRef = useRef(null);

  /* Hero parallax: background drifts and the text column fades/rises
     as the hero section itself scrolls past, driven directly by scroll
     position rather than a fixed-duration animation. */
  const { scrollYProgress: heroProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const heroBgY = useTransform(heroProgress, [0, 1], ['0%', '22%']);
  const heroContentY = useTransform(heroProgress, [0, 1], ['0%', '30%']);
  const heroContentOpacity = useTransform(heroProgress, [0, 0.7], [1, 0]);

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
    <MotionConfig reducedMotion="user">
    <div className="landing-root" dir={dir}>
      <ScrollProgressBar />

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
          {/* Grouped separately from slp-navbar-icons so the mobile layout
              (see landing.css) can pull the icons up onto the logo's row
              and drop just this button pair to a second, full-width row —
              instead of all 4 controls wrapping wherever they happen to fit. */}
          <div className="slp-navbar-buttons">
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
          </div>

          <div className="slp-navbar-icons">
            <div className="slp-espace-wrap" ref={langRef}>
              <button className="slp-globe-btn" onClick={() => setLangOpen(o => !o)} title={t('languageLabel')}>
                {currentLang.flag ? <img src={currentLang.flag} alt="" className="slp-flag-icon" /> : <UKFlag size={18} />}
              </button>
              {langOpen && (
                <div className="slp-dropdown">
                  {LANGS.map(l => (
                    <button
                      key={l.code}
                      onClick={() => { setLocale(l.code); setLangOpen(false); }}
                      className="slp-dropdown-item"
                    >
                      {l.flag ? <img src={l.flag} alt="" className="slp-flag-icon-sm" /> : <UKFlag size={18} />}
                      {l.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button className="slp-globe-btn" onClick={toggleTheme} title={theme === 'dark' ? t('lightMode') : t('darkMode')}>
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </div>
      </nav>

      {/* ══════════════ HERO (full-bleed, content centered as a column) ══════════════ */}
      <section className="slp-hero" id="slp-about" ref={heroRef}>
        <div className="slp-hero-bg-clip">
          <motion.div className="slp-hero-bg" style={{ y: heroBgY }} />
        </div>

        <div className="slp-hero-inner">
          <motion.div
            className="slp-hero-content"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: EASE_OUT }}
          >
            <motion.div style={{ y: heroContentY, opacity: heroContentOpacity }}>
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
            </motion.div>
          </motion.div>

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
            <button className="slp-btn-white slp-btn-white-outline" onClick={goRegister}>
              {t('landingViewAllAuctions')}
            </button>
          </Reveal>

          <Reveal stagger className="slp-categories-grid">
            {CATEGORIES.map((cat, i) => (
              <div key={i} className="slp-cat-card" onClick={goRegister}>
                <ImageReveal className="slp-cat-card-img" src={cat.img} alt={t(cat.nameKey)} dir={dir} />
                <div className="slp-cat-card-body">
                  <div>
                    <h4>{t(cat.nameKey)}</h4>
                    <p>{cat.count} {t('landingOffersSuffix')}</p>
                  </div>
                  <span className="slp-cat-card-arrow"><ChevronDown size={13} className="slp-cat-card-arrow-icon" /></span>
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
            <div className="slp-footer-contact-item"><Mail size={14} /><a href="https://mail.google.com/mail/?view=cm&fs=1&to=achikh200@gmail.com" target="_blank" rel="noopener noreferrer">achikh200@gmail.com</a></div>
            <div className="slp-footer-contact-item"><Phone size={14} /><a href="tel:+213661271997" dir="ltr">+213 661 27 19 97</a></div>
            <div className="slp-footer-contact-item"><MapPin size={14} /><span>{t('landingFooterAddress')}</span></div>
            <div className="slp-social-row">
              {SOCIALS.map(s => (
                <a key={s.key} href={s.url} target="_blank" rel="noopener noreferrer" className="slp-social-btn" aria-label={s.key}>
                  <SocialIcon path={SOCIAL_ICON_PATHS[s.key]} />
                </a>
              ))}
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
        <button className="slp-scroll-top" onClick={scrollTop} title={t('scrollToTopLabel')}>
          <ArrowUp size={18} />
        </button>
      )}
    </div>
    </MotionConfig>
  );
}
