import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { Sprout, LogOut, Tractor, ShoppingBag, RefreshCw, Wifi, WifiOff, LogIn, Home } from 'lucide-react';
import LandingPage from './components/LandingPage';
import LoginPage from './components/LoginPage';
import BuyerDashboard from './components/BuyerDashboard';
import ProducerDashboard from './components/ProducerDashboard';

const BACKEND_URL = 'http://localhost:3001';

export default function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('agri_user');
    return saved ? JSON.parse(saved) : null;
  });
  
  // Navigation pages: 'landing' | 'login' | 'dashboard'
  const [page, setPage] = useState(() => {
    const saved = localStorage.getItem('agri_user');
    return saved ? 'dashboard' : 'landing';
  });

  const [auctions, setAuctions] = useState([]);
  const [connected, setConnected] = useState(false);
  const [newBidFlashIds, setNewBidFlashIds] = useState([]);
  const socketRef = useRef(null);

  useEffect(() => {
    // Establish Socket.io connection
    const socket = io(BACKEND_URL);
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to WebSocket server');
      setConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from WebSocket server');
      setConnected(false);
    });

    socket.on('auctions_list', (data) => {
      setAuctions(data);
    });

    socket.on('auction_created', (newAuction) => {
      setAuctions((prev) => {
        if (prev.some(a => a.id === newAuction.id)) return prev;
        return [newAuction, ...prev];
      });
    });

    socket.on('auction_updated', (updatedAuction) => {
      setAuctions((prev) => {
        const oldAuction = prev.find(a => a.id === updatedAuction.id);
        if (oldAuction) {
          const oldBidIds = new Set(oldAuction.bids.map(b => b.id));
          const newBids = updatedAuction.bids.filter(b => !oldBidIds.has(b.id));
          
          if (newBids.length > 0) {
            const newIds = newBids.map(b => b.id);
            setNewBidFlashIds(flashIds => [...flashIds, ...newIds]);
            
            setTimeout(() => {
              setNewBidFlashIds(flashIds => flashIds.filter(id => !newIds.includes(id)));
            }, 1500);
          }
        }
        
        return prev.map(a => a.id === updatedAuction.id ? updatedAuction : a);
      });
    });

    socket.on('data_reset', () => {
      setAuctions([]);
    });

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  const handleLoginSuccess = (userInfo) => {
    setUser(userInfo);
    setPage('dashboard');
    localStorage.setItem('agri_user', JSON.stringify(userInfo));
  };

  const handleLogout = () => {
    setUser(null);
    setPage('landing');
    localStorage.removeItem('agri_user');
  };

  const handleCreateAuction = (auctionData) => {
    if (socketRef.current) {
      socketRef.current.emit('create_auction', auctionData);
    }
  };

  const handlePlaceBid = (bidData) => {
    if (socketRef.current) {
      socketRef.current.emit('place_bid', bidData);
    }
  };

  const handleAcceptBid = (auctionId, bidId) => {
    if (socketRef.current) {
      socketRef.current.emit('accept_bid', { auctionId, bidId });
    }
  };

  const handleResetData = async () => {
    if (window.confirm('Voulez-vous vraiment réinitialiser toutes les enchères ?')) {
      try {
        await fetch(`${BACKEND_URL}/api/reset`, { method: 'POST' });
      } catch (err) {
        console.error('Error resetting data:', err);
        alert('Erreur lors du reset.');
      }
    }
  };

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
            {/* Connection Status indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {connected ? (
                <>
                  <Wifi size={16} className="text-success" />
                  <span>En temps réel</span>
                </>
              ) : (
                <>
                  <WifiOff size={16} className="text-danger" />
                  <span>Hors ligne</span>
                </>
              )}
            </div>

            {/* Navigation options based on state */}
            {!user ? (
              page === 'landing' ? (
                <button 
                  onClick={() => setPage('login')} 
                  className="btn btn-primary"
                  style={{ padding: '8px 16px', fontSize: '0.875rem' }}
                >
                  <LogIn size={15} />
                  Se connecter
                </button>
              ) : (
                <button 
                  onClick={() => setPage('landing')} 
                  className="btn btn-secondary"
                  style={{ padding: '8px 16px', fontSize: '0.875rem' }}
                >
                  <Home size={15} />
                  Accueil
                </button>
              )
            ) : (
              <>
                <button 
                  onClick={handleResetData}
                  className="btn btn-secondary" 
                  title="Réinitialiser toutes les données"
                  style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}
                >
                  <RefreshCw size={14} />
                  Reset
                </button>

                <div className="user-badge">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {user.role === 'buyer' ? (
                      <ShoppingBag size={14} className="text-primary" />
                    ) : (
                      <Tractor size={14} className="text-accent" />
                    )}
                    <strong>{user.name}</strong> 
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      ({user.role === 'buyer' ? 'Acheteur' : 'Producteur'})
                    </span>
                  </span>
                  <div className="badge-dot" style={{ backgroundColor: connected ? 'var(--primary)' : 'var(--danger)' }}></div>
                </div>

                <button 
                  onClick={handleLogout} 
                  className="btn btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '0.85rem', display: 'flex', gap: '6px' }}
                >
                  <LogOut size={14} />
                  Quitter
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ flex: 1, padding: page === 'dashboard' ? '0' : '20px 24px 40px 24px' }}>
        {page === 'landing' && <LandingPage onNavigateToLogin={() => setPage('login')} />}
        {page === 'login' && <LoginPage onLoginSuccess={handleLoginSuccess} />}
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

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '20px 24px', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        AgriEnchères &copy; {new Date().getFullYear()} &bull; Plateforme d'Enchères Inversées Agricoles en Algérie
      </footer>
    </div>
  );
}
