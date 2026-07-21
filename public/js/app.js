let sections = [];
let currentSectionId = null;
let streakData = null;

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 2500);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function renderAuthModal() {
  const overlay = document.createElement('div');
  overlay.className = 'auth-overlay';
  overlay.id = 'auth-overlay';
  overlay.innerHTML = `
    <div class="auth-modal">
      <h2 id="auth-title">Welcome</h2>
      <p class="subtitle" id="auth-subtitle">Sign in to track your progress</p>
      <div class="auth-error" id="auth-error"></div>
      <form id="auth-form">
        <div class="form-group" id="name-group">
          <label>Username</label>
          <input type="text" id="reg-username" required>
        </div>
        <div class="form-group" id="email-group" style="display:none">
          <label>Email</label>
          <input type="email" id="reg-email">
        </div>
        <div class="form-group">
          <label>Password</label>
          <input type="password" id="auth-password" required>
        </div>
        <button type="submit" class="btn btn-primary" id="auth-submit-btn">Sign In</button>
      </form>
      <div class="auth-switch">
        <span id="auth-switch-text">Don't have an account?</span>
        <a id="auth-switch-link">Sign Up</a>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  let isLogin = true;

  function toggleMode() {
    isLogin = !isLogin;
    document.getElementById('auth-title').textContent = isLogin ? 'Welcome' : 'Create Account';
    document.getElementById('auth-subtitle').textContent = isLogin ? 'Sign in to track your progress' : 'Start your cybersecurity learning journey';
    document.getElementById('auth-submit-btn').textContent = isLogin ? 'Sign In' : 'Create Account';
    document.getElementById('auth-switch-text').textContent = isLogin ? "Don't have an account?" : 'Already have an account?';
    document.getElementById('auth-switch-link').textContent = isLogin ? 'Sign Up' : 'Sign In';
    document.getElementById('email-group').style.display = isLogin ? 'none' : 'block';
    document.getElementById('name-group').querySelector('label').textContent = isLogin ? 'Username' : 'Choose a Username';
    document.getElementById('auth-error').style.display = 'none';
  }

  document.getElementById('auth-switch-link').addEventListener('click', toggleMode);

  document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('auth-error');
    errorEl.style.display = 'none';
    const username = document.getElementById('reg-username').value;
    const password = document.getElementById('auth-password').value;
    const email = document.getElementById('reg-email').value;

    try {
      if (isLogin) {
        await auth.login(username, password);
      } else {
        await auth.register(username, email, password);
      }
      overlay.remove();
      showToast(isLogin ? 'Signed in successfully!' : 'Account created! Welcome!');
      initApp();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.style.display = 'block';
    }
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

function renderHeader() {
  const header = document.getElementById('header');
  const initial = auth.user ? auth.user.username.charAt(0).toUpperCase() : '?';
  header.innerHTML = `
    <div class="header-inner">
      <a href="#" class="logo" onclick="event.preventDefault(); renderSection(currentSectionId)">
        <span class="shield">&#x1F6E1;</span> CyberSec Notes
      </a>
      <div class="header-right">
        <div class="streak-badge" id="streak-badge" title="View streak details" onclick="showStreakModal()" style="display:none">
          <span class="fire">&#x1F525;</span>
          <span class="count" id="streak-count">0</span>
          <span style="font-size:11px;color:var(--text-secondary)">day streak</span>
        </div>
        <div class="user-menu">
          <div class="user-avatar">${escapeHtml(initial)}</div>
          <span class="user-name">${escapeHtml(auth.user.username)}</span>
          <button class="logout-btn" onclick="handleLogout()">Sign Out</button>
        </div>
      </div>
    </div>
  `;
}

function renderSidebar() {
  const nav = document.getElementById('sidebar-nav');
  const icons = ['🖥️', '🔧', '⚡', '👤', '🛡️', '🦠', '⚠️', '🎭', '🌊', '🤖', '🔗', '🔍', '🔑'];
  nav.innerHTML = sections.map((s, i) => `
    <li><a class="${s.id === currentSectionId ? 'active' : ''}" onclick="renderSection('${s.id}')">
      <span class="icon">${icons[i % icons.length]}</span>
      ${escapeHtml(s.title)}
      <span class="check" id="check-${s.id}" style="display:none">&#10003;</span>
    </a></li>
  `).join('');
}

function renderSection(sectionId) {
  if (!sectionId && sections.length > 0) sectionId = sections[0].id;
  const section = sections.find(s => s.id === sectionId);
  if (!section) return;

  currentSectionId = sectionId;
  renderSidebar();

  const container = document.getElementById('content');
  container.innerHTML = `
    <div class="section-header">
      <h1>${escapeHtml(section.title)}</h1>
      <div class="breadcrumb">Cybersecurity / ${escapeHtml(section.title)}</div>
    </div>
    <div class="section-body">
      ${section.content}
      <div class="mark-complete">
        <input type="checkbox" id="check-complete" ${section._completed ? 'checked' : ''} onchange="toggleComplete('${section.id}', this.checked)">
        <label for="check-complete">Mark this section as completed</label>
      </div>
    </div>
    <div class="sources-section">
      <h3>&#128279; Additional Resources</h3>
      <div class="sources-list">
        ${section.sources.map(s => `
          <a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer" class="source-item">
            <span class="link-icon">&#128279;</span>
            <span class="source-name">${escapeHtml(s.name)}</span>
            <span class="arrow">&#8599;</span>
          </a>
        `).join('')}
      </div>
    </div>
  `;

  history.replaceState(null, '', `#${section.id}`);
}

