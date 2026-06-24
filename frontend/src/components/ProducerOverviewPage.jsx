import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Trophy, Sprout, ArrowRight } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';

export default function ProducerOverviewPage({ user, auctions, parcelles }) {
  const { locale } = useTranslation();
  const navigate = useNavigate();

  const activeBidsCount = auctions.filter(a => a.status === 'open' && a.myBidId !== null).length;
  const wonAuctionsCount = auctions.filter(a => a.status === 'closed' && a.myBidId && a.acceptedBidId === a.myBidId).length;

  return (
    <div style={{ flex: 1, padding: '32px 40px', overflowY: 'auto', textAlign: 'start' }}>
      <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: 8, color: 'var(--text-main)' }}>
        {locale === 'ar' ? `مرحباً، ${user.name} 👋` : `Bienvenue, ${user.name} 👋`}
      </h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: 32, fontSize: '0.95rem' }}>
        {locale === 'ar' ? 'إليك ملخص نشاطك الزراعي والمناقصات.' : 'Voici un aperçu de vos activités agricoles et des enchères.'}
      </p>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 36 }}>
        {[
          { icon: Activity, label: locale === 'ar' ? 'عروض نشطة' : 'Offres actives', value: activeBidsCount, color: '#f59e0b' },
          { icon: Trophy, label: locale === 'ar' ? 'مناقصات ربحتها' : 'Enchères gagnées', value: wonAuctionsCount, color: 'var(--primary)' },
          { icon: Sprout, label: locale === 'ar' ? 'عدد قطع الأراضي' : 'Parcelles agricoles', value: parcelles.length, color: '#3b82f6' },
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
            {locale === 'ar' ? 'إدارة حقولك الزراعية' : 'Gérez vos parcelles agricoles'}
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            {locale === 'ar'
              ? 'أضف مواقع حقولك، حدد نوع المحاصيل وسجل تفاصيل الري وطبيعة التربة.'
              : "Ajoutez vos parcelles, spécifiez vos cultures et suivez vos méthodes d'irrigation."}
          </p>
        </div>
        <button onClick={() => navigate('/dashboard/parcelles')} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
          {locale === 'ar' ? 'عرض حقولي' : 'Voir mes parcelles'} <ArrowRight size={16} />
        </button>
      </div>

      {/* Quick link to Auctions */}
      <div className="glass-panel" style={{ padding: '28px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
        <div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 6, color: 'var(--text-main)' }}>
            {locale === 'ar' ? 'عروض الشراء المتاحة' : "Appels d'offres disponibles"}
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            {locale === 'ar'
              ? 'تصفح عروض الشراء القريبة وقدم مقترحات الأسعار.'
              : "Consultez les appels d'offres à proximité et soumettez vos offres."}
          </p>
        </div>
        <button onClick={() => navigate('/dashboard/auctions')} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
          {locale === 'ar' ? 'عرض المزادات' : 'Voir les enchères'} <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
