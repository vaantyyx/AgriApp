import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { Sprout, LogOut, Tractor, ShoppingBag, RefreshCw, Wifi, WifiOff, LogIn, Home, Bell, Leaf, Sun, Moon } from 'lucide-react';
import LandingPage from './components/LandingPage';
import LoginPage from './components/LoginPage';
import RegisterPage from './components/RegisterPage';
import BuyerDashboard from './components/BuyerDashboard';
import ProducerDashboard from './components/ProducerDashboard';
import ProfilePage from './components/ProfilePage';
import VerifyEmailPage from './components/VerifyEmailPage';
import { useTranslation } from './context/LanguageContext';
import { useTheme } from './context/ThemeContext';

const BACKEND_URL = 'http://127.0.0.1:3001';

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

function getInitialPage() {
  if (window.location.pathname === '/verify-email' || window.location.search.includes('token=')) {
    return 'verify-email';
  }
  return getStoredToken() ? 'dashboard' : 'login';
}

export default function App() {
  const { locale, setLocale, t, dir } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const [token, setToken] = useState(getStoredToken);
  const [user, setUser] = useState(getStoredUser);
  const [page, setPage] = useState(getInitialPage);

  const [auctions, setAuctions] = useState([]);
  const [connected, setConnected] = useState(false);
  const [newBidFlashIds, setNewBidFlashIds] = useState([]);
  const [highlightAuctionId, setHighlightAuctionId] = useState(null);
  const socketRef = useRef(null);
  const userRef = useRef(user);
  const localeRef = useRef(locale);

  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { localeRef.current = locale; }, [locale]);

  // Notifications state
  const [notifications, setNotifications] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifPanelRef = useRef(null);

  const unreadCount = notifications.filter(n => !n.read).length;

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
      setAuctions(prev => prev.some(a => a.id === newAuction.id) ? prev : [newAuction, ...prev]);
    });

    socket.on('auction_updated', (updatedAuction) => {
      setAuctions(prev => {
        const old = prev.find(a => a.id === updatedAuction.id);
        if (old) {
          const oldBidIds = new Set(old.bids.map(b => b.id));
          const newBids = updatedAuction.bids.filter(b => !oldBidIds.has(b.id));
          if (newBids.length > 0) {
            const ids = newBids.map(b => b.id);
            setNewBidFlashIds(f => [...f, ...ids]);
            setTimeout(() => setNewBidFlashIds(f => f.filter(id => !ids.includes(id))), 1500);
          }
        }
        return prev.map(a => a.id === updatedAuction.id ? updatedAuction : a);
      });
    });

    socket.on('data_reset', () => {
      setAuctions([]);
      setNotifications([]);
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
    setPage('dashboard');
    sessionStorage.setItem('agri_token', newToken);
    sessionStorage.setItem('agri_user', JSON.stringify(userInfo));
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    setPage('login');
    setNotifications([]);
    setNotifOpen(false);
    sessionStorage.removeItem('agri_token');
    sessionStorage.removeItem('agri_user');
  };

  const handleUserUpdate = (updatedUser) => {
    setUser(updatedUser);
    sessionStorage.setItem('agri_user', JSON.stringify(updatedUser));
  };

  const handleCreateAuction = (data) => socketRef.current?.emit('create_auction', data);
  const handlePlaceBid = (data) => socketRef.current?.emit('place_bid', data);
  const handleAcceptBid = (auctionId, bidId) => socketRef.current?.emit('accept_bid', { auctionId, bidId });
  const handleRateProducer = (auctionId, rating) => socketRef.current?.emit('rate_producer', { auctionId, rating });

  const handleResetData = async () => {
    if (!window.confirm(t('reset_confirm'))) return;
    try { await fetch(`${BACKEND_URL}/api/reset`, { method: 'POST' }); } catch { }
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch(`${BACKEND_URL}/api/notifications/read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch { }
  };

  // Avatar
  const photoUrl = user?.profilePhoto ? `${BACKEND_URL}/uploads/${user.profilePhoto}` : null;
  const initials = user?.name ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '?';
  const avatarColors = ['#1a7a4a', '#059669', '#0e4f2f', '#22a362'];
  const colorIndex = user?.name ? user.name.charCodeAt(0) % avatarColors.length : 0;

  return (
    <div className="page-wrapper">

      {/* ── HEADER ── */}
      <header className="app-header">
        <div className="header-container" style={{ flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}>

          {/* Logo */}
          <a
            href="/"
            className="logo"
            onClick={(e) => { e.preventDefault(); setPage(user ? 'dashboard' : 'login'); }}
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
              page === 'landing' ? (
                <div style={{ display: 'flex', gap: '8px', flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}>
                  <button
                    id="btn-login-header"
                    onClick={() => setPage('login')}
                    className="btn btn-secondary btn-sm"
                  >
                    <LogIn size={14} /> {t('login')}
                  </button>
                  <button
                    id="btn-register-header"
                    onClick={() => setPage('register')}
                    className="btn btn-primary btn-sm"
                  >
                    {t('register')}
                  </button>
                </div>
              ) : (
                <button onClick={() => setPage('landing')} className="btn btn-secondary btn-sm">
                  <Home size={14} /> {t('home')}
                </button>
              )
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}>

                <button
                  id="btn-reset"
                  onClick={handleResetData}
                  className="btn btn-secondary btn-sm"
                  title={t('reset')}
                >
                  <RefreshCw size={13} /> {t('reset')}
                </button>

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
                                onClick={() => {
                                  setNotifOpen(false);
                                  setPage('dashboard');
                                  setHighlightAuctionId(n.auctionId);
                                  setTimeout(() => setHighlightAuctionId(null), 3000);
                                }}
                                onKeyDown={e => e.key === 'Enter' && (() => {
                                  setNotifOpen(false);
                                  setPage('dashboard');
                                  setHighlightAuctionId(n.auctionId);
                                  setTimeout(() => setHighlightAuctionId(null), 3000);
                                })()}
                              >
                                <div className="notif-dot" />
                                <div className="notif-content">
                                  <div className="notif-title">
                                    {n.type === 'new_bid'
                                      ? t('newBidNotificationTitle')
                                      : t('newDemandAtDistance', { distance: n.distanceKm || 0 })}
                                  </div>
                                  <div className="notif-body">
                                    {n.type === 'new_bid'
                                      ? t('newBidNotificationBody', { product: n.product })
                                      : `${n.product} — ${n.quantity} ${t('unit_' + n.unit)}`}
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
                  className={`user-pill ${page === 'profile' ? 'active' : ''}`}
                  onClick={() => setPage('profile')}
                  title={t('profile')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    background: page === 'profile' ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${page === 'profile' ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`,
                    padding: '5px 14px 5px 6px', borderRadius: '999px',
                    cursor: 'pointer', transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.1)'; e.currentTarget.style.borderColor = 'rgba(16,185,129,0.3)'; }}
                  onMouseLeave={e => { if (page !== 'profile') { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'var(--border)'; } }}
                >
                  {photoUrl ? (
                    <img src={photoUrl} alt="" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary)' }} />
                  ) : (
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: `linear-gradient(135deg, ${avatarColors[colorIndex]}, ${avatarColors[(colorIndex + 1) % avatarColors.length]})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: '800', color: 'white', flexShrink: 0 }}>
                      {initials}
                    </div>
                  )}
                  <span style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-main)' }}>{user.name}</span>
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
                  <LogOut size={13} /> {t('logout')}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT ── */}
      <main style={{ flex: 1 }}>
        {page === 'landing' && (
          <LandingPage
            onNavigateToLogin={() => setPage('login')}
            onNavigateToRegister={() => setPage('register')}
          />
        )}
        {page === 'login' && (
          <LoginPage
            onLoginSuccess={handleLoginSuccess}
            onNavigateToRegister={() => setPage('register')}
          />
        )}
        {page === 'register' && (
          <RegisterPage onNavigateToLogin={() => setPage('login')} />
        )}
        {page === 'verify-email' && (
          <VerifyEmailPage onNavigateToLogin={() => setPage('login')} />
        )}
        {page === 'profile' && user && token && (
          <ProfilePage
            token={token}
            user={user}
            onUserUpdate={handleUserUpdate}
            onNavigateToDashboard={() => setPage('dashboard')}
          />
        )}
        {page === 'dashboard' && user && (
          user.role === 'buyer' ? (
            <BuyerDashboard
              user={user}
              auctions={auctions}
              onCreateAuction={handleCreateAuction}
              onAcceptBid={handleAcceptBid}
              onRateProducer={handleRateProducer}
              newBidFlashIds={newBidFlashIds}
              highlightAuctionId={highlightAuctionId}
              onNavigateToProfile={() => setPage('profile')}
            />
          ) : (
            <ProducerDashboard
              user={user}
              auctions={auctions}
              onPlaceBid={handlePlaceBid}
              newBidFlashIds={newBidFlashIds}
              highlightAuctionId={highlightAuctionId}
              onNavigateToProfile={() => setPage('profile')}
              token={token}
            />
          )
        )}
      </main>

      {/* ── FOOTER ── */}
      <footer className="app-footer">
        <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{t('appName')}</span>
        {' '}&copy; {new Date().getFullYear()} &bull; {t('appDesc')}
      </footer>
    </div>
  );
}
