import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from '../context/LanguageContext';
import { UKFlag, LANGS } from './landingShared';

/* Flag-icon language switcher used in the app header (dashboard/profile
   routes) — same trigger+dropdown pattern as the landing navbar's language
   menu, styled to sit on the theme-aware header instead of the landing
   page's fixed dark navbar. */
export default function LanguageSwitcher() {
  const { locale, setLocale } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const currentLang = LANGS.find(l => l.code === locale) || LANGS[0];

  return (
    <div className="header-lang-wrap" ref={ref}>
      <button
        type="button"
        id="lang-switcher"
        className="lang-trigger-btn header-lang-btn"
        onClick={() => setOpen(o => !o)}
        title="Language"
      >
        {currentLang.flag ? <img src={currentLang.flag} alt="" style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover' }} /> : <UKFlag size={18} />}
      </button>
      {open && (
        <div className="header-lang-dropdown animate-fade-in">
          {LANGS.map(l => (
            <button
              key={l.code}
              onClick={() => { setLocale(l.code); setOpen(false); }}
            >
              {l.flag ? <img src={l.flag} alt="" /> : <UKFlag size={18} />}
              {l.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
