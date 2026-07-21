import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Users, Gavel, Search, ChevronLeft, ChevronRight, CheckCircle2, XCircle, KeyRound, X, Eye, EyeOff } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';
import { BACKEND_URL } from '../utils/config.js';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useFocusTrap } from '../hooks/useFocusTrap';

function StatTile({ label, value }) {
  return (
    <div className="glass-panel" style={{ padding: '16px 20px' }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', marginTop: 4 }}>{value}</div>
    </div>
  );
}

function ChangePasswordModal({ user, onSubmit, onClose }) {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const cardRef = useRef(null);
  useEscapeKey(true, onClose);
  useFocusTrap(cardRef, true);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 8) { setError(t('passwordMinChar')); return; }
    if (password !== confirmPassword) { setError(t('passwordMismatch')); return; }
    setError('');
    setSubmitting(true);
    await onSubmit(password);
    setSubmitting(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div ref={cardRef} className="modal-card animate-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }} role="dialog" aria-modal="true" aria-label={t('adminChangePasswordTitle')}>
        <button className="modal-close-btn" onClick={onClose} aria-label={t('captchaClose')}><X size={18} /></button>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🔑</div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: 6, color: 'var(--text-main)' }}>{t('adminChangePasswordTitle')}</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t('adminChangePasswordDesc', { name: user.name })}</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="admin-new-password">{t('passwordLabel')}</label>
            <div style={{ position: 'relative' }}>
              <input
                id="admin-new-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder={t('passwordHelpPlaceholder')}
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoFocus
              />
              <button type="button" onClick={() => setShowPassword(p => !p)}
                aria-label={showPassword ? t('hidePasswordLabel') : t('showPasswordLabel')}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="admin-confirm-password">{t('confirmPasswordLabel')}</label>
            <input
              id="admin-confirm-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder={t('confirmPasswordPlaceholder')}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
            />
          </div>
          {error && <div className="inline-alert-danger" style={{ marginBottom: 16 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>{t('cancelBtn')}</button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={submitting || !password || !confirmPassword}>
              {t('confirmBtn')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminDashboardPage({ token }) {
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
  const [changingPasswordUser, setChangingPasswordUser] = useState(null);

  const showToast = (message, type = 'success') => { setToast({ message, type }); setTimeout(() => setToast(null), 3000); };

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/stats`, { headers: authHeaders });
      if (res.ok) setStats(await res.json());
    } catch { /* stats are non-critical */ }
  }, [authHeaders]);

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
  }, [authHeaders]);

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
  }, [authHeaders]);

  // Data-fetching-on-dependency-change effects: each callback sets a loading
  // flag / result state after its own fetch, not derived-state-from-props.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchStats(); }, [fetchStats]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
    if (tab === 'users') fetchUsers(1, search);
    else fetchAuctions(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const handleSetPassword = async (password) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/users/${changingPasswordUser.id}/set-password`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(t('adminActionSuccess'));
        setChangingPasswordUser(null);
      } else {
        showToast(data.error || t('adminActionError'), 'error');
      }
    } catch {
      showToast(t('adminActionError'), 'error');
    }
  };

  return (
    <div dir={dir} style={{ minHeight: '100vh', background: 'var(--bg-main)' }}>
      {changingPasswordUser && (
        <ChangePasswordModal
          user={changingPasswordUser}
          onSubmit={handleSetPassword}
          onClose={() => setChangingPasswordUser(null)}
        />
      )}
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
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => setChangingPasswordUser(u)}
                          className="btn btn-secondary"
                          title={t('adminChangePasswordBtn')}
                          aria-label={t('adminChangePasswordBtn')}
                          style={{ padding: '5px 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 5 }}
                        >
                          <KeyRound size={13} /> {t('adminChangePasswordBtn')}
                        </button>
                        {u.role !== 'admin' && (
                          <button
                            onClick={() => toggleUserActive(u)}
                            className="btn btn-secondary"
                            style={{ padding: '5px 12px', fontSize: '0.78rem' }}
                          >
                            {u.isActive ? t('adminDeactivateBtn') : t('adminReactivateBtn')}
                          </button>
                        )}
                      </div>
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
