import { useState, useEffect, useRef, Suspense, lazy } from 'react';
import io from 'socket.io-client';
import { LogOut, Tractor, ShoppingBag, Wifi, WifiOff, LogIn, Home, Bell, Sun, Moon, Menu, Shield } from 'lucide-react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import DashboardLayout from './components/DashboardLayout';
import CookieConsent from './components/CookieConsent';
import LanguageSwitcher from './components/LanguageSwitcher';
import { useTranslation } from './context/LanguageContext';
import { useTheme } from './context/ThemeContext';
import { BACKEND_URL } from './utils/config.js';
import { getNotificationTitle, getNotificationBody } from './utils/notificationText.js';
import { trackVisit } from './utils/trackVisit.js';

// Route-level pages are code-split: each is only downloaded when the user
// actually navigates to it, instead of bloating the initial bundle.
const LandingPage = lazy(() => import('./components/LandingPage'));
const LoginPage = lazy(() => import('./components/LoginPage'));
const RegisterPage = lazy(() => import('./components/RegisterPage'));
const BuyerProfilePage = lazy(() => import('./components/BuyerProfilePage'));
const ProducerProfilePage = lazy(() => import('./components/ProducerProfilePage'));
const AdminProfilePage = lazy(() => import('./components/AdminProfilePage'));
const BuyerOverviewPage = lazy(() => import('./components/BuyerOverviewPage'));
const BuyerAuctionsPage = lazy(() => import('./components/BuyerAuctionsPage'));
const ProducerOverviewPage = lazy(() => import('./components/ProducerOverviewPage'));
const ProducerAuctionsPage = lazy(() => import('./components/ProducerAuctionsPage'));
const ProducerParcellesPage = lazy(() => import('./components/ProducerParcellesPage'));
const VerifyEmailPage = lazy(() => import('./components/VerifyEmailPage'));
const ForgotPasswordPage = lazy(() => import('./components/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./components/ResetPasswordPage'));
const TermsPage = lazy(() => import('./components/TermsPage'));
const NotificationsPage = lazy(() => import('./components/NotificationsPage'));
const WeatherPage = lazy(() => import('./components/WeatherPage'));
const ParcellesMapPage = lazy(() => import('./components/ParcellesMapPage'));
const CropCalendarPage = lazy(() => import('./components/CropCalendarPage'));
const ProducerStatsPage = lazy(() => import('./components/ProducerStatsPage'));
const BuyerStatsPage = lazy(() => import('./components/BuyerStatsPage'));
const ProducerTransactionsPage = lazy(() => import('./components/ProducerTransactionsPage'));
const BuyerTransactionsPage = lazy(() => import('./components/BuyerTransactionsPage'));
const HelpPage = lazy(() => import('./components/HelpPage'));
const AdminDashboardPage = lazy(() => import('./components/AdminDashboardPage'));

function RouteLoadingFallback() {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );
}

