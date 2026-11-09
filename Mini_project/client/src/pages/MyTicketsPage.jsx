import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

// SCP-F-012: a student's tickets, open at any time (stored on the server, so they
// work after logout and on any device). Tap a ticket to show its QR at the gate.
// The QR image comes from the server's signed ticket (GET /api/tickets/:id/qr).

const STATUS = {
  UPCOMING: { label: 'Upcoming', bg: '#d1fae5', fg: '#065f46' },
  USED: { label: 'Checked in', bg: '#e0ecfa', fg: '#1e4e8c' },
  EXPIRED: { label: 'Expired', bg: '#eef2f6', fg: '#66788a' },
};

function formatDate(value) {
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function Chip({ status }) {
  const s = STATUS[status] || STATUS.UPCOMING;
  return (
    <span style={{ background: s.bg, color: s.fg, padding: '2px 10px', borderRadius: 10, fontSize: '0.8rem', fontWeight: 600 }}>
      {s.label}
    </span>
  );
}

// Full-screen ticket with a large QR, readable from a phone screen at the entrance.
function TicketView({ ticket, onClose }) {
  const [qrUrl, setQrUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let url = '';
    api
      .get(`/tickets/${ticket.id}/qr`, { responseType: 'blob' })
      .then((res) => {
        url = URL.createObjectURL(res.data);
        setQrUrl(url);
      })
      .catch(() => setError('Could not load the QR code. Try again.'));
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [ticket.id]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Ticket for ${ticket.eventName}`}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 10 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 380, overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}
      >
        <div style={{ background: '#16324f', color: '#fff', padding: '16px 20px' }}>
          <small style={{ opacity: 0.8 }}>{ticket.clubName}</small>
          <h3 style={{ margin: '4px 0 0' }}>{ticket.eventName}</h3>
          <div style={{ marginTop: 6, fontSize: '0.9rem' }}>
            📅 {formatDate(ticket.eventDate)} · 📍 {ticket.venue}
          </div>
        </div>

        <div style={{ padding: 20, textAlign: 'center', borderBottom: '2px dashed #c5ced6' }}>
          {qrUrl && <img src={qrUrl} alt="Ticket QR code" style={{ width: '100%', maxWidth: 280, imageRendering: 'pixelated' }} />}
          {!qrUrl && !error && <p className="muted">Loading QR...</p>}
          {error && <p className="error">{error}</p>}
          <div style={{ marginTop: 8 }}>
            <Chip status={ticket.status} />
          </div>
          {ticket.status === 'USED' && (
            <p className="muted" style={{ margin: '8px 0 0', fontSize: '0.85rem' }}>
              Checked in {new Date(ticket.checkedInAt).toLocaleString()}
            </p>
          )}
        </div>

        <div style={{ padding: '14px 20px' }}>
          <small className="muted">Ticket code (for manual entry)</small>
          <div style={{ fontFamily: 'monospace', fontSize: '0.9rem', wordBreak: 'break-all' }}>{ticket.ticketCode}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            {qrUrl && (
              <a
                href={qrUrl}
                download={`ticket-${ticket.id}.png`}
                style={{ flex: 1, textAlign: 'center', padding: 10, borderRadius: 6, background: '#2b6cb0', color: '#fff', textDecoration: 'none' }}
              >
                Download PNG
              </a>
            )}
            <button type="button" onClick={onClose} style={{ flex: 1, background: '#66788a' }}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MyTicketsPage() {
  const [items, setItems] = useState([]);
  const [tab, setTab] = useState('UPCOMING');
  const [open, setOpen] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/tickets');
      setItems(res.data.items);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load your tickets.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const upcoming = items
    .filter((t) => t.status === 'UPCOMING')
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate));
  const past = items.filter((t) => t.status !== 'UPCOMING');
  const shown = tab === 'UPCOMING' ? upcoming : past;

  const tabStyle = (active) => ({
    background: active ? '#16324f' : '#eef2f6',
    color: active ? '#fff' : '#1f2933',
    padding: '8px 14px',
    fontSize: '0.9rem',
  });

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>My Tickets</h2>
      <p className="muted" style={{ marginTop: 0 }}>Tap a ticket to show its QR code at the entrance.</p>

      <div role="tablist" style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button type="button" role="tab" aria-selected={tab === 'UPCOMING'} onClick={() => setTab('UPCOMING')} style={tabStyle(tab === 'UPCOMING')}>
          Upcoming ({upcoming.length})
        </button>
        <button type="button" role="tab" aria-selected={tab === 'PAST'} onClick={() => setTab('PAST')} style={tabStyle(tab === 'PAST')}>
          Past / used ({past.length})
        </button>
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {loading && <p className="muted">Loading...</p>}
      {!loading && !error && shown.length === 0 && (
        <p className="muted">
          {tab === 'UPCOMING' ? (
            <>
              No upcoming tickets. <Link to="/events">Browse events</Link>
            </>
          ) : (
            'No past tickets yet.'
          )}
        </p>
      )}

      <div style={{ display: 'grid', gap: 12 }}>
        {shown.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setOpen(t)}
            style={{
              display: 'flex',
              alignItems: 'stretch',
              padding: 0,
              background: '#fff',
              color: '#1f2933',
              border: '1px solid #e4e7eb',
              borderRadius: 10,
              textAlign: 'left',
              overflow: 'hidden',
              opacity: t.status === 'UPCOMING' ? 1 : 0.75,
            }}
          >
            <div style={{ background: '#16324f', color: '#fff', padding: '12px 14px', minWidth: 74, textAlign: 'center' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{new Date(`${t.eventDate}T00:00:00`).getDate()}</div>
              <div style={{ fontSize: '0.8rem' }}>
                {new Date(`${t.eventDate}T00:00:00`).toLocaleDateString(undefined, { month: 'short' })}
              </div>
            </div>
            <div style={{ flex: 1, padding: '12px 14px', borderLeft: '2px dashed #c5ced6' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <small className="muted">{t.clubName}</small>
                <Chip status={t.status} />
              </div>
              <div style={{ fontWeight: 600, margin: '4px 0' }}>{t.eventName}</div>
              <small className="muted">
                📍 {t.venue} · Ticket #{t.id}
              </small>
            </div>
          </button>
        ))}
      </div>

      {open && <TicketView ticket={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