function toggleComplete(sectionId, completed) {
  fetch('/api/progress', {
    method: 'POST',
    headers: { ...auth.getAuthHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ section_id: sectionId, completed })
  });
  const check = document.getElementById(`check-${sectionId}`);
  if (check) check.style.display = completed ? 'inline' : 'none';
  showToast(completed ? 'Marked as completed' : 'Marked as incomplete');
}

async function loadProgress() {
  try {
    const res = await fetch('/api/progress', { headers: auth.getAuthHeaders() });
    const progress = await res.json();
    sections.forEach(s => {
      const p = progress.find(pr => pr.section_id === s.id);
      s._completed = p ? p.completed === 1 : false;
    });
    renderSidebar();
  } catch {}
}

async function loadStreak() {
  try {
    await fetch('/api/streak/visit', { method: 'POST', headers: auth.getAuthHeaders() });
    const res = await fetch('/api/streak', { headers: auth.getAuthHeaders() });
    streakData = await res.json();
    document.getElementById('streak-count').textContent = streakData.currentStreak;
    document.getElementById('streak-badge').style.display = 'flex';
  } catch {}
}

function showStreakModal() {
  if (!streakData) return;
  const today = new Date();
  const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  let calHtml = '';
  for (let i = 0; i < 7; i++) {
    calHtml += `<div class="cal-day cal-day-header">${dayNames[i]}</div>`;
  }

  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 27);
  startDate.setHours(0, 0, 0, 0);

  for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    const isToday = dateStr === today.toISOString().split('T')[0];
    const isVisited = streakData.visits.includes(dateStr);
    const classes = `cal-day${isVisited ? ' visited' : ''}${isToday ? ' today' : ''}`;
    calHtml += `<div class="${classes}">${d.getDate()}</div>`;
  }

  const overlay = document.createElement('div');
  overlay.className = 'streak-modal-overlay show';
  overlay.innerHTML = `
    <div class="streak-modal">
      <div class="big-fire">&#x1F525;</div>
      <div class="streak-number">${streakData.currentStreak}</div>
      <div class="streak-label">day streak</div>
      <div class="streak-calendar">${calHtml}</div>
      <div class="streak-stats">
        <div class="stat">
          <div class="stat-value">${streakData.currentStreak}</div>
          <div class="stat-label">Current Streak</div>
        </div>
        <div class="stat">
          <div class="stat-value">${streakData.totalVisits}</div>
          <div class="stat-label">Total Days</div>
        </div>
        <div class="stat">
          <div class="stat-value">${sections.filter(s => s._completed).length}/${sections.length}</div>
          <div class="stat-label">Completed</div>
        </div>
      </div>
      <button class="btn btn-secondary" style="margin-top:20px;width:100%;justify-content:center" onclick="this.closest('.streak-modal-overlay').remove()">Close</button>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}

function handleLogout() {
  auth.logout();
  document.getElementById('app').innerHTML = '';
  document.getElementById('header').innerHTML = '';
  showToast('Signed out');
}

async function initApp() {
  if (!auth.isLoggedIn()) {
    renderAuthModal();
    return;
  }

  const valid = await auth.init();
  if (!valid) {
    renderAuthModal();
    return;
  }

  try {
    const res = await fetch('/api/sections');
    sections = await res.json();
  } catch {
    showToast('Failed to load sections', 'error');
    return;
  }

  renderHeader();
  renderSidebar();

  const hash = window.location.hash.slice(1);
  currentSectionId = hash || sections[0]?.id;
  renderSection(currentSectionId);

  await Promise.all([loadProgress(), loadStreak()]);
}

auth.onAuthChange = initApp;

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});
