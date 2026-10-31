import { useState } from 'react';
import api from '../api';

// SCP-F-003: a Club Lead submits an event proposal with a budget.
// The server does the real validation; this form only gives quick feedback
// and shows the server's field errors next to each field.

const EMPTY = {
  eventName: '',
  eventDate: '',
  venue: '',
  expectedAttendance: '',
  budget: '',
  description: '',
};

const MAX = { eventName: 150, venue: 150, description: 5000 };

function todayISO() {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

function validate(v) {
  const e = {};
  if (!v.eventName.trim()) e.eventName = 'Event name is required';
  if (!v.eventDate) e.eventDate = 'Event date is required';
  else if (v.eventDate < todayISO()) e.eventDate = 'Event date cannot be in the past';
  if (!v.venue.trim()) e.venue = 'Venue is required';
  if (v.expectedAttendance === '') e.expectedAttendance = 'Expected attendance is required';
  else if (!/^\d+$/.test(v.expectedAttendance) || Number(v.expectedAttendance) < 1) {
    e.expectedAttendance = 'Expected attendance must be a whole number of 1 or more';
  }
  if (v.budget === '') e.budget = 'Budget is required';
  else if (!/^\d+(\.\d{1,2})?$/.test(v.budget.trim()) || !(Number(v.budget) > 0)) {
    e.budget = 'Budget must be a positive amount (up to 2 decimal places)';
  }
  if (!v.description.trim()) e.description = 'Description is required';
  return e;
}

function Field({ id, label, error, children }) {
  return (
    <div>
      <label htmlFor={id}>{label}</label>
      {children}
      {error && (
        <p className="error" id={`${id}-error`} role="alert" style={{ margin: '4px 0 0' }}>
          {error}
        </p>
      )}
    </div>
  );
}

export default function ProposalFormPage() {
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState(null);
  const [busy, setBusy] = useState(false);

  function set(name) {
    return (e) => {
      setValues((v) => ({ ...v, [name]: e.target.value }));
      setErrors((er) => ({ ...er, [name]: undefined }));
    };
  }

  function inputProps(name) {
    return {
      id: name,
      value: values[name],
      onChange: set(name),
      'aria-invalid': errors[name] ? 'true' : undefined,
      'aria-describedby': errors[name] ? `${name}-error` : undefined,
    };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    setSuccess(null);

    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    try {
      const res = await api.post('/proposals', {
        eventName: values.eventName.trim(),
        eventDate: values.eventDate,
        venue: values.venue.trim(),
        expectedAttendance: Number(values.expectedAttendance),
        budget: values.budget.trim(),
        description: values.description.trim(),
      });
      setSuccess({ id: res.data.proposalId, name: values.eventName.trim() });
      setValues(EMPTY);
    } catch (err) {
      const data = err.response?.data;
      if (data?.fields) setErrors(data.fields);
      setFormError(data?.message || 'Could not submit the proposal. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>New Event Proposal</h2>
      <p className="muted">
        Your proposal goes to the Faculty Coordinator first, then the Finance Officer and the Dean.
      </p>

      {success && (
        <p role="status" style={{ color: '#2f855a', fontWeight: 600 }}>
          &quot;{success.name}&quot; was submitted (proposal #{success.id}) and is now waiting for the Faculty
          Coordinator.
        </p>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <Field id="eventName" label="Event name" error={errors.eventName}>
          <input type="text" maxLength={MAX.eventName} {...inputProps('eventName')} />
        </Field>

        <Field id="eventDate" label="Event date" error={errors.eventDate}>
          <input type="date" min={todayISO()} {...inputProps('eventDate')} />
        </Field>

        <Field id="venue" label="Venue" error={errors.venue}>
          <input type="text" maxLength={MAX.venue} {...inputProps('venue')} />
        </Field>

        <Field id="expectedAttendance" label="Expected attendance" error={errors.expectedAttendance}>
          <input type="number" min="1" step="1" inputMode="numeric" {...inputProps('expectedAttendance')} />
        </Field>

        <Field id="budget" label="Budget amount (INR)" error={errors.budget}>
          <input type="number" min="0.01" step="0.01" inputMode="decimal" {...inputProps('budget')} />
        </Field>

        <Field id="description" label="Description" error={errors.description}>
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

        <div style={{ marginTop: 18 }}>
          <button type="submit" disabled={busy}>
            {busy ? 'Submitting...' : 'Submit proposal'}
          </button>
        </div>
      </form>
    </div>
  );
}
