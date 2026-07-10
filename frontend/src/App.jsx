import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { Sprout, LogOut, Tractor, ShoppingBag, Wifi, WifiOff, LogIn, Home, Bell, Leaf, Sun, Moon, Menu } from 'lucide-react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import LoginPage from './components/LoginPage';
import RegisterPage from './components/RegisterPage';
import BuyerProfilePage from './components/BuyerProfilePage';
import ProducerProfilePage from './components/ProducerProfilePage';
import BuyerOverviewPage from './components/BuyerOverviewPage';
import BuyerAuctionsPage from './components/BuyerAuctionsPage';
import ProducerOverviewPage from './components/ProducerOverviewPage';
import ProducerAuctionsPage from './components/ProducerAuctionsPage';
import ProducerParcellesPage from './components/ProducerParcellesPage';
import DashboardLayout from './components/DashboardLayout';
import VerifyEmailPage from './components/VerifyEmailPage';
import ForgotPasswordPage from './components/ForgotPasswordPage';
import ResetPasswordPage from './components/ResetPasswordPage';
import TermsPage from './components/TermsPage';
import { useTranslation } from './context/LanguageContext';
import { useTheme } from './context/ThemeContext';
import { BACKEND_URL } from './utils/config.js';

// Helper: get token from sessionStorage
// TODO(security): In production, migrate to HttpOnly cookies to prevent XSS token theft.
function getStoredToken() {
  try { return sessionStorage.getItem('agri_token') || null; } catch { return null; }
}
function getStoredUser() {
  try {
    const s = sessionStorage.getItem('agri_user');
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

export default function App() {
  const { locale, setLocale, t, dir } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const [token, setToken] = useState(getStoredToken);
  const [user, setUser] = useState(getStoredUser);
  const navigate = useNavigate();
  const location = useLocation();

  const [auctions, setAuctions] = useState([]);
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

  const fetchParcelles = async () => {
    if (!token || !user || user.role !== 'producer') return;
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
    fetchParcelles();
  }, [token, user]);

  // Notifications state
  const [notifications, setNotifications] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifPanelRef = useRef(null);

  const unreadCount = notifications.filter(n => !n.read).length;

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
  // Close the drawer automatically on route changes (e.g. back/forward nav)
  useEffect(() => { setIsMobileDrawerOpen(false); }, [location.pathname]);

  // Only show sidebar on authenticated dashboard/profile routes
  const isDashboardRoute = user && token && (location.pathname.startsWith('/dashboard') || location.pathname === '/profile');
  const sidebarWidth = isDashboardRoute ? (isMobile ? 0 : (isSidebarOpen ? 220 : 70)) : 0;
  // The landing page owns its own navbar/footer to match its dedicated design
  const isLandingRoute = location.pathname === '/';

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
  }, [token, user]);

  // Refresh the session user from the authoritative profile data on load/login.
  // Without this, fields edited on the Profile page (e.g. phone) only update the
  // dashboard's completion widget in the tab that made the edit — any other tab,
  // or a session restored from sessionStorage, kept showing the stale value.
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
          sessionStorage.setItem('agri_user', JSON.stringify(updated));
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
      setConnected(false);
      setAuctions([]);
      return;
    }

    const socket = io(BACKEND_URL, { auth: { token } });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', (err) => {
      setConnected(false);
      if (err && (err.message === 'Invalid token' || err.message === 'Authentication required')) {
        handleLogout();
      }
    });

    socket.on('auctions_list', (data) => setAuctions(data));

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
      const currentRole = userRef.current?.role;
      const currentLoc = localeRef.current;
      const alertTitle = currentRole === 'buyer'
        ? (currentLoc === 'ar' ? '🔔 إشعار جديد!' : (currentLoc === 'fr' ? '🔔 Nouveau message !' : '🔔 New notification!'))
        : t('newDemandNearbyAlert');
      document.title = alertTitle;
      setTimeout(() => { document.title = t('tabTitle'); }, 5000);
    });

    return () => { socket.disconnect(); };
  }, [token]);

  const handleLoginSuccess = (newToken, userInfo) => {
    setToken(newToken);
    setUser(userInfo);
    sessionStorage.setItem('agri_token', newToken);
    sessionStorage.setItem('agri_user', JSON.stringify(userInfo));
    navigate('/dashboard');
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    setNotifications([]);
    setNotifOpen(false);
    sessionStorage.removeItem('agri_token');
    sessionStorage.removeItem('agri_user');
    navigate('/login');
  };

  const handleUserUpdate = (updatedUser) => {
    setUser(updatedUser);
    sessionStorage.setItem('agri_user', JSON.stringify(updatedUser));
  };

  const handleCreateAuction = (data) => socketRef.current?.emit('create_auction', data);
  const handleUpdateAuction = (auctionId, data) => socketRef.current?.emit('update_auction', { auctionId, ...data });
  const handleDeleteAuction = (auctionId) => socketRef.current?.emit('delete_auction', { auctionId });
  const handlePlaceBid = (data) => socketRef.current?.emit('place_bid', data);
  const handleAcceptBid = (auctionId, bidId) => socketRef.current?.emit('accept_bid', { auctionId, bidId });
  const handleRateProducer = (auctionId, rating) => socketRef.current?.emit('rate_producer', { auctionId, rating });

  const handleMarkAllRead = async () => {
    try {
      await fetch(`${BACKEND_URL}/api/notifications/read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch { }
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

  const getNotificationTitle = (n) => {
    if (n.type === 'new_bid') return t('newBidNotificationTitle');
    if (n.type === 'bid_accepted') return t('bidAcceptedNotificationTitle');
    if (n.type === 'auction_scheduled') return t('auctionScheduledNotificationTitle');
    if (n.type === 'auction_starting_soon') return t('auctionStartingSoonNotificationTitle');
    if (n.type === 'auction_canceled') return t('auctionCanceledNotificationTitle');
    return t('newDemandAtDistance', { distance: n.distanceKm || 0 });
  };

  const getNotificationBody = (n) => {
    if (n.type === 'new_bid') return t('newBidNotificationBody', { product: n.product });
    if (n.type === 'bid_accepted') {
      if (n.price != null) {
        return t('bidAcceptedNotificationBody', {
          product: n.product,
          price: n.price,
          unit: t('unit_' + (n.unit || 'tonnes')),
        });
      }
      return t('bidAcceptedNotificationBodyPackage', {
        product: n.product,
        count: n.optionCount || 0,
      });
    }
    if (n.type === 'auction_scheduled') {
      return t('auctionScheduledNotificationBody', {
        product: n.product,
        date: n.startAt ? new Date(n.startAt).toLocaleString('fr-DZ', { dateStyle: 'medium', timeStyle: 'short' }) : '',
      });
    }
    if (n.type === 'auction_starting_soon') {
      return t('auctionStartingSoonNotificationBody', { product: n.product });
    }
    if (n.type === 'auction_canceled') {
      return t('auctionCanceledNotificationBody', { product: n.product });
    }
    return `${n.product} — ${n.quantity} ${t('unit_' + n.unit)}`;
  };

  // Avatar
  const photoUrl = user?.profilePhoto ? `${BACKEND_URL}/uploads/${user.profilePhoto}` : null;
  const initials = user?.name ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '?';
  const avatarColors = ['#1a7a4a', '#059669', '#0e4f2f', '#22a362'];
  const colorIndex = user?.name ? user.name.charCodeAt(0) % avatarColors.length : 0;

  return (
    <div className="page-wrapper">

      {/* ── HEADER ── */}
      {!isLandingRoute && (
      <header className="app-header" style={{
        paddingLeft: dir === 'ltr' ? sidebarWidth : 0,
        paddingRight: dir === 'rtl' ? sidebarWidth : 0,
        transition: 'padding 0.3s ease',
      }}>
        <div className="header-container" style={{ flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}>

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

          {/* Logo */}
          <a
            href="/"
            className="logo"
            onClick={(e) => { e.preventDefault(); navigate(user ? '/dashboard' : '/'); }}
          >
            <img
              src="/logo.png"
              alt="Sougra"
              style={{ height: 38, width: 'auto', objectFit: 'contain' }}
            />
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
            <select
              className="lang-select"
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              id="lang-switcher"
            >
              <option value="ar">العربية</option>
              <option value="fr">Français</option>
              <option value="en">English</option>
            </select>

            {/* Theme */}
            <button
              id="theme-toggle"
              className="theme-btn"
              onClick={toggleTheme}
              title={theme === 'dark' ? t('lightMode') : t('darkMode')}
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>

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
                      title="Notifications"
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
                                    {getNotificationTitle(n)}
                                  </div>
                                  <div className="notif-body">
                                    {getNotificationBody(n)}
                                  </div>
                                  <div className="notif-time">
                                    {new Date(n.createdAt).toLocaleTimeString('fr-DZ', { hour: '2-digit', minute: '2-digit' })}
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
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    background: location.pathname === '/profile' ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${location.pathname === '/profile' ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`,
                    padding: '5px 14px 5px 6px', borderRadius: '999px',
                    cursor: 'pointer', transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.1)'; e.currentTarget.style.borderColor = 'rgba(16,185,129,0.3)'; }}
                  onMouseLeave={e => { if (location.pathname !== '/profile') { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'var(--border)'; } }}
                >
                  {photoUrl ? (
                    <img src={photoUrl} alt="" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary)' }} />
                  ) : (
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: `linear-gradient(135deg, ${avatarColors[colorIndex]}, ${avatarColors[(colorIndex + 1) % avatarColors.length]})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: '800', color: 'white', flexShrink: 0 }}>
                      {initials}
                    </div>
                  )}
                  <span className="user-pill-name" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-main)' }}>{user.name}</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {user.role === 'buyer' ? <ShoppingBag size={11} /> : <Tractor size={11} />}
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
        <Routes>
          <Route path="/" element={
            <LandingPage
              onNavigateToLogin={() => navigate('/login')}
              onNavigateToRegister={() => navigate('/register')}
            />
          } />
          <Route path="/login" element={
            <LoginPage
              onLoginSuccess={handleLoginSuccess}
              onNavigateToRegister={() => navigate('/register')}
            />
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
            user && token ? (
              <DashboardLayout user={user} isOpen={isSidebarOpen} onToggle={toggleSidebar} mobileOpen={isMobileDrawerOpen} onCloseMobile={() => setIsMobileDrawerOpen(false)}>
                {user.role === 'buyer' ? (
                  <BuyerProfilePage
                    token={token}
                    user={user}
                    onUserUpdate={handleUserUpdate}
                    onLogout={handleLogout}
                    onNavigateToDashboard={() => navigate('/dashboard')}
                  />
                ) : (
                  <ProducerProfilePage
                    token={token}
                    user={user}
                    onUserUpdate={handleUserUpdate}
                    onLogout={handleLogout}
                    onNavigateToDashboard={() => navigate('/dashboard')}
                  />
                )}
              </DashboardLayout>
            ) : <Navigate to="/login" replace />
          } />
          <Route path="/dashboard" element={
            user && token ? (
              <DashboardLayout user={user} isOpen={isSidebarOpen} onToggle={toggleSidebar} mobileOpen={isMobileDrawerOpen} onCloseMobile={() => setIsMobileDrawerOpen(false)}>
                {user.role === 'buyer' ? (
                  <BuyerOverviewPage user={user} auctions={auctions} />
                ) : (
                  <ProducerOverviewPage user={user} auctions={auctions} parcelles={parcelles} />
                )}
              </DashboardLayout>
            ) : <Navigate to="/login" replace />
          } />
          
          <Route path="/dashboard/auctions" element={
            user && token ? (
              <DashboardLayout user={user} isOpen={isSidebarOpen} onToggle={toggleSidebar} mobileOpen={isMobileDrawerOpen} onCloseMobile={() => setIsMobileDrawerOpen(false)}>
                {user.role === 'buyer' ? (
                  <BuyerAuctionsPage
                    user={user}
                    auctions={auctions}
                    onCreateAuction={handleCreateAuction}
                    onUpdateAuction={handleUpdateAuction}
                    onDeleteAuction={handleDeleteAuction}
                    onAcceptBid={handleAcceptBid}
                    onRateProducer={handleRateProducer}
                    newBidFlashIds={newBidFlashIds}
                    highlightAuctionId={highlightAuctionId}
                  />
                ) : (
                  <ProducerAuctionsPage
                    user={user}
                    auctions={auctions}
                    onPlaceBid={handlePlaceBid}
                    newBidFlashIds={newBidFlashIds}
                    highlightAuctionId={highlightAuctionId}
                    token={token}
                  />
                )}
              </DashboardLayout>
            ) : <Navigate to="/login" replace />
          } />

          <Route path="/dashboard/parcelles" element={
            user && token && user.role === 'producer' ? (
              <DashboardLayout user={user} isOpen={isSidebarOpen} onToggle={toggleSidebar} mobileOpen={isMobileDrawerOpen} onCloseMobile={() => setIsMobileDrawerOpen(false)}>
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
      </main>

      {/* ── FOOTER ── */}
      {!isLandingRoute && (
      <footer className="app-footer">
        <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{t('appName')}</span>
        {' '}&copy; {new Date().getFullYear()} &bull; {t('appDesc')}
      </footer>
      )}
    </div>
  );
}
