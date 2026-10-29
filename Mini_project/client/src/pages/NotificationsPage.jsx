import { useCallback, useEffect, useState } from 'react';
import api from '../api';

// SCP-F-009: in-app notifications for every role. Refreshes every 30 seconds,
// so a new notification shows up well within the 1-minute target.
const REFRESH_MS = 30000;

function formatTime(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString();
}

export default function NotificationsPage() {
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/notifications');
      setItems(res.data.items);
      setUnreadCount(res.data.unreadCount);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load notifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  async function markRead(id) {
    try {
      await api.patch(`/notifications/${id}/read`);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update the notification.');
    }
  }

  async function markAllRead() {
    try {
      await api.post('/notifications/read-all');
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update notifications.');
    }
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
        <h2 style={{ margin: 0, flex: 1 }}>
          Notifications {unreadCount > 0 && <span className="muted">({unreadCount} unread)</span>}
        </h2>
        {unreadCount > 0 && <button onClick={markAllRead}>Mark all as read</button>}
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {loading && <p className="muted">Loading...</p>}
      {!loading && items.length === 0 && !error && <p className="muted">No notifications yet.</p>}

      <ul style={{ listStyle: 'none', padding: 0, margin: '16px 0 0' }}>
        {items.map((n) => (
          <li
            key={n.id}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 8,
              padding: '12px 0',
              borderTop: '1px solid #e4e7eb',
            }}
          >
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontWeight: n.read ? 'normal' : 600 }}>{n.message}</div>
              <small className="muted">{formatTime(n.createdAt)}</small>
            </div>
            {!n.read && (
              <button
                onClick={() => markRead(n.id)}
                style={{ padding: '6px 12px', fontSize: '0.85rem' }}
              >
                Mark as read
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
