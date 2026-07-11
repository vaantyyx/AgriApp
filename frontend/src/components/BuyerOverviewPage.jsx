import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Gavel, Check, ListOrdered, Plus, ArrowRight } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';
import { computeBuyerCompletion } from './BuyerProfilePage';

function getMissingFieldsList(user, locale) {
  const missing = [];
  const labels = {
    wilaya: { fr: 'Wilaya', ar: 'الولاية', en: 'Wilaya' },
    commune: { fr: 'Commune', ar: 'البلدية', en: 'Commune' },
    phone: { fr: 'Téléphone', ar: 'الهاتف', en: 'Phone' },
    forme_juridique: { fr: 'Forme juridique', ar: 'الشكل القانوني', en: 'Legal form' },
    rc: { fr: 'Registre de commerce (RC)', ar: 'السجل التجاري (RC)', en: 'Business registration (RC)' },
    nif: { fr: 'NIF', ar: 'الرقم الضريبي (NIF)', en: 'Tax ID (NIF)' },
    secteur_activite: { fr: "Secteur d'activité", ar: 'قطاع النشاط', en: 'Business sector' },
    nom_commercial: { fr: 'Nom commercial', ar: 'الاسم التجاري', en: 'Trade name' },
  };
  if (!user) return [];
  if (!user.wilaya || !user.wilaya.trim()) missing.push(labels.wilaya[locale] || labels.wilaya.fr);
  if (!user.commune || !user.commune.trim()) missing.push(labels.commune[locale] || labels.commune.fr);
  if (!user.phone || !user.phone.trim()) missing.push(labels.phone[locale] || labels.phone.fr);
  if (user.entity_type === 'entreprise') {
    if (!user.forme_juridique?.trim()) missing.push(labels.forme_juridique[locale] || labels.forme_juridique.fr);
    if (!user.rc?.trim()) missing.push(labels.rc[locale] || labels.rc.fr);
    if (!user.nif?.trim()) missing.push(labels.nif[locale] || labels.nif.fr);
    if (!user.secteur_activite?.trim()) missing.push(labels.secteur_activite[locale] || labels.secteur_activite.fr);
    if (!user.nom_commercial?.trim()) missing.push(labels.nom_commercial[locale] || labels.nom_commercial.fr);
  }
  return missing;
}

export default function BuyerOverviewPage({ user, auctions }) {
  const { t, locale } = useTranslation();
  const navigate = useNavigate();

  const myAuctions = auctions.filter(a => a.isOwner);
  const completion = computeBuyerCompletion(user);

  return (
    <div className="dash-page-scroll" style={{ flex: 1, padding: '32px 40px', overflowY: 'auto', textAlign: 'start' }}>
      <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: 8, color: 'var(--text-main)' }}>
        {t('welcome_back', { name: user.name })}
      </h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: 32, fontSize: '0.95rem' }}>
        {t('activity_summary')}
      </p>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginBottom: 36 }}>
        {[
          { icon: Gavel, label: t('total_auctions'), value: myAuctions.length, color: 'var(--primary)' },
          { icon: ListOrdered, label: t('statusOpen'), value: myAuctions.filter(a => a.status === 'open').length, color: '#f59e0b' },
          { icon: Check, label: t('statusClosed'), value: myAuctions.filter(a => a.status === 'closed').length, color: '#3b82f6' },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="glass-panel" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: `${stat.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={24} style={{ color: stat.color }} />
              </div>
              <div>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: stat.color }}>{stat.value}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{stat.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Profile Completion Widget */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '28px', display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap', textAlign: 'start' }}>
        <div style={{ position: 'relative', width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="80" height="80" viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="40" cy="40" r="34" stroke="rgba(255,255,255,0.05)" strokeWidth="6" fill="transparent" />
            <circle cx="40" cy="40" r="34" stroke="var(--primary)" strokeWidth="6" fill="transparent"
              strokeDasharray={`${2 * Math.PI * 34}`}
              strokeDashoffset={`${2 * Math.PI * 34 * (1 - completion / 100)}`}
              style={{ transition: 'stroke-dashoffset 0.8s ease' }}
            />
          </svg>
          <div style={{ position: 'absolute', fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)' }}>
            {completion}%
          </div>
        </div>
        <div style={{ flex: 1, minWidth: '240px', textAlign: 'start' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-main)' }}>
            {t('profile_completion_title')}
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: 0, lineHeight: 1.4 }}>
            {completion < 70
              ? t('profile_completion_warning')
              : t('profile_completion_ok')}
          </p>
          {completion < 70 && (
            <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '0.72rem' }}>
              {getMissingFieldsList(user, locale).map((field, idx) => (
                <span key={idx} style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', padding: '2px 8px', borderRadius: '4px' }}>
                  {field}
                </span>
              ))}
            </div>
          )}
        </div>
        {completion < 100 && (
          <button onClick={() => navigate('/profile')} className="btn btn-secondary" style={{ fontSize: '0.85rem', padding: '8px 16px', whiteSpace: 'nowrap' }}>
            {t('edit_profile_btn')}
          </button>
        )}
      </div>

      {/* CTA */}
      <div className="glass-panel" style={{ padding: '28px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
        <div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 6, color: 'var(--text-main)' }}>
            {t('create_new_auction_title')}
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            {t('create_new_auction_desc')}
          </p>
        </div>
        <button onClick={() => navigate('/dashboard/auctions')} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
          <Plus size={18} />
          {t('create_auction_btn')}
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
