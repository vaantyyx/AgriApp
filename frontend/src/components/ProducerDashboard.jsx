import { useState, useEffect, useRef } from 'react';
import {
  Send, MessageSquare, Check, Inbox, Trophy, X,
  Image as ImageIcon, Plus, Trash2, Edit3, MapPin,
  Calendar, Layers, ArrowRight, Activity, Sprout
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from '../context/LanguageContext';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useFocusTrap } from '../hooks/useFocusTrap';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { WILAYA_COORDS } from '../utils/wilayaCoordinates.js';
import { getWinnerCongratsMessage, getBidClosedWinnerMessage, isBidLineAccepted } from '../utils/auctionHelpers';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Fix Leaflet default icon paths broken by Vite bundler
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

// Reference data for Parcelles
const cultureTypes = [
  { value: 'Grandes Cultures', label: 'Grandes Cultures' },
  { value: 'Arboriculture', label: 'Arboriculture' },
  { value: 'Maraîchage', label: 'Maraîchage' },
  { value: 'Fourrage', label: 'Fourrage' },
  { value: 'Viticulture', label: 'Viticulture' }
];

const subTypes = {
  'Grandes Cultures': ['Blé Dur', 'Blé Tendre', 'Orge', 'Maïs', 'Avoine', 'Légumineuses'],
  'Arboriculture': ['Olivier', 'Pommier', 'Agrumes', 'Datte', 'Amandier', 'Cerisier', 'Figuier', 'Abricotier'],
  'Maraîchage': ['Tomate', 'Pomme de terre', 'Oignon', 'Piment', 'Laitue', 'Carotte', 'Melon', 'Pastèque'],
  'Fourrage': ['Luzerne', 'Sorgho', 'Bersim', 'Maïs fourrager'],
  'Viticulture': ['Raisin de table', 'Raisin de cuve']
};

const irrigationOptions = [
  { value: 'Goutte à goutte', label: 'Goutte à goutte' },
  { value: 'Aspersion', label: 'Aspersion' },
  { value: 'Gravitaire', label: 'Gravitaire' },
  { value: 'Pluvial', label: 'Pluvial' },
  { value: 'Pivot', label: 'Pivot' }
];

const soilOptions = [
  { value: 'Argileux', label: 'Argileux' },
  { value: 'Sableux', label: 'Sableux' },
  { value: 'Limoneux', label: 'Limoneux' },
  { value: 'Calcaire', label: 'Calcaire' },
  { value: 'Humifère', label: 'Humifère' }
];

const WILAYA_LIST = Object.entries(WILAYA_COORDS)
  .map(([id, w]) => ({ id: parseInt(id), name: w.name }))
  .sort((a, b) => a.id - b.id);

// ─── Image Compressor ───────────────────────────────────────────────────────
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 800;
        let { width, height } = img;
        if (width > height) {
          if (width > MAX) { height *= MAX / width; width = MAX; }
        } else {
          if (height > MAX) { width *= MAX / height; height = MAX; }
        }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
}

// Default empty line for multi-line bids
const emptyLine = () => ({ quality: '', price: '', quantity: '', unit: '', comments: '', images: [], isUploading: false });

const getCultureColor = (type, isSecondary = false) => {
  const colors = {
    'Grandes Cultures': isSecondary ? 'rgba(200,230,201,0.95)' : '#81C784',
    'Arboriculture': isSecondary ? 'rgba(220,237,200,0.95)' : '#AED581',
    'Maraîchage': isSecondary ? 'rgba(240,244,195,0.95)' : '#DCE775',
    'Fourrage': isSecondary ? 'rgba(255,249,196,0.95)' : '#FFF176',
    'Viticulture': isSecondary ? 'rgba(225,190,231,0.95)' : '#BA68C8'
  };
  return colors[type] || (isSecondary ? 'rgba(187,222,251,0.95)' : '#64B5F6');
};

const getPrimaryCultureType = (parcelle) => {
  if (parcelle.cultures && parcelle.cultures.length > 0) {
    return parcelle.cultures[0].type_culture;
  }
  return 'Grandes Cultures';
};

