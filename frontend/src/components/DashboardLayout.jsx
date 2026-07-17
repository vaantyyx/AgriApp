import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from '../context/LanguageContext';
import { LayoutDashboard, Gavel, User, MapPin, ChevronRight, ChevronLeft, CloudSun, Map as MapIcon, Calendar, BarChart3, Receipt, Bell, HelpCircle } from 'lucide-react';
import AiAssistant from './AiAssistant';

export default function DashboardLayout({ user, isOpen, onToggle, mobileOpen, onCloseMobile, children }) {
  const { t, dir } = useTranslation();
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
  else if (location.pathname.includes('/dashboard/map')) activeTab = 'map';
  else if (location.pathname.includes('/dashboard/weather')) activeTab = 'weather';
  else if (location.pathname.includes('/dashboard/calendar')) activeTab = 'calendar';
  else if (location.pathname.includes('/dashboard/stats')) activeTab = 'stats';
  else if (location.pathname.includes('/dashboard/transactions')) activeTab = 'transactions';
  else if (location.pathname.includes('/dashboard/notifications')) activeTab = 'notifications';
  else if (location.pathname.includes('/dashboard/help')) activeTab = 'help';

  const buyerItems = [
    { id: 'dashboard',      icon: LayoutDashboard, labelKey: 'dashboard' },
    { id: 'auctions',       icon: Gavel,           labelKey: 'myAuctions' },
    { id: 'stats',          icon: BarChart3,       labelKey: 'sidebarStats' },
    { id: 'transactions',   icon: Receipt,         labelKey: 'sidebarTransactions' },
    { id: 'notifications',  icon: Bell,            labelKey: 'notifications' },
    { id: 'profile',        icon: User,            labelKey: 'profile' },
    { id: 'help',           icon: HelpCircle,      labelKey: 'sidebarHelp' },
  ];

  const producerItems = [
    { id: 'dashboard',      icon: LayoutDashboard, labelKey: 'dashboard' },
    { id: 'parcelles',      icon: MapPin,          labelKey: 'myParcelles' },
    { id: 'map',            icon: MapIcon,         labelKey: 'sidebarMap' },
    { id: 'weather',        icon: CloudSun,        labelKey: 'sidebarWeather' },
    { id: 'calendar',       icon: Calendar,        labelKey: 'sidebarCalendar' },
    { id: 'auctions',       icon: Gavel,           labelKey: 'auctions' },
    { id: 'stats',          icon: BarChart3,       labelKey: 'sidebarStats' },
    { id: 'transactions',   icon: Receipt,         labelKey: 'sidebarTransactions' },
    { id: 'notifications',  icon: Bell,            labelKey: 'notifications' },
    { id: 'profile',        icon: User,            labelKey: 'profile' },
    { id: 'help',           icon: HelpCircle,      labelKey: 'sidebarHelp' },
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
        className={`dash-sidebar ${effectiveOpen ? 'expanded' : 'collapsed'} ${isMobile && mobileOpen ? 'dash-sidebar-mobile-open' : ''}`}
      >

        {/* Brand / logo zone at the very top */}
        <div
          className={`dash-sidebar-header ${effectiveOpen ? 'expanded' : 'collapsed'}`}
          style={{ flexDirection: dir === 'rtl' && effectiveOpen ? 'row-reverse' : 'row' }}
        >
          {/* App icon */}
          <div className="dash-sidebar-icon-box">
            <Gavel size={20} color="white" />
          </div>

          {/* Name + role — only when expanded */}
          {effectiveOpen && (
            <div className="dash-sidebar-userinfo">
              <div className="dash-sidebar-username">
                {user?.name}
              </div>
              <div className="dash-sidebar-userrole">
                {user?.role === 'buyer' ? t('role_buyer') : t('role_producer')}
              </div>
            </div>
          )}

          {/* Toggle button — right edge of the sidebar header (desktop only; mobile closes via backdrop/nav click) */}
          {!isMobile && (
            <button
              onClick={onToggle}
              title={isOpen ? t('hideSidebar') : t('showSidebar')}
              className="dash-sidebar-toggle-btn"
            >
              {isOpen
                ? (dir === 'rtl' ? <ChevronRight size={14} /> : <ChevronLeft size={14} />)
                : (dir === 'rtl' ? <ChevronLeft size={14} /> : <ChevronRight size={14} />)}
            </button>
          )}
        </div>

        {/* Navigation items */}
        <nav className="dash-sidebar-nav">
          {items.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item.id)}
                title={!effectiveOpen ? sidebarLabel(item) : ''}
                className={`dash-nav-item ${effectiveOpen ? 'expanded' : 'collapsed'} ${isActive ? 'active' : ''}`}
                style={{ flexDirection: dir === 'rtl' && effectiveOpen ? 'row-reverse' : 'row' }}
              >
                <Icon size={effectiveOpen ? 18 : 22} className="icon-shrink0" />
                {effectiveOpen && <span className="text-ellipsis">{sidebarLabel(item)}</span>}
              </button>
            );
          })}
        </nav>

        {/* Footer of sidebar */}
        {effectiveOpen && (
          <div className="dash-sidebar-footer">
            Sougra © {new Date().getFullYear()}
          </div>
        )}
      </aside>

      {/* ── PAGE CONTENT (no extra padding needed, App.jsx handles it) ── */}
      <div className="dash-content-wrap">
        {children}
      </div>

      <AiAssistant />
    </>
  );
}
