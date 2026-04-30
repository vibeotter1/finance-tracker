const TWEAKER_DEFAULTS = {
  '--accent':             '#3fb950',
  '--bg':                 '#0d1117',
  '--surface':            '#161b22',
  '--surface-alt':        '#21262d',
  '--text':               '#e6edf3',
  '--text-muted':         '#8b949e',
  '--card-radius':        '8',
  '--card-padding':       '24',
  '--font-scale':         '1',
  '--border-alpha':       '0.15',
  '--shadow-alpha':       '0.12',
  '--accent-hover-alpha': '0.35',
};
const TICKER_DEFAULT = 67;
const LS_KEY = 'signal-tweaker-v1';

function applyTickerSpeed(pxPerSec) {
  window.tickerSpeedPxPerSec = pxPerSec;
  requestAnimationFrame(() => {
    const ct = document.getElementById('crypto-track');
    const st = document.getElementById('stocks-track');
    if (ct && ct.children.length > 0 && typeof syncTickerSpeed === 'function') {
      syncTickerSpeed(ct, pxPerSec);
      syncTickerSpeed(st, pxPerSec);
    }
  });
}

function getSpanId(prop) {
  return 'val-' + prop; // matches id="val---card-radius" etc in HTML
}

function updateSpan(prop, displayVal) {
  const el = document.getElementById(getSpanId(prop));
  if (el) el.textContent = displayVal;
}

function applyVar(prop, rawValue, unit) {
  const cssValue = unit ? rawValue + unit : rawValue;
  document.documentElement.style.setProperty(prop, cssValue);
  updateSpan(prop, cssValue.trim() || rawValue);
}

function persist() {
  const data = {};
  document.querySelectorAll('.tw-range, .tw-color').forEach(input => {
    if (input.dataset.var) data[input.dataset.var] = input.value;
  });
  data['--ticker-speed'] = document.getElementById('tw-ticker-speed').value;
  localStorage.setItem(LS_KEY, JSON.stringify(data));
}

function init() {
  const saved = JSON.parse(localStorage.getItem(LS_KEY) || '{}');

  // Hydrate CSS vars + input values
  Object.entries(TWEAKER_DEFAULTS).forEach(([prop, defaultVal]) => {
    const saved_val = saved[prop] ?? defaultVal;
    const input = document.querySelector(`[data-var="${prop}"]`);
    const unit = input ? (input.dataset.unit ?? '') : '';
    if (input) input.value = saved_val;
    applyVar(prop, saved_val, unit);
  });

  // Ticker speed
  const tickerSpeed = parseFloat(saved['--ticker-speed'] ?? TICKER_DEFAULT);
  const tickerInput = document.getElementById('tw-ticker-speed');
  tickerInput.value = tickerSpeed;
  document.getElementById('val---ticker-speed').textContent = tickerSpeed;
  applyTickerSpeed(tickerSpeed);

  // Wire range + color inputs
  document.querySelectorAll('.tw-range, .tw-color').forEach(input => {
    input.addEventListener('input', () => {
      const prop = input.dataset.var;
      const unit = input.dataset.unit ?? '';
      applyVar(prop, input.value, unit);
      persist();
    });
  });

  // Ticker speed slider
  document.getElementById('tw-ticker-speed').addEventListener('input', function () {
    const speed = parseFloat(this.value);
    document.getElementById('val---ticker-speed').textContent = speed;
    applyTickerSpeed(speed);
    persist();
  });

  // Copy CSS vars
  document.getElementById('tw-copy-btn').addEventListener('click', () => {
    const lines = [':root {'];
    Object.keys(TWEAKER_DEFAULTS).forEach(prop => {
      const val = getComputedStyle(document.documentElement).getPropertyValue(prop).trim();
      lines.push(`  ${prop}: ${val};`);
    });
    const speed = document.getElementById('tw-ticker-speed').value;
    lines.push(`  /* ticker speed: ${speed}px/s */`);
    lines.push('}');
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      const btn = document.getElementById('tw-copy-btn');
      btn.textContent = 'Copied ✓';
      btn.classList.add('tw-copied');
      setTimeout(() => { btn.textContent = 'Copy CSS vars'; btn.classList.remove('tw-copied'); }, 2000);
    });
  });

  // Reset
  document.getElementById('tw-reset-btn').addEventListener('click', () => {
    Object.entries(TWEAKER_DEFAULTS).forEach(([prop, defaultVal]) => {
      const input = document.querySelector(`[data-var="${prop}"]`);
      const unit = input ? (input.dataset.unit ?? '') : '';
      if (input) input.value = defaultVal;
      applyVar(prop, defaultVal, unit);
    });
    document.getElementById('tw-ticker-speed').value = TICKER_DEFAULT;
    document.getElementById('val---ticker-speed').textContent = TICKER_DEFAULT;
    applyTickerSpeed(TICKER_DEFAULT);
    localStorage.removeItem(LS_KEY);
  });

  // Toggle open/close
  document.getElementById('tweaker-toggle').addEventListener('click', () => {
    const panel = document.getElementById('tweaker-panel');
    const open = panel.classList.toggle('tw-open');
    panel.setAttribute('aria-hidden', String(!open));
  });
  document.getElementById('tweaker-close').addEventListener('click', () => {
    document.getElementById('tweaker-panel').classList.remove('tw-open');
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') document.getElementById('tweaker-panel').classList.remove('tw-open');
  });

  // Show toggle button if ?tweaker in URL or if user has saved settings
  if (location.search.includes('tweaker') || location.hash.includes('tweaker') || saved['--accent']) {
    document.getElementById('tweaker-toggle').style.display = 'flex';
  }
}

document.addEventListener('DOMContentLoaded', init);
