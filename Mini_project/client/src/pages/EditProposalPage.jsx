import { useCallback, useEffect, useState } from 'react';
import api from '../api';
import { EMPTY, MAX, Field, todayISO, validate } from './ProposalFormPage';

// SCP-F-004: a Club Lead edits a rejected proposal and resubmits it.
// The proposal goes back to the Faculty Coordinator (status PENDING_FACULTY);
// earlier decisions stay in the approval history. Approved proposals are read-only,
// so only REJECTED ones are listed here.

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

function toForm(p) {
  return {
    eventName: p.eventName,
    eventDate: p.eventDate,
    venue: p.venue,
    expectedAttendance: String(p.expectedAttendance),
    budget: String(p.budget),
    description: p.description,
  };
}

function EditForm({ proposal, onCancel, onDone }) {
  const [values, setValues] = useState(() => ({ ...EMPTY, ...toForm(proposal) }));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  function set(name) {
    return (e) => {
      setValues((v) => ({ ...v, [name]: e.target.value }));
      setErrors((er) => ({ ...er, [name]: undefined }));
    };
  }

  function inputProps(name) {
    return {
      id: `edit-${name}`,
      value: values[name],
      onChange: set(name),
      'aria-invalid': errors[name] ? 'true' : undefined,
      'aria-describedby': errors[name] ? `edit-${name}-error` : undefined,
    };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');

    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    try {
      await api.put(`/proposals/${proposal.id}`, {
        eventName: values.eventName.trim(),
        eventDate: values.eventDate,
        venue: values.venue.trim(),
        expectedAttendance: Number(values.expectedAttendance),
        budget: values.budget.trim(),
        description: values.description.trim(),
      });
      onDone(values.eventName.trim());
    } catch (err) {
      const data = err.response?.data;
      if (data?.fields) setErrors(data.fields);
      setFormError(data?.message || 'Could not resubmit the proposal. Try again.');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Field id="edit-eventName" label="Event name" error={errors.eventName}>
        <input type="text" maxLength={MAX.eventName} {...inputProps('eventName')} />
      </Field>
      <Field id="edit-eventDate" label="Event date" error={errors.eventDate}>
        <input type="date" min={todayISO()} {...inputProps('eventDate')} />
      </Field>
      <Field id="edit-venue" label="Venue" error={errors.venue}>
        <input type="text" maxLength={MAX.venue} {...inputProps('venue')} />
      </Field>
      <Field id="edit-expectedAttendance" label="Expected attendance" error={errors.expectedAttendance}>
        <input type="number" min="1" step="1" inputMode="numeric" {...inputProps('expectedAttendance')} />
      </Field>
      <Field id="edit-budget" label="Budget amount (INR)" error={errors.budget}>
        <input type="number" min="0.01" step="0.01" inputMode="decimal" {...inputProps('budget')} />
      </Field>
      <Field id="edit-description" label="Description" error={errors.description}>
        <textarea
          rows={5}
          maxLength={MAX.description}
          style={{ width: '100%', padding: 10, border: '1px solid #c5ced6', borderRadius: 6, font: 'inherit' }}
          {...inputProps('description')}
        />
      </Field>

      {formError && (
        <p className="error" role="alert">
          {formError}
        </p>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 18 }}>
        <button type="submit" disabled={busy}>
          {busy ? 'Resubmitting...' : 'Resubmit proposal'}
        </button>
        <button type="button" onClick={onCancel} disabled={busy} style={{ background: '#66788a' }}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function EditProposalPage() {
  const [items, setItems] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await api.get('/proposals/mine', { params: { status: 'REJECTED' } });
      setItems(res.data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load your rejected proposals.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function handleDone(id, name) {
    setNotice(`"${name}" was resubmitted and is now waiting for the Faculty Coordinator.`);
    setItems((list) => list.filter((p) => p.id !== id));
    setEditingId(null);
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Edit Rejected Proposals</h2>
      <p className="muted">
        Fix a rejected proposal and resubmit it. It restarts at the Faculty Coordinator. Approved
        proposals cannot be edited.
      </p>

      {notice && <p role="status" style={{ color: '#2f855a', fontWeight: 600 }}>{notice}</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {loading && <p className="muted">Loading...</p>}
      {!loading && !error && items.length === 0 && <p className="muted">You have no rejected proposals.</p>}

      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {items.map((p) => (
          <li key={p.id} style={{ padding: '16px 0', borderTop: '1px solid #e4e7eb' }}>
            <h3 style={{ margin: '0 0 4px' }}>{p.eventName}</h3>
            <p className="muted" style={{ margin: '0 0 8px' }}>
              {p.eventDate} · {p.venue} · {p.expectedAttendance} attendees ·{' '}
              <strong>{money.format(p.budget)}</strong>
            </p>
            <p className="error" style={{ margin: '0 0 10px' }}>
              Rejection reason: {p.rejectionComment || 'No comment given.'}
            </p>

            {editingId === p.id ? (
              <EditForm proposal={p} onCancel={() => setEditingId(null)} onDone={(name) => handleDone(p.id, name)} />
            ) : (
              <button onClick={() => { setNotice(''); setEditingId(p.id); }}>Edit and resubmit</button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
