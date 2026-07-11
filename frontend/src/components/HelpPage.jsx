import React, { useState } from 'react';
import { HelpCircle, ChevronDown, Mail } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';

const FAQ_KEYS = [
  ['helpFaqQ1', 'helpFaqA1'],
  ['helpFaqQ2', 'helpFaqA2'],
  ['helpFaqQ3', 'helpFaqA3'],
  ['helpFaqQ4', 'helpFaqA4'],
  ['helpFaqQ5', 'helpFaqA5'],
];

export default function HelpPage() {
  const { t, dir } = useTranslation();
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <div className="dash-page-scroll" style={{ flex: 1, padding: '32px 40px', overflowY: 'auto', textAlign: dir === 'rtl' ? 'right' : 'left' }}>
      <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: 8, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <HelpCircle size={26} style={{ color: 'var(--primary)' }} /> {t('helpPageTitle')}
      </h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: 28, fontSize: '0.95rem' }}>{t('helpPageDesc')}</p>

      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden', marginBottom: 24 }}>
        {FAQ_KEYS.map(([qKey, aKey], i) => {
          const isOpen = openIndex === i;
          return (
            <div key={qKey} style={{ borderBottom: i < FAQ_KEYS.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <button
                onClick={() => setOpenIndex(isOpen ? -1 : i)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                  padding: '18px 24px', background: 'transparent', border: 'none', cursor: 'pointer',
                  flexDirection: dir === 'rtl' ? 'row-reverse' : 'row', textAlign: dir === 'rtl' ? 'right' : 'left',
                }}
              >
                <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.9rem' }}>{t(qKey)}</span>
                <ChevronDown size={18} style={{ color: 'var(--text-muted)', flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
              </button>
              {isOpen && (
                <div style={{ padding: '0 24px 20px', color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.6 }}>
                  {t(aKey)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="glass-panel" style={{ padding: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: 6 }}>{t('helpContactTitle')}</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t('helpContactDesc')}</p>
        </div>
        <a href="mailto:contact@sougra.dz" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
          <Mail size={16} /> {t('helpContactEmailLabel')}
        </a>
      </div>
    </div>
  );
}
