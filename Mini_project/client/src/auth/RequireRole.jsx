import { useAuth } from './AuthContext';

// Hides a button, link or section from roles that may not use it (SCP-F-002).
//
//   <RequireRole roles={[ROLES.CLUB_LEAD]}>
//     <button>Edit and resubmit</button>
//   </RequireRole>
//
// This is only for usability. The server still returns 403 if someone calls the API anyway.
export default function RequireRole({ roles, children, fallback = null }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) return fallback;
  return children;
}

// Same check for code:  const canApprove = useHasRole([ROLES.FACULTY, ROLES.FINANCE, ROLES.DEAN]);
export function useHasRole(roles) {
  const { user } = useAuth();
  return Boolean(user && roles.includes(user.role));
}
