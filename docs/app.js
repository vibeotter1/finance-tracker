const CHART_COLORS = [
  '#f59e0b', '#8b5cf6', '#10b981', '#fbbf24',
  '#a78bfa', '#34d399', '#f97316', '#60a5fa',
];

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

  const latest = snapshots[snapshots.length - 1];

  document.getElementById('meta').innerHTML =
    `Last updated: <strong>${escHtml(latest.date)}</strong><br>` +
    `${latest.total_articles} items processed &middot; ${latest.topics.length} topics found`;

  renderTopics(latest.topics || []);
  renderCrypto(latest.crypto_trending || []);
  renderTrendChart(snapshots);
}

function showEmpty(msg) {
  document.getElementById('meta').textContent = msg;
  document.getElementById('topics-grid').innerHTML =
    `<p class="empty-state">${escHtml(msg)}</p>`;
}

function renderTopics(topics) {
  const grid = document.getElementById('topics-grid');
  if (!topics.length) {
    grid.innerHTML = '<p class="empty-state">No topics found for today.</p>';
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
  const grid = document.getElementById('crypto-grid');
  if (!coins.length) {
    grid.innerHTML = '<p class="empty-state">No trending crypto data available.</p>';
    return;
  }
  grid.innerHTML = coins.map(coin => `
    <div class="crypto-card">
      ${coin.thumb
        ? `<img class="crypto-thumb" src="${escHtml(coin.thumb)}" alt="${escHtml(coin.symbol)}" />`
        : ''}
      <div>
        <div class="crypto-name">${escHtml(coin.name)}</div>
        <div class="crypto-symbol">${escHtml(coin.symbol)}</div>
      </div>
    </div>
  `).join('');
}

function renderTrendChart(snapshots) {
  const last30 = snapshots.slice(-30);
  if (last30.length < 2) return;

  const labels = last30.map(s => s.date);

  // Aggregate total mentions per topic across the window
  const totals = {};
  for (const snap of last30) {
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
    data: last30.map(snap => {
      const found = (snap.topics || []).find(t => t.name === name);
      return found ? found.count : 0;
    }),
    borderColor: CHART_COLORS[i % CHART_COLORS.length],
    backgroundColor: 'transparent',
    tension: 0.35,
    pointRadius: 2.5,
    borderWidth: 2,
  }));

  const ctx = document.getElementById('trend-chart').getContext('2d');
  new Chart(ctx, {
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
            boxWidth: 12,
            font: { size: 11 },
            padding: 16,
          },
        },
        tooltip: {
          backgroundColor: '#161b22',
          borderColor: '#30363d',
          borderWidth: 1,
          titleColor: '#e6edf3',
          bodyColor: '#8b949e',
        },
      },
      scales: {
        x: {
          ticks: { color: '#8b949e', font: { size: 10 }, maxTicksLimit: 10 },
          grid: { color: '#21262d' },
        },
        y: {
          ticks: { color: '#8b949e', font: { size: 10 } },
          grid: { color: '#21262d' },
          beginAtZero: true,
        },
      },
    },
  });
}

init();
