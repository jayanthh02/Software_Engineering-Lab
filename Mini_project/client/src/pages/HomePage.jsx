import { useAuth } from '../auth/AuthContext';
import { ROLE_LABELS } from '../auth/roles';

// Placeholder home page per role. Later stories add their own pages
// (see the page list in App.jsx) and can link to them from here.
const WHAT_YOU_CAN_DO = {
  CLUB_LEAD: 'Submit event proposals, track their status and check in tickets at your events.',
  FACULTY: 'Review proposals waiting at the Faculty stage.',
  FINANCE: 'Review proposals waiting at the Finance stage.',
  DEAN: 'Review proposals waiting at the Dean stage.',
  ADMIN: 'See the dashboard for all clubs and export reports.',
  STUDENT: 'Browse approved events, register and view your QR tickets.',
};

export default function HomePage() {
  const { user } = useAuth();

  return (
    <div className="card">
      <h2>Welcome, {user.name}</h2>
      <p>
        Signed in as <strong>{ROLE_LABELS[user.role]}</strong>.
      </p>
      <p className="muted">{WHAT_YOU_CAN_DO[user.role]}</p>
    </div>
  );
}
