import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Map as MapIcon, MapPin } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTranslation } from '../context/LanguageContext';

export default function ParcellesMapPage({ parcelles, loadingParcelles }) {
  const { t, dir } = useTranslation();
  const navigate = useNavigate();
  const mapRef = useRef(null);
  const leafletMapRef = useRef(null);
  const markersRef = useRef([]);
  const [mapLayer, setMapLayer] = useState('satellite');

  const located = parcelles.filter(p => p.latitude != null && p.longitude != null);
  const missing = parcelles.filter(p => p.latitude == null || p.longitude == null);

  // Create the map once on mount — independent of whether parcelles data has
  // finished loading yet, so a hard refresh (where `parcelles` starts empty
  // and arrives asynchronously) doesn't race the container's mount timing.
  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current) return;

    const map = L.map(mapRef.current, { zoomControl: true, center: [28, 2], zoom: 5 });

    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18 });
    const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 });
    const labelLayer = L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18, opacity: 0.7 });
    satelliteLayer.addTo(map);
    labelLayer.addTo(map);
    map.satelliteLayer = satelliteLayer;
    map.streetLayer = streetLayer;
    map.labelLayer = labelLayer;

    leafletMapRef.current = map;
    setTimeout(() => map.invalidateSize(), 200);

    return () => { map.remove(); leafletMapRef.current = null; };
  }, []);

  // Sync markers whenever the located-parcelles list changes (initial async
  // load, a parcelle added/edited, etc.) without recreating the map itself.
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map) return;

    markersRef.current.forEach(m => map.removeLayer(m));
    markersRef.current = located.map(p => {
      const culturesLabel = p.cultures && p.cultures.length > 0
        ? p.cultures.map(c => c.type_culture).join(', ')
        : t('mapNoneLabel');
      return L.marker([p.latitude, p.longitude])
        .addTo(map)
        .bindPopup(
          `<strong>${p.intitule}</strong><br/>${t('mapSurfaceLabel')}: ${p.superficie} ha<br/>${t('mapCulturesLabel')}: ${culturesLabel}`
        );
    });

    if (markersRef.current.length === 1) {
      map.setView([located[0].latitude, located[0].longitude], 12);
    } else if (markersRef.current.length > 1) {
      map.fitBounds(L.featureGroup(markersRef.current).getBounds().pad(0.2));
    }
  }, [located, t]);

  const handleSwitchLayer = (layerType) => {
    setMapLayer(layerType);
    const map = leafletMapRef.current;
    if (!map) return;
    if (layerType === 'satellite') {
      if (map.hasLayer(map.streetLayer)) map.removeLayer(map.streetLayer);
      map.satelliteLayer.addTo(map);
      map.labelLayer.addTo(map);
    } else {
      if (map.hasLayer(map.satelliteLayer)) map.removeLayer(map.satelliteLayer);
      if (map.hasLayer(map.labelLayer)) map.removeLayer(map.labelLayer);
      map.streetLayer.addTo(map);
    }
  };

  const showEmptyOverlay = !loadingParcelles && located.length === 0;

  return (
    <div className="dash-page-scroll" style={{ flex: 1, padding: '32px 40px', overflowY: 'auto', textAlign: dir === 'rtl' ? 'right' : 'left', display: 'flex', flexDirection: 'column' }}>
      <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: 8, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <MapIcon size={26} style={{ color: 'var(--primary)' }} /> {t('mapPageTitle')}
      </h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: '0.95rem' }}>{t('mapPageDesc')}</p>

      <div style={{ position: 'relative', width: '100%', height: 480, borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border)' }}>
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

        {!showEmptyOverlay && (
          <div style={{
            position: 'absolute', top: 12, [dir === 'rtl' ? 'left' : 'right']: 12, zIndex: 1000,
            display: 'flex', gap: 4, background: 'rgba(10,15,25,0.85)', backdropFilter: 'blur(8px)',
            padding: 2, borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)',
          }}>
            <button
              type="button"
              onClick={() => handleSwitchLayer('satellite')}
              style={{
                border: 'none', background: mapLayer === 'satellite' ? 'var(--primary)' : 'transparent',
                color: mapLayer === 'satellite' ? 'white' : 'rgba(255,255,255,0.75)',
                fontSize: '0.72rem', padding: '6px 12px', borderRadius: 4, cursor: 'pointer', fontWeight: 600,
              }}
            >
              {t('mapLayerSatellite')}
            </button>
            <button
              type="button"
              onClick={() => handleSwitchLayer('street')}
              style={{
                border: 'none', background: mapLayer === 'street' ? 'var(--primary)' : 'transparent',
                color: mapLayer === 'street' ? 'white' : 'rgba(255,255,255,0.75)',
                fontSize: '0.72rem', padding: '6px 12px', borderRadius: 4, cursor: 'pointer', fontWeight: 600,
              }}
            >
              {t('mapLayerStreet')}
            </button>
          </div>
        )}

        {showEmptyOverlay && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 900, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--bg-card)',
          }}>
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>
              {t('mapNoCoordsDesc')}
              <div style={{ marginTop: 16 }}>
                <button onClick={() => navigate('/dashboard/parcelles')} className="btn btn-primary">{t('mapNoCoordsCta')}</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {missing.length > 0 && (
        <div className="glass-panel" style={{ padding: 20, marginTop: 20 }}>
          <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: 6 }}>{t('mapNoCoordsTitle')}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 12 }}>{t('mapNoCoordsDesc')}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {missing.map(p => (
              <span key={p._id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, background: 'var(--bg-section)', border: '1px solid var(--border)', fontSize: '0.8rem', color: 'var(--text-body)' }}>
                <MapPin size={12} /> {p.intitule}
              </span>
            ))}
          </div>
          <button onClick={() => navigate('/dashboard/parcelles')} className="btn btn-secondary btn-sm">{t('mapNoCoordsCta')}</button>
        </div>
      )}
    </div>
  );
}
