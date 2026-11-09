import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../api';

// SCP-F-008: approval history of one proposal (/proposals/:id/history).
// Opened from the menu (/approvals/history) without an id, it asks for a proposal ID first.

function HistoryLookup() {
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  function open(e) {
    e.preventDefault();
    const id = Number(value.trim());
    if (!Number.isInteger(id) || id <= 0) {
      setError('Enter a proposal ID (a whole number, e.g. 4).');
      return;
    }
    navigate(`/proposals/${id}/history`);
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Approval History</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Every decision on a proposal, with who made it, when, and the comment. Open it from a proposal in the{' '}
        <Link to="/approvals">Approval Inbox</Link>, or enter its ID.
      </p>
      <form onSubmit={open} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'end' }}>
        <div style={{ flex: 1, minWidth: 180, maxWidth: 260 }}>
          <label htmlFor="history-id" style={{ marginTop: 0 }}>Proposal ID</label>
          <input id="history-id" inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
        <button type="submit">Show history</button>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function HistoryTable({ id }) {
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    api.get(`/proposals/${id}/history`)
      .then((response) => {
        if (active) setHistory(response.data);
      })
      .catch((err) => {
        if (active) {
          setError(
            err.response?.data?.message ||
              'Could not load approval history.'
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  const cell = { padding: '8px 10px', borderTop: '1px solid #e4e7eb', textAlign: 'left' };

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Approval History</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Proposal ID: {id} · <Link to="/approvals/history">Look up another</Link>
      </p>

      {loading && <p className="muted">Loading approval history...</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && history.length === 0 && <p>No approval decisions recorded yet.</p>}
      {!loading && !error && history.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
            <thead>
              <tr>
                {['Stage', 'Decision', 'Approver ID', 'Comment', 'Date'].map((h) => (
                  <th key={h} style={{ ...cell, borderTop: 0, color: '#66788a' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map((item, index) => (
                <tr key={`${item.stage}-${item.created_at}-${index}`}>
                  <td style={cell}>{item.stage}</td>
                  <td style={cell}>{item.decision}</td>
                  <td style={cell}>{item.approver_id}</td>
                  <td style={cell}>{item.comment || '-'}</td>
                  <td style={cell}>
                    {item.created_at
                      ? new Date(item.created_at).toLocaleString()
                      : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function ApprovalHistoryPage() {
  const { id } = useParams();
  return id ? <HistoryTable id={id} /> : <HistoryLookup />;
}
