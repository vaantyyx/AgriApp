import React from 'react';
import { useTranslation } from '../context/LanguageContext';

/**
 * Single-series horizontal bar list. One consistent hue (primary) since color
 * would otherwise double-encode the category the label already names — see
 * the dataviz skill's color-formula (identity is never color-alone here,
 * because there IS no second series to disambiguate).
 */
export default function HorizontalBarChart({ data, formatValue }) {
  const { dir } = useTranslation();
  const max = Math.max(...data.map(d => d.value), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {data.map(d => {
        const pct = Math.max((d.value / max) * 100, 2);
        return (
          <div key={d.label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 5, flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}>
              <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{d.label}</span>
              <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{formatValue(d.value)}</span>
            </div>
            <div style={{ height: 10, borderRadius: 999, background: 'var(--bg-section)', border: '1px solid var(--border)', overflow: 'hidden' }}>
              <div style={{
                width: `${pct}%`, height: '100%', background: 'var(--primary)', borderRadius: 999,
                marginLeft: dir === 'rtl' ? 'auto' : 0, marginRight: dir === 'rtl' ? 0 : 'auto',
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
