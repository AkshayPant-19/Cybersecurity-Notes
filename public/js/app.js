let sections = [];
let currentSectionId = null;
let streakData = null;
let quizData = {};
let statsData = null;

function showToast(message, type) {
  const toast = document.createElement('div');
  toast.className = `toast ${type || 'success'}`;
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

function togglePassword(btn) {
  const input = btn.previousElementSibling;
  const isPw = input.type === 'password';
  input.type = isPw ? 'text' : 'password';
  btn.textContent = isPw ? '🙈' : '👁';
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
          <div class="password-wrap">
            <input type="password" id="auth-password" required>
            <button type="button" class="toggle-pw" onclick="togglePassword(this)" tabindex="-1" aria-label="Toggle password visibility">&#x1F441;</button>
          </div>
          <div class="pw-hint" id="pw-hint">Min 4 chars &bull; must differ from username</div>
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
    document.getElementById('pw-hint').style.display = isLogin ? 'none' : 'block';
    document.getElementById('auth-error').style.display = 'none';
  }
  document.getElementById('auth-switch-link').addEventListener('click', toggleMode);
  document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('auth-error');
    errorEl.style.display = 'none';
    const username = document.getElementById('reg-username').value.trim();
    const password = document.getElementById('auth-password').value;
    const email = document.getElementById('reg-email').value.trim();
    if (!isLogin) {
      if (password.length < 4) { errorEl.textContent = 'Password must be at least 4 characters'; errorEl.style.display = 'block'; return; }
      if (password.toLowerCase() === username.toLowerCase()) { errorEl.textContent = 'Password cannot be the same as username'; errorEl.style.display = 'block'; return; }
    }
    try {
      if (isLogin) await auth.login(username, password);
      else await auth.register(username, email, password);
      overlay.remove();
      showToast(isLogin ? 'Signed in!' : 'Account created!');
      initApp();
    } catch (err) { errorEl.textContent = err.message; errorEl.style.display = 'block'; }
  });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}

