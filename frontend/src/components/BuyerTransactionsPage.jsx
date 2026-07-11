import React, { useMemo } from 'react';
import { Receipt, Download, Printer } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';
import { resolveAcceptedLine } from '../utils/auctionHelpers.js';
import { downloadCsv } from '../utils/csvExport.js';

export default function BuyerTransactionsPage({ auctions }) {
  const { t, dir, locale } = useTranslation();
  const localeTag = locale === 'ar' ? 'ar-DZ' : locale === 'en' ? 'en-US' : 'fr-DZ';

  const rows = useMemo(() => {
    return auctions
      .filter(a => a.isOwner && a.status === 'closed')
      .map(a => {
        const bid = a.acceptedBidId ? (a.bids || []).find(b => b.id === a.acceptedBidId) : null;
        const line = bid ? resolveAcceptedLine(bid, a.acceptedLineId) : null;
        return {
          id: a.id,
          date: a.endAt || a.createdAt,
          product: a.product,
          quantity: line?.quantity || a.quantity || '',
          unit: line?.unit || a.unit || '',
          price: line?.price ?? null,
          counterpart: bid?.producerAlias || '-',
        };
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [auctions]);

  const formatDate = (d) => d ? new Date(d).toLocaleDateString(localeTag, { dateStyle: 'medium' }) : '-';
  const formatPrice = (r) => r.price != null ? `${Math.round(r.price).toLocaleString(localeTag)} ${t('currencyDA')}` : '-';

  const handleExport = () => {
    downloadCsv('sougra-transactions.csv',
      [
        { key: 'date', header: t('transactionsColDate') },
        { key: 'product', header: t('transactionsColProduct') },
        { key: 'quantity', header: t('transactionsColQuantity') },
        { key: 'price', header: t('transactionsColPrice') },
        { key: 'counterpart', header: t('transactionsColCounterpart') },
        { key: 'status', header: t('transactionsColStatus') },
      ],
      rows.map(r => ({
        date: formatDate(r.date),
        product: r.product,
        quantity: `${r.quantity} ${r.unit}`,
        price: formatPrice(r),
        counterpart: r.counterpart,
        status: t('transactionsStatusCompleted'),
      }))
    );
  };

  return (
    <div className="dash-page-scroll" style={{ flex: 1, padding: '32px 40px', overflowY: 'auto', textAlign: dir === 'rtl' ? 'right' : 'left' }}>
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 8 }}>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Receipt size={26} style={{ color: 'var(--primary)' }} /> {t('transactionsPageTitle')}
        </h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleExport} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Download size={16} /> {t('exportCsvBtn')}
          </button>
          <button onClick={() => window.print()} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Printer size={16} /> {t('printBtn')}
          </button>
        </div>
      </div>
      <p className="no-print" style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: '0.95rem' }}>{t('transactionsPageDescBuyer')}</p>

      <div className="glass-panel print-area" style={{ padding: 0, overflow: 'hidden', overflowX: 'auto' }}>
        {rows.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>{t('transactionsEmpty')}</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['transactionsColDate', 'transactionsColProduct', 'transactionsColQuantity', 'transactionsColPrice', 'transactionsColCounterpart', 'transactionsColStatus'].map(k => (
                  <th key={k} style={{ padding: '14px 18px', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: dir === 'rtl' ? 'right' : 'left' }}>{t(k)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '14px 18px', fontSize: '0.85rem', color: 'var(--text-main)' }}>{formatDate(r.date)}</td>
                  <td style={{ padding: '14px 18px', fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 600 }}>{r.product}</td>
                  <td style={{ padding: '14px 18px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{r.quantity} {r.unit}</td>
                  <td style={{ padding: '14px 18px', fontSize: '0.85rem', color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums' }}>{formatPrice(r)}</td>
                  <td style={{ padding: '14px 18px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{r.counterpart}</td>
                  <td style={{ padding: '14px 18px' }}>
                    <span style={{
                      fontSize: '0.72rem', fontWeight: 700, padding: '4px 10px', borderRadius: 999,
                      background: 'rgba(16,185,129,0.14)', color: 'var(--primary)',
                    }}>
                      {t('transactionsStatusCompleted')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
