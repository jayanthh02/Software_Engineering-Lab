
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';

export default function ApprovalHistoryPage() {
  const { id } = useParams();
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    api.get(`/proposals/${id}/history`)
      .then((response) => {
        if (active) setHistory(response.data);
      })
      .catch((err) => {
        if (active) {
          setError(
            err.response?.data?.message || 'Could not load approval history.'
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

  if (loading) return <p>Loading approval history...</p>;
  if (error) return <p role="alert">{error}</p>;

  return (
    <main>
      <h1>Approval History</h1>
      <p>Proposal ID: {id}</p>

      {history.length === 0 ? (
        <p>No approval decisions recorded yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Stage</th>
              <th>Decision</th>
              <th>Approver ID</th>
              <th>Comment</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {history.map((item, index) => (
              <tr key={`${item.stage}-${item.created_at}-${index}`}>
                <td>{item.stage}</td>
                <td>{item.decision}</td>
                <td>{item.approver_id}</td>
                <td>{item.comment || '—'}</td>
                <td>
                  {item.created_at
                    ? new Date(item.created_at).toLocaleString()
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
