import { useCallback, useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../auth/AuthContext';
import { ROLE_LABELS } from '../auth/roles';

// SCP-F-007: proposals waiting at my stage; approve, or reject with a comment.

function formatDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString();
}

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

function ProposalCard({ proposal, onDone }) {
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function decide(decision) {
    setError('');
    if (decision === 'REJECT' && !comment.trim()) {
      setError('Enter a comment to reject this proposal.');
      return;
    }
    setBusy(true);
    try {
      const res = await api.post(`/proposals/${proposal.id}/decision`, { decision, comment });
      onDone(proposal, res.data.newStatus);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save the decision. Try again.');
      setBusy(false);
    }
  }

  return (
    <li style={{ padding: '16px 0', borderTop: '1px solid #e4e7eb' }}>
      <h3 style={{ margin: '0 0 4px' }}>{proposal.eventName}</h3>
      <p className="muted" style={{ margin: '0 0 8px' }}>
        {proposal.clubName} · {formatDate(proposal.eventDate)} · {proposal.venue} ·{' '}
        {proposal.expectedAttendance} attendees · <strong>{money.format(proposal.budget)}</strong>
      </p>
      <p style={{ margin: '0 0 8px', whiteSpace: 'pre-wrap' }}>{proposal.description}</p>

      <label htmlFor={`comment-${proposal.id}`}>Comment (required to reject)</label>
      <textarea
        id={`comment-${proposal.id}`}
        rows={2}
        maxLength={500}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        style={{ width: '100%', padding: 10, border: '1px solid #c5ced6', borderRadius: 6, font: 'inherit' }}
      />

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
        <button onClick={() => decide('APPROVE')} disabled={busy} style={{ background: '#2f855a' }}>
          Approve
        </button>
        <button onClick={() => decide('REJECT')} disabled={busy} style={{ background: '#b42318' }}>
          Reject
        </button>
      </div>
    </li>
  );
}

const RESULT_TEXT = {
  PENDING_FINANCE: 'approved and sent to the Finance Officer',
  PENDING_DEAN: 'approved and sent to the Dean',
  APPROVED: 'fully approved',
  REJECTED: 'rejected',
};

export default function ApprovalInboxPage() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/approvals/inbox');
      setItems(res.data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load the inbox.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function handleDone(proposal, newStatus) {
    setNotice(`"${proposal.eventName}" was ${RESULT_TEXT[newStatus] || 'updated'}.`);
    setItems((list) => list.filter((p) => p.id !== proposal.id));
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Approval Inbox</h2>
      <p className="muted">Proposals waiting for the {ROLE_LABELS[user.role]}.</p>

      {notice && <p role="status">{notice}</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {loading && <p className="muted">Loading...</p>}
      {!loading && !error && items.length === 0 && <p className="muted">Nothing waiting for you.</p>}

      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {items.map((p) => (
          <ProposalCard key={p.id} proposal={p} onDone={handleDone} />
        ))}
      </ul>
    </div>
  );
}
