const KEY = 'scp_auth'; // holds { token, user }

export function getAuth() {
  try {
    return JSON.parse(localStorage.getItem(KEY));
  } catch (e) {
    return null;
  }
}

export function setAuth(auth) {
  try {
    localStorage.setItem(KEY, JSON.stringify(auth));
  } catch (e) {
    /* storage unavailable: user simply stays logged in for this tab only */
  }
}

export function clearAuth() {
  try {
    localStorage.removeItem(KEY);
  } catch (e) {
    /* ignore */
  }
}
