import React, { useEffect, useState } from 'react';
import { CloudSun, MapPin, Snowflake, CloudRain, Sun } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../context/LanguageContext';
import { fetchParcelleForecast, detectAlerts, weatherCodeIcon } from '../utils/weather.js';

const ALERT_META = {
  frost: { icon: Snowflake, color: '#38bdf8', titleKey: 'weatherAlertFrostTitle', descKey: 'weatherAlertFrostDesc' },
  rain: { icon: CloudRain, color: '#3b82f6', titleKey: 'weatherAlertRainTitle', descKey: 'weatherAlertRainDesc' },
  drought: { icon: Sun, color: '#f59e0b', titleKey: 'weatherAlertDroughtTitle', descKey: 'weatherAlertDroughtDesc' },
};

function ParcelleWeatherCard({ parcelle }) {
  const { t, locale, dir } = useTranslation();
  const [days, setDays] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (parcelle.latitude == null || parcelle.longitude == null) return;
    fetchParcelleForecast(parcelle.latitude, parcelle.longitude)
      .then(d => { if (!cancelled) setDays(d); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [parcelle.latitude, parcelle.longitude]);

  const localeTag = locale === 'ar' ? 'ar-DZ' : locale === 'en' ? 'en-US' : 'fr-DZ';

  if (parcelle.latitude == null || parcelle.longitude == null) {
    return (
      <div className="glass-panel" style={{ padding: 24 }}>
        <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: 6 }}>{parcelle.intitule}</div>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 12 }}>{t('weatherNoCoordsDesc')}</div>
      </div>
    );
  }

  const alerts = days ? detectAlerts(days) : [];

  return (
    <div className="glass-panel" style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}>
        <MapPin size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
        <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{parcelle.intitule}</div>
      </div>

      {error && <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t('weatherError')}</div>}

      {!error && !days && <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t('weatherLoading')}</div>}

      {days && (
        <>
          {alerts.map(a => {
            const meta = ALERT_META[a];
            const Icon = meta.icon;
            return (
              <div key={a} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10,
                background: `${meta.color}18`, border: `1px solid ${meta.color}40`, marginBottom: 10,
                flexDirection: dir === 'rtl' ? 'row-reverse' : 'row',
              }}>
                <Icon size={16} style={{ color: meta.color, flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.8rem', color: meta.color }}>{t(meta.titleKey)}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t(meta.descKey)}</div>
                </div>
              </div>
            );
          })}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(78px, 1fr))', gap: 8, marginTop: 12 }}>
            {days.map((d, i) => (
              <div key={d.date} style={{
                textAlign: 'center', padding: '10px 6px', borderRadius: 10,
                background: 'var(--bg-section)', border: '1px solid var(--border)',
              }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>
                  {i === 0 ? t('weatherTodayLabel') : new Date(d.date).toLocaleDateString(localeTag, { weekday: 'short' })}
                </div>
                <div style={{ fontSize: '1.3rem', marginBottom: 4 }}>{weatherCodeIcon(d.code)}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-main)', fontWeight: 700 }}>{Math.round(d.tempMax)}°</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{Math.round(d.tempMin)}°</div>
                {d.precipitation > 0 && (
                  <div style={{ fontSize: '0.65rem', color: '#3b82f6', marginTop: 2 }}>{d.precipitation.toFixed(1)}mm</div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function WeatherPage({ parcelles, loadingParcelles }) {
  const { t, dir } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="dash-page-scroll" style={{ flex: 1, padding: '32px 40px', overflowY: 'auto', textAlign: dir === 'rtl' ? 'right' : 'left' }}>
      <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: 8, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <CloudSun size={26} style={{ color: 'var(--primary)' }} /> {t('weatherPageTitle')}
      </h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: 28, fontSize: '0.95rem' }}>{t('weatherPageDesc')}</p>

      {loadingParcelles ? (
        <div style={{ color: 'var(--text-muted)' }}>{t('weatherLoading')}</div>
      ) : parcelles.length === 0 ? (
        <div className="glass-panel" style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
          {t('weatherNoParcelles')}
          <div style={{ marginTop: 16 }}>
            <button onClick={() => navigate('/dashboard/parcelles')} className="btn btn-primary">{t('weatherNoCoordsCta')}</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          {parcelles.map(p => <ParcelleWeatherCard key={p._id} parcelle={p} />)}
        </div>
      )}
    </div>
  );
}
