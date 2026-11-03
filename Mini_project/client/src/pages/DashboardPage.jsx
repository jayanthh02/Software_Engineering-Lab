import { useCallback, useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../auth/AuthContext';
import { ROLES } from '../auth/roles';

// SCP-F-014: approval pipeline (count per stage), proposal table and filters.
// Campus Admin sees all clubs; a Club Lead sees only their own club (enforced by the server).

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

const STAGES = [
  { key: 'PENDING_FACULTY', label: 'Pending Faculty' },
  { key: 'PENDING_FINANCE', label: 'Pending Finance' },
  { key: 'PENDING_DEAN', label: 'Pending Dean' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'REJECTED', label: 'Rejected' },
];
const LABEL = Object.fromEntries(STAGES.map((s) => [s.key, s.label]));

const BADGE = {
  APPROVED: { bg: '#d1fae5', fg: '#065f46' },
  REJECTED: { bg: '#fee2e2', fg: '#991b1b' },
  PENDING: { bg: '#fef3c7', fg: '#92400e' },
};

const EMPTY_FILTERS = { status: '', clubId: '', from: '', to: '' };

function formatDate(value) {
  if (!value) return '';
  const d = new Date(String(value).length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString();
}

const fieldStyle = { padding: 8, border: '1px solid #c5ced6', borderRadius: 6, font: 'inherit', width: '100%' };
const cell = { padding: '8px 10px', borderTop: '1px solid #e4e7eb', textAlign: 'left', whiteSpace: 'nowrap' };

export default function DashboardPage() {
  const { user } = useAuth();
  const isAdmin = user.role === ROLES.ADMIN;
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [applied, setApplied] = useState(EMPTY_FILTERS);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (f) => {
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== ''));
      const res = await api.get('/dashboard', { params });
      setData(res.data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load the dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(applied);
  }, [applied, load]);

  function update(field, value) {
    setFilters((f) => ({ ...f, [field]: value }));
  }

  function applyFilters(e) {
    e.preventDefault();
    if (filters.from && filters.to && filters.from > filters.to) {
      setError('The From date must be on or before the To date.');
      return;
    }
    setApplied(filters);
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
  }

  // Clicking a pipeline count shows only that stage in the table.
  function drillDown(status) {
    const next = { ...applied, status };
    setFilters(next);
    setApplied(next);
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Dashboard</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        {isAdmin ? 'All clubs' : 'Your club only'}. Click a count to see those proposals.
      </p>

      {/* Pipeline */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
        {STAGES.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => drillDown(s.key)}
            aria-pressed={applied.status === s.key}
            style={{
              background: applied.status === s.key ? '#16324f' : '#eef2f6',
              color: applied.status === s.key ? '#fff' : '#1f2933',
              textAlign: 'left',
            }}
          >
            <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{data ? data.pipeline[s.key] : '-'}</div>
            <div style={{ fontSize: '0.85rem' }}>{s.label}</div>
          </button>
        ))}
      </div>

      {data && (
        <p style={{ margin: '12px 0 0' }}>
          <strong>{data.totals.proposals}</strong> proposals · Approved budget{' '}
          <strong>{money.format(data.totals.approvedBudget)}</strong> · Pending budget{' '}
          <strong>{money.format(data.totals.pendingBudget)}</strong>
        </p>
      )}

      {/* Filters */}
      <form
        onSubmit={applyFilters}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginTop: 16, alignItems: 'end' }}
      >
        <div>
          <label htmlFor="f-status" style={{ marginTop: 0 }}>Status</label>
          <select id="f-status" value={filters.status} onChange={(e) => update('status', e.target.value)} style={fieldStyle}>
            <option value="">All</option>
            {STAGES.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        </div>
        {isAdmin && (
          <div>
            <label htmlFor="f-club" style={{ marginTop: 0 }}>Club</label>
            <select id="f-club" value={filters.clubId} onChange={(e) => update('clubId', e.target.value)} style={fieldStyle}>
              <option value="">All clubs</option>
              {(data?.clubs || []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label htmlFor="f-from" style={{ marginTop: 0 }}>Submitted from</label>
          <input id="f-from" type="date" value={filters.from} onChange={(e) => update('from', e.target.value)} style={fieldStyle} />
        </div>
        <div>
          <label htmlFor="f-to" style={{ marginTop: 0 }}>Submitted to</label>
          <input id="f-to" type="date" value={filters.to} onChange={(e) => update('to', e.target.value)} style={fieldStyle} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit">Apply</button>
          <button type="button" onClick={clearFilters} style={{ background: '#66788a' }}>Clear</button>
        </div>
      </form>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {/* Proposal table */}
      {loading && <p className="muted">Loading...</p>}
      {!loading && data && data.proposals.length === 0 && <p className="muted">No proposals match these filters.</p>}
      {!loading && data && data.proposals.length > 0 && (
        <div style={{ overflowX: 'auto', marginTop: 16 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr>
                {['ID', 'Club', 'Event', 'Date', 'Budget', 'Status', 'Submitted', 'Days pending'].map((h) => (
                  <th key={h} style={{ ...cell, borderTop: 0, color: '#66788a' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.proposals.map((p) => {
                const badge = BADGE[p.status] || BADGE.PENDING;
                return (
                  <tr key={p.id}>
                    <td style={cell}>{p.id}</td>
                    <td style={cell}>{p.clubName}</td>
                    <td style={{ ...cell, whiteSpace: 'normal' }}>{p.eventName}</td>
                    <td style={cell}>{formatDate(p.eventDate)}</td>
                    <td style={cell}>{money.format(p.budget)}</td>
                    <td style={cell}>
                      <span style={{ background: badge.bg, color: badge.fg, padding: '2px 8px', borderRadius: 10 }}>
                        {LABEL[p.status] || p.status}
                      </span>
                    </td>
                    <td style={cell}>{formatDate(p.submittedAt)}</td>
                    <td style={cell}>{p.daysPending === null ? '-' : `${p.daysPending} days`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
