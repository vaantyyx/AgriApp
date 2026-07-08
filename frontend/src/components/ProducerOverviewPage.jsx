import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Trophy, Sprout, ArrowRight } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';

export default function ProducerOverviewPage({ user, auctions, parcelles }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const activeBidsCount = auctions.filter(a => a.status === 'open' && a.myBidId !== null).length;
  const wonAuctionsCount = auctions.filter(a => a.status === 'closed' && a.myBidId && a.acceptedBidId === a.myBidId).length;

  return (
    <div style={{ flex: 1, padding: '32px 40px', overflowY: 'auto', textAlign: 'start' }}>
      <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: 8, color: 'var(--text-main)' }}>
        {t('welcome_back', { name: user.name })}
      </h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: 32, fontSize: '0.95rem' }}>
        {t('activity_summary_producer')}
      </p>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 36 }}>
        {[
          { icon: Activity, label: t('activeBidsProducer'), value: activeBidsCount, color: '#f59e0b' },
          { icon: Trophy, label: t('wonAuctions'), value: wonAuctionsCount, color: 'var(--primary)' },
          { icon: Sprout, label: t('myParcelles'), value: parcelles.length, color: '#3b82f6' },
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

      {/* Quick link to Parcelles */}
      <div className="glass-panel" style={{ padding: '28px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, marginBottom: 24 }}>
        <div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 6, color: 'var(--text-main)' }}>
            {t('manage_parcelles_title')}
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            {t('manage_parcelles_desc')}
          </p>
        </div>
        <button onClick={() => navigate('/dashboard/parcelles')} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
          {t('view_parcelles_btn')} <ArrowRight size={16} />
        </button>
      </div>

      {/* Quick link to Auctions */}
      <div className="glass-panel" style={{ padding: '28px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
        <div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 6, color: 'var(--text-main)' }}>
            {t('available_demands_title')}
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            {t('available_demands_desc')}
          </p>
        </div>
        <button onClick={() => navigate('/dashboard/auctions')} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
          {t('view_auctions_btn')} <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
