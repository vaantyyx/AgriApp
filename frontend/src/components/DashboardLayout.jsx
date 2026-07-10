import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from '../context/LanguageContext';
import { LayoutDashboard, Gavel, User, MapPin, ChevronRight, ChevronLeft } from 'lucide-react';

export default function DashboardLayout({ user, isOpen, onToggle, mobileOpen, onCloseMobile, children }) {
  const { t, locale, dir } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768);
  useEffect(() => {
    function onResize() { setIsMobile(window.innerWidth <= 768); }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // On mobile the sidebar is a full-width-labels overlay drawer (no
  // collapsed-to-rail state), independent of the desktop open/collapsed toggle.
  const effectiveOpen = isMobile ? true : isOpen;

  // Determine active tab based on URL
  let activeTab = 'dashboard';
  if (location.pathname.includes('/profile')) activeTab = 'profile';
  else if (location.pathname.includes('/dashboard/auctions')) activeTab = 'auctions';
  else if (location.pathname.includes('/dashboard/parcelles')) activeTab = 'parcelles';

  const buyerItems = [
    { id: 'dashboard', icon: LayoutDashboard, labelKey: 'dashboard' },
    { id: 'auctions',  icon: Gavel,           labelKey: 'myAuctions' },
    { id: 'profile',   icon: User,            labelKey: 'profile' },
  ];

  const producerItems = [
    { id: 'dashboard', icon: LayoutDashboard, labelKey: 'dashboard' },
    { id: 'parcelles', icon: MapPin,          labelKey: 'myParcelles' },
    { id: 'auctions',  icon: Gavel,           labelKey: 'auctions' },
    { id: 'profile',   icon: User,            labelKey: 'profile' },
  ];

  const items = user?.role === 'buyer' ? buyerItems : producerItems;

  const handleItemClick = (id) => {
    if (id === 'profile') {
      navigate('/profile');
    } else if (id === 'dashboard') {
      navigate('/dashboard');
    } else {
      navigate(`/dashboard/${id}`);
    }
    if (isMobile) onCloseMobile?.();
  };

  const sidebarLabel = (item) => t(item.labelKey);

  return (
    <>
      {isMobile && mobileOpen && (
        <div className="dash-sidebar-backdrop" onClick={onCloseMobile} />
      )}

      {/* ── FIXED FULL-HEIGHT SIDEBAR ── */}
      <aside
        className={`dash-sidebar ${isMobile && mobileOpen ? 'dash-sidebar-mobile-open' : ''}`}
        style={{
        position: 'fixed',
        top: 0,
        bottom: 0,
        left: dir === 'ltr' ? 0 : 'auto',
        right: dir === 'rtl' ? 0 : 'auto',
        width: effectiveOpen ? 220 : 70,
        background: 'var(--bg-panel)',
        borderRight: dir === 'ltr' ? '1px solid var(--border)' : 'none',
        borderLeft: dir === 'rtl' ? '1px solid var(--border)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.3s ease',
        zIndex: 1300,
        boxShadow: '2px 0 12px rgba(0,0,0,0.12)',
        overflow: 'visible',
      }}>

        {/* Brand / logo zone at the very top */}
        <div style={{
          padding: effectiveOpen ? '20px 16px 16px' : '20px 0 16px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: effectiveOpen ? 'space-between' : 'center',
          position: 'relative',
          flexDirection: dir === 'rtl' && effectiveOpen ? 'row-reverse' : 'row',
          gap: 8,
        }}>
          {/* App icon */}
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: 'linear-gradient(135deg, var(--primary), #059669)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, boxShadow: '0 2px 8px rgba(16,185,129,0.3)',
          }}>
            <Gavel size={20} color="white" />
          </div>

          {/* Name + role — only when expanded */}
          {effectiveOpen && (
            <div style={{ flex: 1, minWidth: 0, textAlign: dir === 'rtl' ? 'right' : 'left' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.name}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 600 }}>
                {user?.role === 'buyer' ? t('role_buyer') : t('role_producer')}
              </div>
            </div>
          )}

          {/* Toggle button — right edge of the sidebar header (desktop only; mobile closes via backdrop/nav click) */}
          {!isMobile && (
            <button
              onClick={onToggle}
              title={isOpen ? t('hideSidebar') : t('showSidebar')}
              style={{
                position: 'absolute',
                top: '50%',
                transform: 'translateY(-50%)',
                right: dir === 'ltr' ? -12 : 'auto',
                left: dir === 'rtl' ? -12 : 'auto',
                width: 24, height: 24,
                borderRadius: '50%',
                background: 'var(--bg-panel)',
                border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                zIndex: 10,
                color: 'var(--text-muted)',
                boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
                transition: 'color 0.2s, box-shadow 0.2s',
                flexShrink: 0,
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--primary)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(16,185,129,0.3)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.18)'; }}
            >
              {isOpen
                ? (dir === 'rtl' ? <ChevronRight size={14} /> : <ChevronLeft size={14} />)
                : (dir === 'rtl' ? <ChevronLeft size={14} /> : <ChevronRight size={14} />)}
            </button>
          )}
        </div>

        {/* Navigation items */}
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, padding: '12px 0', overflowY: 'auto', overflowX: 'hidden' }}>
          {items.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item.id)}
                title={!effectiveOpen ? sidebarLabel(item) : ''}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: effectiveOpen ? '12px 20px' : '12px 0',
                  justifyContent: effectiveOpen ? 'flex-start' : 'center',
                  flexDirection: dir === 'rtl' && effectiveOpen ? 'row-reverse' : 'row',
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
                  whiteSpace: 'nowrap',
                  textAlign: dir === 'rtl' ? 'right' : 'left',
                  borderRadius: '0 8px 8px 0',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(16,185,129,0.06)'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
              >
                <Icon size={effectiveOpen ? 18 : 22} style={{ flexShrink: 0 }} />
                {effectiveOpen && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{sidebarLabel(item)}</span>}
              </button>
            );
          })}
        </nav>

        {/* Footer of sidebar */}
        {effectiveOpen && (
          <div style={{
            padding: '12px 16px',
            borderTop: '1px solid var(--border)',
            fontSize: '0.68rem',
            color: 'var(--text-muted)',
            textAlign: dir === 'rtl' ? 'right' : 'left',
          }}>
            Sougra © {new Date().getFullYear()}
          </div>
        )}
      </aside>

      {/* ── PAGE CONTENT (no extra padding needed, App.jsx handles it) ── */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: '100%' }}>
        {children}
      </div>
    </>
  );
}
