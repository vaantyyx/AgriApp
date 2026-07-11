import React, { useState, useEffect, useRef } from 'react';
import { Sprout, Plus, Layers, MapPin, Calendar, Edit3, Trash2, X, Check } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { WILAYA_COORDS } from '../utils/wilayaCoordinates.js';
import { BACKEND_URL } from '../utils/config.js';

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

const WILAYA_LIST = Object.entries(WILAYA_COORDS).map(([id, w]) => ({ id: parseInt(id), name: w.name })).sort((a, b) => a.id - b.id);

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
  if (parcelle.cultures && parcelle.cultures.length > 0) return parcelle.cultures[0].type_culture;
  return 'Grandes Cultures';
};

export default function ProducerParcellesPage({ user, parcelles, token, fetchParcelles, loadingParcelles }) {
  const { locale } = useTranslation();
  const localeTag = locale === 'ar' ? 'ar-DZ' : locale === 'en' ? 'en-US' : 'fr-DZ';

  const [formOpen, setFormOpen] = useState(false);
  const [editingParcelle, setEditingParcelle] = useState(null);
  
  const [formIntitule, setFormIntitule] = useState('');
  const [formWilayaId, setFormWilayaId] = useState('');
  const [formSuperficie, setFormSuperficie] = useState('');
  const [formAcquisitionDate, setFormAcquisitionDate] = useState('');
  const [formCultures, setFormCultures] = useState([{ type_culture: '', sous_type_culture: [] }]);
  const [formIrrigationMethod, setFormIrrigationMethod] = useState('');
  const [formSoilType, setFormSoilType] = useState('');
  const [formLatitude, setFormLatitude] = useState('');
  const [formLongitude, setFormLongitude] = useState('');

  const mapRef = useRef(null);
  const leafletMapRef = useRef(null);
  const markerRef = useRef(null);
  const [mapLayer, setMapLayer] = useState('satellite');

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
      const map = L.map(mapRef.current, { center: [initialLat, initialLng], zoom: formLatitude ? 14 : 6, zoomControl: true });

      const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18 });
      const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 });
      if (mapLayer === 'satellite') satelliteLayer.addTo(map); else streetLayer.addTo(map);
      
      map.satelliteLayer = satelliteLayer;
      map.streetLayer = streetLayer;

      const labelLayer = L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18, opacity: 0.7 });
      if (mapLayer === 'satellite') labelLayer.addTo(map);
      map.labelLayer = labelLayer;

      if (formLatitude && formLongitude) {
        const marker = L.marker([initialLat, initialLng], { draggable: true }).addTo(map);
        markerRef.current = marker;
        marker.on('dragend', () => { const pos = marker.getLatLng(); setFormLatitude(pos.lat); setFormLongitude(pos.lng); });
      }

      map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        setFormLatitude(lat); setFormLongitude(lng);
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          const marker = L.marker([lat, lng], { draggable: true }).addTo(map);
          markerRef.current = marker;
          marker.on('dragend', () => { const pos = marker.getLatLng(); setFormLatitude(pos.lat); setFormLongitude(pos.lng); });
        }
      });
      leafletMapRef.current = map;
      map.invalidateSize();
    }, 300);
    return () => clearTimeout(timer);
  }, [formOpen]);

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

  const handleWilayaSelect = (wId) => {
    setFormWilayaId(wId);
    const coords = WILAYA_COORDS[parseInt(wId)];
    if (coords && leafletMapRef.current) {
      leafletMapRef.current.setView([coords.lat, coords.lng], 10);
      setFormLatitude(coords.lat); setFormLongitude(coords.lng);
      if (markerRef.current) {
        markerRef.current.setLatLng([coords.lat, coords.lng]);
      } else {
        const marker = L.marker([coords.lat, coords.lng], { draggable: true }).addTo(leafletMapRef.current);
        markerRef.current = marker;
        marker.on('dragend', () => { const pos = marker.getLatLng(); setFormLatitude(pos.lat); setFormLongitude(pos.lng); });
      }
    }
  };

  const handleOpenAddForm = () => {
    setEditingParcelle(null);
    setFormIntitule(''); setFormWilayaId(''); setFormSuperficie(''); setFormAcquisitionDate('');
    setFormCultures([{ type_culture: '', sous_type_culture: [] }]);
    setFormIrrigationMethod(''); setFormSoilType(''); setFormLatitude(''); setFormLongitude('');
    setFormOpen(true);
  };

  const handleOpenEditForm = (parcelle) => {
    setEditingParcelle(parcelle);
    setFormIntitule(parcelle.intitule || ''); setFormWilayaId(parcelle.wilayaId || '');
    setFormSuperficie(parcelle.superficie || '');
    setFormAcquisitionDate(parcelle.acquisitionDate ? parcelle.acquisitionDate.split('T')[0] : '');
    setFormCultures(parcelle.cultures && parcelle.cultures.length > 0 ? parcelle.cultures.map(c => ({ type_culture: c.type_culture, sous_type_culture: Array.isArray(c.sous_type_culture) ? c.sous_type_culture : [] })) : [{ type_culture: '', sous_type_culture: [] }]);
    setFormIrrigationMethod(parcelle.irrigationMethod || ''); setFormSoilType(parcelle.soilType || '');
    setFormLatitude(parcelle.latitude || ''); setFormLongitude(parcelle.longitude || '');
    setFormOpen(true);
  };

  const handleSaveParcelle = async (e) => {
    e.preventDefault();
    if (!formIntitule.trim()) { alert(locale === 'ar' ? 'اسم الحقل مطلوب' : (locale === 'en' ? 'Plot name is required' : 'Nom de la parcelle requis')); return; }
    if (!formSuperficie || parseFloat(formSuperficie) <= 0) { alert(locale === 'ar' ? 'المساحة يجب أن تكون أكبر من 0' : (locale === 'en' ? 'Area must be greater than 0' : 'La superficie doit être supérieure à 0')); return; }
    if (!formWilayaId) { alert(locale === 'ar' ? 'الرجاء اختيار الولاية' : (locale === 'en' ? 'Please select a wilaya' : 'Veuillez sélectionner une wilaya')); return; }
    if (formCultures.some(c => !c.type_culture)) { alert(locale === 'ar' ? 'الرجاء تحديد نوع الزراعة' : (locale === 'en' ? 'Please select a type for all crops' : 'Veuillez sélectionner le type pour toutes les cultures')); return; }

    const wilayaObj = WILAYA_COORDS[parseInt(formWilayaId)];
    const payload = {
      intitule: formIntitule.trim(), wilayaId: formWilayaId, wilayaName: wilayaObj ? wilayaObj.name : '',
      superficie: parseFloat(formSuperficie), acquisitionDate: formAcquisitionDate || null,
      cultures: formCultures, irrigationMethod: formIrrigationMethod || null, soilType: formSoilType || null,
      latitude: formLatitude ? parseFloat(formLatitude) : null, longitude: formLongitude ? parseFloat(formLongitude) : null
    };

    try {
      const url = editingParcelle ? `${BACKEND_URL}/api/parcelles/${editingParcelle._id}` : `${BACKEND_URL}/api/parcelles`;
      const method = editingParcelle ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
      if (res.ok) { setFormOpen(false); fetchParcelles(); }
      else {
        const err = await res.json();
        alert(err.error || (locale === 'ar' ? 'خطأ أثناء حفظ الحقل' : (locale === 'en' ? 'Error while saving the plot' : "Erreur lors de l'enregistrement de la parcelle")));
      }
    } catch (err) { console.error('Erreur lors de l\'enregistrement de la parcelle:', err); }
  };

  const handleDeleteParcelle = async (id) => {
    if (!window.confirm(locale === 'ar' ? 'هل أنت متأكد من حذف هذه القطعة؟' : (locale === 'en' ? 'Are you sure you want to delete this plot?' : 'Voulez-vous vraiment supprimer cette parcelle ?'))) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/parcelles/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) fetchParcelles();
      else alert(locale === 'ar' ? 'خطأ أثناء حذف الحقل' : (locale === 'en' ? 'Error while deleting the plot' : 'Erreur lors de la suppression de la parcelle'));
    } catch (err) { console.error('Erreur lors de la suppression de la parcelle:', err); }
  };

  const handleUpdateCulture = (index, field, value) => {
    setFormCultures(prev => prev.map((c, i) => {
      if (i !== index) return c;
      const updated = { ...c, [field]: value };
      if (field === 'type_culture') updated.sous_type_culture = [];
      return updated;
    }));
  };

  const handleToggleSousType = (index, val) => {
    setFormCultures(prev => prev.map((c, i) => {
      if (i !== index) return c;
      const current = c.sous_type_culture || [];
      const updated = current.includes(val) ? current.filter(x => x !== val) : [...current, val];
      return { ...c, sous_type_culture: updated };
    }));
  };

  const totalSuperficie = parcelles.reduce((sum, p) => sum + (parseFloat(p.superficie) || 0), 0).toFixed(1);
  const uniqueCulturesCount = new Set(parcelles.flatMap(p => p.cultures ? p.cultures.map(c => c.type_culture) : [])).size;
  const uniqueWilayasCount = new Set(parcelles.map(p => p.wilayaId).filter(Boolean)).size;

  return (
    <div className="dash-page-scroll" style={{ flex: 1, padding: '32px 40px', overflowY: 'auto', textAlign: 'start' }}>
      
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Sprout size={24} style={{ color: 'var(--primary)' }} />
            {locale === 'ar' ? 'حقولي الزراعية' : (locale === 'en' ? 'My agricultural plots' : 'Mes parcelles agricoles')}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 4 }}>
            {locale === 'ar' ? 'تنظيم ومتابعة استثماراتك الزراعية.' : (locale === 'en' ? 'Manage your lands and optimize your crops in real time.' : 'Gérez vos terrains et optimisez vos cultures en temps réel.')}
          </p>
        </div>
        <button onClick={handleOpenAddForm} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Plus size={16} /> {locale === 'ar' ? 'إضافة قطعة أرض' : (locale === 'en' ? 'Add plot' : 'Nouvelle parcelle')}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginBottom: 32 }}>
        <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ background: 'rgba(16,185,129,0.06)', padding: 10, borderRadius: 10 }}><Layers size={20} style={{ color: 'var(--primary)' }} /></div>
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{locale === 'ar' ? 'المساحة الإجمالية' : (locale === 'en' ? 'Total Area' : 'Superficie Totale')}</div>
            <div style={{ fontSize: '1.35rem', fontWeight: '800', color: 'var(--text-main)', marginTop: 2 }}>{totalSuperficie} <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 'bold' }}>ha</span></div>
          </div>
        </div>
        <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ background: 'rgba(245,158,11,0.06)', padding: 10, borderRadius: 10 }}><Sprout size={20} style={{ color: '#f59e0b' }} /></div>
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{locale === 'ar' ? 'الزراعات' : (locale === 'en' ? 'Crops' : 'Cultures')}</div>
            <div style={{ fontSize: '1.35rem', fontWeight: '800', color: 'var(--text-main)', marginTop: 2 }}>{uniqueCulturesCount} <span style={{ fontSize: '0.8rem', color: '#f59e0b', fontWeight: 'bold' }}>types</span></div>
          </div>
        </div>
        <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ background: 'rgba(59,130,246,0.06)', padding: 10, borderRadius: 10 }}><MapPin size={20} style={{ color: '#3b82f6' }} /></div>
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{locale === 'ar' ? 'المواقع' : (locale === 'en' ? 'Locations' : 'Implantations')}</div>
            <div style={{ fontSize: '1.35rem', fontWeight: '800', color: 'var(--text-main)', marginTop: 2 }}>{uniqueWilayasCount} <span style={{ fontSize: '0.8rem', color: '#3b82f6', fontWeight: 'bold' }}>wilayas</span></div>
          </div>
        </div>
      </div>

      {loadingParcelles ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>{locale === 'ar' ? 'جاري تحميل حقولك...' : (locale === 'en' ? 'Loading your plots...' : 'Chargement de vos parcelles...')}</div>
      ) : parcelles.length === 0 ? (
        <div className="glass-panel empty-state" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ background: 'rgba(16,185,129,0.05)', width: 80, height: 80, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <Sprout size={36} style={{ color: 'var(--primary)' }} />
          </div>
          <h4 style={{ fontSize: '1.2rem', marginBottom: 8, color: 'var(--text-main)' }}>{locale === 'ar' ? 'لا توجد حقول مسجلة' : (locale === 'en' ? 'No plots registered' : 'Aucune parcelle enregistrée')}</h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', maxWidth: 460, margin: '0 auto 24px' }}>{locale === 'ar' ? 'لم تقم بإضافة أراضٍ زراعية إلى ملفك الشخصي بعد. أنشئ حقلك الأول لبدء الاستغلال!' : (locale === 'en' ? "You haven't added any agricultural lands to your profile yet. Create your first plot to start exploiting it!" : "Vous n'avez pas encore ajouté de terres agricoles à votre profil. Créez votre première parcelle pour commencer à l'exploiter !")}</p>
          <button onClick={handleOpenAddForm} className="btn btn-primary"><Plus size={16} /> {locale === 'ar' ? 'إضافة حقلي الأول' : (locale === 'en' ? 'Add my first plot' : 'Ajouter ma première parcelle')}</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 24 }}>
          {parcelles.map(p => {
            const primaryCulture = getPrimaryCultureType(p);
            return (
              <div key={p._id} className="glass-panel" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%', border: '1px solid var(--border)' }}>
                <div style={{ height: 90, background: `linear-gradient(135deg, ${getCultureColor(primaryCulture)} 0%, ${getCultureColor(primaryCulture, true)} 100%)`, position: 'relative', padding: '16px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'absolute', top: 12, left: 16, right: 16 }}>
                    <span style={{ background: 'rgba(255,255,255,0.9)', color: 'black', padding: '3px 8px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Layers size={11} /> {p.superficie} ha
                    </span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => handleOpenEditForm(p)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white' }}><Edit3 size={12} /></button>
                      <button onClick={() => handleDeleteParcelle(p._id)} style={{ background: 'rgba(239,68,68,0.2)', border: 'none', borderRadius: '50%', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={12} /></button>
                    </div>
                  </div>
                  <h4 style={{ color: 'white', fontWeight: 'bold', fontSize: '1.05rem', margin: 0, textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>{p.intitule}</h4>
                </div>
                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <MapPin size={15} style={{ color: 'var(--text-muted)', marginTop: 2, flexShrink: 0 }} />
                    <div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>{locale === 'ar' ? 'الموقع' : (locale === 'en' ? 'Location' : 'Localisation')}</span>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 600 }}>{p.wilayaName ? p.wilayaName : (locale === 'ar' ? 'غير محدد' : (locale === 'en' ? 'Not located' : 'Non localisée'))}</span>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div style={{ background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.08)', borderRadius: 8, padding: '8px 12px' }}>
                      <div style={{ fontSize: '0.65rem', color: 'var(--primary)', fontWeight: 'bold', textTransform: 'uppercase' }}>{locale === 'ar' ? 'الزراعات' : (locale === 'en' ? 'Crops' : 'Cultures')}</div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-main)', marginTop: 2, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {p.cultures && p.cultures.length > 0 ? (p.cultures.length === 1 ? p.cultures[0].type_culture : `Multi (${p.cultures.length})`) : (locale === 'ar' ? 'لا يوجد' : (locale === 'en' ? 'None' : 'Aucune'))}
                      </div>
                    </div>
                    <div style={{ background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.08)', borderRadius: 8, padding: '8px 12px' }}>
                      <div style={{ fontSize: '0.65rem', color: '#3b82f6', fontWeight: 'bold', textTransform: 'uppercase' }}>{locale === 'ar' ? 'الري' : (locale === 'en' ? 'Irrigation' : 'Irrigation')}</div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-main)', marginTop: 2, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{p.irrigationMethod || 'Pluvial'}</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 'auto', paddingTop: 10, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={12} /> {p.acquisitionDate ? new Date(p.acquisitionDate).toLocaleDateString(localeTag, { year: 'numeric', month: 'short' }) : '—'}</span>
                    <span style={{ color: 'var(--primary)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 3 }}><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)' }} /> {locale === 'ar' ? 'نشط' : (locale === 'en' ? 'Active' : 'Actif')}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL FORM */}
      {formOpen && (
        <div className="modal-overlay" style={{ zIndex: 1050 }} onClick={() => setFormOpen(false)}>
          <div className="modal-card parcel-modal-card animate-fade-in" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ background: 'rgba(16,185,129,0.1)', padding: 8, borderRadius: 8 }}><MapPin size={18} style={{ color: 'var(--primary)' }} /></div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text-main)', margin: 0 }}>{editingParcelle ? (locale === 'ar' ? 'تعديل الحقل' : (locale === 'en' ? 'Edit plot' : 'Modifier la parcelle')) : (locale === 'ar' ? 'حقل جديد' : (locale === 'en' ? 'New plot' : 'Nouvelle parcelle'))}</h3>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{editingParcelle ? (locale === 'ar' ? 'تحديث زراعاتك وإحداثياتك' : (locale === 'en' ? 'Update your crops and coordinates' : 'Mettre à jour vos cultures et coordonnées')) : (locale === 'ar' ? 'إعداد أراضيك الزراعية' : (locale === 'en' ? 'Configure your agricultural lands' : 'Configurer vos terrains agricoles'))}</span>
                </div>
              </div>
              <button onClick={() => setFormOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>

            <div className="parcel-modal-body">
              <form onSubmit={handleSaveParcelle} className="parcel-modal-form">
                <div>
                  <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--primary)', fontWeight: 800, borderBottom: '1px solid var(--border)', paddingBottom: 6, marginBottom: 12 }}>{locale === 'ar' ? 'معلومات عامة' : (locale === 'en' ? 'General information' : 'Informations générales')}</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label>{locale === 'ar' ? 'اسم الحقل' : (locale === 'en' ? 'Plot name' : 'Nom de la parcelle')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                      <input type="text" value={formIntitule} onChange={e => setFormIntitule(e.target.value)} required />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>{locale === 'ar' ? 'المساحة (هكتار)' : (locale === 'en' ? 'Area (ha)' : 'Superficie (ha)')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                        <input type="number" step="any" value={formSuperficie} onChange={e => setFormSuperficie(e.target.value)} required />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>{locale === 'ar' ? 'تاريخ الاقتناء' : (locale === 'en' ? 'Acquisition date' : "Date d'acquisition")}</label>
                        <input type="date" value={formAcquisitionDate} onChange={e => setFormAcquisitionDate(e.target.value)} />
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 6, marginBottom: 12, marginTop: 12 }}>
                    <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--primary)', fontWeight: 800, margin: 0 }}>{locale === 'ar' ? 'إدارة الزراعات' : (locale === 'en' ? 'Crop management' : 'Gestion des cultures')}</h4>
                    <button type="button" onClick={() => setFormCultures(prev => [...prev, { type_culture: '', sous_type_culture: [] }])} className="btn btn-secondary" style={{ fontSize: '0.7rem', padding: '3px 8px', gap: 3 }}><Plus size={11} /> {locale === 'ar' ? 'إضافة زراعة' : (locale === 'en' ? 'Add crop' : 'Ajouter culture')}</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {formCultures.map((c, index) => (
                      <div key={index} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, background: 'rgba(255,255,255,0.02)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)' }}>CULTURE #{index+1}</span>
                          {formCultures.length > 1 && <button type="button" onClick={() => setFormCultures(prev => prev.filter((_, i) => i !== index))} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}><Trash2 size={13} /></button>}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label style={{ fontSize: '0.7rem' }}>{locale === 'ar' ? 'نوع الزراعة' : (locale === 'en' ? 'Crop type' : 'Type de culture')}</label>
                            <select value={c.type_culture} onChange={e => handleUpdateCulture(index, 'type_culture', e.target.value)} style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 10px', color: 'var(--text-main)', fontSize: '0.85rem' }}>
                              <option value="">{locale === 'ar' ? '-- اختر --' : (locale === 'en' ? '-- Select --' : '-- Choisir --')}</option>
                              {cultureTypes.map(ct => <option key={ct.value} value={ct.value}>{ct.label}</option>)}
                            </select>
                          </div>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label style={{ fontSize: '0.7rem' }}>{locale === 'ar' ? 'الأصناف (الأنواع الفرعية)' : (locale === 'en' ? 'Varieties (Sub-types)' : 'Variétés (Sous-types)')}</label>
                            <div style={{ maxHeight: '120px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 6, background: 'var(--bg-input)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {!c.type_culture ? <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: 4 }}>{locale === 'ar' ? 'اختر النوع' : (locale === 'en' ? 'Choose the type' : 'Choisir le type')}</span> : (
                                (subTypes[c.type_culture] || []).map(st => {
                                  const isChecked = (c.sous_type_culture || []).includes(st);
                                  return (
                                    <label key={st} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', cursor: 'pointer', color: 'var(--text-main)' }}>
                                      <input type="checkbox" checked={isChecked} onChange={() => handleToggleSousType(index, st)} style={{ width: '12px', height: '12px', accentColor: 'var(--primary)' }} /> {st}
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

                <div>
                  <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--primary)', fontWeight: 800, borderBottom: '1px solid var(--border)', paddingBottom: 6, marginBottom: 12, marginTop: 12 }}>{locale === 'ar' ? 'الخصائص' : (locale === 'en' ? 'Characteristics' : 'Caractéristiques')}</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label>{locale === 'ar' ? 'نظام الري' : (locale === 'en' ? 'Irrigation system' : "Système d'irrigation")}</label>
                      <select value={formIrrigationMethod} onChange={e => setFormIrrigationMethod(e.target.value)} style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px', color: 'var(--text-main)', fontSize: '0.875rem' }}>
                        <option value="">{locale === 'ar' ? '-- اختر --' : (locale === 'en' ? '-- Select --' : '-- Choisir --')}</option>
                        {irrigationOptions.map(io => <option key={io.value} value={io.value}>{io.label}</option>)}
                      </select>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label>{locale === 'ar' ? 'نوع التربة' : (locale === 'en' ? 'Soil type' : 'Nature du sol')}</label>
                      <select value={formSoilType} onChange={e => setFormSoilType(e.target.value)} style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px', color: 'var(--text-main)', fontSize: '0.875rem' }}>
                        <option value="">{locale === 'ar' ? '-- اختر --' : (locale === 'en' ? '-- Select --' : '-- Choisir --')}</option>
                        {soilOptions.map(so => <option key={so.value} value={so.value}>{so.label}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--primary)', fontWeight: 800, borderBottom: '1px solid var(--border)', paddingBottom: 6, marginBottom: 12, marginTop: 12 }}>{locale === 'ar' ? 'الموقع' : (locale === 'en' ? 'Location' : 'Localisation')}</h4>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>{locale === 'ar' ? 'الولاية' : (locale === 'en' ? 'Wilaya' : 'Wilaya')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <select value={formWilayaId} onChange={e => handleWilayaSelect(e.target.value)} required style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px', color: 'var(--text-main)', fontSize: '0.875rem' }}>
                      <option value="">{locale === 'ar' ? '-- اختر الولاية --' : (locale === 'en' ? '-- Select wilaya --' : '-- Choisir wilaya --')}</option>
                      {WILAYA_LIST.map(w => <option key={w.id} value={w.id}>{w.id} – {w.name}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ marginTop: 'auto', display: 'flex', gap: 12, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                  <button type="button" onClick={() => setFormOpen(false)} className="btn btn-secondary" style={{ flex: 1 }}>{locale === 'ar' ? 'إلغاء' : (locale === 'en' ? 'Cancel' : 'Annuler')}</button>
                  <button type="submit" className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }}><Check size={16} /> {locale === 'ar' ? 'حفظ الحقل' : (locale === 'en' ? 'Save plot' : 'Enregistrer la parcelle')}</button>
                </div>
              </form>

              <div className="parcel-modal-map-container">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
                  <div>
                    <h5 style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>{locale === 'ar' ? 'ترسيم الحدود' : (locale === 'en' ? 'Boundary mapping' : 'Délimitation')}</h5>
                    <span style={{ fontSize: '0.65rem', color: 'var(--primary)', fontWeight: 'bold', textTransform: 'uppercase' }}>{locale === 'ar' ? 'موقع GPS دقيق' : (locale === 'en' ? 'Precise GPS position' : 'Position GPS précise')}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.04)', padding: 2, borderRadius: 6, border: '1px solid var(--border)' }}>
                    <button type="button" onClick={() => handleSwitchLayer('satellite')} style={{ border: 'none', background: mapLayer === 'satellite' ? 'var(--primary)' : 'transparent', color: mapLayer === 'satellite' ? 'white' : 'var(--text-muted)', fontSize: '0.68rem', padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>{locale === 'ar' ? 'قمر صناعي' : (locale === 'en' ? 'Satellite' : 'Satellite')}</button>
                    <button type="button" onClick={() => handleSwitchLayer('street')} style={{ border: 'none', background: mapLayer === 'street' ? 'var(--primary)' : 'transparent', color: mapLayer === 'street' ? 'white' : 'var(--text-muted)', fontSize: '0.68rem', padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>{locale === 'ar' ? 'خريطة' : (locale === 'en' ? 'Map' : 'Plan OSM')}</button>
                  </div>
                </div>
                <div ref={mapRef} style={{ flex: 1 }} />
                <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: 'rgba(10,15,25,0.85)', backdropFilter: 'blur(8px)', padding: '8px 16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 16, fontSize: '0.78rem' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{locale === 'ar' ? 'خط العرض' : 'Latitude'}</div>
                    <div style={{ fontWeight: 'bold', color: 'var(--primary)', fontFamily: 'monospace' }}>{formLatitude ? parseFloat(formLatitude).toFixed(6) : '--.------'}</div>
                  </div>
                  <div style={{ width: 1, background: 'rgba(255,255,255,0.1)' }} />
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{locale === 'ar' ? 'خط الطول' : 'Longitude'}</div>
                    <div style={{ fontWeight: 'bold', color: 'var(--primary)', fontFamily: 'monospace' }}>{formLongitude ? parseFloat(formLongitude).toFixed(6) : '--.------'}</div>
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
