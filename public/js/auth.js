class Auth {
  constructor() {
    this.token = localStorage.getItem('token');
    this.user = null;
    this.onAuthChange = null;
  }

  isLoggedIn() { return !!this.token; }

  async init() {
    if (!this.token) return false;
    try {
      const res = await fetch('/api/me', {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      if (!res.ok) throw new Error('Invalid token');
      this.user = await res.json();
      return true;
    } catch {
      this.token = null;
      localStorage.removeItem('token');
      return false;
    }
  }

  async login(username, password) {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    this.token = data.token;
    this.user = data.user;
    localStorage.setItem('token', this.token);
    if (this.onAuthChange) this.onAuthChange();
    return data;
  }

  async register(username, email, password) {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    this.token = data.token;
    this.user = data.user;
    localStorage.setItem('token', this.token);
    if (this.onAuthChange) this.onAuthChange();
    return data;
  }

  logout() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('token');
    if (this.onAuthChange) this.onAuthChange();
  }

  getAuthHeaders() {
    return { 'Authorization': `Bearer ${this.token}` };
  }
}

const auth = new Auth();
