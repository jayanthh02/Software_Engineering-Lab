import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

// Not logged in -> go to /login.
// Logged in but the role is not allowed -> friendly message (the server still returns 403).
export default function ProtectedRoute({ roles, children }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (roles && !roles.includes(user.role)) {
    return (
      <div className="card">
        <h2>Access denied</h2>
        <p>Your role does not have access to this page.</p>
      </div>
    );
  }
  return children;
}
