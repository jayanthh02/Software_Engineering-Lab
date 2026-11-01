import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

// SCP-F-005: a Club Lead sees the current status and stage of each of their club's proposals.
// The server only returns the Club Lead's own club (SCP-F-002), so there is no club filter here.

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

const FILTERS = [
  { value: 'ALL', label: 'All' },
  { value: 'PENDING', label: 'In review' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
];

const BADGE = {
  PENDING_FACULTY: { bg: '#fef3c7', fg: '#92400e' },
  PENDING_FINANCE: { bg: '#fef3c7', fg: '#92400e' },
  PENDING_DEAN: { bg: '#fef3c7', fg: '#92400e' },
  APPROVED: { bg: '#d1fae5', fg: '#065f46' },
  REJECTED: { bg: '#fee2e2', fg: '#991b1b' },
};

// The three approval stages, in the fixed order (SCP-F-006).
const STEPS = [
  { key: 'PENDING_FACULTY', label: 'Faculty' },
  { key: 'PENDING_FINANCE', label: 'Finance' },
  { key: 'PENDING_DEAN', label: 'Dean' },
];

function matches(p, filter) {
  if (filter === 'ALL') return true;
  if (filter === 'PENDING') return p.status.startsWith('PENDING_');
  return p.status === filter;
}

function formatDate(value) {
  if (!value) return '';
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString();
}

function formatDateTime(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString();
}

function Progress({ status }) {
  const current = STEPS.findIndex((s) => s.key === status);
  return (
    <ol
      aria-label="Approval progress"
      style={{ display: 'flex', flexWrap: 'wrap', gap: 6, listStyle: 'none', padding: 0, margin: '10px 0 0' }}
    >
      {STEPS.map((s, i) => {
        const done = status === 'APPROVED' || i < current;
        const active = i === current;
        return (
          <li
            key={s.key}
            style={{
              padding: '4px 10px',
              borderRadius: 999,
              fontSize: '0.85rem',
              border: '1px solid',
              borderColor: done ? '#2f855a' : active ? '#b7791f' : '#c5ced6',
              background: done ? '#d1fae5' : active ? '#fef3c7' : '#fff',
              color: done ? '#065f46' : active ? '#92400e' : '#66788a',
              fontWeight: active ? 700 : 500,
            }}
          >
            {done ? '✓ ' : ''}
            {s.label}
            {active ? ' (waiting)' : ''}
          </li>
        );
      })}
    </ol>
  );
}

function ProposalRow({ p }) {
  const badge = BADGE[p.status] || { bg: '#e4e7eb', fg: '#1f2933' };
  return (
    <li style={{ padding: '16px 0', borderTop: '1px solid #e4e7eb' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 12px' }}>
        <h3 style={{ margin: 0 }}>{p.eventName}</h3>
        <span
          style={{
            background: badge.bg,
            color: badge.fg,
            padding: '2px 10px',
            borderRadius: 999,
            fontSize: '0.85rem',
            fontWeight: 700,
          }}
        >
          {p.statusLabel}
        </span>
      </div>

      <p className="muted" style={{ margin: '6px 0 0' }}>
        {formatDate(p.eventDate)} · {p.venue} · {p.expectedAttendance} attendees ·{' '}
        <strong>{money.format(p.budget)}</strong>
      </p>

      {p.currentStage && (
        <p style={{ margin: '6px 0 0' }}>
          Waiting for the <strong>{p.currentStage}</strong>.
        </p>
      )}
      {p.status === 'APPROVED' && <p style={{ margin: '6px 0 0' }}>Fully approved by all three stages.</p>}

      {p.status.startsWith('PENDING_') || p.status === 'APPROVED' ? <Progress status={p.status} /> : null}

      {p.status === 'REJECTED' && (
        <div style={{ marginTop: 8 }}>
          <p className="error" style={{ margin: 0 }}>
            Rejected{p.rejectedBy ? ` by the ${p.rejectedBy}` : ''}: {p.rejectionComment || 'No comment given.'}
          </p>
          <p style={{ margin: '6px 0 0' }}>
            <Link to="/proposals/edit">Edit and resubmit</Link>
          </p>
        </div>
      )}

      <p className="muted" style={{ margin: '8px 0 0', fontSize: '0.85rem' }}>
        Submitted {formatDateTime(p.submittedAt)} · Last update {formatDateTime(p.updatedAt)}
      </p>
    </li>
  );
}

export default function MyProposalsPage() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api
      .get('/proposals/mine')
      .then((res) => {
        if (!cancelled) setItems(res.data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.message || 'Could not load your proposals.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const shown = items.filter((p) => matches(p, filter));

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>My Proposals</h2>
      <p className="muted">The status and current stage of every proposal from your club.</p>

      <label htmlFor="status-filter">Show</label>
      <select
        id="status-filter"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        style={{ padding: 10, border: '1px solid #c5ced6', borderRadius: 6, font: 'inherit', maxWidth: '100%' }}
      >
        {FILTERS.map((f) => (
          <option key={f.value} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {loading && <p className="muted">Loading...</p>}
      {!loading && !error && items.length === 0 && (
        <p className="muted">
          Your club has no proposals yet. <Link to="/proposals/new">Submit one</Link>.
        </p>
      )}
      {!loading && !error && items.length > 0 && shown.length === 0 && (
        <p className="muted">No proposals match this filter.</p>
      )}

      <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0' }}>
        {shown.map((p) => (
          <ProposalRow key={p.id} p={p} />
        ))}
      </ul>
    </div>
  );
}
