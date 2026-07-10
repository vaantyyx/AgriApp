import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sun, Moon, Home } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { UKFlag, LANGS } from './landingShared';
import '../landing.css';

/* Same slp-navbar used on the landing page (logo, language switcher, theme
   toggle, same positioning), minus the anchor nav links and CTA buttons
   that only make sense on the scrolling landing page itself. Used on
   login/register/terms so those pages don't carry a second, different-
   looking header on top of their own content. */
export default function SiteNavbar() {
  const { t, dir, locale, setLocale } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    function onClickOutside(e) {
      if (langRef.current && !langRef.current.contains(e.target)) setLangOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const currentLang = LANGS.find(l => l.code === locale) || LANGS[0];

  return (
    <nav className="slp-navbar" dir={dir}>
      <div className="slp-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
        <img src="/logo.png" alt="Sougra" />
        <div className="slp-logo-text">
          <strong>SOUGRA</strong>
          <span>{t('landingLogoTagline')}</span>
        </div>
      </div>

      <div className="slp-navbar-actions">
        <button className="slp-btn-white" onClick={() => navigate('/')}>
          <Home size={14} /> {t('home')}
        </button>

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
  );
}
