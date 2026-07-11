/** Open-Meteo is a free, keyless, CORS-open weather API — no backend proxy needed. */
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

export async function fetchParcelleForecast(lat, lng) {
  const url = `${FORECAST_URL}?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode&timezone=auto&forecast_days=7`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('weather fetch failed');
  const data = await res.json();
  const daily = data.daily;
  return daily.time.map((date, i) => ({
    date,
    tempMax: daily.temperature_2m_max[i],
    tempMin: daily.temperature_2m_min[i],
    precipitation: daily.precipitation_sum[i],
    code: daily.weathercode[i],
  }));
}

/** Frost / heavy rain / drought thresholds — simple heuristics, not an agronomic model. */
export function detectAlerts(days) {
  const alerts = [];
  if (days.some(d => d.tempMin <= 2)) alerts.push('frost');
  if (days.some(d => d.precipitation >= 20)) alerts.push('rain');

  let consecutiveDry = 0;
  let droughtFound = false;
  for (const d of days) {
    if (d.precipitation === 0 && d.tempMax > 30) consecutiveDry++;
    else consecutiveDry = 0;
    if (consecutiveDry >= 5) droughtFound = true;
  }
  if (droughtFound) alerts.push('drought');

  return alerts;
}

export function weatherCodeIcon(code) {
  if (code === 0) return '☀️';
  if ([1, 2, 3].includes(code)) return '⛅';
  if ([45, 48].includes(code)) return '🌫️';
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return '🌧️';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return '❄️';
  if ([95, 96, 99].includes(code)) return '⛈️';
  return '🌡️';
}
