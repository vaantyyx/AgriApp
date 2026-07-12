import { useMemo } from 'react';
import { Trophy, Percent, Wallet, Activity } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';
import { resolveAcceptedLine } from '../utils/auctionHelpers.js';
import HorizontalBarChart from './HorizontalBarChart';

export default function ProducerStatsPage({ auctions }) {
  const { t, dir, locale } = useTranslation();
  const localeTag = locale === 'ar' ? 'ar-DZ' : locale === 'en' ? 'en-US' : 'fr-DZ';

  const stats = useMemo(() => {
    const withMyBid = auctions.filter(a => a.myBidId);
    const closed = withMyBid.filter(a => a.status === 'closed');
    const won = closed.filter(a => a.acceptedBidId === a.myBidId);
    const activeBids = withMyBid.filter(a => a.status === 'open').length;
    const winRate = closed.length > 0 ? Math.round((won.length / closed.length) * 100) : 0;

    let totalRevenue = 0;
    const revenueByProduct = {};
    won.forEach(a => {
      const bid = (a.bids || []).find(b => b.id === a.myBidId);
      const line = resolveAcceptedLine(bid, a.acceptedLineId);
      if (!line) return;
      const amount = (parseFloat(line.price) || 0) * (parseFloat(line.quantity) || parseFloat(a.quantity) || 0);
      totalRevenue += amount;
      revenueByProduct[a.product] = (revenueByProduct[a.product] || 0) + amount;
    });

    const revenueRows = Object.entries(revenueByProduct)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);

    return { wonCount: won.length, winRate, activeBids, totalRevenue, revenueRows };
  }, [auctions]);

  const formatDA = (v) => `${Math.round(v).toLocaleString(localeTag)} ${t('currencyDA')}`;

  const tiles = [
    { icon: Trophy, label: t('statWonAuctions'), value: stats.wonCount, color: 'var(--primary)' },
    { icon: Percent, label: t('statWinRate'), value: `${stats.winRate}%`, color: '#3b82f6' },
    { icon: Wallet, label: t('statTotalRevenue'), value: formatDA(stats.totalRevenue), color: '#f59e0b' },
    { icon: Activity, label: t('statActiveBids'), value: stats.activeBids, color: '#8b5cf6' },
  ];

  return (
    <div className="dash-page-scroll" style={{ flex: 1, padding: '32px 40px', overflowY: 'auto', textAlign: dir === 'rtl' ? 'right' : 'left' }}>
      <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: 8, color: 'var(--text-main)' }}>{t('statsPageTitle')}</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: 32, fontSize: '0.95rem' }}>{t('statsPageDescProducer')}</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginBottom: 32 }}>
        {tiles.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="glass-panel" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: `${s.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={24} style={{ color: s.color }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: s.color, whiteSpace: 'nowrap' }}>{s.value}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{s.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="glass-panel" style={{ padding: 28 }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: 20 }}>{t('statRevenueByProduct')}</h3>
        {stats.revenueRows.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t('statNoData')}</div>
        ) : (
          <HorizontalBarChart data={stats.revenueRows} formatValue={formatDA} />
        )}
      </div>
    </div>
  );
}
