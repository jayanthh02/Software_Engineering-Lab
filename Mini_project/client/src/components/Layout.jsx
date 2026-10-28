import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ROLE_LABELS } from '../auth/roles';

// Top bar + role-based menu. The menu is built from the `pages` list in App.jsx,
// showing only the pages the logged-in role may open.
export default function Layout({ pages }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const menu = pages.filter((p) => p.roles.includes(user.role));

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="app">
      <header className="topbar">
        <strong className="brand">Student Club Portal</strong>
        <nav className="menu">
          {menu.map((p) => (
            <NavLink key={p.path} to={p.path}>
              {p.label}
            </NavLink>
          ))}
        </nav>
        <div className="userbox">
          <span>
            {user.name} ({ROLE_LABELS[user.role]})
          </span>
          <button onClick={handleLogout}>Log out</button>
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
