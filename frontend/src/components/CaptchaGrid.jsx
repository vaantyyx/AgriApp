import React, { useState, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import { RefreshCw, Check, X, ShieldCheck } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';
import { BACKEND_URL } from '../utils/config.js';

/**
 * reCAPTCHA-style trigger: a small "I'm not a robot" style badge that opens
 * a popup with the actual 4x4 image challenge. Exposes to the parent form:
 *   - getToken(): the verified challengeId, or null if not yet verified
 *   - reset(): clears the verified state (call after any login attempt —
 *     the token is single-use and gets consumed server-side either way)
 */
const CaptchaGrid = forwardRef(function CaptchaGrid(_props, ref) {
  const { t, locale } = useTranslation();
  const [modalOpen, setModalOpen] = useState(false);
  const [verified, setVerified] = useState(false);

  const [challengeId, setChallengeId] = useState(null);
  const [categoryLabel, setCategoryLabel] = useState('');
  const [categoryEmoji, setCategoryEmoji] = useState('');
  const [tileCount, setTileCount] = useState(16);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [poppingIndex, setPoppingIndex] = useState(null);
  const requestIdRef = useRef(0);

  const loadChallenge = useCallback(async () => {
    const myRequestId = ++requestIdRef.current;
    setLoading(true);
    setError('');
    setSelected(new Set());
    try {
      const res = await fetch(`${BACKEND_URL}/api/captcha/challenge?locale=${locale}`);
      const data = await res.json();
      if (myRequestId !== requestIdRef.current) return; // superseded by a newer load (e.g. rapid refresh clicks)
      if (!res.ok) { setError(t('captchaLoadError')); return; }
      setChallengeId(data.challengeId);
      setCategoryLabel(data.category?.label || '');
      setCategoryEmoji(data.category?.emoji || '');
      setTileCount(data.tileCount || 16);
    } catch {
      if (myRequestId === requestIdRef.current) setError(t('captchaLoadError'));
    } finally {
      if (myRequestId === requestIdRef.current) setLoading(false);
    }
  }, [locale, t]);

  const openModal = () => {
    setModalOpen(true);
    loadChallenge();
  };

  const closeModal = () => setModalOpen(false);

  const toggleTile = (index) => {
    if (loading || verifying) return;
    setSelected(prev => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
    setPoppingIndex(index);
    setTimeout(() => setPoppingIndex(p => (p === index ? null : p)), 260);
  };

  const handleValidate = async () => {
    if (selected.size === 0) {
      setError(t('captchaSelectAtLeastOne'));
      return;
    }
    setVerifying(true);
    setError('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/captcha/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId, selected: [...selected] }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.reason === 'expired' ? t('captchaExpiredReload') : t('captchaWrongSelection'));
        loadChallenge();
        return;
      }
      setVerified(true);
      setModalOpen(false);
    } catch {
      setError(t('captchaLoadError'));
    } finally {
      setVerifying(false);
    }
  };

  useImperativeHandle(ref, () => ({
    getToken: () => (verified ? challengeId : null),
    reset: () => { setVerified(false); setChallengeId(null); },
  }), [verified, challengeId]);

  return (
    <div className="captcha-wrap">
      <button
        type="button"
        className={`captcha-trigger${verified ? ' verified' : ''}`}
        onClick={openModal}
      >
        <span className="captcha-trigger-box">{verified && <Check size={14} strokeWidth={3} />}</span>
        <span className="captcha-trigger-label">
          {verified ? t('captchaVerified') : t('captchaNotVerified')}
        </span>
        <ShieldCheck size={16} className="captcha-trigger-icon" />
      </button>

      {modalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-box captcha-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t('captchaModalTitle')}>
            <div className="modal-header">
              <span className="modal-title">{t('captchaModalTitle')}</span>
              <button type="button" className="modal-close" onClick={closeModal} aria-label={t('captchaClose')}>
                <X size={16} />
              </button>
            </div>

            <div className="captcha-header">
              <span className="captcha-prompt">
                {loading ? t('captchaLoading') : `${t('captchaPromptPrefix')} ${categoryLabel} ${categoryEmoji}`}
              </span>
              <button
                type="button"
                className="captcha-refresh-btn"
                onClick={loadChallenge}
                disabled={loading || verifying}
                title={t('captchaRefresh')}
              >
                <RefreshCw size={15} className={loading ? 'spinning' : ''} />
              </button>
            </div>

            <div className="captcha-grid">
              {Array.from({ length: tileCount }).map((_, index) => (
                loading ? (
                  <div key={index} className="captcha-tile captcha-skeleton" />
                ) : (
                  <button
                    key={`${challengeId}-${index}`}
                    type="button"
                    className={`captcha-tile${selected.has(index) ? ' selected' : ''}${poppingIndex === index ? ' popping' : ''}`}
                    onClick={() => toggleTile(index)}
                    disabled={verifying}
                  >
                    <img
                      src={`${BACKEND_URL}/api/captcha/image/${challengeId}/${index}`}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      draggable={false}
                    />
                    {selected.has(index) && (
                      <span className="captcha-tile-check"><Check size={14} strokeWidth={3} /></span>
                    )}
                  </button>
                )
              ))}
            </div>

            {error && <div className="captcha-error">{error}</div>}

            <button
              type="button"
              className="btn btn-primary captcha-validate-btn"
              onClick={handleValidate}
              disabled={loading || verifying}
            >
              {verifying ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <span style={{ width: 15, height: 15, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  {t('captchaValidating')}
                </span>
              ) : t('captchaValidateBtn')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

export default CaptchaGrid;
