import React, { useEffect, useState, useCallback } from 'react';
import { Shield, Users, Gavel, LogOut, Search, ChevronLeft, ChevronRight, CheckCircle2, XCircle } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';
import { BACKEND_URL } from '../utils/config.js';
import LanguageSwitcher from './LanguageSwitcher';

function StatTile({ label, value }) {
  return (
    <div className="glass-panel" style={{ padding: '16px 20px' }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', marginTop: 4 }}>{value}</div>
    </div>
  );
}

export default function AdminDashboardPage({ token, onLogout }) {
  const { t, dir, locale } = useTranslation();
  const localeTag = locale === 'ar' ? 'ar-DZ' : locale === 'en' ? 'en-US' : 'fr-DZ';

  const [tab, setTab] = useState('users');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [auctions, setAuctions] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => { setToast({ message, type }); setTimeout(() => setToast(null), 3000); };

  const authHeaders = { Authorization: `Bearer ${token}` };

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/stats`, { headers: authHeaders });
      if (res.ok) setStats(await res.json());
    } catch { /* stats are non-critical */ }
  }, [token]);

  const fetchUsers = useCallback(async (targetPage, searchTerm) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: targetPage, limit: 20, search: searchTerm || '' });
      const res = await fetch(`${BACKEND_URL}/api/admin/users?${params}`, { headers: authHeaders });
      const data = await res.json();
      if (res.ok) {
        setUsers(data.users);
        setTotalPages(data.totalPages);
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchAuctions = useCallback(async (targetPage) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: targetPage, limit: 20 });
      const res = await fetch(`${BACKEND_URL}/api/admin/auctions?${params}`, { headers: authHeaders });
      const data = await res.json();
      if (res.ok) {
        setAuctions(data.auctions);
        setTotalPages(data.totalPages);
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  useEffect(() => {
    setPage(1);
    if (tab === 'users') fetchUsers(1, search);
    else fetchAuctions(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    if (tab === 'users') fetchUsers(page, search);
    else fetchAuctions(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchUsers(1, search);
  };

  const toggleUserActive = async (u) => {
    const action = u.isActive ? 'deactivate' : 'reactivate';
    const confirmMsg = u.isActive ? t('adminConfirmDeactivate') : t('adminConfirmReactivate');
    if (!window.confirm(confirmMsg)) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/users/${u.id}/${action}`, { method: 'POST', headers: authHeaders });
      const data = await res.json();
      if (res.ok) {
        showToast(t('adminActionSuccess'));
        setUsers(prev => prev.map(x => x.id === u.id ? { ...x, isActive: !u.isActive } : x));
        fetchStats();
      } else {
        showToast(data.error || t('adminActionError'), 'error');
      }
    } catch {
      showToast(t('adminActionError'), 'error');
    }
  };

  return (
    <div dir={dir} style={{ minHeight: '100vh', background: 'var(--bg-main)' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 32px', borderBottom: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Shield size={22} style={{ color: 'var(--primary)' }} />
          <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-main)' }}>{t('adminTitle')}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <LanguageSwitcher />
          <button onClick={onLogout} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: '0.85rem' }}>
            <LogOut size={14} /> {t('logout')}
          </button>
        </div>
      </header>

      <div style={{ padding: '28px 32px', maxWidth: 1200, margin: '0 auto' }}>
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 28 }}>
            <StatTile label={t('adminStatUsers')} value={stats.totalUsers} />
            <StatTile label={t('adminStatBuyers')} value={stats.buyerCount} />
            <StatTile label={t('adminStatProducers')} value={stats.producerCount} />
            <StatTile label={t('adminStatOpenAuctions')} value={stats.openAuctions} />
            <StatTile label={t('adminStatClosedAuctions')} value={stats.closedAuctions} />
            <StatTile label={t('adminStatDeactivated')} value={stats.deactivatedUsers} />
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <button
            onClick={() => setTab('users')}
            className={tab === 'users' ? 'btn btn-primary' : 'btn btn-secondary'}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: '0.875rem' }}
          >
            <Users size={15} /> {t('adminUsersTab')}
          </button>
          <button
            onClick={() => setTab('auctions')}
            className={tab === 'auctions' ? 'btn btn-primary' : 'btn btn-secondary'}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: '0.875rem' }}
          >
            <Gavel size={15} /> {t('adminAuctionsTab')}
          </button>
        </div>

        {tab === 'users' && (
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: 8, marginBottom: 16, maxWidth: 360 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('searchPlaceholder')}
                style={{ width: '100%', paddingLeft: dir === 'ltr' ? 36 : 14, paddingRight: dir === 'rtl' ? 36 : 14 }}
              />
              <Search size={15} style={{ position: 'absolute', left: dir === 'ltr' ? 12 : 'auto', right: dir === 'rtl' ? 12 : 'auto', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>
          </form>
        )}

        <div style={{ borderRadius: 14, border: '1px solid var(--border)', overflowX: 'auto', background: 'var(--bg-panel)' }}>
          {tab === 'users' ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720, fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)', textAlign: dir === 'rtl' ? 'right' : 'left' }}>
                  <th style={{ padding: '10px 16px' }}>{t('adminColName')}</th>
                  <th style={{ padding: '10px 16px' }}>{t('adminColEmail')}</th>
                  <th style={{ padding: '10px 16px' }}>{t('adminColRole')}</th>
                  <th style={{ padding: '10px 16px' }}>{t('adminColVerified')}</th>
                  <th style={{ padding: '10px 16px' }}>{t('adminColStatus')}</th>
                  <th style={{ padding: '10px 16px' }}>{t('adminColJoined')}</th>
                  <th style={{ padding: '10px 16px' }}>{t('adminColActions')}</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 600 }}>{u.name}</td>
                    <td style={{ padding: '10px 16px', color: 'var(--text-muted)' }}>{u.email}</td>
                    <td style={{ padding: '10px 16px' }}>{u.role === 'buyer' ? t('role_buyer') : u.role === 'producer' ? t('role_producer') : u.role}</td>
                    <td style={{ padding: '10px 16px' }}>{u.isVerified ? <CheckCircle2 size={16} style={{ color: 'var(--primary)' }} /> : <XCircle size={16} style={{ color: 'var(--text-muted)' }} />}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: '0.75rem', fontWeight: 700, background: u.isActive ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', color: u.isActive ? 'var(--primary)' : '#ef4444' }}>
                        {u.isActive ? t('adminStatusActive') : t('adminStatusDeactivated')}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', color: 'var(--text-muted)' }}>{u.createdAt ? new Date(u.createdAt).toLocaleDateString(localeTag) : '-'}</td>
                    <td style={{ padding: '10px 16px' }}>
                      {u.role !== 'admin' && (
                        <button
                          onClick={() => toggleUserActive(u)}
                          className="btn btn-secondary"
                          style={{ padding: '5px 12px', fontSize: '0.78rem' }}
                        >
                          {u.isActive ? t('adminDeactivateBtn') : t('adminReactivateBtn')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {!loading && users.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>{t('adminNoUsers')}</td></tr>
                )}
              </tbody>
            </table>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640, fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)', textAlign: dir === 'rtl' ? 'right' : 'left' }}>
                  <th style={{ padding: '10px 16px' }}>{t('adminColTitle')}</th>
                  <th style={{ padding: '10px 16px' }}>{t('adminColStatus')}</th>
                  <th style={{ padding: '10px 16px' }}>{t('adminColBuyer')}</th>
                  <th style={{ padding: '10px 16px' }}>{t('adminColBids')}</th>
                  <th style={{ padding: '10px 16px' }}>{t('adminColDate')}</th>
                </tr>
              </thead>
              <tbody>
                {auctions.map(a => (
                  <tr key={a.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 600 }}>{a.title}</td>
                    <td style={{ padding: '10px 16px' }}>{a.status}</td>
                    <td style={{ padding: '10px 16px', color: 'var(--text-muted)' }}>{a.buyerName}</td>
                    <td style={{ padding: '10px 16px' }}>{a.bidsCount}</td>
                    <td style={{ padding: '10px 16px', color: 'var(--text-muted)' }}>{a.createdAt ? new Date(a.createdAt).toLocaleDateString(localeTag) : '-'}</td>
                  </tr>
                ))}
                {!loading && auctions.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>{t('adminNoAuctions')}</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 20 }}>
            <button onClick={() => setPage(p => Math.max(p - 1, 1))} disabled={page <= 1} className="btn btn-secondary" style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 4 }}>
              {dir === 'rtl' ? <ChevronRight size={14} /> : <ChevronLeft size={14} />} {t('adminPrevPage')}
            </button>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{t('adminPageOf', { page, totalPages })}</span>
            <button onClick={() => setPage(p => Math.min(p + 1, totalPages))} disabled={page >= totalPages} className="btn btn-secondary" style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 4 }}>
              {t('adminNextPage')} {dir === 'rtl' ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
            </button>
          </div>
        )}
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: dir === 'ltr' ? 24 : 'auto', left: dir === 'rtl' ? 24 : 'auto', zIndex: 1000, background: toast.type === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', border: `1px solid ${toast.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`, color: toast.type === 'success' ? 'var(--primary)' : 'var(--danger)', padding: '12px 20px', borderRadius: 10 }}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
