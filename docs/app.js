const CHART_COLORS = [
  '#3fb950', '#7ee787', '#56d364', '#2ea043',
  '#26a641', '#1a7f37', '#0d6124', '#e6edf3',
];

let allSnapshots = [];
let trendChartInstance = null;
let activeDays = 7;

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

async function init() {
  let snapshots;
  try {
    const res = await fetch('data.json');
    snapshots = await res.json();
  } catch {
    showEmpty('Could not load data.');
    return;
  }

  if (!snapshots || snapshots.length === 0) {
    showEmpty('No data yet — check back after the first daily run.');
    return;
  }

  allSnapshots = snapshots;
  const latest = snapshots[snapshots.length - 1];

  // Date tag
  document.getElementById('date-tag').textContent = formatDate(latest.date);

  // Last updated in footer
  const footerEl = document.querySelector('footer p');
  if (footerEl) {
    footerEl.innerHTML += ` &middot; Last updated: ${escHtml(latest.date)}`;
  }

  renderTopics(latest.topics || [], latest.date, true);
  renderCrypto(latest.crypto_trending || []);
  renderTrendChart(activeDays);
  renderArchive(snapshots, latest.date);
  initChartTabs();
}

function showEmpty(msg) {
  document.getElementById('topics-grid').innerHTML =
    `<p class="empty-state">${escHtml(msg)}</p>`;
}

function renderTopics(topics, date, isLatest = false) {
  const heading = document.getElementById('topics-heading');
  heading.textContent = isLatest
    ? "Today's Hot Topics"
    : `Topics — ${formatDate(date)}`;

  const grid = document.getElementById('topics-grid');
  if (!topics.length) {
    grid.innerHTML = '<p class="empty-state">No topics for this date.</p>';
    return;
  }

  const maxCount = topics[0].count || 1;

  grid.innerHTML = topics.slice(0, 18).map((topic, i) => {
    const pct = Math.round((topic.count / maxCount) * 100);
    const articles = (topic.articles || []).slice(0, 3);

    return `
      <div class="topic-card" style="animation-delay:${i * 60}ms">
        <div class="topic-header">
          <span class="topic-name">${escHtml(topic.name)}</span>
          ${topic.is_new ? '<span class="badge-new">New</span>' : ''}
        </div>
        <div class="topic-count">${topic.count} mention${topic.count !== 1 ? 's' : ''}</div>
        <div class="mention-bar">
          <div class="mention-fill" style="width:${pct}%"></div>
        </div>
        <div class="sources">
          ${(topic.sources || []).map(s => `<span class="source-tag">${escHtml(s)}</span>`).join('')}
        </div>
        ${articles.length ? `
          <div class="articles">
            ${articles.map(a => `
              <div class="article-item">
                <a class="article-link"
                   href="${escHtml(a.url)}"
                   target="_blank"
                   rel="noopener noreferrer">${escHtml(a.title)}</a>
                <span class="article-source">${escHtml(a.source)}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

function renderCrypto(coins) {
  const track = document.getElementById('ticker-track');
  const wrapper = document.getElementById('ticker-wrapper');
  if (!coins.length) {
    wrapper.style.display = 'none';
    return;
  }

  const coinHtml = (coin) => `
    <div class="ticker-coin">
      ${coin.thumb ? `<img class="ticker-coin-img" src="${escHtml(coin.thumb)}" alt="" />` : ''}
      <span class="ticker-coin-symbol">${escHtml(coin.symbol)}</span>
      <span class="ticker-coin-name">${escHtml(coin.name)}</span>
    </div>
    <span class="ticker-divider">·</span>
  `;

  track.innerHTML = coins.map(coinHtml).join('') + coins.map(coinHtml).join('');
}

function renderTrendChart(days) {
  const window = allSnapshots.slice(-days);
  if (window.length < 2) return;

  const labels = window.map(s => {
    const [, m, d] = s.date.split('-');
    return `${m}/${d}`;
  });

  const totals = {};
  for (const snap of window) {
    for (const t of (snap.topics || [])) {
      totals[t.name] = (totals[t.name] || 0) + t.count;
    }
  }

  const topTopics = Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name]) => name);

  const datasets = topTopics.map((name, i) => ({
    label: name,
    data: window.map(snap => {
      const found = (snap.topics || []).find(t => t.name === name);
      return found ? found.count : 0;
    }),
    borderColor: CHART_COLORS[i % CHART_COLORS.length],
    backgroundColor: 'transparent',
    tension: 0.35,
    pointRadius: 2.5,
    borderWidth: 2,
  }));

  if (trendChartInstance) {
    trendChartInstance.destroy();
    trendChartInstance = null;
  }

  const ctx = document.getElementById('trend-chart').getContext('2d');
  trendChartInstance = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: {
            color: '#8b949e',
            boxWidth: 10,
            font: { family: 'IBM Plex Mono', size: 10 },
            padding: 14,
          },
        },
        tooltip: {
          backgroundColor: '#161b22',
          borderColor: 'rgba(139,148,158,0.15)',
          borderWidth: 1,
          titleColor: '#e6edf3',
          bodyColor: '#8b949e',
          titleFont: { family: 'IBM Plex Mono', size: 11 },
          bodyFont: { family: 'IBM Plex Mono', size: 10 },
        },
      },
      scales: {
        x: {
          ticks: { color: '#8b949e', font: { family: 'IBM Plex Mono', size: 9 }, maxTicksLimit: days === 7 ? 7 : 10 },
          grid: { color: 'rgba(139,148,158,0.08)' },
        },
        y: {
          ticks: { color: '#8b949e', font: { family: 'IBM Plex Mono', size: 9 } },
          grid: { color: 'rgba(139,148,158,0.08)' },
          beginAtZero: true,
        },
      },
    },
  });
}

function initChartTabs() {
  document.querySelectorAll('.chart-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.chart-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeDays = parseInt(btn.dataset.days);
      renderTrendChart(activeDays);
    });
  });
}

function renderArchive(snapshots, latestDate) {
  const nav = document.getElementById('archive-nav');

  // Group by year → month
  const byYear = {};
  for (const snap of [...snapshots].reverse()) {
    const [year, month] = snap.date.split('-');
    if (!byYear[year]) byYear[year] = {};
    if (!byYear[year][month]) byYear[year][month] = [];
    byYear[year][month].push(snap.date);
  }

  nav.innerHTML = Object.entries(byYear).map(([year, months]) => `
    <div class="archive-year">
      <span class="archive-year-label">${year}</span>
      ${Object.entries(months).map(([month, dates]) => {
        const monthName = new Date(year, month - 1).toLocaleDateString('en-US', { month: 'short' });
        return `
          <div class="archive-month">
            <span class="archive-month-label">${monthName}</span>
            <div class="archive-dates">
              ${dates.map(date => {
                const day = parseInt(date.split('-')[2]);
                const isToday = date === latestDate;
                return `<button class="archive-date-btn ${isToday ? 'today' : ''}"
                  data-date="${date}">${day}</button>`;
              }).join('')}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `).join('');

  nav.addEventListener('click', e => {
    const btn = e.target.closest('.archive-date-btn');
    if (!btn) return;
    const date = btn.dataset.date;
    const snap = allSnapshots.find(s => s.date === date);
    if (!snap) return;

    document.querySelectorAll('.archive-date-btn').forEach(b => {
      b.classList.remove('active');
      if (b.dataset.date === latestDate) b.classList.add('today');
    });
    btn.classList.remove('today');
    btn.classList.add('active');

    const isLatest = date === latestDate;
    renderTopics(snap.topics || [], date, isLatest);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

init();
