import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

// SCP-F-010: students browse approved upcoming events and register (free).
// Registering creates the QR ticket at once (SCP-F-011); it then shows in My Tickets.

function formatDate(value) {
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

const badge = (bg, fg) => ({ background: bg, color: fg, padding: '2px 10px', borderRadius: 10, fontSize: '0.8rem', fontWeight: 600 });

export default function EventsPage() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [booked, setBooked] = useState(null); // event just registered for

  const load = useCallback(async () => {
    try {
      const res = await api.get('/events');
      setItems(res.data.items);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load events.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function register(event) {
    setBusyId(event.id);
    setError('');
    setBooked(null);
    try {
      await api.post(`/registrations/${event.id}`);
      setBooked(event);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not register for this event.');
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Events</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Approved upcoming events. Registration is free and your QR ticket is ready instantly.
      </p>

      {booked && (
        <div role="status" style={{ background: '#d1fae5', color: '#065f46', padding: 12, borderRadius: 6, marginBottom: 12 }}>
          You are registered for <strong>{booked.eventName}</strong>. <Link to="/tickets">View your ticket</Link>
        </div>
      )}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {loading && <p className="muted">Loading...</p>}
      {!loading && items.length === 0 && !error && <p className="muted">No upcoming events right now.</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
        {items.map((e) => {
          const soldOut = e.seatsLeft === 0;
          return (
            <article
              key={e.id}
              style={{ border: '1px solid #e4e7eb', borderRadius: 8, padding: 16, display: 'flex', flexDirection: 'column', gap: 6 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                <small className="muted">{e.clubName}</small>
                {e.registeredByMe ? (
                  <span style={badge('#d1fae5', '#065f46')}>Registered ✓</span>
                ) : soldOut ? (
                  <span style={badge('#fee2e2', '#991b1b')}>Sold out</span>
                ) : (
                  <span style={badge('#e0ecfa', '#1e4e8c')}>Free</span>
                )}
              </div>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{e.eventName}</h3>
              <div>📅 {formatDate(e.eventDate)}</div>
              <div>📍 {e.venue}</div>
              <p className="muted" style={{ margin: '4px 0', fontSize: '0.9rem', flex: 1 }}>{e.description}</p>
              <small className="muted">
                {e.seatsLeft} of {e.capacity} seats left
              </small>
              {e.registeredByMe ? (
                <Link to="/tickets" style={{ textAlign: 'center', padding: 10, fontWeight: 600 }}>
                  View ticket
                </Link>
              ) : (
                <button type="button" onClick={() => register(e)} disabled={soldOut || busyId !== null}>
                  {busyId === e.id ? 'Registering...' : soldOut ? 'Sold out' : 'Register'}
                </button>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
