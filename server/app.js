const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { initDatabase, database: db } = require('./database');

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'cybersec_notes_jwt_secret_2026';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'No token provided' });
  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ error: 'All fields required' });
    if (password.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' });
    if (password.toLowerCase() === username.toLowerCase()) return res.status(400).json({ error: 'Password cannot be the same as username' });
    const existing = await db.findUserByUsername.get(username);
    if (existing) return res.status(400).json({ error: 'Username taken' });
    const existingEmail = await db.findUserByEmail.get(email);
    if (existingEmail) return res.status(400).json({ error: 'Email already registered' });
    const hashed = await bcrypt.hash(password, 10);
    const result = await db.insertUser.run(username, email, hashed);
    const token = jwt.sign({ id: result.id, username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: result.id, username, email } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'All fields required' });
    const user = await db.findUserByUsername.get(username);
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/me', authMiddleware, async (req, res) => {
  const user = await db.findUserById.get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

app.post('/api/streak/visit', authMiddleware, async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  await db.addVisit.run(req.user.id, today);
  const rows = await db.getStreaks.all(req.user.id);
  res.json({ visits: rows.map(r => r.visit_date), currentStreak: calculateStreak(rows.map(r => r.visit_date)) });
});

app.get('/api/streak', authMiddleware, async (req, res) => {
  const rows = await db.getStreaks.all(req.user.id);
  const visits = rows.map(r => r.visit_date);
  res.json({ visits, currentStreak: calculateStreak(visits), totalVisits: (await db.getTotalVisits.get(req.user.id)).count });
});

app.post('/api/progress', authMiddleware, async (req, res) => {
  const { section_id, completed } = req.body;
  await db.upsertProgress.run(req.user.id, section_id, completed ? 1 : 0);
  res.json(await db.getProgress.all(req.user.id));
});

app.get('/api/progress', authMiddleware, async (req, res) => {
  res.json(await db.getProgress.all(req.user.id));
});

app.post('/api/quiz/submit', authMiddleware, async (req, res) => {
  const { section_id, answers } = req.body;
  if (!section_id || !answers) return res.status(400).json({ error: 'Invalid data' });
  const section = sections.find(s => s.id === section_id);
  if (!section) return res.status(404).json({ error: 'Section not found' });
  const correctAnswers = section.quiz.map(q => q.a);
  const score = answers.filter((a, i) => a === correctAnswers[i]).length;
  const total = section.quiz.length;
  await db.saveQuizScore.run(req.user.id, section_id, score, total);
  const best = await db.getBestQuizScore.get(req.user.id, section_id);
  res.json({ saved: true, score, total, best: best ? best.score : score, correctAnswers });
});

app.get('/api/quiz/scores', authMiddleware, async (req, res) => {
  const scores = await db.getQuizScores.all(req.user.id);
  const bestMap = {};
  scores.forEach(s => { if (!bestMap[s.section_id] || s.score > bestMap[s.section_id].score) bestMap[s.section_id] = s; });
  res.json({ all: scores, best: bestMap });
});

app.get('/api/stats', authMiddleware, async (req, res) => {
  const [progress, rows, totalVisitsRes, quizScores] = await Promise.all([
    db.getProgress.all(req.user.id),
    db.getStreaks.all(req.user.id),
    db.getTotalVisits.get(req.user.id),
    db.getQuizScores.all(req.user.id)
  ]);
  const completed = progress.filter(p => p.completed === 1).length;
  const visits = rows.map(r => r.visit_date);
  const streak = calculateStreak(visits);
  const avgScore = quizScores.length > 0 ? Math.round(quizScores.reduce((s, q) => s + (q.score / q.total) * 100, 0) / quizScores.length) : 0;
  res.json({ completed, totalSections: sections.length, streak, totalVisits: totalVisitsRes.count, quizzesTaken: quizScores.length, avgScore });
});

app.get('/api/dashboard', authMiddleware, async (req, res) => {
  const [progress, rows, totalVisitsRes, quizScores] = await Promise.all([
    db.getProgress.all(req.user.id),
    db.getStreaks.all(req.user.id),
    db.getTotalVisits.get(req.user.id),
    db.getQuizScores.all(req.user.id)
  ]);
  const visits = rows.map(r => r.visit_date);
  const bestMap = {};
  quizScores.forEach(s => { if (!bestMap[s.section_id] || s.score > bestMap[s.section_id].score) bestMap[s.section_id] = s; });
  const quizTaken = quizScores.length;
  const avgScore = quizTaken > 0 ? Math.round(quizScores.reduce((s, q) => s + (q.score / q.total) * 100, 0) / quizTaken) : 0;
  res.json({ progress, visits, totalVisits: totalVisitsRes.count, currentStreak: calculateStreak(visits), quizTaken, avgScore, bestScores: bestMap });
});

