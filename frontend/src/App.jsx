import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { Leaf, LogOut, Tractor, ShoppingBag, RefreshCw, Wifi, WifiOff, LogIn, Home, Sun, Moon, User } from 'lucide-react';
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

  const { locale, setLocale, t, dir } = useTranslation();
  const { theme, toggleTheme } = useTheme();

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

    socket.on('connect', () => { setConnected(true); });
    socket.on('disconnect', () => { setConnected(false); });
    socket.on('connect_error', () => { setConnected(false); });
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
    socket.on('data_reset', () => setAuctions([]));

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

  const handleResetData = async () => {
    if (!window.confirm(t('reset_confirm'))) return;
    try {
      await fetch(`${BACKEND_URL}/api/reset`, { method: 'POST' });
    } catch (err) {
      console.error('Error resetting data:', err);
    }
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
            onClick={(e) => { e.preventDefault(); setPage(user ? 'dashboard' : 'landing'); }}
          >
            <div className="logo-icon">
              <Leaf size={20} strokeWidth={2.5} />
            </div>
            <span className="logo-text">
              <span>{t('appName')}</span>
            </span>
          </a>

          {/* Right side */}
          <div className="header-nav" style={{ flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}>

            {/* Connection status */}
            {user && (
              <div className={`conn-dot ${connected ? 'online' : 'offline'}`}>
                {connected
                  ? <><Wifi size={12} /><span style={{ display: 'none' }}>{t('connected')}</span></>
                  : <><WifiOff size={12} /><span style={{ display: 'none' }}>{t('disconnected')}</span></>
                }
                <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>
                  {connected ? t('connected') : t('disconnected')}
                </span>
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

                {/* User pill */}
                <button
                  id="btn-profile"
                  className={`user-pill ${page === 'profile' ? 'active' : ''}`}
                  onClick={() => setPage('profile')}
                  title={t('profile')}
                >
                  <div
                    className="user-pill-avatar"
                    style={{
                      background: photoUrl ? 'transparent' : `linear-gradient(135deg, ${avatarColors[colorIndex]}, ${avatarColors[(colorIndex + 1) % avatarColors.length]})`
                    }}
                  >
                    {photoUrl
                      ? <img src={photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                      : initials
                    }
                  </div>
                  <span style={{ fontSize: '0.85rem', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user.name}
                  </span>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
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

      {/* ── FOOTER ── */}
      <footer className="app-footer">
        <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{t('appName')}</span>
        {' '}&copy; {new Date().getFullYear()} &bull; {t('appDesc')}
      </footer>
    </div>
  );
}
