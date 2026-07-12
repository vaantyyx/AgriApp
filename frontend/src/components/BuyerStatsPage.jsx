import { useMemo } from 'react';
import { Gavel, Wallet, TrendingUp } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';
import { resolveAcceptedLine } from '../utils/auctionHelpers.js';
import HorizontalBarChart from './HorizontalBarChart';

export default function BuyerStatsPage({ auctions }) {
  const { t, dir, locale } = useTranslation();
  const localeTag = locale === 'ar' ? 'ar-DZ' : locale === 'en' ? 'en-US' : 'fr-DZ';

  const stats = useMemo(() => {
    const mine = auctions.filter(a => a.isOwner);
    const closed = mine.filter(a => a.status === 'closed' && a.acceptedBidId);

    let totalSpent = 0;
    const spentByProduct = {};
    const priceSamplesByProduct = {};
    closed.forEach(a => {
      const bid = (a.bids || []).find(b => b.id === a.acceptedBidId);
      const line = resolveAcceptedLine(bid, a.acceptedLineId);
      if (!line) return;
      const price = parseFloat(line.price) || 0;
      const qty = parseFloat(line.quantity) || parseFloat(a.quantity) || 0;
      totalSpent += price * qty;
      spentByProduct[a.product] = (spentByProduct[a.product] || 0) + price * qty;
      (priceSamplesByProduct[a.product] ||= []).push(price);
    });

    const spentRows = Object.entries(spentByProduct)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);

    const avgPriceRows = Object.entries(priceSamplesByProduct)
      .map(([label, prices]) => ({ label, value: prices.reduce((s, p) => s + p, 0) / prices.length }))
      .sort((a, b) => b.value - a.value);

    return { closedCount: closed.length, totalSpent, spentRows, avgPriceRows };
  }, [auctions]);

  const formatDA = (v) => `${Math.round(v).toLocaleString(localeTag)} ${t('currencyDA')}`;

  const tiles = [
    { icon: Gavel, label: t('statClosedAuctions'), value: stats.closedCount, color: 'var(--primary)' },
    { icon: Wallet, label: t('statTotalSpent'), value: formatDA(stats.totalSpent), color: '#f59e0b' },
  ];

  return (
    <div className="dash-page-scroll" style={{ flex: 1, padding: '32px 40px', overflowY: 'auto', textAlign: dir === 'rtl' ? 'right' : 'left' }}>
      <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: 8, color: 'var(--text-main)' }}>{t('statsPageTitle')}</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: 32, fontSize: '0.95rem' }}>{t('statsPageDescBuyer')}</p>

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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
        <div className="glass-panel" style={{ padding: 28 }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: 20 }}>{t('statSpentByProduct')}</h3>
          {stats.spentRows.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t('statNoData')}</div>
          ) : (
            <HorizontalBarChart data={stats.spentRows} formatValue={formatDA} />
          )}
        </div>

        <div className="glass-panel" style={{ padding: 28 }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={18} style={{ color: 'var(--primary)' }} /> {t('statAvgPricePerProduct')}
          </h3>
          {stats.avgPriceRows.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t('statNoData')}</div>
          ) : (
            <HorizontalBarChart data={stats.avgPriceRows} formatValue={formatDA} />
          )}
        </div>
      </div>
    </div>
  );
}
