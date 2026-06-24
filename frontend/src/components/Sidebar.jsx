import React from 'react';
import { useTranslation } from '../context/LanguageContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Gavel, User, MapPin, ChevronRight, ChevronLeft } from 'lucide-react';

export default function Sidebar({ user, isOpen, onToggle }) {
  const { t, locale, dir } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const searchParams = new URLSearchParams(location.search);
  const activeTab = location.pathname.includes('/profile') 
    ? 'profile' 
    : (searchParams.get('tab') || 'dashboard');

  const buyerItems = [
    { id: 'dashboard', icon: LayoutDashboard, labelFr: 'Tableau de bord', labelAr: 'لوحة القيادة' },
    { id: 'auctions',  icon: Gavel,           labelFr: 'Mes enchères',    labelAr: 'مزاداتي' },
    { id: 'profile',   icon: User,            labelFr: 'Mon profil',      labelAr: 'ملفي الشخصي' },
  ];

  const producerItems = [
    { id: 'dashboard', icon: LayoutDashboard, labelFr: 'Tableau de bord', labelAr: 'لوحة القيادة' },
    { id: 'parcelles', icon: MapPin,          labelFr: 'Mes parcelles',   labelAr: 'مزارعي' },
    { id: 'auctions',  icon: Gavel,           labelFr: 'Enchères',        labelAr: 'المناقصات' },
    { id: 'profile',   icon: User,            labelFr: 'Mon profil',      labelAr: 'ملفي الشخصي' },
  ];

  const items = user?.role === 'buyer' ? buyerItems : producerItems;

  const handleItemClick = (id) => {
    if (id === 'profile') {
      navigate('/profile');
    } else {
      navigate(`/dashboard${id === 'dashboard' ? '' : '?tab=' + id}`);
    }
  };

  const sidebarLabel = (item) => locale === 'ar' ? item.labelAr : item.labelFr;

  return (
    <aside style={{
      position: 'fixed',
      top: 0,
      bottom: 0,
      left: dir === 'ltr' ? 0 : 'auto',
      right: dir === 'rtl' ? 0 : 'auto',
      width: isOpen ? 220 : 70,
      background: 'var(--bg-panel)',
      borderRight: dir === 'ltr' ? '1px solid var(--border)' : 'none',
      borderLeft: dir === 'rtl' ? '1px solid var(--border)' : 'none',
      display: 'flex', flexDirection: 'column',
      padding: '24px 0',
      transition: 'width 0.3s ease',
      zIndex: 1100, // Above header
      boxShadow: isOpen ? '2px 0 10px rgba(0,0,0,0.1)' : 'none'
    }}>
      {/* Toggle button */}
      <button 
        onClick={onToggle}
        title={isOpen ? (locale === 'fr' ? 'Masquer' : 'إخفاء') : (locale === 'fr' ? 'Afficher' : 'إظهار')}
        style={{
          position: 'absolute',
          top: 20,
          right: dir === 'ltr' ? -12 : 'auto',
          left: dir === 'rtl' ? -12 : 'auto',
          width: 24, height: 24,
          borderRadius: '50%',
          background: 'var(--bg-panel)',
          border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 10,
          color: 'var(--text-main)',
          boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
        }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-main)'}
      >
        {isOpen ? (dir === 'rtl' ? <ChevronRight size={14} /> : <ChevronLeft size={14} />) : (dir === 'rtl' ? <ChevronLeft size={14} /> : <ChevronRight size={14} />)}
      </button>

      {isOpen ? (
        <div style={{ padding: '0 16px 20px', borderBottom: '1px solid var(--border)', marginBottom: 8, whiteSpace: 'nowrap', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Gavel size={20} color="white" />
            </div>
            <div style={{ textAlign: dir === 'rtl' ? 'right' : 'left' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
                {user?.role === 'buyer' ? (locale === 'ar' ? 'مستلم' : 'Acheteur') : (locale === 'ar' ? 'منتج' : 'Producteur')}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{user?.name}</div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: '20px', borderBottom: '1px solid var(--border)', marginBottom: 8 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Gavel size={20} color="white" />
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleItemClick(item.id)}
              title={!isOpen ? sidebarLabel(item) : ''}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: isOpen ? '11px 20px' : '11px 0',
                justifyContent: isOpen ? 'flex-start' : 'center',
                flexDirection: dir === 'rtl' && isOpen ? 'row-reverse' : 'row',
                background: isActive ? 'rgba(16,185,129,0.12)' : 'transparent',
                border: 'none',
                borderLeft: dir === 'ltr' ? `3px solid ${isActive ? 'var(--primary)' : 'transparent'}` : 'none',
                borderRight: dir === 'rtl' ? `3px solid ${isActive ? 'var(--primary)' : 'transparent'}` : 'none',
                color: isActive ? 'var(--primary)' : 'var(--text-body)',
                fontWeight: isActive ? 700 : 500,
                fontSize: '0.875rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                width: '100%',
                overflow: 'hidden',
                whiteSpace: 'nowrap'
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
            >
              <Icon size={isOpen ? 18 : 22} style={{ flexShrink: 0 }} />
              {isOpen && <span>{sidebarLabel(item)}</span>}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