// Sidebar moved to DashboardLayout.jsx
export default function ProducerDashboard({ user, auctions, onPlaceBid, newBidFlashIds, highlightAuctionId, token }) {
  const { locale, t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const urlTab = searchParams.get('tab') || 'dashboard';

  const [activeSection, setActiveSection] = useState(urlTab);

  useEffect(() => {
    // Syncing local UI state to the URL (an external system), not derived
    // render-time state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveSection(urlTab);
  }, [urlTab]);

  // Auctions & bidding state
  const [inputs, setInputs] = useState({});
  const [activeZoomImage, setActiveZoomImage] = useState(null);
  const auctionRefs = useRef({});

  // Parcelles State
  const [parcelles, setParcelles] = useState([]);
  const [loadingParcelles, setLoadingParcelles] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingParcelle, setEditingParcelle] = useState(null);

  useEscapeKey(formOpen, () => setFormOpen(false));
  useEscapeKey(!!activeZoomImage, () => setActiveZoomImage(null));
  const parcelModalRef = useRef(null);
  useFocusTrap(parcelModalRef, formOpen);

  // Parcelles form fields
  const [formIntitule, setFormIntitule] = useState('');
  const [formWilayaId, setFormWilayaId] = useState('');
  const [formSuperficie, setFormSuperficie] = useState('');
  const [formAcquisitionDate, setFormAcquisitionDate] = useState('');
  const [formCultures, setFormCultures] = useState([{ type_culture: '', sous_type_culture: [] }]);
  const [formIrrigationMethod, setFormIrrigationMethod] = useState('');
  const [formSoilType, setFormSoilType] = useState('');
  const [formLatitude, setFormLatitude] = useState('');
  const [formLongitude, setFormLongitude] = useState('');

  // Map settings
  const mapRef = useRef(null);
  const leafletMapRef = useRef(null);
  const markerRef = useRef(null);
  const [mapLayer, setMapLayer] = useState('satellite'); // 'satellite' | 'street'

  // Fetch Parcelles from backend
  const fetchParcelles = async () => {
    if (!token) return;
    setLoadingParcelles(true);
    try {
      const res = await fetch('http://127.0.0.1:3001/api/parcelles', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setParcelles(data);
      }
    } catch (err) {
      console.error('Error fetching parcelles:', err);
    } finally {
      setLoadingParcelles(false);
    }
  };

  useEffect(() => {
    // Fetches from the API and sets a loading flag before the first await —
    // the standard data-fetching-on-dependency-change pattern. fetchParcelles
    // is intentionally omitted from deps: it's redefined every render and
    // this should only re-run when the token changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchParcelles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Scroll to highlighted auction
  useEffect(() => {
    if (activeSection === 'auctions' && highlightAuctionId) {
      setTimeout(() => {
        const el = auctionRefs.current[highlightAuctionId];
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
    }
  }, [highlightAuctionId, activeSection]);

  // Initialize/Destruct Leaflet Map in dialog
  useEffect(() => {
    if (!formOpen) {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
        markerRef.current = null;
      }
      return;
    }

    const timer = setTimeout(() => {
      if (!mapRef.current || leafletMapRef.current) return;

      const initialLat = formLatitude ? parseFloat(formLatitude) : 36.75;
      const initialLng = formLongitude ? parseFloat(formLongitude) : 3.06;

      const map = L.map(mapRef.current, {
        center: [initialLat, initialLng],
        zoom: formLatitude ? 14 : 6,
        zoomControl: true
      });

      const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; World Imagery',
        maxZoom: 18
      });

      const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
      });

      if (mapLayer === 'satellite') {
        satelliteLayer.addTo(map);
      } else {
        streetLayer.addTo(map);
      }

      map.satelliteLayer = satelliteLayer;
      map.streetLayer = streetLayer;

      const labelLayer = L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 18,
        opacity: 0.7
      });
      if (mapLayer === 'satellite') {
        labelLayer.addTo(map);
      }
      map.labelLayer = labelLayer;

      if (formLatitude && formLongitude) {
        const marker = L.marker([initialLat, initialLng], { draggable: true }).addTo(map);
        markerRef.current = marker;

        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          setFormLatitude(pos.lat);
          setFormLongitude(pos.lng);
        });
      }

      map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        setFormLatitude(lat);
        setFormLongitude(lng);

        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          const marker = L.marker([lat, lng], { draggable: true }).addTo(map);
          markerRef.current = marker;

          marker.on('dragend', () => {
            const pos = marker.getLatLng();
            setFormLatitude(pos.lat);
            setFormLongitude(pos.lng);
          });
        }
      });

      leafletMapRef.current = map;
      map.invalidateSize();
    }, 300);

    return () => {
      clearTimeout(timer);
    };
    // formLatitude/formLongitude/mapLayer are read only to set the map's
    // initial state when it (re)opens — including them would recreate the
    // map on every marker drag or layer switch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formOpen]);

  // Switch base layers
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

  // Center on selected Wilaya
  const handleWilayaSelect = (wId) => {
    setFormWilayaId(wId);
    const coords = WILAYA_COORDS[parseInt(wId)];
    if (coords && leafletMapRef.current) {
      leafletMapRef.current.setView([coords.lat, coords.lng], 10);
      
      setFormLatitude(coords.lat);
      setFormLongitude(coords.lng);
      
      if (markerRef.current) {
        markerRef.current.setLatLng([coords.lat, coords.lng]);
      } else {
        const marker = L.marker([coords.lat, coords.lng], { draggable: true }).addTo(leafletMapRef.current);
        markerRef.current = marker;
        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          setFormLatitude(pos.lat);
          setFormLongitude(pos.lng);
        });
      }
    }
  };

  // ─── Input helpers ───────────────────────────────────────────────────────
  const getLines = (auctionId) => inputs[auctionId]?.lines || [emptyLine()];

  const setLine = (auctionId, lineIdx, field, value) => {
    setInputs(prev => {
      const lines = [...(prev[auctionId]?.lines || [emptyLine()])];
      lines[lineIdx] = { ...lines[lineIdx], [field]: value };
      return { ...prev, [auctionId]: { lines } };
    });
  };

  const addLine = (auctionId) => {
    setInputs(prev => {
      const lines = [...(prev[auctionId]?.lines || [emptyLine()]), emptyLine()];
      return { ...prev, [auctionId]: { lines } };
    });
  };

  const removeLine = (auctionId, lineIdx) => {
    setInputs(prev => {
      const lines = (prev[auctionId]?.lines || [emptyLine()]).filter((_, i) => i !== lineIdx);
      return { ...prev, [auctionId]: { lines: lines.length > 0 ? lines : [emptyLine()] } };
    });
  };

  const handleImageChange = async (auctionId, lineIdx, files) => {
    const existing = getLines(auctionId)[lineIdx]?.images || [];
    if (existing.length + files.length > 5) {
      alert(locale === 'ar' ? 'يمكنك إضافة 5 صور كحد أقصى لكل خيار.' : 'Maximum 5 photos par option.');
      return;
    }
    setLine(auctionId, lineIdx, 'isUploading', true);
    try {
      const compressed = await Promise.all(files.map(f => compressImage(f)));
      setInputs(prev => {
        const lines = [...(prev[auctionId]?.lines || [emptyLine()])];
        lines[lineIdx] = {
          ...lines[lineIdx],
          images: [...(lines[lineIdx]?.images || []), ...compressed],
          isUploading: false,
        };
        return { ...prev, [auctionId]: { lines } };
      });
    } catch {
      setLine(auctionId, lineIdx, 'isUploading', false);
    }
  };

  const handleRemoveImage = (auctionId, lineIdx, imgIdx) => {
    setInputs(prev => {
      const lines = [...(prev[auctionId]?.lines || [emptyLine()])];
      lines[lineIdx] = {
        ...lines[lineIdx],
        images: (lines[lineIdx]?.images || []).filter((_, i) => i !== imgIdx),
      };
      return { ...prev, [auctionId]: { lines } };
    });
  };

  const handleSubmitBid = (e, auctionId) => {
    e.preventDefault();
    const lines = getLines(auctionId);
    const validLines = lines.filter(l => l.price && parseFloat(l.price) > 0);
    if (validLines.length === 0) {
      alert(t('enterValidPrice'));
      return;
    }
    const auction = auctions.find(a => a.id === auctionId);
    onPlaceBid({
      auctionId,
      lines: validLines.map(line => ({
        price: parseFloat(line.price),
        quantity: line.quantity ? parseFloat(line.quantity) : null,
        optionName: (line.quality || '').trim(),
        unit: line.unit || auction?.unit || 'tonnes',
        comments: (line.comments || '').trim(),
        images: line.images || [],
      }))
    });
    setInputs(prev => ({ ...prev, [auctionId]: { lines: [emptyLine()] } }));
  };

  // Parcelles CRUD logic
  const handleOpenAddForm = () => {
    setEditingParcelle(null);
    setFormIntitule('');
    setFormWilayaId('');
    setFormSuperficie('');
    setFormAcquisitionDate('');
    setFormCultures([{ type_culture: '', sous_type_culture: [] }]);
    setFormIrrigationMethod('');
    setFormSoilType('');
    setFormLatitude('');
    setFormLongitude('');
    setFormOpen(true);
  };

  const handleOpenEditForm = (parcelle) => {
    setEditingParcelle(parcelle);
    setFormIntitule(parcelle.intitule || '');
    setFormWilayaId(parcelle.wilayaId || '');
    setFormSuperficie(parcelle.superficie || '');
    setFormAcquisitionDate(parcelle.acquisitionDate ? parcelle.acquisitionDate.split('T')[0] : '');
    setFormCultures(parcelle.cultures && parcelle.cultures.length > 0
      ? parcelle.cultures.map(c => ({
          type_culture: c.type_culture,
          sous_type_culture: Array.isArray(c.sous_type_culture) ? c.sous_type_culture : []
        }))
      : [{ type_culture: '', sous_type_culture: [] }]
    );
    setFormIrrigationMethod(parcelle.irrigationMethod || '');
    setFormSoilType(parcelle.soilType || '');
    setFormLatitude(parcelle.latitude || '');
    setFormLongitude(parcelle.longitude || '');
    setFormOpen(true);
  };

  const handleSaveParcelle = async (e) => {
    e.preventDefault();
    if (!formIntitule.trim()) {
      alert(locale === 'ar' ? 'اسم الحقل مطلوب' : (locale === 'en' ? 'Field name is required' : 'Nom de la parcelle requis'));
      return;
    }
    if (!formSuperficie || parseFloat(formSuperficie) <= 0) {
      alert(locale === 'ar' ? 'المساحة يجب أن تكون أكبر من 0' : (locale === 'en' ? 'Area must be greater than 0' : 'La superficie doit être supérieure à 0'));
      return;
    }
    if (!formWilayaId) {
      alert(locale === 'ar' ? 'الرجاء اختيار الولاية' : (locale === 'en' ? 'Please select a wilaya' : 'Veuillez sélectionner une wilaya'));
      return;
    }
    if (formCultures.some(c => !c.type_culture)) {
      alert(locale === 'ar' ? 'الرجاء تحديد نوع الزراعة' : (locale === 'en' ? 'Please select the type for all crops' : 'Veuillez sélectionner le type pour toutes les cultures'));
      return;
    }

    const wilayaObj = WILAYA_COORDS[parseInt(formWilayaId)];
    const payload = {
      intitule: formIntitule.trim(),
      wilayaId: formWilayaId,
      wilayaName: wilayaObj ? wilayaObj.name : '',
      superficie: parseFloat(formSuperficie),
      acquisitionDate: formAcquisitionDate || null,
      cultures: formCultures,
      irrigationMethod: formIrrigationMethod || null,
      soilType: formSoilType || null,
      latitude: formLatitude ? parseFloat(formLatitude) : null,
      longitude: formLongitude ? parseFloat(formLongitude) : null
    };

    try {
      const url = editingParcelle
        ? `http://127.0.0.1:3001/api/parcelles/${editingParcelle._id}`
        : 'http://127.0.0.1:3001/api/parcelles';
      const method = editingParcelle ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setFormOpen(false);
        fetchParcelles();
      } else {
        const err = await res.json();
        alert(err.error || 'Erreur lors de l\'enregistrement de la parcelle');
      }
    } catch (err) {
      console.error('Erreur lors de l\'enregistrement de la parcelle:', err);
    }
  };

  const handleDeleteParcelle = async (id) => {
    if (!window.confirm(locale === 'ar' ? 'هل أنت متأكد من حذف هذه القطعة؟' : 'Voulez-vous vraiment supprimer cette parcelle ?')) return;

    try {
      const res = await fetch(`http://127.0.0.1:3001/api/parcelles/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchParcelles();
      } else {
        alert('Erreur lors de la suppression de la parcelle');
      }
    } catch (err) {
      console.error('Erreur lors de la suppression de la parcelle:', err);
    }
  };

  const handleUpdateCulture = (index, field, value) => {
    setFormCultures(prev => prev.map((c, i) => {
      if (i !== index) return c;
      const updated = { ...c, [field]: value };
      if (field === 'type_culture') updated.sous_type_culture = [];
      return updated;
    }));
  };

  const handleAddFormCulture = () => {
    setFormCultures(prev => [...prev, { type_culture: '', sous_type_culture: [] }]);
  };

  const handleRemoveFormCulture = (index) => {
    setFormCultures(prev => prev.filter((_, i) => i !== index));
  };

  const handleToggleSousType = (index, val) => {
    setFormCultures(prev => prev.map((c, i) => {
      if (i !== index) return c;
      const current = c.sous_type_culture || [];
      const updated = current.includes(val)
        ? current.filter(x => x !== val)
        : [...current, val];
      return { ...c, sous_type_culture: updated };
    }));
  };

  // Stats calculations
  const activeBidsCount = auctions.filter(a => a.status === 'open' && a.myBidId !== null).length;
  const wonAuctionsCount = auctions.filter(a => a.status === 'closed' && a.myBidId && a.acceptedBidId === a.myBidId).length;
  
  const totalSuperficie = parcelles.reduce((sum, p) => sum + (parseFloat(p.superficie) || 0), 0).toFixed(1);
  const uniqueCulturesCount = new Set(
    parcelles.flatMap(p => p.cultures ? p.cultures.map(c => c.type_culture) : [])
  ).size;
  const uniqueWilayasCount = new Set(parcelles.map(p => p.wilayaId).filter(Boolean)).size;

  return (
      <div className="dash-page-scroll" style={{ flex: 1, padding: '32px 40px', overflowY: 'auto', textAlign: 'start', height: '100%' }}>

        {/* Lightbox */}
        {activeZoomImage && (
          <div className="lightbox-modal" onClick={() => setActiveZoomImage(null)}>
            <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
              <button className="lightbox-close" onClick={() => setActiveZoomImage(null)} aria-label={t('captchaClose')}>
                <X size={20} />
              </button>
              <img src={activeZoomImage} alt={t('zoomProduct')} />
            </div>
          </div>
        )}

        {/* ══ SECTION 1: DASHBOARD ══════════════════════════════════════ */}
        {activeSection === 'dashboard' && (
          <div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: 8, color: 'var(--text-main)' }}>
              {locale === 'ar' ? `مرحباً، ${user.name} 👋` : `Bienvenue, ${user.name} 👋`}
            </h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 32, fontSize: '0.95rem' }}>
              {locale === 'ar' ? 'إليك ملخص نشاطك الزراعي والمناقصات.' : 'Voici un aperçu de vos activités agricoles et des enchères.'}
            </p>

            {/* Stats grid */}
            <div className="stats-mini-grid">
              <div className="glass-panel stat-mini-card">
                <div className="stat-mini-icon-box" style={{ background: 'rgba(245,158,11,0.12)' }}>
                  <Activity size={24} style={{ color: '#f59e0b' }} />
                </div>
                <div>
                  <div className="stat-mini-value" style={{ color: '#f59e0b' }}>{activeBidsCount}</div>
                  <div className="stat-mini-label">{locale === 'ar' ? 'عروض نشطة' : 'Offres actives'}</div>
                </div>
              </div>

              <div className="glass-panel stat-mini-card">
                <div className="stat-mini-icon-box" style={{ background: 'rgba(16,185,129,0.12)' }}>
                  <Trophy size={24} style={{ color: 'var(--primary)' }} />
                </div>
                <div>
                  <div className="stat-mini-value" style={{ color: 'var(--primary)' }}>{wonAuctionsCount}</div>
                  <div className="stat-mini-label">{locale === 'ar' ? 'مناقصات ربحتها' : 'Enchères gagnées'}</div>
                </div>
              </div>

              <div className="glass-panel stat-mini-card">
                <div className="stat-mini-icon-box" style={{ background: 'rgba(59,130,246,0.12)' }}>
                  <Sprout size={24} style={{ color: '#3b82f6' }} />
                </div>
                <div>
                  <div className="stat-mini-value" style={{ color: '#3b82f6' }}>{parcelles.length}</div>
                  <div className="stat-mini-label">{locale === 'ar' ? 'عدد قطع الأراضي' : 'Parcelles agricoles'}</div>
                </div>
              </div>
            </div>

            {/* Quick Link Card to Parcelles */}
            <div className="glass-panel" style={{ padding: '28px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 6, color: 'var(--text-main)' }}>
                  {locale === 'ar' ? 'إدارة حقولك الزراعية' : 'Gérez vos parcelles agricoles'}
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  {locale === 'ar' ? 'أضف مواقع حقولك، حدد نوع المحاصيل وسجل تفاصيل الري وطبيعة التربة.' : 'Ajoutez vos parcelles, spécifiez vos cultures et suivez vos méthodes d\'irrigation.'}
                </p>
              </div>
              <button onClick={() => { setActiveSection('parcelles'); navigate('?tab=parcelles'); }} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
                {locale === 'ar' ? 'عرض حقولي' : 'Voir mes parcelles'}
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ══ SECTION 2: PARCELLES (CRUD) ═══════════════════════════════ */}
        {activeSection === 'parcelles' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Sprout size={24} style={{ color: 'var(--primary)' }} />
                  {locale === 'ar' ? 'حقولي الزراعية' : 'Mes parcelles agricoles'}
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 4 }}>
                  {locale === 'ar' ? 'تنظيم ومتابعة استثماراتك الزراعية.' : 'Gérez vos terrains et optimisez vos cultures en temps réel.'}
                </p>
              </div>
              <button onClick={handleOpenAddForm} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Plus size={16} />
                {locale === 'ar' ? 'إضافة قطعة أرض' : 'Nouvelle parcelle'}
              </button>
            </div>

            {/* Parcelles summary statistics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginBottom: 32 }}>
              <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ background: 'rgba(16,185,129,0.06)', padding: 10, borderRadius: 10 }}>
                  <Layers size={20} style={{ color: 'var(--primary)' }} />
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Superficie Totale</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: '800', color: 'var(--text-main)', marginTop: 2 }}>
                    {totalSuperficie} <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 'bold' }}>ha</span>
                  </div>
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ background: 'rgba(245,158,11,0.06)', padding: 10, borderRadius: 10 }}>
                  <Sprout size={20} style={{ color: '#f59e0b' }} />
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Cultures</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: '800', color: 'var(--text-main)', marginTop: 2 }}>
                    {uniqueCulturesCount} <span style={{ fontSize: '0.8rem', color: '#f59e0b', fontWeight: 'bold' }}>types</span>
                  </div>
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ background: 'rgba(59,130,246,0.06)', padding: 10, borderRadius: 10 }}>
                  <MapPin size={20} style={{ color: '#3b82f6' }} />
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Implantations</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: '800', color: 'var(--text-main)', marginTop: 2 }}>
                    {uniqueWilayasCount} <span style={{ fontSize: '0.8rem', color: '#3b82f6', fontWeight: 'bold' }}>wilayas</span>
                  </div>
                </div>
              </div>
            </div>

            {loadingParcelles ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
                Chargement de vos parcelles...
              </div>
            ) : parcelles.length === 0 ? (
              <div className="glass-panel empty-state" style={{ padding: '48px 24px', textAlign: 'center' }}>
                <div style={{ background: 'rgba(16,185,129,0.05)', width: 80, height: 80, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                  <Sprout size={36} style={{ color: 'var(--primary)' }} />
                </div>
                <h4 style={{ fontSize: '1.2rem', marginBottom: 8, color: 'var(--text-main)' }}>Aucune parcelle enregistrée</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', maxWidth: 460, margin: '0 auto 24px' }}>
                  Vous n'avez pas encore ajouté de terres agricoles à votre profil. Créez votre première parcelle pour commencer à l'exploiter !
                </p>
                <button onClick={handleOpenAddForm} className="btn btn-primary">
                  <Plus size={16} /> Ajouter ma première parcelle
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 24 }}>
                {parcelles.map(p => {
                  const primaryCulture = getPrimaryCultureType(p);
                  return (
                    <div key={p._id} className="glass-panel" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%', transition: 'transform 0.2s', border: '1px solid var(--border)' }}
                      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
                      onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                      {/* Gradient background header */}
                      <div style={{
                        height: 90,
                        background: `linear-gradient(135deg, ${getCultureColor(primaryCulture)} 0%, ${getCultureColor(primaryCulture, true)} 100%)`,
                        position: 'relative',
                        padding: '16px 20px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'flex-end'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'absolute', top: 12, left: 16, right: 16 }}>
                          <span style={{
                            background: 'rgba(255,255,255,0.9)',
                            color: 'black',
                            padding: '3px 8px',
                            borderRadius: '20px',
                            fontSize: '0.72rem',
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4
                          }}>
                            <Layers size={11} /> {p.superficie} ha
                          </span>
                          
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => handleOpenEditForm(p)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white' }}>
                              <Edit3 size={12} />
                            </button>
                            <button onClick={() => handleDeleteParcelle(p._id)} style={{ background: 'rgba(239,68,68,0.2)', border: 'none', borderRadius: '50%', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#ef4444' }}>
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>

                        <h4 style={{ color: 'white', fontWeight: 'bold', fontSize: '1.05rem', margin: 0, textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
                          {p.intitule}
                        </h4>
                      </div>

                      {/* Content details */}
                      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <MapPin size={15} style={{ color: 'var(--text-muted)', marginTop: 2, flexShrink: 0 }} />
                          <div>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Localisation</span>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 600 }}>
                              {p.wilayaName ? p.wilayaName : 'Non localisée'}
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          <div style={{ background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.08)', borderRadius: 8, padding: '8px 12px' }}>
                            <div style={{ fontSize: '0.65rem', color: 'var(--primary)', fontWeight: 'bold', textTransform: 'uppercase' }}>Cultures</div>
                            <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-main)', marginTop: 2, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              {p.cultures && p.cultures.length > 0 
                                ? (p.cultures.length === 1 ? p.cultures[0].type_culture : `Multi-cultures (${p.cultures.length})`) 
                                : 'Aucune'}
                            </div>
                          </div>

                          <div style={{ background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.08)', borderRadius: 8, padding: '8px 12px' }}>
                            <div style={{ fontSize: '0.65rem', color: '#3b82f6', fontWeight: 'bold', textTransform: 'uppercase' }}>Irrigation</div>
                            <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-main)', marginTop: 2, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              {p.irrigationMethod || 'Pluvial'}
                            </div>
                          </div>
                        </div>

                        {/* Card footer details */}
                        <div style={{ marginTop: 'auto', paddingTop: 10, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Calendar size={12} /> {p.acquisitionDate ? new Date(p.acquisitionDate).toLocaleDateString('fr-DZ', { year: 'numeric', month: 'short' }) : '—'}
                          </span>
                          <span style={{ color: 'var(--primary)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 3 }}>
                            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)' }} /> Actif
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══ SECTION 3: AUCTIONS (Bidding) ═════════════════════════════ */}
        {activeSection === 'auctions' && (
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: 8 }}>
              {t('availablePublicDemands')}
            </h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 28, fontSize: '0.85rem' }}>
              {locale === 'ar' ? 'تصفح عروض الشراء القريبة وقدم مقترحات الأسعار الخاصة بك.' : 'Consultez les appels d\'offres à proximité et soumettez vos offres.'}
            </p>

            {auctions.length === 0 ? (
              <div className="glass-panel empty-state">
                <div className="empty-state-icon"><Inbox size={28} /></div>
                <h3>{t('noAuctionInCurrent')}</h3>
                <p>{t('noAuctionInCurrentSub')}</p>
              </div>
            ) : (
              [...auctions]
                .sort((a, b) => {
                  if (a.status === 'open' && b.status !== 'open') return -1;
                  if (a.status !== 'open' && b.status === 'open') return 1;
                  return new Date(b.createdAt) - new Date(a.createdAt);
                })
                .map(auction => {
                  const myBid = auction.bids.find(b => b.producerAlias === 'Vous');
                  const isClosed = auction.status === 'closed';
                  const isWinner = isClosed && auction.myBidId && auction.acceptedBidId === auction.myBidId;
                  const winningBid = isClosed ? auction.bids.find(b => b.id === auction.acceptedBidId) : null;
                  const lines = getLines(auction.id);
                  const isHighlighted = highlightAuctionId === auction.id;

                  return (
                    <div
                      key={auction.id}
                      ref={el => auctionRefs.current[auction.id] = el}
                      className={`auction-card animate-fade-in ${isHighlighted ? 'auction-card-highlighted' : ''}`}
                      style={{
                        borderLeft: isWinner
                          ? '4px solid var(--primary)'
                          : myBid ? '4px solid var(--secondary)' : '1px solid var(--border)',
                        marginBottom: 20
                      }}
                    >
                      <div className="auction-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <h3 className="auction-title" style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
                            {auction.product} — {auction.quantity} {t('unit_' + auction.unit)}
                          </h3>
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                            {t('anonymousDemand', { time: new Date(auction.createdAt).toLocaleTimeString() })}
                          </p>
                        </div>
                        <span className={`badge ${isClosed ? 'badge-closed' : 'badge-open'}`}>
                          {isClosed ? t('statusClosed') : t('statusOpen')}
                        </span>
                      </div>

                      {auction.description && (
                        <p style={{
                          background: 'rgba(255,255,255,0.01)',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          fontSize: '0.9rem',
                          margin: '12px 0',
                          borderLeft: locale === 'fr' ? '3px solid rgba(255,255,255,0.1)' : 'none',
                          borderRight: locale === 'ar' ? '3px solid rgba(255,255,255,0.1)' : 'none',
                        }}>
                          <strong>{locale === 'fr' ? 'Spécifications :' : (locale === 'ar' ? 'المواصفات :' : 'Specifications:')}</strong> {auction.description}
                        </p>
                      )}

                      <div className="auction-details" style={{ display: 'flex', gap: 14, fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                        <span>Lieu de livraison: <strong>{auction.deliveryLocation || '—'}</strong></span>
                        <span>|</span>
                        <span>Offres reçues: <strong style={{ color: 'var(--primary)' }}>{auction.bids.length}</strong></span>
                      </div>

                      {/* ── Submission Form ── */}
                      {!isClosed ? (
                        <>
                          {myBid && auction.myRank !== null && auction.myRank !== undefined && (
                            <div style={{
                              background: 'rgba(34, 163, 98, 0.08)',
                              border: '1px solid rgba(34, 163, 98, 0.25)',
                              color: 'var(--secondary)',
                              padding: '10px 14px',
                              borderRadius: '8px',
                              fontSize: '0.88rem',
                              fontWeight: 'bold',
                              marginBottom: '16px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '8px',
                              width: '100%',
                              boxSizing: 'border-box'
                            }}>
                              <Trophy size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                              <span>
                                {locale === 'ar' 
                                  ? `ترتيبك: ${auction.myRank} من ${auction.totalBidders}` 
                                  : `Votre classement : ${auction.myRank === 1 ? '1er' : `${auction.myRank}e`} sur ${auction.totalBidders}`}
                              </span>
                            </div>
                          )}
                          <form
                            onSubmit={(e) => handleSubmitBid(e, auction.id)}
                            style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border)', marginBottom: '16px', marginTop: '16px' }}
                          >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                            <h4 style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                              {t('makeOfferTitle')}
                            </h4>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: 'var(--primary-soft)', padding: '2px 8px', borderRadius: '999px' }}>
                              {lines.length} {lines.length > 1 ? 'options' : 'option'}
                            </span>
                          </div>

                          {lines.length === 1 && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '12px', padding: '8px 12px', background: 'rgba(244,160,28,0.07)', border: '1px solid rgba(244,160,28,0.2)', borderRadius: '8px' }}>
                              {t('proposeMultipleOptionsTip')}
                            </div>
                          )}

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            {lines.map((line, lineIdx) => (
                              <div key={lineIdx} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px', position: 'relative' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                  <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    {t('lineLabel', { number: lineIdx + 1 })}
                                  </span>
                                  {lines.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => removeLine(auction.id, lineIdx)}
                                      style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.75rem', padding: '2px 6px' }}
                                    >
                                      <Trash2 size={12} /> {t('delete')}
                                    </button>
                                  )}
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                                  <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label style={{ fontSize: '0.72rem', textAlign: 'start' }}>{t('optionVariety')}</label>
                                    <input
                                      type="text"
                                      placeholder={t('optionVarietyPlaceholder')}
                                      value={line.quality}
                                      onChange={e => setLine(auction.id, lineIdx, 'quality', e.target.value)}
                                      style={{ textAlign: 'start', fontSize: '0.85rem', padding: '8px 10px' }}
                                    />
                                  </div>
                                  <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label style={{ fontSize: '0.72rem', textAlign: 'start' }}>{t('lineQuantity')}</label>
                                    <input
                                      type="number"
                                      step="any"
                                      placeholder={t('lineQuantityPlaceholder')}
                                      value={line.quantity}
                                      onChange={e => setLine(auction.id, lineIdx, 'quantity', e.target.value)}
                                      style={{ textAlign: 'start', fontSize: '0.85rem', padding: '8px 10px' }}
                                    />
                                  </div>
                                  <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label style={{ fontSize: '0.72rem', textAlign: 'start' }}>{t('priceDAOnly')}</label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      placeholder={t('pricePlaceholder')}
                                      value={line.price}
                                      onChange={e => setLine(auction.id, lineIdx, 'price', e.target.value)}
                                      required={lineIdx === 0}
                                      style={{ textAlign: 'start', fontSize: '0.85rem', padding: '8px 10px' }}
                                    />
                                  </div>
                                  <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label style={{ fontSize: '0.72rem', textAlign: 'start' }}>{t('unitLabel')}</label>
                                    <select
                                      value={line.unit || auction.unit}
                                      onChange={e => setLine(auction.id, lineIdx, 'unit', e.target.value)}
                                      style={{ textAlign: 'start', fontSize: '0.85rem', padding: '8px 10px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-main)', width: '100%', height: '38px', cursor: 'pointer' }}
                                    >
                                      <option value="tonnes">{t('unit_tonnes')}</option>
                                      <option value="kg">{t('unit_kg')}</option>
                                      <option value="cagettes">{t('unit_cagettes')}</option>
                                      <option value="palettes">{t('unit_palettes')}</option>
                                      <option value="sacs">{t('unit_sacs')}</option>
                                    </select>
                                  </div>
                                </div>

                                <div className="form-group" style={{ marginBottom: '10px' }}>
                                  <label style={{ fontSize: '0.72rem' }}>{t('commentLabel')}</label>
                                  <input
                                    type="text"
                                    placeholder={t('commentPlaceholder')}
                                    value={line.comments}
                                    onChange={e => setLine(auction.id, lineIdx, 'comments', e.target.value)}
                                    style={{ fontSize: '0.85rem', padding: '8px 10px' }}
                                  />
                                </div>

                                <div className="form-group" style={{ marginBottom: 0 }}>
                                  <div
                                    className="image-upload-zone"
                                    style={{ padding: '8px', cursor: line.isUploading ? 'not-allowed' : 'pointer', fontSize: '0.75rem' }}
                                    onClick={() => !line.isUploading && document.getElementById(`photo-${auction.id}-${lineIdx}`)?.click()}
                                  >
                                    <ImageIcon size={15} style={{ color: 'var(--text-muted)' }} />
                                    <span>{line.isUploading ? t('photosUploading') : t('photosOptionalMax')}</span>
                                    <input
                                      id={`photo-${auction.id}-${lineIdx}`}
                                      type="file"
                                      multiple
                                      accept="image/*"
                                      style={{ display: 'none' }}
                                      disabled={line.isUploading}
                                      onChange={async e => {
                                        const files = Array.from(e.target.files);
                                        if (files.length > 0) await handleImageChange(auction.id, lineIdx, files);
                                        e.target.value = '';
                                      }}
                                    />
                                  </div>
                                  {line.images && line.images.length > 0 && (
                                    <div className="image-previews-grid" style={{ marginTop: '8px' }}>
                                      {line.images.map((img, idx) => (
                                        <div key={idx} className="image-preview-wrapper">
                                          <img src={img} alt={t('preview')} />
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveImage(auction.id, lineIdx, idx)}
                                            className="image-preview-remove"
                                            title={t('delete')}
                                          >
                                            <X size={10} />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>

                          <div style={{ display: 'flex', gap: '10px', marginTop: '14px', alignItems: 'center' }}>
                            <button
                              type="button"
                              onClick={() => addLine(auction.id)}
                              className="btn btn-secondary"
                              style={{ fontSize: '0.82rem', padding: '8px 14px', gap: '5px' }}
                              disabled={lines.length >= 5}
                            >
                              <Plus size={14} /> {t('addOptionBtn')}
                            </button>
                            <button
                              type="submit"
                              className="btn btn-primary"
                              style={{ flex: 1, justifyContent: 'center' }}
                              disabled={lines.some(l => l.isUploading)}
                            >
                              <Send size={15} />
                              {lines.length > 1 ? t('submitMultipleBidsBtn', { count: lines.filter(l => l.price && parseFloat(l.price) > 0).length }) : t('submitBidBtn')}
                            </button>
                          </div>
                        </form>
                      </>
                      ) : (
                        <div style={{
                          background: isWinner ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.02)',
                          padding: '12px 16px', borderRadius: '8px',
                          border: isWinner ? '1px solid var(--primary)' : '1px solid var(--border)',
                          marginBottom: '16px', marginTop: '16px',
                          display: 'flex', alignItems: 'center', gap: '12px',
                        }}>
                          {isWinner ? (
                            <>
                              <Trophy style={{ color: 'var(--accent)' }} size={20} />
                              <div>
                                {getWinnerCongratsMessage({ bid: myBid, acceptedLineId: auction.acceptedLineId, auction, t })}
                              </div>
                            </>
                          ) : (
                            <>
                              <Check size={20} style={{ color: 'var(--text-muted)' }} />
                              <div>
                                {getBidClosedWinnerMessage({ winningBid, acceptedLineId: auction.acceptedLineId, auction, t, locale })}
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {/* Offers History */}
                      <div className="bids-container">
                        <h5 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: '700', textTransform: 'uppercase', textAlign: 'start' }}>
                          {locale === 'fr' ? 'Historique des offres' : 'سجل العروض'} ({auction.bids.length})
                        </h5>
                        {auction.bids.length === 0 ? (
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'start' }}>
                            {t('noOfferYet')}
                          </p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {[...auction.bids]
                              .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
                              .map(bid => {
                                const isMe = bid.producerAlias === 'Vous';
                                const isNew = newBidFlashIds.includes(bid.id);
                                const isSelected = auction.acceptedBidId === bid.id;

                                return (
                                  <div
                                    key={bid.id}
                                    className={`bid-item ${isNew ? 'bid-flash-new' : ''}`}
                                    style={{
                                      padding: '12px 14px',
                                      fontSize: '0.85rem',
                                      background: isMe ? 'rgba(34, 163, 98, 0.04)' : 'rgba(255, 255, 255, 0.01)',
                                      border: '1px solid var(--border)',
                                      borderColor: isMe ? 'rgba(34, 163, 98, 0.25)' : 'var(--border)',
                                      borderRadius: '10px',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '8px'
                                    }}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.04)', paddingBottom: '6px' }}>
                                      <span style={{ fontWeight: 600, color: isMe ? 'var(--secondary)' : 'var(--text-main)' }}>
                                        {bid.producerAlias}
                                      </span>
                                      {isSelected && (
                                        <span className="badge badge-open" style={{ fontSize: '0.6rem', padding: '1px 6px', background: 'var(--primary)', color: 'var(--text-inverse)', border: 'none' }}>
                                          {t('winnerLabel')}
                                        </span>
                                      )}
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                      {(bid.lines || []).map(line => {
                                        const isThisLineAccepted = isBidLineAccepted(auction, bid, line);
                                        return (
                                          <div
                                            key={line.id}
                                            style={{
                                              display: 'flex',
                                              justifyContent: 'space-between',
                                              alignItems: 'center',
                                              padding: '6px 10px',
                                              background: isThisLineAccepted ? 'rgba(34, 163, 98, 0.08)' : 'transparent',
                                              border: isThisLineAccepted ? '1px solid var(--primary)' : '1px dotted var(--border)',
                                              borderRadius: '6px'
                                            }}
                                          >
                                            <div>
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                {line.optionName && (
                                                  <span style={{ fontSize: '0.75rem', fontWeight: 'bold', background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: '4px' }}>
                                                    {line.optionName}
                                                  </span>
                                                )}
                                                <span style={{ fontWeight: '800', color: 'var(--secondary)', fontSize: '0.85rem' }}>
                                                  {line.price !== null && line.price !== undefined
                                                    ? `${line.price} DA/${t('unit_' + (line.unit || auction.unit))}`
                                                    : `— DA/${t('unit_' + (line.unit || auction.unit))} (${locale === 'ar' ? 'مخفي' : 'Masqué'})`}
                                                </span>
                                              </div>
                                              {line.comments && (
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
                                                  <MessageSquare size={10} /> {line.comments}
                                                </div>
                                              )}
                                            </div>

                                            {line.images && line.images.length > 0 && (
                                              <div style={{ display: 'flex', gap: '3px' }}>
                                                {line.images.map((img, idx) => (
                                                  <div
                                                    key={idx}
                                                    className="bid-photo-thumb"
                                                    style={{ width: '28px', height: '28px', borderRadius: '4px' }}
                                                    onClick={() => setActiveZoomImage(img)}
                                                    role="button"
                                                    tabIndex={0}
                                                    onKeyDown={e => e.key === 'Enter' && setActiveZoomImage(img)}
                                                  >
                                                    <img src={img} alt={t('preview')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        )}

      {/* ══ FORM DIALOG MODAL (Add / Edit Parcelle) ═══════════════════ */}
      {formOpen && (
        <div className="modal-overlay" style={{ zIndex: 1050 }} onClick={() => setFormOpen(false)}>
          <div ref={parcelModalRef} className="modal-card parcel-modal-card animate-fade-in" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={editingParcelle ? 'Modifier la parcelle' : 'Nouvelle parcelle'}>
            {/* Modal Toolbar Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ background: 'rgba(16,185,129,0.1)', padding: 8, borderRadius: 8 }}>
                  <MapPin size={18} style={{ color: 'var(--primary)' }} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text-main)', margin: 0 }}>
                    {editingParcelle ? 'Modifier la parcelle' : 'Nouvelle parcelle'}
                  </h3>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {editingParcelle ? 'Mettre à jour vos cultures et coordonnées' : 'Configurer vos terrains agricoles'}
                  </span>
                </div>
              </div>
              <button onClick={() => setFormOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            {/* Modal Body: Split Form on Left & Map on Right */}
            <div className="parcel-modal-body">
              
              {/* Form Area */}
              <form onSubmit={handleSaveParcelle} className="parcel-modal-form">
                
                {/* Section: Informations générales */}
                <div>
                  <h4 className="form-section-title">
                    Informations générales
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label>Nom de la parcelle <span className="required-asterisk">*</span></label>
                      <input
                        type="text"
                        placeholder="Ex: Champ d'Oliviers Nord"
                        value={formIntitule}
                        onChange={e => setFormIntitule(e.target.value)}
                        required
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>Superficie (ha) <span className="required-asterisk">*</span></label>
                        <input
                          type="number"
                          step="any"
                          placeholder="0.0"
                          value={formSuperficie}
                          onChange={e => setFormSuperficie(e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>Date d'acquisition</label>
                        <input
                          type="date"
                          value={formAcquisitionDate}
                          onChange={e => setFormAcquisitionDate(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section: Cultures */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 6, marginBottom: 12 }}>
                    <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--primary)', fontWeight: 800, margin: 0 }}>
                      Gestion des cultures
                    </h4>
                    <button type="button" onClick={handleAddFormCulture} className="btn btn-secondary" style={{ fontSize: '0.7rem', padding: '3px 8px', gap: 3 }}>
                      <Plus size={11} /> Ajouter culture
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {formCultures.map((c, index) => (
                      <div key={index} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, background: 'rgba(255,255,255,0.02)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)' }}>CULTURE #{index+1}</span>
                          {formCultures.length > 1 && (
                            <button type="button" onClick={() => handleRemoveFormCulture(index)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label style={{ fontSize: '0.7rem' }}>Type de culture</label>
                            <select
                              value={c.type_culture}
                              onChange={e => handleUpdateCulture(index, 'type_culture', e.target.value)}
                              style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 10px', color: 'var(--text-main)', fontSize: '0.85rem' }}
                            >
                              <option value="">-- Choisir --</option>
                              {cultureTypes.map(ct => (
                                <option key={ct.value} value={ct.value}>{ct.label}</option>
                              ))}
                            </select>
                          </div>

                          <div className="form-group" style={{ margin: 0 }}>
                            <label style={{ fontSize: '0.7rem' }}>Variétés (Sous-types)</label>
                            <div style={{
                              maxHeight: '120px',
                              overflowY: 'auto',
                              border: '1px solid var(--border)',
                              borderRadius: 8,
                              padding: 6,
                              background: 'var(--bg-input)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 4
                            }}>
                              {!c.type_culture ? (
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: 4 }}>Choisir le type d'abord</span>
                              ) : (
                                (subTypes[c.type_culture] || []).map(st => {
                                  const isChecked = (c.sous_type_culture || []).includes(st);
                                  return (
                                    <label key={st} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', cursor: 'pointer', color: 'var(--text-main)' }}>
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => handleToggleSousType(index, st)}
                                        style={{ width: '12px', height: '12px', accentColor: 'var(--primary)' }}
                                      />
                                      {st}
                                    </label>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section: Caractéristiques */}
                <div>
                  <h4 className="form-section-title">
                    Caractéristiques techniques
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label>Système d'irrigation</label>
                      <select
                        value={formIrrigationMethod}
                        onChange={e => setFormIrrigationMethod(e.target.value)}
                        style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px', color: 'var(--text-main)', fontSize: '0.875rem' }}
                      >
                        <option value="">-- Choisir --</option>
                        {irrigationOptions.map(io => (
                          <option key={io.value} value={io.value}>{io.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label>Nature du sol</label>
                      <select
                        value={formSoilType}
                        onChange={e => setFormSoilType(e.target.value)}
                        style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px', color: 'var(--text-main)', fontSize: '0.875rem' }}
                      >
                        <option value="">-- Choisir --</option>
                        {soilOptions.map(so => (
                          <option key={so.value} value={so.value}>{so.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Section: Localisation administrative */}
                <div>
                  <h4 className="form-section-title">
                    Localisation administrative
                  </h4>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Wilaya <span className="required-asterisk">*</span></label>
                    <select
                      value={formWilayaId}
                      onChange={e => handleWilayaSelect(e.target.value)}
                      required
                      style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px', color: 'var(--text-main)', fontSize: '0.875rem' }}
                    >
                      <option value="">-- Choisir wilaya --</option>
                      {WILAYA_LIST.map(w => (
                        <option key={w.id} value={w.id}>{w.id} – {w.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Submit button inside form */}
                <div style={{ marginTop: 'auto', display: 'flex', gap: 12, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                  <button type="button" onClick={() => setFormOpen(false)} className="btn btn-secondary" style={{ flex: 1 }}>
                    Annuler
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }}>
                    <Check size={16} /> Enregistrer la parcelle
                  </button>
                </div>

              </form>

              {/* Map Delimitation Area */}
              <div className="parcel-modal-map-container">
                
                {/* Header inside map area */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
                  <div>
                    <h5 style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>Délimitation</h5>
                    <span style={{ fontSize: '0.65rem', color: 'var(--primary)', fontWeight: 'bold', textTransform: 'uppercase' }}>Position GPS précise</span>
                  </div>
                  
                  {/* Layer controller */}
                  <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.04)', padding: 2, borderRadius: 6, border: '1px solid var(--border)' }}>
                    <button type="button" onClick={() => handleSwitchLayer('satellite')} style={{ border: 'none', background: mapLayer === 'satellite' ? 'var(--primary)' : 'transparent', color: mapLayer === 'satellite' ? 'white' : 'var(--text-muted)', fontSize: '0.68rem', padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>
                      Satellite
                    </button>
                    <button type="button" onClick={() => handleSwitchLayer('street')} style={{ border: 'none', background: mapLayer === 'street' ? 'var(--primary)' : 'transparent', color: mapLayer === 'street' ? 'white' : 'var(--text-muted)', fontSize: '0.68rem', padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>
                      OSM Plan
                    </button>
                  </div>
                </div>

                {/* Leaflet map container */}
                <div ref={mapRef} style={{ flex: 1 }} />

                {/* Floating GPS Coords indicator */}
                <div style={{
                  position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 1000,
                  background: 'rgba(10,15,25,0.85)', backdropFilter: 'blur(8px)',
                  padding: '8px 16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex', gap: 16, fontSize: '0.78rem'
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Latitude</div>
                    <div style={{ fontWeight: 'bold', color: 'var(--primary)', fontFamily: 'monospace' }}>
                      {formLatitude ? parseFloat(formLatitude).toFixed(6) : '--.------'}
                    </div>
                  </div>
                  <div style={{ width: 1, background: 'rgba(255,255,255,0.1)' }} />
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Longitude</div>
                    <div style={{ fontWeight: 'bold', color: 'var(--primary)', fontFamily: 'monospace' }}>
                      {formLongitude ? parseFloat(formLongitude).toFixed(6) : '--.------'}
                    </div>
                  </div>
                </div>

              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
