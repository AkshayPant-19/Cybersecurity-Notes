const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { initDatabase, database: db, saveDb } = require('./database');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'cybersec_notes_jwt_secret_2026';

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
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields required' });
    }
    const existing = db.findUserByUsername.get(username);
    if (existing) return res.status(400).json({ error: 'Username taken' });
    const existingEmail = db.findUserByEmail.get(email);
    if (existingEmail) return res.status(400).json({ error: 'Email already registered' });
    const hashed = await bcrypt.hash(password, 10);
    db.insertUser.run(username, email, hashed);
    const created = db.findUserByUsername.get(username);
    const token = jwt.sign({ id: created.id, username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: created.id, username, email } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'All fields required' });
    const user = db.findUserByUsername.get(username);
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/me', authMiddleware, (req, res) => {
  const user = db.findUserById.get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

app.post('/api/streak/visit', authMiddleware, (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  db.addVisit.run(req.user.id, today);
  const visits = db.getStreaks.all(req.user.id).map(r => r.visit_date);
  res.json({ visits, currentStreak: calculateStreak(visits) });
});

app.get('/api/streak', authMiddleware, (req, res) => {
  const visits = db.getStreaks.all(req.user.id).map(r => r.visit_date);
  const totalVisits = db.getTotalVisits.get(req.user.id).count;
  res.json({ visits, currentStreak: calculateStreak(visits), totalVisits });
});

app.post('/api/progress', authMiddleware, (req, res) => {
  const { section_id, completed } = req.body;
  db.upsertProgress.run(req.user.id, section_id, completed ? 1 : 0);
  const progress = db.getProgress.all(req.user.id);
  res.json(progress);
});

app.get('/api/progress', authMiddleware, (req, res) => {
  const progress = db.getProgress.all(req.user.id);
  res.json(progress);
});

function calculateStreak(visits) {
  if (visits.length === 0) return 0;
  let streak = 0;
  const today = new Date();
  const sorted = [...visits].sort().reverse();
  let checkDate = new Date(today);
  checkDate.setHours(0, 0, 0, 0);
  if (sorted[0] !== checkDate.toISOString().split('T')[0]) {
    checkDate.setDate(checkDate.getDate() - 1);
  }
  for (const dateStr of sorted) {
    const d = new Date(dateStr + 'T00:00:00');
    if (d.getTime() === checkDate.getTime()) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else if (d.getTime() < checkDate.getTime()) {
      break;
    }
  }
  return streak;
}

