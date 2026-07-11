import React, { useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';
import { getNotificationTitle, getNotificationBody } from '../utils/notificationText.js';

export default function NotificationsPage({ notifications, onMarkAllRead, onMarkOneRead, onNotificationClick }) {
  const { t, dir, locale } = useTranslation();
  const localeTag = locale === 'ar' ? 'ar-DZ' : locale === 'en' ? 'en-US' : 'fr-DZ';
  const [filter, setFilter] = useState('all');

  const unreadCount = notifications.filter(n => !n.read).length;
  const visible = filter === 'unread' ? notifications.filter(n => !n.read) : notifications;

  const handleClick = (n) => {
    if (!n.read) onMarkOneRead(n.id);
    onNotificationClick(n);
  };

  return (
    <div className="dash-page-scroll" style={{ flex: 1, padding: '32px 40px', overflowY: 'auto', textAlign: dir === 'rtl' ? 'right' : 'left' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 8 }}>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)' }}>{t('notificationsPageTitle')}</h2>
        {unreadCount > 0 && (
          <button onClick={onMarkAllRead} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCheck size={16} /> {t('markAllRead')}
          </button>
        )}
      </div>
      <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: '0.95rem' }}>{t('notificationsPageDesc')}</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}>
        {[
          { id: 'all', label: t('notifFilterAll') },
          { id: 'unread', label: t('notifFilterUnread') },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={filter === f.id ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
          >
            {f.label}{f.id === 'unread' && unreadCount > 0 ? ` (${unreadCount})` : ''}
          </button>
        ))}
      </div>

      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        {visible.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Bell size={32} style={{ opacity: 0.4, marginBottom: 12 }} />
            <div>{filter === 'unread' ? t('noUnreadNotifications') : t('noNotifications')}</div>
          </div>
        ) : (
          visible.map((n, i) => (
            <div
              key={n.id}
              role="button"
              tabIndex={0}
              onClick={() => handleClick(n)}
              onKeyDown={e => e.key === 'Enter' && handleClick(n)}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 14,
                padding: '18px 24px',
                borderBottom: i < visible.length - 1 ? '1px solid var(--border)' : 'none',
                background: n.read ? 'transparent' : 'rgba(16,185,129,0.06)',
                cursor: 'pointer',
                flexDirection: dir === 'rtl' ? 'row-reverse' : 'row',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = n.read ? 'var(--bg-section)' : 'rgba(16,185,129,0.1)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = n.read ? 'transparent' : 'rgba(16,185,129,0.06)'; }}
            >
              <div style={{
                width: 8, height: 8, borderRadius: '50%', marginTop: 6, flexShrink: 0,
                background: n.read ? 'transparent' : 'var(--primary)',
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: n.read ? 500 : 700, color: 'var(--text-main)', fontSize: '0.9rem', marginBottom: 4 }}>
                  {getNotificationTitle(n, t)}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 6 }}>
                  {getNotificationBody(n, t, locale)}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                  {new Date(n.createdAt).toLocaleString(localeTag, { dateStyle: 'medium', timeStyle: 'short' })}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
