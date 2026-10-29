import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './auth/ProtectedRoute';
import { ALL_ROLES } from './auth/roles';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import NotificationsPage from './pages/NotificationsPage';

/*
 * THE PAGE LIST. Add ONE object here for each page you build.
 * It creates the route AND the menu link, and the menu only shows
 * the link to users whose role is in `roles`.
 *
 *   { path: '/proposals/new', label: 'New Proposal',
 *     roles: [ROLES.CLUB_LEAD], element: <ProposalForm /> },
 *
 * Hiding a page here is only for usability. The server enforces the real
 * role check (401 / 403), see SCP-SR-002.
 */
const pages = [
  { path: '/home', label: 'Home', roles: ALL_ROLES, element: <HomePage /> },
  { path: '/notifications', label: 'Notifications', roles: ALL_ROLES, element: <NotificationsPage /> },
];

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <ProtectedRoute>
            <Layout pages={pages} />
          </ProtectedRoute>
        }
      >
        {pages.map((p) => (
          <Route
            key={p.path}
            path={p.path}
            element={<ProtectedRoute roles={p.roles}>{p.element}</ProtectedRoute>}
          />
        ))}
      </Route>

      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );
}
