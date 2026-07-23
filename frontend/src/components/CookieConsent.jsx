import { useState } from 'react';
import { Cookie } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../context/LanguageContext';
import { trackVisit } from '../utils/trackVisit.js';

const STORAGE_KEY = 'sougra_cookie_consent'; // 'accepted' | 'rejected'

export default function CookieConsent() {
  const { t, dir } = useTranslation();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(() => !localStorage.getItem(STORAGE_KEY));

  const decide = (choice) => {
    localStorage.setItem(STORAGE_KEY, choice);
    setVisible(false);
    if (choice === 'accepted') trackVisit();
  };

  if (!visible) return null;

  return (
    <div className="cookie-banner" dir={dir}>
      <div className="cookie-banner-inner">
        <div className="cookie-banner-icon"><Cookie size={22} /></div>
        <p className="cookie-banner-text">
          {t('cookieBannerMessage')}{' '}
          <button
            type="button"
            className="cookie-banner-link"
            onClick={() => navigate('/terms')}
          >
            {t('cookieBannerLearnMore')}
          </button>
        </p>
        <div className="cookie-banner-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => decide('rejected')}>
            {t('cookieBannerReject')}
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => decide('accepted')}>
            {t('cookieBannerAccept')}
          </button>
        </div>
      </div>
    </div>
  );
}
