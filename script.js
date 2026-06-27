const STORAGE_KEY = 'lotary_draw_history';
const SPEED_STORAGE_KEY = 'lotary_speed_mode';
const CHAR_DELAY_MS = 1500;
const SPIN_INTERVAL_MS = 60;
const LETTERS = 'PU';
const DIGITS = '0123456789';

const FULL_POOL = [
  ...Array.from({ length: 600 }, (_, i) => 'P' + String(i + 1).padStart(3, '0')),
  ...Array.from({ length: 600 }, (_, i) => 'U' + String(i + 1).padStart(3, '0')),
];

let history = loadHistory();
// True once the current pending entry's reveal animation has finished
// (defaults true on load so a refresh mid-decision skips straight to the result).
let revealedCurrent = true;
let animating = false;
let speedMode = loadSpeedMode();

function loadHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

function loadSpeedMode() {
  return localStorage.getItem(SPEED_STORAGE_KEY) === 'fast' ? 'fast' : 'slow';
}

function saveSpeedMode() {
  localStorage.setItem(SPEED_STORAGE_KEY, speedMode);
}

function isAvailable(number) {
  return !history.some(e => e.number === number && (e.status === 'present' || e.status === 'pending'));
}

function getAvailablePool() {
  return FULL_POOL.filter(isAvailable);
}

function getLatest() {
  return history[history.length - 1] || null;
}

function prefixClass(number) {
  return number.startsWith('P') ? 'prefix-P' : 'prefix-U';
}

function statusLabel(status) {
  if (status === 'present') return 'Present';
  if (status === 'absent') return 'Not Present';
  return 'Pending';
}

function randomChar(pos) {
  const set = pos === 0 ? LETTERS : DIGITS;
  return set[Math.floor(Math.random() * set.length)];
}

const drawBtn = document.getElementById('drawBtn');
const slotEls = Array.from(document.querySelectorAll('.slot'));
const statusTagEl = document.getElementById('statusTag');
const decisionButtonsEl = document.getElementById('decisionButtons');
const presentBtn = document.getElementById('presentBtn');
const notPresentBtn = document.getElementById('notPresentBtn');
const remainingEl = document.getElementById('remaining');
const historyListEl = document.getElementById('historyList');
const resetBtn = document.getElementById('resetBtn');
const slowBtn = document.getElementById('slowBtn');
const fastBtn = document.getElementById('fastBtn');

function clearSlots() {
  slotEls.forEach(el => {
    el.textContent = ' ';
    el.classList.remove('spinning', 'landed', 'prefix-P', 'prefix-U');
  });
}

function drawNumber() {
  if (animating) return;
  const latest = getLatest();
  if (latest && latest.status === 'pending') return;
  const pool = getAvailablePool();
  if (pool.length === 0) return;

  const number = pool[Math.floor(Math.random() * pool.length)];
  const entry = { id: crypto.randomUUID(), number, status: 'pending' };
  history.push(entry);
  saveHistory();
  revealedCurrent = false;
  clearSlots();
  render();
  playRevealAnimation(entry);
}

function playRevealAnimation(entry) {
  if (speedMode === 'fast') {
    revealedCurrent = true;
    render();
    return;
  }

  animating = true;
  render();

  const chars = entry.number.split('');
  const order = [...chars.keys()].reverse(); // reveal last digit -> ... -> prefix letter
  let step = 0;

  function revealNext() {
    if (step >= order.length) {
      animating = false;
      revealedCurrent = true;
      render();
      return;
    }

    const slotIndex = order[step];
    const slotEl = slotEls[slotIndex];
    slotEl.classList.remove('landed');
    slotEl.classList.add('spinning');
    const spinInterval = setInterval(() => {
      slotEl.textContent = randomChar(slotIndex);
    }, SPIN_INTERVAL_MS);

    setTimeout(() => {
      clearInterval(spinInterval);
      slotEl.textContent = chars[slotIndex];
      slotEl.classList.remove('spinning', 'prefix-P', 'prefix-U');
      slotEl.classList.add('landed', prefixClass(entry.number));
      step += 1;
      revealNext();
    }, CHAR_DELAY_MS);
  }

  revealNext();
}

