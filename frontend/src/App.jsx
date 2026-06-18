import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { Sprout, LogOut, Tractor, ShoppingBag, RefreshCw, Wifi, WifiOff, LogIn, Home, Bell } from 'lucide-react';
import LandingPage from './components/LandingPage';
import LoginPage from './components/LoginPage';
import RegisterPage from './components/RegisterPage';
import BuyerDashboard from './components/BuyerDashboard';
import ProducerDashboard from './components/ProducerDashboard';
import ProfilePage from './components/ProfilePage';
import VerifyEmailPage from './components/VerifyEmailPage';

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

// Detect if current URL is a verify-email route
function getInitialPage() {
  if (window.location.pathname === '/verify-email' || window.location.search.includes('token=')) {
    return 'verify-email';
  }
  return getStoredToken() ? 'dashboard' : 'landing';
}

export default function App() {
  const [token, setToken] = useState(getStoredToken);
  const [user, setUser] = useState(getStoredUser);
  const [page, setPage] = useState(getInitialPage);

  const [auctions, setAuctions] = useState([]);
  const [connected, setConnected] = useState(false);
  const [newBidFlashIds, setNewBidFlashIds] = useState([]);
  const socketRef = useRef(null);

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

  // Load notifications from API on login (producers)
  useEffect(() => {
    if (!token || !user || user.role !== 'producer') return;
    fetch(`${BACKEND_URL}/api/notifications`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : [])
      .then(data => setNotifications(Array.isArray(data) ? data : []))
      .catch(() => {});
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
    socket.on('connect_error', () => setConnected(false));

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

    // New notification for producers
    socket.on('new_notification', (notif) => {
      setNotifications(prev => [notif, ...prev]);
      // Show a brief flash on the page title
      document.title = '🔔 AgriEnchères — Nouveau besoin à proximité !';
      setTimeout(() => { document.title = 'AgriEnchères - Enchères Inversées Agricoles en Temps Réel'; }, 5000);
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
    setPage('landing');
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
    if (!window.confirm('Voulez-vous vraiment réinitialiser toutes les enchères ?')) return;
    try { await fetch(`${BACKEND_URL}/api/reset`, { method: 'POST' }); } catch {}
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch(`${BACKEND_URL}/api/notifications/read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch {}
  };

  // Avatar
  const photoUrl = user?.profilePhoto ? `${BACKEND_URL}/uploads/${user.profilePhoto}` : null;
  const initials = user?.name ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '?';
  const avatarColors = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6'];
  const colorIndex = user?.name ? user.name.charCodeAt(0) % avatarColors.length : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>

      {/* Header */}
      <header className="app-header">
        <div className="header-container">
          <a href="/" className="logo" onClick={(e) => { e.preventDefault(); setPage(user ? 'dashboard' : 'landing'); }}>
            <Sprout size={28} style={{ color: 'var(--primary)' }} />
            <span>AgriEnchères</span>
          </a>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Connection indicator */}
            {user && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: connected ? 'var(--primary)' : 'var(--text-muted)' }}>
                {connected
                  ? <><Wifi size={14} /><span style={{ fontWeight: 500 }}>Connecté</span></>
                  : <><WifiOff size={14} style={{ color: 'var(--danger)' }} /><span style={{ color: 'var(--danger)' }}>Déconnecté</span></>
                }
              </div>
            )}

            {/* Navigation */}
            {!user ? (
              page === 'landing' ? (
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => setPage('login')} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.875rem' }}>
                    <LogIn size={15} /> Se connecter
                  </button>
                  <button onClick={() => setPage('register')} className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.875rem' }}>
                    S'inscrire
                  </button>
                </div>
              ) : (
                <button onClick={() => setPage('landing')} className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: '0.875rem' }}>
                  <Home size={15} /> Accueil
                </button>
              )
            ) : (
              <>
                {/* Reset button */}
                <button onClick={handleResetData} className="btn btn-secondary" title="Réinitialiser toutes les enchères" style={{ padding: '6px 10px', fontSize: '0.8rem' }}>
                  <RefreshCw size={14} /> Réinitialiser
                </button>

                {/* Notification bell (producers only) */}
                {user.role === 'producer' && (
                  <div ref={notifPanelRef} style={{ position: 'relative' }}>
                    <button
                      id="notif-bell-btn"
                      className="notif-bell-btn"
                      onClick={() => {
                        setNotifOpen(o => !o);
                        if (!notifOpen && unreadCount > 0) handleMarkAllRead();
                      }}
                      title="Notifications"
                      aria-label={`${unreadCount} notifications non lues`}
                    >
                      <Bell size={18} />
                      {unreadCount > 0 && (
                        <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
                      )}
                    </button>

                    {notifOpen && (
                      <div className="notif-panel animate-fade-in">
                        <div className="notif-panel-header">
                          <span>Notifications</span>
                          {notifications.length > 0 && (
                            <button className="notif-clear-btn" onClick={handleMarkAllRead}>Tout marquer lu</button>
                          )}
                        </div>
                        <div className="notif-list">
                          {notifications.length === 0 ? (
                            <div className="notif-empty">Aucune notification</div>
                          ) : (
                            notifications.map(n => (
                              <div key={n.id} className={`notif-item ${n.read ? '' : 'notif-unread'}`}>
                                <div className="notif-dot" />
                                <div className="notif-content">
                                  <div className="notif-title">
                                    Nouveau besoin à <strong>{n.distanceKm} km</strong>
                                  </div>
                                  <div className="notif-body">
                                    {n.product} — {n.quantity} {n.unit}
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
                  onClick={() => setPage('profile')}
                  title="Mon profil"
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
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: connected ? 'var(--primary)' : 'var(--danger)', boxShadow: connected ? '0 0 6px var(--primary)' : 'none' }} />
                </button>

                <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
                  <LogOut size={14} /> Déconnexion
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main */}
      <main style={{ flex: 1, padding: page === 'dashboard' ? '0' : '20px 24px 40px' }}>
        {page === 'landing' && <LandingPage onNavigateToLogin={() => setPage('login')} onNavigateToRegister={() => setPage('register')} />}
        {page === 'login' && <LoginPage onLoginSuccess={handleLoginSuccess} onNavigateToRegister={() => setPage('register')} />}
        {page === 'register' && <RegisterPage onNavigateToLogin={() => setPage('login')} />}
        {page === 'verify-email' && <VerifyEmailPage onNavigateToLogin={() => setPage('login')} />}
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
            />
          ) : (
            <ProducerDashboard
              user={user}
              auctions={auctions}
              onPlaceBid={handlePlaceBid}
              newBidFlashIds={newBidFlashIds}
            />
          )
        )}
      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '20px 24px', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        AgriEnchères &copy; {new Date().getFullYear()} &bull; Plateforme d'Enchères Inversées Agricoles en Algérie
      </footer>
    </div>
  );
}
