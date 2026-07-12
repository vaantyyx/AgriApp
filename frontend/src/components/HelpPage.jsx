import React, { useState } from 'react';
import { HelpCircle, ChevronDown, Mail, X, Send, CheckCircle2, AlertCircle } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';
import { BACKEND_URL } from '../utils/config.js';

const FAQ_KEYS = [
  ['helpFaqQ1', 'helpFaqA1'],
  ['helpFaqQ2', 'helpFaqA2'],
  ['helpFaqQ3', 'helpFaqA3'],
  ['helpFaqQ4', 'helpFaqA4'],
  ['helpFaqQ5', 'helpFaqA5'],
  ['helpFaqQ6', 'helpFaqA6'],
  ['helpFaqQ7', 'helpFaqA7'],
  ['helpFaqQ8', 'helpFaqA8'],
  ['helpFaqQ9', 'helpFaqA9'],
  ['helpFaqQ10', 'helpFaqA10'],
  ['helpFaqQ11', 'helpFaqA11'],
  ['helpFaqQ12', 'helpFaqA12'],
  ['helpFaqQ13', 'helpFaqA13'],
  ['helpFaqQ14', 'helpFaqA14'],
  ['helpFaqQ15', 'helpFaqA15'],
];

function ContactSupportModal({ user, token, locale, dir, t, onClose }) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    if (!subject.trim()) { setError(t('helpContactSubjectRequired')); return; }
    if (!message.trim()) { setError(t('helpContactMessageRequired')); return; }

    setSending(true);
    setError('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/support/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: user?.name || '', subject: subject.trim(), message: message.trim(), locale }),
      });
      const data = await res.json();
      if (res.ok) {
        setSent(true);
      } else {
        setError(data.error || t('helpContactErrorGeneric'));
      }
    } catch {
      setError(t('helpContactErrorGeneric'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', padding: 20,
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel animate-fade-in"
        dir={dir}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('helpContactModalTitle')}
        style={{ maxWidth: 460, width: '100%', padding: 32, position: 'relative', textAlign: dir === 'rtl' ? 'right' : 'left' }}
      >
        <button
          onClick={onClose}
          aria-label={t('helpContactCloseBtn')}
          style={{ position: 'absolute', top: 16, [dir === 'rtl' ? 'left' : 'right']: 16, background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', cursor: 'pointer' }}
        >
          <X size={16} />
        </button>

        {sent ? (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ display: 'inline-flex', padding: 14, borderRadius: '50%', background: 'rgba(16,185,129,0.12)', color: 'var(--primary)', marginBottom: 18 }}>
              <CheckCircle2 size={32} />
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: 8 }}>{t('helpContactSuccessTitle')}</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: 24 }}>{t('helpContactSuccessDesc')}</p>
            <button onClick={onClose} className="btn btn-primary" style={{ padding: '10px 28px' }}>
              {t('helpContactCloseBtn')}
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: 'inline-flex', padding: 12, borderRadius: '50%', background: 'var(--primary-glow)', color: 'var(--primary)', marginBottom: 16 }}>
              <Mail size={22} />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: 6 }}>{t('helpContactModalTitle')}</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: 22 }}>{t('helpContactModalDesc')}</p>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label>{t('helpContactSubjectLabel')}</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => { setSubject(e.target.value); setError(''); }}
                placeholder={t('helpContactSubjectPlaceholder')}
                maxLength={200}
                style={{ width: '100%', textAlign: dir === 'rtl' ? 'right' : 'left' }}
                autoFocus
              />
            </div>

            <div className="form-group" style={{ marginBottom: 10 }}>
              <label>{t('helpContactMessageLabel')}</label>
              <textarea
                value={message}
                onChange={(e) => { setMessage(e.target.value); setError(''); }}
                placeholder={t('helpContactMessagePlaceholder')}
                maxLength={5000}
                rows={5}
                style={{ width: '100%', resize: 'vertical', textAlign: dir === 'rtl' ? 'right' : 'left', fontFamily: 'inherit' }}
              />
            </div>

            {error && (
              <div style={{
                borderRadius: 8, padding: '10px 14px', fontSize: '0.85rem', marginBottom: 16,
                display: 'flex', alignItems: 'center', gap: 8,
                color: '#9b1c1c', background: 'var(--danger-soft)', border: '1px solid rgba(229,62,62,0.25)',
              }}>
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}>
              <button onClick={onClose} className="btn btn-secondary" style={{ padding: '10px 20px' }} disabled={sending}>
                {t('helpContactCancelBtn')}
              </button>
              <button
                onClick={handleSend}
                className="btn btn-primary"
                disabled={sending}
                style={{ padding: '10px 22px', display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                {sending ? (
                  <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                ) : (
                  <Send size={15} />
                )}
                {sending ? t('helpContactSending') : t('helpContactSendBtn')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function HelpPage({ user, token }) {
  const { t, dir, locale } = useTranslation();
  const [openIndex, setOpenIndex] = useState(0);
  const [showContactModal, setShowContactModal] = useState(false);

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
        <button onClick={() => setShowContactModal(true)} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
          <Mail size={16} /> {t('helpContactEmailLabel')}
        </button>
      </div>

      {showContactModal && (
        <ContactSupportModal
          user={user}
          token={token}
          locale={locale}
          dir={dir}
          t={t}
          onClose={() => setShowContactModal(false)}
        />
      )}
    </div>
  );
}