// Helper: get token from localStorage
// TODO(security): In production, migrate to HttpOnly cookies to prevent XSS token theft.
function getStoredToken() {
  try { return localStorage.getItem('agri_token') || null; } catch { return null; }
}
function getStoredUser() {
  try {
    const s = localStorage.getItem('agri_user');
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}
// Which "hat" a dual-role account is currently browsing under — a display
// preference only, never an authorization concept (the backend still checks
// actual capabilities). Single-role accounts never see this matter at all.
function getStoredActiveView() {
  try { return localStorage.getItem('agri_active_view') || null; } catch { return null; }
}

export default function App() {
  const { locale, t, dir } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const [token, setToken] = useState(getStoredToken);
  const [user, setUser] = useState(getStoredUser);
  const [activeView, setActiveViewState] = useState(getStoredActiveView);
  const navigate = useNavigate();
  const location = useLocation();

  // `roles` is the account's capabilities; `activeRole` resolves the current
  // view preference against them, falling back to the first role a dual-role
  // account has (or the legacy single `role` for accounts predating this).
  const userRoles = user?.roles || (user?.role ? [user.role] : []);
  const activeRole = userRoles.includes(activeView) ? activeView : userRoles[0];
  const setActiveView = (view) => {
    setActiveViewState(view);
    try { localStorage.setItem('agri_active_view', view); } catch { /* ignore */ }
  };
  const activeRoleRef = useRef(activeRole);
  useEffect(() => { activeRoleRef.current = activeRole; }, [activeRole]);

  const [auctions, setAuctions] = useState([]);
  const [hasMoreAuctions, setHasMoreAuctions] = useState(false);
  const [loadingMoreAuctions, setLoadingMoreAuctions] = useState(false);
  const [parcelles, setParcelles] = useState([]);
  const [loadingParcelles, setLoadingParcelles] = useState(false);
  const [connected, setConnected] = useState(false);
  const [newBidFlashIds, setNewBidFlashIds] = useState([]);
  const [highlightAuctionId, setHighlightAuctionId] = useState(null);
  const socketRef = useRef(null);
  const userRef = useRef(user);
  const localeRef = useRef(locale);

  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { localeRef.current = locale; }, [locale]);

  // Covers returning visitors whose cookie consent was already accepted in a
  // previous session — first-time acceptance is tracked from CookieConsent.jsx
  // itself, at the moment consent is actually granted.
  useEffect(() => { trackVisit(); }, []);

  const fetchParcelles = async () => {
    if (!token || !user || !userRoles.includes('producer')) return;
    try {
      setLoadingParcelles(true);
      const res = await fetch(`${BACKEND_URL}/api/parcelles`, {
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
    // this should only re-run when token/user change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchParcelles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user]);

  // Notifications state
  const [notifications, setNotifications] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifPanelRef = useRef(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    setActiveViewState(null);
    setNotifications([]);
    setNotifOpen(false);
    localStorage.removeItem('agri_token');
    localStorage.removeItem('agri_user');
    localStorage.removeItem('agri_active_view');
    navigate('/login');
  };

  // Sidebar open/close state — lifted here so header & main can adapt
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    return localStorage.getItem('agri_sidebar_open') !== 'false';
  });
  const toggleSidebar = () => setIsSidebarOpen(prev => {
    localStorage.setItem('agri_sidebar_open', !prev);
    return !prev;
  });

  // On narrow screens the sidebar becomes an overlay drawer rather than
  // pushing content, so it must not reserve any header/main padding.
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768);
  useEffect(() => {
    function onResize() { setIsMobile(window.innerWidth <= 768); }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  // Close the drawer automatically on route changes (e.g. back/forward nav) —
  // syncing local UI state to the router, an external system.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setIsMobileDrawerOpen(false); }, [location.pathname]);

  // Only show sidebar on authenticated dashboard/profile routes
  const isDashboardRoute = user && token && (location.pathname.startsWith('/dashboard') || location.pathname === '/profile');
  const sidebarWidth = isDashboardRoute ? (isMobile ? 0 : (isSidebarOpen ? 220 : 70)) : 0;
  // The landing page owns its own navbar/footer to match its dedicated design.
  // Login/register/terms render that same navbar (SiteNavbar) themselves too,
  // so the generic global header is skipped on all of these routes.
  const isLandingRoute = location.pathname === '/';
  const hasOwnNavbar = isLandingRoute || ['/login', '/register', '/terms'].includes(location.pathname);

  // Close notif panel on outside click
  useEffect(() => {
    function handler(e) {
      if (notifPanelRef.current && !notifPanelRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    }
    if (notifOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [notifOpen]);

  // Load notifications from API on login
  useEffect(() => {
    if (!token || !user) return;
    fetch(`${BACKEND_URL}/api/notifications`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => {
        if (r.status === 401) {
          handleLogout();
          return [];
        }
        return r.ok ? r.json() : [];
      })
      .then(data => setNotifications(Array.isArray(data) ? data : []))
      .catch(() => { });
    // handleLogout is intentionally omitted: it's redefined every render and
    // this should only re-run when token/user change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user]);

  // Refresh the session user from the authoritative profile data on load/login.
  // Without this, fields edited on the Profile page (e.g. phone) only update the
  // dashboard's completion widget in the tab that made the edit — any other tab,
  // or a session restored from localStorage, kept showing the stale value.
  useEffect(() => {
    if (!token) return;
    fetch(`${BACKEND_URL}/api/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (!data) return;
        setUser(prev => {
          if (!prev) return prev;
          const updated = {
            ...prev,
            name: data.name,
            phone: data.phone || '',
            bio: data.bio || '',
            wilaya: data.wilaya || '',
            commune: data.commune || '',
            profilePhoto: data.profilePhoto || null,
            entity_type: data.entity_type || 'particulier',
            rc: data.rc || '',
            nif: data.nif || '',
            forme_juridique: data.forme_juridique || '',
            nom_commercial: data.nom_commercial || '',
            secteur_activite: data.secteur_activite || '',
            possede_transport: !!data.possede_transport,
            possede_chambre_froide: !!data.possede_chambre_froide,
            rcDocument: data.rcDocument || null,
            numeroCarteAgriculteur: data.numeroCarteAgriculteur || '',
            ficheSignaletiqueDocument: data.ficheSignaletiqueDocument || null,
            carteAgriculteurDocument: data.carteAgriculteurDocument || null,
          };
          localStorage.setItem('agri_user', JSON.stringify(updated));
          return updated;
        });
      })
      .catch(() => {});
  }, [token]);

  // Socket.IO — connect only when authenticated
  useEffect(() => {
    if (!token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      // Tearing down the socket (an external system) and resetting the
      // React state that mirrored its connection — not a derived-state effect.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setConnected(false);
      setAuctions([]);
      setHasMoreAuctions(false);
      return;
    }

    const socket = io(BACKEND_URL, { auth: { token, activeView: activeRoleRef.current } });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', (err) => {
      setConnected(false);
      if (err && (err.message === 'Invalid token' || err.message === 'Authentication required')) {
        handleLogout();
      }
    });

    socket.on('auctions_list', (data, meta) => {
      setAuctions(data);
      setHasMoreAuctions(!!meta?.hasMore);
    });

    socket.on('auction_created', (newAuction) => {
      setAuctions(prev => prev.some(a => a.id === newAuction.id)
        ? prev.map(a => a.id === newAuction.id ? newAuction : a)
        : [newAuction, ...prev]
      );
      if (newAuction.isOwner) {
        setHighlightAuctionId(newAuction.id);
        setTimeout(() => setHighlightAuctionId(null), 3000);
      }
    });

    socket.on('auction_updated', (updatedAuction) => {
      setAuctions(prev => {
        const old = prev.find(a => a.id === updatedAuction.id);
        const updatedList = old
          ? prev.map(a => a.id === updatedAuction.id ? updatedAuction : a)
          : [updatedAuction, ...prev];

        if (old) {
          const oldBidIds = new Set(old.bids.map(b => b.id));
          const newBids = updatedAuction.bids.filter(b => !oldBidIds.has(b.id));
          if (newBids.length > 0) {
            const ids = newBids.map(b => b.id);
            setNewBidFlashIds(f => [...f, ...ids]);
            setTimeout(() => setNewBidFlashIds(f => f.filter(id => !ids.includes(id))), 1500);
          }
        }

        return updatedList;
      });
    });

    socket.on('auction_deleted', ({ auctionId }) => {
      setAuctions(prev => prev.filter(a => a.id !== auctionId));
      setNotifications(prev => prev.filter(n => n.auctionId !== auctionId || n.type === 'auction_canceled'));
    });

    // New notification
    socket.on('new_notification', (notif) => {
      setNotifications(prev => [notif, ...prev]);
      // Show a brief flash on the page title
      const currentRole = activeRoleRef.current;
      const currentLoc = localeRef.current;
      const alertTitle = currentRole === 'buyer'
        ? (currentLoc === 'ar' ? '🔔 إشعار جديد!' : (currentLoc === 'fr' ? '🔔 Nouveau message !' : '🔔 New notification!'))
        : t('newDemandNearbyAlert');
      document.title = alertTitle;
      setTimeout(() => { document.title = t('tabTitle'); }, 5000);
    });

    return () => { socket.disconnect(); };
    // handleLogout and t are intentionally omitted: the socket should only
    // reconnect when the auth token changes (or the active view is switched,
    // so the server resends auctions_list sanitized for the new perspective),
    // not on every render or locale switch — localeRef/userRef above exist
    // precisely to read their latest values from inside long-lived socket
    // callbacks without that dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, activeRole]);

  const handleLoginSuccess = (newToken, userInfo) => {
    setToken(newToken);
    setUser(userInfo);
    localStorage.setItem('agri_token', newToken);
    localStorage.setItem('agri_user', JSON.stringify(userInfo));
    navigate(userInfo.role === 'admin' ? '/admin' : '/dashboard');
  };

  const handleUserUpdate = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem('agri_user', JSON.stringify(updatedUser));
  };

  // Lets a buyer add the producer capability (or vice versa) without
  // re-registering — the backend reissues a JWT carrying the new `roles`,
  // so the session updates in place instead of forcing a re-login.
  const handleAddRole = async (role, extraFields = {}) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/profile/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ role, ...extraFields }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data.error };
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('agri_token', data.token);
      localStorage.setItem('agri_user', JSON.stringify(data.user));
      return { ok: true };
    } catch {
      return { ok: false, error: 'Erreur réseau.' };
    }
  };

  const handleCreateAuction = (data) => socketRef.current?.emit('create_auction', data);
  const handleUpdateAuction = (auctionId, data) => socketRef.current?.emit('update_auction', { auctionId, ...data });
  const handleDeleteAuction = (auctionId) => socketRef.current?.emit('delete_auction', { auctionId });
  const handlePlaceBid = (data) => socketRef.current?.emit('place_bid', data);
  const handleAcceptBid = (auctionId, bidId) => socketRef.current?.emit('accept_bid', { auctionId, bidId });
  const handleSubmitInspection = (auctionId, { conforms, reliabilityRating, qualityRating }) =>
    socketRef.current?.emit('submit_inspection', { auctionId, conforms, reliabilityRating, qualityRating });

  // Bloc A — live reference-price lookup (not the frozen validation.referenceUsed
  // snapshot): used by the buyer's create/edit form as a pricing hint, and by
  // the producer's bid view to see the current market reference.
  const lookupReferencePrice = async (productId, wilayaId, unit) => {
    if (!productId || !wilayaId) return null;
    try {
      const params = new URLSearchParams({ productId, wilayaId, unit: unit || 'tonnes' });
      const res = await fetch(`${BACKEND_URL}/api/reference-prices/lookup?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.reference;
    } catch {
      return null;
    }
  };

  // The live feed only carries the most recent page (see INITIAL_AUCTIONS_LIMIT
  // server-side) — this fetches older ones on demand instead of ever loading
  // the entire auctions history into memory at once.
  const loadMoreAuctions = async () => {
    if (loadingMoreAuctions || auctions.length === 0) return;
    const oldest = auctions.reduce((min, a) => (a.createdAt < min ? a.createdAt : min), auctions[0].createdAt);
    setLoadingMoreAuctions(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/auctions/older?before=${encodeURIComponent(oldest)}&limit=50&activeView=${encodeURIComponent(activeRole || '')}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setAuctions(prev => {
          const existingIds = new Set(prev.map(a => a.id));
          return [...prev, ...data.auctions.filter(a => !existingIds.has(a.id))];
        });
        setHasMoreAuctions(!!data.hasMore);
      }
    } finally {
      setLoadingMoreAuctions(false);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch(`${BACKEND_URL}/api/notifications/read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch { /* non-critical: local state already reflects read status */ }
  };

  const handleMarkOneRead = async (notifId) => {
    try {
      await fetch(`${BACKEND_URL}/api/notifications/${notifId}/read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, read: true } : n));
    } catch { /* non-critical: local state already reflects read status */ }
  };

  const handleNotificationClick = (n) => {
    setNotifOpen(false);
    if (n.auctionId) {
      navigate('/dashboard/auctions');
      setHighlightAuctionId(n.auctionId);
      setTimeout(() => setHighlightAuctionId(null), 3000);
    } else {
      navigate('/dashboard');
    }
  };

  // Avatar
  const photoUrl = user?.profilePhoto ? `${BACKEND_URL}/uploads/${user.profilePhoto}?token=${token}` : null;
  const initials = user?.name ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '?';
  const avatarColors = ['#1a7a4a', '#059669', '#0e4f2f', '#22a362'];
  const colorIndex = user?.name ? user.name.charCodeAt(0) % avatarColors.length : 0;

  return (
    <div className="page-wrapper">

      {/* ── HEADER ── */}
      {!hasOwnNavbar && (
      <header className="app-header" style={{
        paddingLeft: dir === 'ltr' ? sidebarWidth : 0,
        paddingRight: dir === 'rtl' ? sidebarWidth : 0,
        transition: 'padding 0.3s ease',
      }}>
        {/* Always a plain "row" (never reversed): with dir=rtl a normal row's
            start edge is the physical right — same side the sidebar docks to
            (see DashboardLayout's `right: 0` in rtl) — so the logo (first
            child) lands right next to the sidebar and the nav cluster (last
            child) lands on the opposite edge, in both languages. */}
        <div className="header-container">

          {/* Hamburger — opens the mobile sidebar drawer (dashboard routes only) */}
          {isDashboardRoute && (
            <button
              className="hamburger-btn"
              onClick={() => setIsMobileDrawerOpen(o => !o)}
              aria-label={t('showSidebar')}
            >
              <Menu size={18} />
            </button>
          )}

          {/* Logo — icon + wordmark, same lockup as the landing header */}
          <a
            href="/"
            className="logo"
            onClick={(e) => { e.preventDefault(); navigate(user ? '/dashboard' : '/'); }}
          >
            <img src="/logo.png" alt="Sougra" />
            <div className="logo-text">
              <strong>SOUGRA</strong>
              <span>{t('landingLogoTagline')}</span>
            </div>
          </a>

          {/* Right side */}
          <div className="header-nav" style={{ flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}>

            {/* Connection status */}
            {user && (
              <div className={`conn-dot ${connected ? 'online' : 'offline'}`} title={connected ? t('connected') : t('disconnected')}>
                {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
              </div>
            )}

            {/* Language */}
            <LanguageSwitcher />

            {/* Theme */}
            <button
              id="theme-toggle"
              className="theme-btn"
              onClick={toggleTheme}
              title={theme === 'dark' ? t('lightMode') : t('darkMode')}
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            {user && <span className="header-divider" />}

            {/* Navigation */}
            {!user ? (
              location.pathname === '/' ? (
                <div style={{ display: 'flex', gap: '8px', flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}>
                  <button
                    id="btn-login-header"
                    onClick={() => navigate('/login')}
                    className="btn btn-secondary btn-sm"
                  >
                    <LogIn size={14} /> {t('login')}
                  </button>
                  <button
                    id="btn-register-header"
                    onClick={() => navigate('/register')}
                    className="btn btn-primary btn-sm"
                  >
                    {t('register')}
                  </button>
                </div>
              ) : (
                <button onClick={() => navigate('/')} className="btn btn-secondary btn-sm">
                  <Home size={14} /> {t('home')}
                </button>
              )
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}>

                {/* Notification bell */}
                {user && (
                  <div ref={notifPanelRef} style={{ position: 'relative' }}>
                    <button
                      id="notif-bell-btn"
                      className="notif-bell-btn"
                      onClick={() => {
                        setNotifOpen(o => !o);
                        if (!notifOpen && unreadCount > 0) handleMarkAllRead();
                      }}
                      title={t('notifications')}
                      aria-label={t('unreadNotifications', { count: unreadCount })}
                    >
                      <Bell size={18} />
                      {unreadCount > 0 && (
                        <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
                      )}
                    </button>

                    {notifOpen && (
                      <div className="notif-panel animate-fade-in">
                        <div className="notif-panel-header">
                          <span>{t('notifications')}</span>
                          {notifications.length > 0 && (
                            <button className="notif-clear-btn" onClick={handleMarkAllRead}>{t('markAllRead')}</button>
                          )}
                        </div>
                        <div className="notif-list">
                          {notifications.length === 0 ? (
                            <div className="notif-empty">{t('noNotifications')}</div>
                          ) : (
                            notifications.map(n => (
                              <div
                                key={n.id}
                                className={`notif-item notif-item-clickable ${n.read ? '' : 'notif-unread'}`}
                                role="button"
                                tabIndex={0}
                                onClick={() => handleNotificationClick(n)}
                                onKeyDown={e => e.key === 'Enter' && handleNotificationClick(n)}
                              >
                                <div className="notif-dot" />
                                <div className="notif-content">
                                  <div className="notif-title">
                                    {getNotificationTitle(n, t)}
                                  </div>
                                  <div className="notif-body">
                                    {getNotificationBody(n, t, locale)}
                                  </div>
                                  <div className="notif-time">
                                    {new Date(n.createdAt).toLocaleTimeString(locale === 'ar' ? 'ar-DZ' : locale === 'en' ? 'en-US' : 'fr-DZ', { hour: '2-digit', minute: '2-digit', hour12: locale === 'en' })}
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* User avatar + name (clickable → profile) */}
                <button
                  id="btn-profile"
                  className={`user-pill ${location.pathname === '/profile' ? 'active' : ''}`}
                  onClick={() => navigate('/profile')}
                  title={t('profile')}
                >
                  {photoUrl ? (
                    <img className="user-pill-avatar" src={photoUrl} alt="" />
                  ) : (
                    <div className="user-pill-avatar" style={{ background: `linear-gradient(135deg, ${avatarColors[colorIndex]}, ${avatarColors[(colorIndex + 1) % avatarColors.length]})` }}>
                      {initials}
                    </div>
                  )}
                  <span className="user-pill-name">{user.name}</span>
                  <span className="user-pill-role-icon" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {user.role === 'admin' ? <Shield size={11} /> : activeRole === 'buyer' ? <ShoppingBag size={11} /> : <Tractor size={11} />}
                  </span>
                  <div style={{
                    width: 7, height: 7,
                    borderRadius: '50%',
                    background: connected ? 'var(--success)' : 'var(--danger)',
                    boxShadow: connected ? '0 0 5px var(--success)' : 'none'
                  }} />
                </button>

                <button
                  id="btn-logout"
                  onClick={handleLogout}
                  className="btn btn-secondary btn-sm"
                >
                  <LogOut size={13} /> <span className="logout-label">{t('logout')}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      )}

      {/* ── MAIN CONTENT ── */}
      <main style={{
        flex: 1,
        paddingLeft: dir === 'ltr' ? sidebarWidth : 0,
        paddingRight: dir === 'rtl' ? sidebarWidth : 0,
        transition: 'padding 0.3s ease',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          <Route path="/" element={
            <LandingPage
              onNavigateToLogin={() => navigate('/login')}
              onNavigateToRegister={() => navigate('/register')}
            />
          } />
          <Route path="/login" element={
            user && token ? (
              <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />
            ) : (
              <LoginPage
                onLoginSuccess={handleLoginSuccess}
                onNavigateToRegister={() => navigate('/register')}
              />
            )
          } />
          <Route path="/register" element={
            <RegisterPage onNavigateToLogin={() => navigate('/login')} />
          } />
          <Route path="/verify-email" element={
            <VerifyEmailPage onNavigateToLogin={() => navigate('/login')} />
          } />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/profile" element={
            !user || !token ? <Navigate to="/login" replace />
            : user.role === 'admin' ? (
              <AdminProfilePage
                token={token}
                user={user}
                onUserUpdate={handleUserUpdate}
                onLogout={handleLogout}
                onNavigateToDashboard={() => navigate('/admin')}
              />
            ) : (
              <DashboardLayout user={user} roles={userRoles} activeRole={activeRole} onSwitchView={setActiveView} isOpen={isSidebarOpen} onToggle={toggleSidebar} mobileOpen={isMobileDrawerOpen} onCloseMobile={() => setIsMobileDrawerOpen(false)}>
                {activeRole === 'buyer' ? (
                  <BuyerProfilePage
                    token={token}
                    user={user}
                    roles={userRoles}
                    onAddRole={handleAddRole}
                    onUserUpdate={handleUserUpdate}
                    onLogout={handleLogout}
                    onNavigateToDashboard={() => navigate('/dashboard')}
                  />
                ) : (
                  <ProducerProfilePage
                    token={token}
                    user={user}
                    roles={userRoles}
                    onAddRole={handleAddRole}
                    onUserUpdate={handleUserUpdate}
                    onLogout={handleLogout}
                    onNavigateToDashboard={() => navigate('/dashboard')}
                  />
                )}
              </DashboardLayout>
            )
          } />
          <Route path="/dashboard" element={
            !user || !token ? <Navigate to="/login" replace />
            : user.role === 'admin' ? <Navigate to="/admin" replace />
            : (
              <DashboardLayout user={user} roles={userRoles} activeRole={activeRole} onSwitchView={setActiveView} isOpen={isSidebarOpen} onToggle={toggleSidebar} mobileOpen={isMobileDrawerOpen} onCloseMobile={() => setIsMobileDrawerOpen(false)}>
                {activeRole === 'buyer' ? (
                  <BuyerOverviewPage user={user} auctions={auctions} />
                ) : (
                  <ProducerOverviewPage user={user} auctions={auctions} parcelles={parcelles} />
                )}
              </DashboardLayout>
            )
          } />

          <Route path="/admin" element={
            user && token && user.role === 'admin' ? (
              <AdminDashboardPage token={token} />
            ) : <Navigate to="/login" replace />
          } />

          <Route path="/dashboard/auctions" element={
            user && token ? (
              <DashboardLayout user={user} roles={userRoles} activeRole={activeRole} onSwitchView={setActiveView} isOpen={isSidebarOpen} onToggle={toggleSidebar} mobileOpen={isMobileDrawerOpen} onCloseMobile={() => setIsMobileDrawerOpen(false)}>
                {activeRole === 'buyer' ? (
                  <BuyerAuctionsPage
                    user={user}
                    token={token}
                    auctions={auctions}
                    onCreateAuction={handleCreateAuction}
                    onUpdateAuction={handleUpdateAuction}
                    onDeleteAuction={handleDeleteAuction}
                    onAcceptBid={handleAcceptBid}
                    onSubmitInspection={handleSubmitInspection}
                    onLookupReferencePrice={lookupReferencePrice}
                    newBidFlashIds={newBidFlashIds}
                    highlightAuctionId={highlightAuctionId}
                    hasMoreAuctions={hasMoreAuctions}
                    loadingMoreAuctions={loadingMoreAuctions}
                    onLoadMoreAuctions={loadMoreAuctions}
                  />
                ) : (
                  <ProducerAuctionsPage
                    user={user}
                    auctions={auctions}
                    onPlaceBid={handlePlaceBid}
                    onLookupReferencePrice={lookupReferencePrice}
                    newBidFlashIds={newBidFlashIds}
                    highlightAuctionId={highlightAuctionId}
                    token={token}
                    hasMoreAuctions={hasMoreAuctions}
                    loadingMoreAuctions={loadingMoreAuctions}
                    onLoadMoreAuctions={loadMoreAuctions}
                  />
                )}
              </DashboardLayout>
            ) : <Navigate to="/login" replace />
          } />

          <Route path="/dashboard/notifications" element={
            user && token ? (
              <DashboardLayout user={user} roles={userRoles} activeRole={activeRole} onSwitchView={setActiveView} isOpen={isSidebarOpen} onToggle={toggleSidebar} mobileOpen={isMobileDrawerOpen} onCloseMobile={() => setIsMobileDrawerOpen(false)}>
                <NotificationsPage
                  notifications={notifications}
                  onMarkAllRead={handleMarkAllRead}
                  onMarkOneRead={handleMarkOneRead}
                  onNotificationClick={handleNotificationClick}
                />
              </DashboardLayout>
            ) : <Navigate to="/login" replace />
          } />

          <Route path="/dashboard/weather" element={
            user && token && userRoles.includes('producer') ? (
              <DashboardLayout user={user} roles={userRoles} activeRole={activeRole} onSwitchView={setActiveView} isOpen={isSidebarOpen} onToggle={toggleSidebar} mobileOpen={isMobileDrawerOpen} onCloseMobile={() => setIsMobileDrawerOpen(false)}>
                <WeatherPage parcelles={parcelles} loadingParcelles={loadingParcelles} />
              </DashboardLayout>
            ) : <Navigate to="/dashboard" replace />
          } />

          <Route path="/dashboard/map" element={
            user && token && userRoles.includes('producer') ? (
              <DashboardLayout user={user} roles={userRoles} activeRole={activeRole} onSwitchView={setActiveView} isOpen={isSidebarOpen} onToggle={toggleSidebar} mobileOpen={isMobileDrawerOpen} onCloseMobile={() => setIsMobileDrawerOpen(false)}>
                <ParcellesMapPage parcelles={parcelles} loadingParcelles={loadingParcelles} />
              </DashboardLayout>
            ) : <Navigate to="/dashboard" replace />
          } />

          <Route path="/dashboard/calendar" element={
            user && token && userRoles.includes('producer') ? (
              <DashboardLayout user={user} roles={userRoles} activeRole={activeRole} onSwitchView={setActiveView} isOpen={isSidebarOpen} onToggle={toggleSidebar} mobileOpen={isMobileDrawerOpen} onCloseMobile={() => setIsMobileDrawerOpen(false)}>
                <CropCalendarPage parcelles={parcelles} loadingParcelles={loadingParcelles} />
              </DashboardLayout>
            ) : <Navigate to="/dashboard" replace />
          } />

          <Route path="/dashboard/stats" element={
            user && token ? (
              <DashboardLayout user={user} roles={userRoles} activeRole={activeRole} onSwitchView={setActiveView} isOpen={isSidebarOpen} onToggle={toggleSidebar} mobileOpen={isMobileDrawerOpen} onCloseMobile={() => setIsMobileDrawerOpen(false)}>
                {activeRole === 'buyer' ? (
                  <BuyerStatsPage user={user} auctions={auctions} />
                ) : (
                  <ProducerStatsPage user={user} auctions={auctions} />
                )}
              </DashboardLayout>
            ) : <Navigate to="/login" replace />
          } />

          <Route path="/dashboard/transactions" element={
            user && token ? (
              <DashboardLayout user={user} roles={userRoles} activeRole={activeRole} onSwitchView={setActiveView} isOpen={isSidebarOpen} onToggle={toggleSidebar} mobileOpen={isMobileDrawerOpen} onCloseMobile={() => setIsMobileDrawerOpen(false)}>
                {activeRole === 'buyer' ? (
                  <BuyerTransactionsPage user={user} auctions={auctions} />
                ) : (
                  <ProducerTransactionsPage user={user} auctions={auctions} />
                )}
              </DashboardLayout>
            ) : <Navigate to="/login" replace />
          } />

          <Route path="/dashboard/help" element={
            user && token ? (
              <DashboardLayout user={user} roles={userRoles} activeRole={activeRole} onSwitchView={setActiveView} isOpen={isSidebarOpen} onToggle={toggleSidebar} mobileOpen={isMobileDrawerOpen} onCloseMobile={() => setIsMobileDrawerOpen(false)}>
                <HelpPage user={user} token={token} />
              </DashboardLayout>
            ) : <Navigate to="/login" replace />
          } />

          <Route path="/dashboard/parcelles" element={
            user && token && userRoles.includes('producer') ? (
              <DashboardLayout user={user} roles={userRoles} activeRole={activeRole} onSwitchView={setActiveView} isOpen={isSidebarOpen} onToggle={toggleSidebar} mobileOpen={isMobileDrawerOpen} onCloseMobile={() => setIsMobileDrawerOpen(false)}>
                <ProducerParcellesPage
                  user={user}
                  parcelles={parcelles}
                  token={token}
                  fetchParcelles={fetchParcelles}
                  loadingParcelles={loadingParcelles}
                />
              </DashboardLayout>
            ) : <Navigate to="/dashboard" replace />
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </main>

      {/* ── FOOTER ── */}
      {!isLandingRoute && (
      <footer className="app-footer">
        <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{t('appName')}</span>
        {' '}&copy; {new Date().getFullYear()} &bull; {t('appDesc')}
      </footer>
      )}

      <CookieConsent />
    </div>
  );
}