function calculateStreak(visits) {
  if (visits.length === 0) return 0;
  let streak = 0;
  const today = new Date();
  const sorted = [...visits].sort().reverse();
  let checkDate = new Date(today);
  checkDate.setHours(0, 0, 0, 0);
  if (sorted[0] !== checkDate.toISOString().split('T')[0]) checkDate.setDate(checkDate.getDate() - 1);
  for (const dateStr of sorted) {
    const d = new Date(dateStr + 'T00:00:00');
    if (d.getTime() === checkDate.getTime()) { streak++; checkDate.setDate(checkDate.getDate() - 1); }
    else if (d.getTime() < checkDate.getTime()) break;
  }
  return streak;
}

const sections = [
  { id: 'computer-basics', title: 'Computer Basics', icon: '🖥️',
    content: '<h3>Core Components</h3><ul><li><strong>Motherboard</strong> - Holds everything together; the backbone of the system</li><li><strong>GPU</strong> - Visual cortex; handles rendering graphics</li><li><strong>CPU</strong> - The brain of the computer; executes instructions</li><li><strong>PSU</strong> - The heart; supplies power to all components</li></ul>',
    sources: [{name:'Wikipedia - Computer Hardware',url:'https://en.wikipedia.org/wiki/Computer_hardware'},{name:'GCF Global - Computer Basics',url:'https://edu.gcfglobal.org/en/computerbasics/'},{name:'Khan Academy - Computers',url:'https://www.khanacademy.org/computing'}],
    quiz: [{q:'Which component is considered the "brain" of the computer?',o:['GPU','CPU','PSU','RAM'],a:1},{q:'What does PSU stand for?',o:['Power Supply Unit','Primary System Unit','Processor Speed Unit','Peripheral Support Unit'],a:0},{q:'Which component handles rendering graphics?',o:['CPU','Motherboard','GPU','PSU'],a:2}] },
  { id: 'motherboard', title: 'Motherboard Components', icon: '🔧',
    content: '<h3>Key Parts of a Motherboard</h3><ul><li><strong>Rear I/O</strong> - Connects to peripheral devices</li><li><strong>CPU Slot</strong> - Socket where the processor is installed</li><li><strong>PCI Express Slot</strong> - Connects the GPU and expansion cards</li><li><strong>SATA Ports</strong> - Connects storage drives</li></ul>',
    sources: [{name:"Tom's Hardware - Motherboard Anatomy",url:'https://www.tomshardware.com/reviews/motherboard-parts-explained'},{name:'Lifewire - Motherboard Components',url:'https://www.lifewire.com/motherboard-components-5185938'}],
    quiz: [{q:'What connects peripheral devices on a motherboard?',o:['PCI Express Slot','CPU Slot','Rear I/O','SATA Ports'],a:2},{q:'What type of slot connects a GPU?',o:['SATA','PCI Express','CPU Slot','RAM Slot'],a:1},{q:'Which ports connect storage drives?',o:['USB','HDMI','SATA','Ethernet'],a:2}] },
  { id: 'uefi-boot', title: 'UEFI & Boot Process', icon: '⚡',
    content: '<h3>Firmware & Boot</h3><ul><li><strong>UEFI</strong> - Modern replacement for BIOS</li><li><strong>Firmware</strong> - Starts up the OS; stored on ROM chips</li><li><strong>Bootloader</strong> - Transfers the OS into RAM</li><li><strong>POST</strong> - Checks presence/functionality of hardware</li></ul>',
    sources: [{name:'Wikipedia - UEFI',url:'https://en.wikipedia.org/wiki/UEFI'},{name:'How-To Geek - What is UEFI',url:'https://www.howtogeek.com/525184/what-is-uefi-and-how-is-it-different-from-bios/'}],
    quiz: [{q:'What does UEFI stand for?',o:['Unified Extensible Firmware Interface','Universal Electronic File Interface','Unified Entry Firmware Index','Universal Extensible File Interchange'],a:0},{q:'What is the purpose of POST?',o:['Transfer OS to RAM','Check hardware presence','Load drivers','Manage power'],a:1},{q:'What does the bootloader do?',o:['Check for malware','Transfer OS to RAM','Manage user accounts','Configure network'],a:1}] },
  { id: 'hacker-types', title: 'Types of Hackers', icon: '👤',
    content: '<h3>Hacker Categories</h3><ul><li><strong>Amateur</strong> - Uses existing tools</li><li><strong>White Hat</strong> - Ethical hackers with permission</li><li><strong>Gray Hat</strong> - Between white and black</li><li><strong>Black Hat</strong> - Malicious intent</li><li><strong>Organized Hackers</strong> - Groups (APTs, cybercrime)</li></ul>',
    sources: [{name:'Norton - Types of Hackers',url:'https://us.norton.com/internetsecurity-emerging-threats-what-is-a-hacker.html'},{name:'Cisco - Types of Hackers',url:'https://www.cisco.com/c/en/us/products/security/what-is-a-hacker.html'},{name:'Kaspersky - Hacker Types',url:'https://www.kaspersky.com/resource-center/definitions/hacker-types'}],
    quiz: [{q:'Which hacker type works with permission?',o:['Black Hat','Gray Hat','White Hat','Script Kiddie'],a:2},{q:'What characterizes an amateur hacker?',o:['Creates new exploits','Uses existing tools','Works in groups','Reports vulnerabilities'],a:1},{q:'What are organized hacker groups called?',o:['Script Kiddies','Gray Hats','APT Groups','White Hats'],a:2}] },
  { id: 'attack-types', title: 'Types of Attacks', icon: '🛡️',
    content: '<h3>Attack Categories</h3><ul><li><strong>Internal Attacks</strong> - Initiated by someone inside the organization</li><li><strong>External Attacks</strong> - Initiated by an outside party</li></ul>',
    sources: [{name:'Imperva - Types of Cyber Attacks',url:'https://www.imperva.com/learn/application-security/cyber-attack/'},{name:'OWASP - Attack Categories',url:'https://owasp.org/www-community/attacks/'}],
    quiz: [{q:'An attack by an employee is what type?',o:['External','Internal','DDoS','Passive'],a:1},{q:'External attacks are initiated by:',o:['Employees','Third parties','Contractors','Partners'],a:1},{q:'Which is NOT an attack category?',o:['Internal','External','Encrypted','Both A and B'],a:2}] },
  { id: 'malware-types', title: 'Types of Malware', icon: '🦠',
    content: '<h3>Malware Variants</h3><ul><li><strong>Spyware</strong> - Captures device actions</li><li><strong>Adware</strong> - Unwanted ads</li><li><strong>Backdoor</strong> - Unauthorized access</li><li><strong>Ransomware</strong> - Holds data hostage</li><li><strong>Scareware</strong> - Scare tactics</li><li><strong>Rootkit</strong> - OS modification for hidden access</li><li><strong>Virus</strong> - Multiplies by attaching to files</li><li><strong>Trojan Horse</strong> - Disguises as legitimate software</li></ul>',
    sources: [{name:'Malwarebytes - Malware Types',url:'https://www.malwarebytes.com/malware'},{name:'CISA - Malware',url:'https://www.cisa.gov/stopransomware'},{name:'Kaspersky - Malware Descriptions',url:'https://www.kaspersky.com/resource-center/threats/types-of-malware'}],
    quiz: [{q:'Which malware captures user actions?',o:['Ransomware','Spyware','Adware','Rootkit'],a:1},{q:'What type of malware holds data for ransom?',o:['Trojan','Virus','Ransomware','Spyware'],a:2},{q:'A Trojan Horse is characterized by:',o:['Self-replication','Disguising as legitimate software','Encrypting files','Showing ads'],a:1}] },
  { id: 'symptoms-malware', title: 'Symptoms of Malware', icon: '⚠️',
    content: '<h3>Common Indicators</h3><ul><li><strong>High CPU usage</strong></li><li>Unexpected pop-ups</li><li>Browser redirects</li><li>Files opening automatically</li><li>Unexplained data loss</li><li>Antivirus disabled</li></ul>',
    sources: [{name:'Microsoft - Malware Signs',url:'https://support.microsoft.com/en-us/topic/how-to-tell-if-your-computer-is-infected-with-malware'},{name:'CISA - Indicators of Compromise',url:'https://www.cisa.gov/indicators-compromise'}],
    quiz: [{q:'Common symptom of malware?',o:['Faster boot','High CPU usage','Better performance','More storage'],a:1},{q:'What might indicate infection?',o:['Disabled antivirus','Regular updates','Clean browser','Fast internet'],a:0},{q:'Unexpected redirects suggest:',o:['Normal behavior','Possible malware','Network upgrade','Browser update'],a:1}] },
  { id: 'social-engineering', title: 'Social Engineering', icon: '🎭',
    content: '<h3>Manipulation Techniques</h3><ul><li><strong>Social Engineering</strong> - Psychological manipulation</li><li><strong>Pretexting</strong> - Fabricated scenario to get data</li><li><strong>Tailgating</strong> - Following into secured location</li><li><strong>Quid Pro Quo</strong> - Service in exchange for info</li></ul>',
    sources: [{name:'Social Engineer Wiki',url:'https://www.social-engineer.org/'},{name:'NIST - Social Engineering',url:'https://www.nist.gov/cyberframework'},{name:'OWASP - Social Engineering',url:'https://owasp.org/www-community/attacks/Social_Engineering'}],
    quiz: [{q:'What is social engineering?',o:['Network hacking','Psychological manipulation','Password cracking','Code injection'],a:1},{q:'Following someone into a secure area is:',o:['Pretexting','Tailgating','Quid Pro Quo','Phishing'],a:1},{q:'"Something for data" describes:',o:['Pretexting','Tailgating','Quid Pro Quo','Shoulder Surfing'],a:2}] },
  { id: 'dos-attacks', title: 'DoS & DDoS Attacks', icon: '🌊',
    content: '<h3>Denial of Service</h3><ul><li><strong>DoS Attack</strong> - Makes system unavailable</li><li>Methods: Overwhelming traffic, Malicious packets</li><li><strong>DDoS</strong> - Multiple bots launch coordinated attack</li></ul>',
    sources: [{name:'Cloudflare - DDoS Guide',url:'https://www.cloudflare.com/learning/ddos/what-is-a-ddos-attack/'},{name:'CERT - DoS Attacks',url:'https://www.cisa.gov/news-events/news/understanding-denial-service-attacks'},{name:'OWASP - DoS',url:'https://owasp.org/www-community/attacks/Denial_of_Service'}],
    quiz: [{q:'What does DoS stand for?',o:['Data Overload System','Denial of Service','Digital Offense Suite','Domain of Security'],a:1},{q:'Compromised systems in DDoS are called?',o:['Servers','Bots/Zombies','Clients','Routers'],a:1},{q:'DDoS uses ___ systems vs DoS:',o:['Fewer','Multiple','Same','None'],a:1}] },
  { id: 'botnet', title: 'Botnets', icon: '🤖',
    content: '<h3>Networks of Bots</h3><ul><li><strong>Botnet</strong> - Network of compromised computers controlled by bot herder</li><li>Used for DDoS, spam, credential stuffing, crypto mining</li></ul>',
    sources: [{name:'Cloudflare - Botnets',url:'https://www.cloudflare.com/learning/bots/what-is-a-botnet/'},{name:'FBI - Botnets',url:'https://www.fbi.gov/investigate/cyber'},{name:'Kaspersky - Botnets',url:'https://www.kaspersky.com/resource-center/threats/botnet-attacks'}],
    quiz: [{q:'What controls a botnet?',o:['Bot herder','ISP','Antivirus','Firewall'],a:0},{q:'Compromised computers are called:',o:['Servers','Bots/Zombies','Clients','Nodes'],a:1},{q:'Common botnet use?',o:['File backup','DDoS attacks','Web hosting','Email filtering'],a:1}] },
  { id: 'on-path-attacks', title: 'On-Path Attacks', icon: '🔗',
    content: '<h3>Intercepting Communications</h3><ul><li>Intercept or modify communications between two devices</li><li>Formerly <strong>Man-in-the-Middle (MitM)</strong></li><li>Methods: ARP spoofing, DNS spoofing, rogue access points</li></ul>',
    sources: [{name:'Cloudflare - MitM',url:'https://www.cloudflare.com/learning/security/threats/man-in-the-middle-attack/'},{name:'OWASP - On-Path Attack',url:'https://owasp.org/www-community/attacks/Man-in-the-middle_attack'},{name:'Wikipedia - MitM',url:'https://en.wikipedia.org/wiki/Man-in-the-middle_attack'}],
    quiz: [{q:'What is an on-path attack?',o:['Intercepting communications','Deleting files','Installing software','Changing passwords'],a:0},{q:'On-path attacks were formerly called:',o:['DoS','Man-in-the-Middle','Phishing','Spoofing'],a:1},{q:'Which is a method used in on-path attacks?',o:['ARP spoofing','SQL injection','XSS','Buffer overflow'],a:0}] },
  { id: 'seo-poisoning', title: 'SEO Poisoning', icon: '🔍',
    content: '<h3>Search Engine Manipulation</h3><ul><li>Increases traffic to malicious sites by abusing SEO keywords</li><li>Also known as <strong>SEO Spam</strong> or <strong>Black Hat SEO</strong></li></ul>',
    sources: [{name:'CrowdStrike - SEO Poisoning',url:'https://www.crowdstrike.com/cybersecurity-101/seo-poisoning/'},{name:'Malwarebytes - SEO Poisoning',url:'https://www.malwarebytes.com/blog/news/2023/03/seo-poisoning'}],
    quiz: [{q:'SEO poisoning abuses what to drive traffic?',o:['SEO keywords','Email lists','Social media','Direct links'],a:0},{q:'SEO poisoning is also called:',o:['White Hat SEO','Black Hat SEO','Gray Hat SEO','Blue Hat SEO'],a:1},{q:'What do malicious SEO pages often distribute?',o:['Updates','Malware','Ad blockers','Browser extensions'],a:1}] },
  { id: 'password-attacks', title: 'Password Attacks', icon: '🔑',
    content: '<h3>Cracking Techniques</h3><ul><li><strong>Spraying</strong> - Few passwords across many accounts</li><li><strong>Dictionary Attack</strong> - Trying dictionary words</li><li><strong>Brute Force</strong> - All combinations</li><li><strong>Rainbow Table</strong> - Precomputed hash comparison</li><li><strong>Traffic Interception</strong> - Cleartext passwords</li></ul>',
    sources: [{name:'OWASP - Password Attacks',url:'https://owasp.org/www-community/attacks/Password_Attacks'},{name:'NIST - Password Guidelines',url:'https://www.nist.gov/itl/tig/projects/special-publication-800-63'},{name:'Have I Been Pwned',url:'https://haveibeenpwned.com/'}],
    quiz: [{q:'Which attack tries all combinations?',o:['Dictionary','Brute Force','Spraying','Rainbow Table'],a:1},{q:'Spraying uses ___ passwords across many accounts.',o:['Many complex','A few common','Random','Stolen'],a:1},{q:'Rainbow tables compare against:',o:['Plain text','Precomputed hashes','Encrypted data','Source code'],a:1}] },
  { id: 'apt', title: 'Advanced Persistent Threats', icon: '🎯',
    content: '<h3>Advanced Persistent Threats (APT)</h3><ul><li><strong>Multi-phase</strong> - Attack unfolds across multiple stages over time</li><li><strong>Long-term</strong> - Can persist for months or years undetected</li><li><strong>Stealthy</strong> - Uses advanced evasion techniques to avoid detection</li><li><strong>Targeted</strong> - Aimed at specific high-value targets (govt, military, enterprises)</li><li>Often state-sponsored or organized cybercrime groups</li><li>Common phases: Reconnaissance → Weaponization → Delivery → Exploitation → C2 → Exfiltration</li></ul>',
    sources: [{name:'CISA - APTs',url:'https://www.cisa.gov/topics/cyber-threats-advisories/advanced-persistent-threats'},{name:'CrowdStrike - APT Definition',url:'https://www.crowdstrike.com/cybersecurity-101/advanced-persistent-threat-apt/'},{name:'MITRE ATT&CK Framework',url:'https://attack.mitre.org/'}],
    quiz: [{q:'What does APT stand for?',o:['Automated Protocol Test','Advanced Persistent Threat','Application Processing Tool','Attack Penetration Test'],a:1},{q:'How long can APT attacks last?',o:['Hours','Days','Months or years','Minutes'],a:2},{q:'Who often sponsors APT attacks?',o:['Script kiddies','State actors','Individual hackers','Hacktivists'],a:1}] }
];

app.get('/api/sections', (req, res) => {
  res.json(sections.map(({ quiz, ...rest }) => rest));
});

app.get('/api/quiz/:sectionId', authMiddleware, async (req, res) => {
  const section = sections.find(s => s.id === req.params.sectionId);
  if (!section) return res.status(404).json({ error: 'Section not found' });
  const best = await db.getBestQuizScore.get(req.user.id, req.params.sectionId);
  res.json({ questions: section.quiz.map(({ q, o }) => ({ q, o })), length: section.quiz.length, bestScore: best ? best.score : null });
});

app.get('/api/quiz/answers/:sectionId', authMiddleware, (req, res) => {
  const section = sections.find(s => s.id === req.params.sectionId);
  if (!section) return res.status(404).json({ error: 'Section not found' });
  res.json({ answers: section.quiz.map(q => q.a) });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

let dbReady = false;
const readyListeners = [];

async function ensureDb() {
  if (dbReady) return;
  await initDatabase();
  dbReady = true;
  readyListeners.forEach(fn => fn());
  readyListeners.length = 0;
}

// Auto-init in dev, lazy-init in production
if (!process.env.VERCEL) ensureDb();

module.exports = { app, ensureDb };