function resolveCurrent(status) {
  const latest = getLatest();
  if (!latest || latest.status !== 'pending') return;
  latest.status = status;
  saveHistory();
  render();
}

function correctEntry(id, newStatus) {
  const entry = history.find(e => e.id === id);
  if (!entry || entry.status === 'pending') return;
  entry.status = newStatus;
  saveHistory();
  render();
}

function setSpeedMode(mode) {
  if (animating || mode === speedMode) return;
  speedMode = mode;
  saveSpeedMode();
  render();
}

function resetAll() {
  if (animating || history.length === 0) return;
  if (!window.confirm('Reset all 1200 numbers? This clears the entire history.')) return;
  history = [];
  revealedCurrent = true;
  saveHistory();
  render();
}

function render() {
  const latest = getLatest();
  const availableCount = getAvailablePool().length;
  const isPending = Boolean(latest && latest.status === 'pending');

  remainingEl.textContent = `${availableCount} / ${FULL_POOL.length} remaining`;
  drawBtn.disabled = animating || isPending || availableCount === 0;
  drawBtn.textContent = availableCount === 0 && !isPending ? 'All numbers drawn' : 'Draw Number';
  resetBtn.disabled = animating || history.length === 0;
  slowBtn.disabled = animating;
  fastBtn.disabled = animating;
  slowBtn.classList.toggle('active', speedMode === 'slow');
  fastBtn.classList.toggle('active', speedMode === 'fast');

  if (!animating) {
    if (latest && revealedCurrent) {
      const chars = latest.number.split('');
      slotEls.forEach((el, i) => {
        el.textContent = chars[i];
        el.classList.remove('spinning', 'prefix-P', 'prefix-U');
        el.classList.add('landed', prefixClass(latest.number));
      });
    } else if (!latest) {
      slotEls.forEach(el => {
        el.textContent = ' ';
        el.classList.remove('spinning', 'landed', 'prefix-P', 'prefix-U');
      });
    }
  }

  if (isPending && revealedCurrent) {
    decisionButtonsEl.classList.add('visible');
    statusTagEl.textContent = '';
    statusTagEl.className = 'status-tag';
  } else {
    decisionButtonsEl.classList.remove('visible');
    statusTagEl.textContent = latest && !isPending ? statusLabel(latest.status) : '';
    statusTagEl.className = latest && !isPending ? `status-tag ${latest.status}` : 'status-tag';
  }

  renderHistory();
}

function renderHistory() {
  historyListEl.innerHTML = '';

  const presentEntries = history.filter(e => e.status === 'present');

  if (presentEntries.length === 0) {
    const li = document.createElement('li');
    li.className = 'history-empty';
    li.textContent = 'No one marked present yet.';
    historyListEl.appendChild(li);
    return;
  }

  [...presentEntries].reverse().forEach(entry => {
    const li = document.createElement('li');
    li.className = 'history-row';

    const numberEl = document.createElement('span');
    numberEl.className = `history-number ${prefixClass(entry.number)}`;
    numberEl.textContent = entry.number;
    li.appendChild(numberEl);

    const statusEl = document.createElement('span');
    statusEl.className = `history-status ${entry.status}`;
    statusEl.textContent = statusLabel(entry.status);
    li.appendChild(statusEl);

    const correctBtn = document.createElement('button');
    correctBtn.className = 'correct-btn';
    correctBtn.textContent = `↺ Mark as ${statusLabel('absent')}`;
    correctBtn.addEventListener('click', () => correctEntry(entry.id, 'absent'));
    li.appendChild(correctBtn);

    historyListEl.appendChild(li);
  });
}

drawBtn.addEventListener('click', drawNumber);
presentBtn.addEventListener('click', () => resolveCurrent('present'));
notPresentBtn.addEventListener('click', () => resolveCurrent('absent'));
resetBtn.addEventListener('click', resetAll);
slowBtn.addEventListener('click', () => setSpeedMode('slow'));
fastBtn.addEventListener('click', () => setSpeedMode('fast'));

render();