const sections = [
  {
    id: 'computer-basics',
    title: 'Computer Basics',
    content: `
      <h3>Core Components</h3>
      <ul>
        <li><strong>Motherboard</strong> - Holds everything together; the backbone of the system</li>
        <li><strong>GPU (Graphics Processing Unit)</strong> - Visual cortex; handles rendering graphics</li>
        <li><strong>CPU (Central Processing Unit)</strong> - The brain of the computer; executes instructions</li>
        <li><strong>PSU (Power Supply Unit)</strong> - The heart; supplies power to all components</li>
      </ul>
    `,
    sources: [
      { name: 'Wikipedia - Computer Hardware', url: 'https://en.wikipedia.org/wiki/Computer_hardware' },
      { name: 'GCF Global - Computer Basics', url: 'https://edu.gcfglobal.org/en/computerbasics/' },
      { name: 'Khan Academy - Computers', url: 'https://www.khanacademy.org/computing' }
    ]
  },
  {
    id: 'motherboard',
    title: 'Motherboard Components',
    content: `
      <h3>Key Parts of a Motherboard</h3>
      <ul>
        <li><strong>Rear I/O</strong> - Connects to peripheral devices (USB, audio, Ethernet, etc.)</li>
        <li><strong>CPU Slot</strong> - Socket where the processor is installed</li>
        <li><strong>PCI Express Slot</strong> - Connects the GPU and other expansion cards</li>
        <li><strong>SATA Ports</strong> - Connects storage drives (SSDs, HDDs)</li>
      </ul>
    `,
    sources: [
      { name: 'Tom\'s Hardware - Motherboard Anatomy', url: 'https://www.tomshardware.com/reviews/motherboard-parts-explained' },
      { name: 'Lifewire - Motherboard Components', url: 'https://www.lifewire.com/motherboard-components-5185938' }
    ]
  },
  {
    id: 'uefi-boot',
    title: 'UEFI & Boot Process',
    content: `
      <h3>Firmware & Boot</h3>
      <ul>
        <li><strong>UEFI</strong> (Unified Extensible Firmware Interface) - Modern replacement for BIOS</li>
        <li><strong>Firmware</strong> - Starts up the OS and other components; stored on ROM chips</li>
        <li><strong>Bootloader</strong> - Transfers the operating system into RAM for execution</li>
        <li><strong>POST</strong> (Power-On Self-Test) - Checks the presence and functionality of hardware</li>
      </ul>
    `,
    sources: [
      { name: 'Wikipedia - UEFI', url: 'https://en.wikipedia.org/wiki/UEFI' },
      { name: 'How-To Geek - What is UEFI', url: 'https://www.howtogeek.com/525184/what-is-uefi-and-how-is-it-different-from-bios/' }
    ]
  },
  {
    id: 'hacker-types',
    title: 'Types of Hackers',
    content: `
      <h3>Hacker Categories</h3>
      <ul>
        <li><strong>Amateur (Script Kiddie)</strong> - Uses already available tools without deep understanding</li>
        <li><strong>Hackers</strong> - Break into systems; classified by intent:</li>
        <ul>
          <li><strong>White Hat</strong> - Ethical hackers; work with permission to find vulnerabilities</li>
          <li><strong>Gray Hat</strong> - Between white and black; may break laws but not maliciously</li>
          <li><strong>Black Hat</strong> - Malicious hackers; break in for personal gain or harm</li>
        </ul>
        <li><strong>Organized Hackers</strong> - Groups of hackers working together (e.g., APT groups, cybercrime syndicates)</li>
      </ul>
    `,
    sources: [
      { name: 'Norton - Types of Hackers', url: 'https://us.norton.com/internetsecurity-emerging-threats-what-is-a-hacker.html' },
      { name: 'Cisco - Types of Hackers', url: 'https://www.cisco.com/c/en/us/products/security/what-is-a-hacker.html' },
      { name: 'Kaspersky - Hacker Types', url: 'https://www.kaspersky.com/resource-center/definitions/hacker-types' }
    ]
  },
  {
    id: 'attack-types',
    title: 'Types of Attacks',
    content: `
      <h3>Attack Categories</h3>
      <ul>
        <li><strong>Internal Attacks</strong> - Initiated by someone inside the organization (insider threat)</li>
        <li><strong>External Attacks</strong> - Initiated by an outside party trying to breach defenses</li>
      </ul>
      <p>Both types can target network infrastructure, applications, data, or users.</p>
    `,
    sources: [
      { name: 'Imperva - Types of Cyber Attacks', url: 'https://www.imperva.com/learn/application-security/cyber-attack/' },
      { name: 'OWASP - Attack Categories', url: 'https://owasp.org/www-community/attacks/' }
    ]
  },
  {
    id: 'malware-types',
    title: 'Types of Malware',
    content: `
      <h3>Malware Variants</h3>
      <ul>
        <li><strong>Spyware</strong> - Captures actions on a device (keystrokes, browsing habits, credentials)</li>
        <li><strong>Adware</strong> - Automatically delivers unwanted advertisements</li>
        <li><strong>Backdoor</strong> - Gains unauthorized access without normal authentication procedures</li>
        <li><strong>Ransomware</strong> - Holds the computer system or data hostage for payment</li>
        <li><strong>Scareware</strong> - Uses scare tactics to trick users into specific actions (e.g., fake antivirus)</li>
        <li><strong>Rootkit</strong> - Modifies the OS to create hidden access channels</li>
        <li><strong>Virus</strong> - Multiplies by attaching itself to other files; spreads when files are shared</li>
        <li><strong>Trojan Horse</strong> - Disguises itself as legitimate software to trick users</li>
      </ul>
    `,
    sources: [
      { name: 'Malwarebytes - Malware Types', url: 'https://www.malwarebytes.com/malware' },
      { name: 'CISA - Malware', url: 'https://www.cisa.gov/stopransomware' },
      { name: 'Kaspersky - Malware Descriptions', url: 'https://www.kaspersky.com/resource-center/threats/types-of-malware' }
    ]
  },
  {
    id: 'symptoms-malware',
    title: 'Symptoms of Malware',
    content: `
      <h3>Common Indicators</h3>
      <ul>
        <li><strong>High CPU usage</strong> - System slows down or fans run constantly</li>
        <li>Unexpected pop-ups or ads</li>
        <li>Browser redirects to unknown sites</li>
        <li>Files or programs opening automatically</li>
        <li>Unexplained data loss or file modifications</li>
        <li>Antivirus disabled without user action</li>
      </ul>
    `,
    sources: [
      { name: 'Microsoft - Malware Infection Signs', url: 'https://support.microsoft.com/en-us/topic/how-to-tell-if-your-computer-is-infected-with-malware' },
      { name: 'CISA - Indicators of Compromise', url: 'https://www.cisa.gov/indicators-compromise' }
    ]
  },
  {
    id: 'social-engineering',
    title: 'Social Engineering',
    content: `
      <h3>Manipulation Techniques</h3>
      <ul>
        <li><strong><dfn>Social Engineering</dfn></strong> - The psychological manipulation of people to divulge confidential information or perform actions</li>
        <li><strong>Pretexting</strong> - Contacting people in an attempt to obtain data by creating a fabricated scenario</li>
        <li><strong>Tailgating</strong> - Following an authorized user into a secured location without proper credentials</li>
        <li><strong>Quid Pro Quo</strong> - "Something for data" - offering a service or benefit in exchange for information</li>
      </ul>
    `,
    sources: [
      { name: 'Social Engineer Wiki', url: 'https://www.social-engineer.org/' },
      { name: 'NIST - Social Engineering', url: 'https://www.nist.gov/cyberframework' },
      { name: 'OWASP - Social Engineering', url: 'https://owasp.org/www-community/attacks/Social_Engineering' }
    ]
  },
  {
    id: 'dos-attacks',
    title: 'DoS & DDoS Attacks',
    content: `
      <h3>Denial of Service</h3>
      <ul>
        <li><strong>DoS Attack</strong> (Denial of Service) - Overwhelms a system to make it unavailable</li>
        <li><strong>Methods:</strong></li>
        <ul>
          <li><strong>Overwhelming Traffic</strong> - Flooding a server with more requests than it can handle</li>
          <li><strong>Malicious Packets</strong> - Sending malformed or specially crafted packets that crash a system</li>
        </ul>
        <li><strong>DDoS</strong> (Distributed DoS) - Uses multiple compromised systems (zombies/bots) to launch a coordinated attack</li>
      </ul>
    `,
    sources: [
      { name: 'Cloudflare - DDoS Attack Guide', url: 'https://www.cloudflare.com/learning/ddos/what-is-a-ddos-attack/' },
      { name: 'CERT - DoS Attacks', url: 'https://www.cisa.gov/news-events/news/understanding-denial-service-attacks' },
      { name: 'OWASP - DoS', url: 'https://owasp.org/www-community/attacks/Denial_of_Service' }
    ]
  },
  {
    id: 'botnet',
    title: 'Botnets',
    content: `
      <h3>Networks of Bots</h3>
      <ul>
        <li><strong>Botnet</strong> - A network of compromised computers (bots/zombies) controlled by a single attacker (bot herder)</li>
        <li>Used for DDoS attacks, spam campaigns, credential stuffing, and cryptocurrency mining</li>
        <li>Bots are often infected via malware, drive-by downloads, or phishing</li>
      </ul>
    `,
    sources: [
      { name: 'Cloudflare - Botnets', url: 'https://www.cloudflare.com/learning/bots/what-is-a-botnet/' },
      { name: 'FBI - Botnets', url: 'https://www.fbi.gov/investigate/cyber' },
      { name: 'Kaspersky - Botnets', url: 'https://www.kaspersky.com/resource-center/threats/botnet-attacks' }
    ]
  },
  {
    id: 'on-path-attacks',
    title: 'On-Path Attacks',
    content: `
      <h3>Intercepting Communications</h3>
      <ul>
        <li>Intercept or modify communications between two devices (e.g., a web browser and a web server)</li>
        <li>Formerly known as <strong>Man-in-the-Middle (MitM)</strong> attacks</li>
        <li>Methods: ARP spoofing, DNS spoofing, rogue access points, session hijacking</li>
      </ul>
    `,
    sources: [
      { name: 'Cloudflare - Man-in-the-Middle', url: 'https://www.cloudflare.com/learning/security/threats/man-in-the-middle-attack/' },
      { name: 'OWASP - On-Path Attack', url: 'https://owasp.org/www-community/attacks/Man-in-the-middle_attack' },
      { name: 'Wikipedia - On-Path Attack', url: 'https://en.wikipedia.org/wiki/Man-in-the-middle_attack' }
    ]
  },
  {
    id: 'seo-poisoning',
    title: 'SEO Poisoning',
    content: `
      <h3>Search Engine Manipulation</h3>
      <ul>
        <li>Increases traffic to malicious sites by abusing SEO keywords</li>
        <li>Attackers create fake pages with popular search terms to appear high in search results</li>
        <li>Often used to distribute malware or phishing links</li>
        <li>Also known as <strong>SEO Spam</strong> or <strong>Black Hat SEO</strong></li>
      </ul>
    `,
    sources: [
      { name: 'CrowdStrike - SEO Poisoning', url: 'https://www.crowdstrike.com/cybersecurity-101/seo-poisoning/' },
      { name: 'Malwarebytes - SEO Poisoning', url: 'https://www.malwarebytes.com/blog/news/2023/03/seo-poisoning' }
    ]
  },
  {
    id: 'password-attacks',
    title: 'Password Attacks',
    content: `
      <h3>Cracking Techniques</h3>
      <ul>
        <li><strong>Spraying</strong> - Using a few commonly used passwords across a large number of accounts to avoid lockouts</li>
        <li><strong>Dictionary Attack</strong> - Systematically trying every word in a dictionary or list of common words</li>
        <li><strong>Brute Force</strong> - Trying all possible combinations of letters, numbers, and symbols until correct</li>
        <li><strong>Rainbow Table</strong> - Compares password hashes against precomputed hash tables to find matches</li>
        <li><strong>Traffic Interception</strong> - Accessing passwords sent in plain text over a network</li>
      </ul>
    `,
    sources: [
      { name: 'OWASP - Password Attacks', url: 'https://owasp.org/www-community/attacks/Password_Attacks' },
      { name: 'NIST - Password Guidelines', url: 'https://www.nist.gov/itl/tig/projects/special-publication-800-63' },
      { name: 'Have I Been Pwned', url: 'https://haveibeenpwned.com/' }
    ]
  }
];

app.get('/api/sections', (req, res) => {
  res.json(sections);
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

async function start() {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`Cybersecurity Notes app running on http://localhost:${PORT}`);
  });
}

start();
