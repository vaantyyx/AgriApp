import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar as CalendarIcon, Droplets } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';
import { getCropInfo, IRRIGATION_TIP_KEYS } from '../utils/cropCalendar.js';

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export default function CropCalendarPage({ parcelles, loadingParcelles }) {
  const { t, locale, dir } = useTranslation();
  const navigate = useNavigate();
  const localeTag = locale === 'ar' ? 'ar-DZ' : locale === 'en' ? 'en-US' : 'fr-DZ';

  const rows = useMemo(() => {
    const seen = new Set();
    const list = [];
    parcelles.forEach(p => {
      (p.cultures || []).forEach(c => {
        const subtypes = Array.isArray(c.sous_type_culture) ? c.sous_type_culture : [];
        const names = subtypes.length > 0 ? subtypes : (c.type_culture ? [c.type_culture] : []);
        names.forEach(name => {
          if (seen.has(name)) return;
          const info = getCropInfo(name, c.type_culture);
          if (!info) return;
          seen.add(name);
          list.push({ name, info });
        });
      });
    });
    return list;
  }, [parcelles]);

  const irrigationMethods = useMemo(() => {
    const seen = new Set();
    parcelles.forEach(p => { if (p.irrigationMethod) seen.add(p.irrigationMethod); });
    return Array.from(seen);
  }, [parcelles]);

  const monthLabel = (m) => new Date(2024, m - 1, 1).toLocaleDateString(localeTag, { month: 'short' });

  return (
    <div className="dash-page-scroll" style={{ flex: 1, padding: '32px 40px', overflowY: 'auto', textAlign: dir === 'rtl' ? 'right' : 'left' }}>
      <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: 8, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <CalendarIcon size={26} style={{ color: 'var(--primary)' }} /> {t('calendarPageTitle')}
      </h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: '0.95rem' }}>{t('calendarPageDesc')}</p>

      {!loadingParcelles && parcelles.length === 0 ? (
        <div className="glass-panel" style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
          {t('calendarNoParcelles')}
          <div style={{ marginTop: 16 }}>
            <button onClick={() => navigate('/dashboard/parcelles')} className="btn btn-primary">{t('mapNoCoordsCta')}</button>
          </div>
        </div>
      ) : rows.length === 0 ? (
        <div className="glass-panel" style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
          {t('calendarNoCultures')}
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 20, marginBottom: 16, fontSize: '0.8rem', color: 'var(--text-muted)', flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--primary)', display: 'inline-block' }} /> {t('calendarLegendSowing')}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: '#f59e0b', display: 'inline-block' }} /> {t('calendarLegendHarvest')}
            </span>
          </div>

          <div className="glass-panel" style={{ padding: 20, overflowX: 'auto', marginBottom: 24 }}>
            <table style={{ borderCollapse: 'separate', borderSpacing: 4, width: '100%', minWidth: 720 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: dir === 'rtl' ? 'right' : 'left', fontSize: '0.8rem', color: 'var(--text-muted)', padding: '0 8px' }}></th>
                  {MONTHS.map(m => (
                    <th key={m} style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'capitalize' }}>{monthLabel(m)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ name, info }) => (
                  <tr key={name}>
                    <td style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap', padding: '4px 8px' }}>
                      {name}
                      {info.perennial && (
                        <div style={{ fontSize: '0.65rem', fontWeight: 500, color: 'var(--text-muted)' }}>{t('calendarPerennialNote')}</div>
                      )}
                    </td>
                    {MONTHS.map(m => {
                      const sowing = info.sowing.includes(m);
                      const harvest = info.harvest.includes(m);
                      return (
                        <td key={m} style={{ padding: 0 }}>
                          <div style={{
                            height: 22, borderRadius: 5,
                            background: harvest ? '#f59e0b' : sowing ? 'var(--primary)' : 'var(--bg-section)',
                            border: '1px solid var(--border)',
                          }} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 12 }}>{t('calendarApproxNote')}</div>
          </div>
        </>
      )}

      {irrigationMethods.length > 0 && (
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Droplets size={18} style={{ color: 'var(--primary)' }} /> {t('calendarIrrigationTitle')}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
            {irrigationMethods.map(method => {
              const tipKey = IRRIGATION_TIP_KEYS[method];
              return (
                <div key={method} className="glass-panel" style={{ padding: 18 }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: 6, fontSize: '0.88rem' }}>{method}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{tipKey ? t(tipKey) : ''}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