function renderHeader() {
  const header = document.getElementById('header');
  const initial = auth.user ? auth.user.username.charAt(0).toUpperCase() : '?';
  header.innerHTML = `
    <div class="header-inner">
      <button class="hamburger" onclick="toggleSidebar()" aria-label="Toggle sidebar">&#x2630;</button>
      <div class="search-wrap">
        <input type="text" id="search-input" placeholder="Search topics..." oninput="onSearchInput()">
        <span class="search-icon">&#x1F50D;</span>
      </div>
      <div class="header-right">
        <div class="dashboard-btn" onclick="showDashboard()" title="Dashboard">
          <span>&#x1F4CA;</span>
        </div>
        <div class="streak-badge" id="streak-badge" onclick="showStreakModal()" style="display:none">
          <span class="fire">&#x1F525;</span>
          <span class="count" id="streak-count">0</span>
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

let sidebarOpen = false;
function toggleSidebar() {
  sidebarOpen = !sidebarOpen;
  document.getElementById('sidebar').classList.toggle('open', sidebarOpen);
  document.getElementById('sidebar-overlay').classList.toggle('show', sidebarOpen);
  document.body.classList.toggle('sidebar-open', sidebarOpen);
}

let searchQuery = '';

function renderSidebar() {
  const nav = document.getElementById('sidebar-nav');
  const filtered = searchQuery
    ? sections.filter(s => s.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : sections;
  nav.innerHTML = filtered.length
    ? filtered.map(s => `
      <li><a class="${s.id === currentSectionId ? 'active' : ''}" onclick="renderSection('${s.id}')">
        <span class="icon">${s.icon || '📄'}</span>
        <span class="nav-title">${escapeHtml(s.title)}</span>
        <span class="check" id="check-${s.id}" style="display:none">&#10003;</span>
      </a></li>
    `).join('')
    : '<li class="no-results">No topics found</li>';
}

function onSearchInput() {
  searchQuery = document.getElementById('search-input').value;
  renderSidebar();
}

/* ─── Dashboard ─── */

function showDashboard() {
  currentSectionId = null;
  renderSidebar();
  const container = document.getElementById('content');
  container.innerHTML = `<div class="loading"><div class="spinner"></div><p>Loading dashboard...</p></div>`;
  loadDashboardData().then(() => renderDashboard(container));
}

async function loadDashboardData() {
  try {
    const res = await fetch('/api/dashboard', { headers: auth.getAuthHeaders() });
    const data = await res.json();
    streakData = { visits: data.visits, currentStreak: data.currentStreak, totalVisits: data.totalVisits };
    statsData = { streak: data.currentStreak, totalVisits: data.totalVisits, quizzesTaken: data.quizTaken, avgScore: data.avgScore, completed: data.progress.filter(p => p.completed === 1).length, totalSections: sections.length };

    sections.forEach(s => {
      const p = data.progress.find(pr => pr.section_id === s.id);
      s._completed = p ? p.completed === 1 : false;
      s._bestQuiz = data.bestScores && data.bestScores[s.id] ? data.bestScores[s.id] : null;
    });
    renderSidebar();
    document.getElementById('streak-count').textContent = data.currentStreak;
    document.getElementById('streak-badge').style.display = 'flex';
  } catch {}
}

function renderDashboard(container) {
  const completed = sections.filter(s => s._completed).length;
  const total = sections.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  container.innerHTML = `
    <div class="section-header">
      <h1>&#x1F4CA; Dashboard</h1>
      <div class="breadcrumb">Your learning overview</div>
    </div>

    <div class="stats-grid">
      <div class="stat-card stat-card-accent">
        <div class="stat-card-icon">&#x1F4D6;</div>
        <div class="stat-card-value">${completed}/${total}</div>
        <div class="stat-card-label">Sections Completed</div>
        <div class="stat-card-bar"><div class="stat-card-bar-fill" style="width:${pct}%"></div></div>
      </div>
      <div class="stat-card stat-card-warning">
        <div class="stat-card-icon">&#x1F525;</div>
        <div class="stat-card-value">${statsData.streak}</div>
        <div class="stat-card-label">Day Streak</div>
      </div>
      <div class="stat-card stat-card-info">
        <div class="stat-card-icon">&#x1F9EA;</div>
        <div class="stat-card-value">${statsData.quizzesTaken}</div>
        <div class="stat-card-label">Quizzes Taken</div>
      </div>
      <div class="stat-card stat-card-secondary">
        <div class="stat-card-icon">&#x1F4CA;</div>
        <div class="stat-card-value">${statsData.avgScore}%</div>
        <div class="stat-card-label">Avg Quiz Score</div>
      </div>
    </div>

    <div class="dash-grid">
      <div class="dash-card">
        <h3>&#x1F4CA; Overall Progress</h3>
        <div class="chart-container">
          <canvas id="progressChart" width="200" height="200"></canvas>
          <div class="chart-center-text">${pct}%</div>
        </div>
      </div>
      <div class="dash-card">
        <h3>&#x1F3AF; Quick Actions</h3>
        <div class="quick-actions">
          ${sections.filter(s => !s._completed).slice(0, 4).map(s => `
            <button class="btn btn-outline quick-action-btn" onclick="renderSection('${s.id}')">
              ${s.icon || '📄'} ${escapeHtml(s.title)}
            </button>
          `).join('')}
          ${sections.filter(s => !s._completed).length === 0 ? '<p style="color:var(--accent)">All sections completed! &#x1F389;</p>' : ''}
          <button class="btn btn-secondary quick-action-btn" onclick="showStreakModal()">&#x1F525; View Streak Details</button>
        </div>
      </div>
    </div>

    <div class="dash-card">
      <h3>&#x1F4DD; Section Progress</h3>
      <div class="section-progress-list">
        ${sections.map(s => {
          const q = s._bestQuiz;
          const quizStr = q ? `${q.score}/${q.total}` : '—';
          return `
          <div class="section-progress-item ${s._completed ? 'completed' : ''}" onclick="renderSection('${s.id}')">
            <span class="sp-icon">${s.icon || '📄'}</span>
            <span class="sp-name">${escapeHtml(s.title)}</span>
            <span class="sp-status ${s._completed ? 'sp-done' : 'sp-pending'}">${s._completed ? '&#10003; Done' : '&#9679; Pending'}</span>
            <span class="sp-quiz">Quiz: ${quizStr}</span>
            <span class="sp-arrow">&#8594;</span>
          </div>`;
        }).join('')}
      </div>
    </div>
  `;

  drawPieChart('progressChart', completed, total - completed);
}

function drawPieChart(canvasId, done, remaining) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const cx = 100, cy = 100, r = 80;
  ctx.clearRect(0, 0, 200, 200);

  if (done === 0 && remaining === 0) remaining = 1;

  const total = done + remaining;
  const doneAngle = (done / total) * Math.PI * 2;
  const startAngle = -Math.PI / 2;

  // Background ring
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 16;
  ctx.stroke();

  // Completed arc
  if (done > 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, startAngle + doneAngle);
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 16;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  // Remaining arc
  if (remaining > 0 && done < total) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle + doneAngle, startAngle + Math.PI * 2);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 16;
    ctx.stroke();
  }

  // Inner glow
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r - 8);
  grad.addColorStop(0, 'rgba(0,255,136,0.05)');
  grad.addColorStop(1, 'rgba(0,255,136,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, r - 8, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
}

/* ─── Section View ─── */

function renderSection(sectionId) {
  const section = sections.find(s => s.id === sectionId);
  if (!section) return;
  currentSectionId = sectionId;
  renderSidebar();
  if (window.innerWidth <= 1024 && sidebarOpen) toggleSidebar();

  const container = document.getElementById('content');
  container.innerHTML = `
    <div class="section-header">
      <div class="section-nav-links">
        <a href="#" onclick="event.preventDefault(); showDashboard()" class="back-link">&#x2190; Dashboard</a>
        <span class="breadcrumb-sep">/</span>
        <span>${escapeHtml(section.title)}</span>
      </div>
      <h1><span class="section-icon-large">${section.icon || '📄'}</span> ${escapeHtml(section.title)}</h1>
    </div>

    <div class="section-body">
      ${section.content}
      <div class="section-actions">
        <label class="mark-complete">
          <input type="checkbox" id="check-complete" ${section._completed ? 'checked' : ''} onchange="toggleComplete('${section.id}', this.checked)">
          <span>Mark as completed</span>
        </label>
        <button class="btn btn-secondary quiz-btn" onclick="openQuiz('${section.id}')">
          &#x1F9EA; Take Quiz
        </button>
      </div>
    </div>

    <div class="sources-section">
      <h3>&#x1F517; Additional Resources</h3>
      <div class="sources-list">
        ${section.sources.map(s => `
          <a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer" class="source-item">
            <span class="source-num">&#x1F517;</span>
            <span class="source-name">${escapeHtml(s.name)}</span>
            <span class="arrow">&#x2197;</span>
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

/* ─── Quiz ─── */

async function openQuiz(sectionId) {
  try {
    const res = await fetch(`/api/quiz/${sectionId}`, { headers: auth.getAuthHeaders() });
    const data = await res.json();
    if (!data.questions || data.questions.length === 0) {
      showToast('No quiz available for this section', 'error');
      return;
    }
    renderQuizModal(sectionId, data);
  } catch {
    showToast('Failed to load quiz', 'error');
  }
}

function renderQuizModal(sectionId, data) {
  const overlay = document.createElement('div');
  overlay.className = 'auth-overlay';
  const section = sections.find(s => s.id === sectionId);
  overlay.innerHTML = `
    <div class="quiz-modal">
      <div class="quiz-header">
        <h2>&#x1F9EA; Quiz: ${escapeHtml(section ? section.title : '')}</h2>
        <p class="quiz-info">${data.questions.length} questions ${data.bestScore != null ? `| Best: ${data.bestScore}/${data.questions.length}` : ''}</p>
      </div>
      <div class="quiz-body" id="quiz-body">
        ${data.questions.map((q, i) => `
          <div class="quiz-question" id="q-${i}">
            <p class="q-text"><span class="q-num">${i + 1}.</span> ${escapeHtml(q.q)}</p>
            <div class="q-options">
              ${q.o.map((opt, oi) => `
                <label class="q-option" onclick="document.getElementById('q-${i}-${oi}').click()">
                  <input type="radio" name="q-${i}" id="q-${i}-${oi}" value="${oi}" onchange="clearQuizError()">
                  <span class="q-radio"></span>
                  <span class="q-opt-text">${escapeHtml(opt)}</span>
                </label>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
      <div class="quiz-error" id="quiz-error"></div>
      <div class="quiz-footer">
        <button class="btn btn-outline" onclick="this.closest('.auth-overlay').remove()">Cancel</button>
        <button class="btn btn-primary" id="quiz-submit-btn" onclick="submitQuiz('${sectionId}', ${data.questions.length}, this)">Submit Answers</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}

function clearQuizError() {
  const el = document.getElementById('quiz-error');
  if (el) el.style.display = 'none';
}

async function submitQuiz(sectionId, total, btn) {
  const answers = [];
  let allAnswered = true;
  for (let i = 0; i < total; i++) {
    const selected = document.querySelector(`input[name="q-${i}"]:checked`);
    if (!selected) { allAnswered = false; break; }
    answers.push(parseInt(selected.value));
  }

  if (!allAnswered) {
    const err = document.getElementById('quiz-error');
    err.textContent = 'Please answer all questions before submitting.';
    err.style.display = 'block';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Submitting...';

  try {
    const res = await fetch('/api/quiz/submit', {
      method: 'POST',
      headers: { ...auth.getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ section_id: sectionId, answers })
    });
    const result = await res.json();
    if (!res.ok) { showToast(result.error || 'Failed to submit', 'error'); btn.disabled = false; btn.textContent = 'Submit Answers'; return; }

    const overlay = btn.closest('.auth-overlay');
    const score = result.score;
    const correctAnswers = result.correctAnswers;
    const best = result.best;

    overlay.innerHTML = `
      <div class="quiz-modal quiz-result-modal">
        <div class="quiz-result-icon">${score === total ? '&#x1F389;' : score >= total / 2 ? '&#x1F44D;' : '&#x1F4AA;'}</div>
        <div class="quiz-result-score">${score}/${total}</div>
        <div class="quiz-result-label">${score === total ? 'Perfect Score!' : score >= total / 2 ? 'Good Job!' : 'Keep Practicing!'}</div>
        <div class="quiz-result-best">${best != null && best !== score ? `Best: ${best}/${total}` : ''}</div>
        <div class="quiz-result-details">
          ${answers.map((a, i) => `
            <div class="qr-item ${a === correctAnswers[i] ? 'qr-correct' : 'qr-wrong'}">
              <span>Q${i + 1}: ${a === correctAnswers[i] ? '&#10003; Correct' : '&#10007; Incorrect'}</span>
              ${a !== correctAnswers[i] ? `<span class="qr-answer">Answer: ${String.fromCharCode(65 + correctAnswers[i])}</span>` : ''}
            </div>
          `).join('')}
        </div>
        <button class="btn btn-secondary" style="margin-top:16px;width:100%;justify-content:center" onclick="renderSection('${currentSectionId || sections[0]?.id}'); this.closest('.auth-overlay').remove()">Back to Section</button>
      </div>
    `;
  } catch {
    showToast('Failed to submit quiz', 'error');
    btn.disabled = false;
    btn.textContent = 'Submit Answers';
  }
}



/* ─── Streak ─── */

function showStreakModal() {
  if (!streakData) return;
  const today = new Date();
  const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  let calHtml = '';
  for (let i = 0; i < 7; i++) calHtml += `<div class="cal-day cal-day-header">${dayNames[i]}</div>`;
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
  const completed = sections.filter(s => s._completed).length;
  const overlay = document.createElement('div');
  overlay.className = 'streak-modal-overlay show';
  overlay.innerHTML = `
    <div class="streak-modal">
      <div class="big-fire">&#x1F525;</div>
      <div class="streak-number">${streakData.currentStreak}</div>
      <div class="streak-label">day streak</div>
      <div class="streak-calendar">${calHtml}</div>
      <div class="streak-stats">
        <div class="stat"><div class="stat-value">${streakData.currentStreak}</div><div class="stat-label">Current</div></div>
        <div class="stat"><div class="stat-value">${streakData.totalVisits}</div><div class="stat-label">Total Days</div></div>
        <div class="stat"><div class="stat-value">${completed}/${sections.length}</div><div class="stat-label">Done</div></div>
      </div>
      <button class="btn btn-secondary" style="margin-top:16px;width:100%;justify-content:center" onclick="this.closest('.streak-modal-overlay').remove()">Close</button>
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

async function loadSections() {
  const cached = sessionStorage.getItem('cybersec_sections');
  if (cached) { sections = JSON.parse(cached); return; }
  const res = await fetch('/api/sections');
  sections = await res.json();
  try { sessionStorage.setItem('cybersec_sections', JSON.stringify(sections)); } catch {}
}

async function initApp() {
  if (!auth.isLoggedIn()) { renderAuthModal(); return; }
  const valid = await auth.init();
  if (!valid) { renderAuthModal(); return; }
  try { await loadSections(); } catch { showToast('Failed to load sections', 'error'); return; }
  renderHeader();
  renderSidebar();
  const hash = window.location.hash.slice(1);
  if (hash) { currentSectionId = hash; renderSection(currentSectionId); }
  else { showDashboard(); }
  loadDashboardData();
}

auth.onAuthChange = initApp;
document.addEventListener('DOMContentLoaded', initApp);
