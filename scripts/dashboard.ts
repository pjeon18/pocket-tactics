/**
 * Renders a self-contained balance dashboard from a telemetry run.
 *
 *   npx tsx scripts/dashboard.ts [tag]        (default: baseline)
 *
 * Reads docs/telemetry/<tag>.json → writes docs/telemetry/<tag>.html
 * No dependencies, no CDN: plain SVG + inline CSS, light/dark aware.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const TAG = process.argv[2] ?? 'baseline'
const data = JSON.parse(readFileSync(new URL(`../docs/telemetry/${TAG}.json`, import.meta.url), 'utf8'))

const esc = (s: string) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
const pct = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`
const fmt = (x: number, d = 1) => x.toFixed(d)

/* ---------- chart builders (plain SVG, hover via <title> + CSS) ---------- */

/** Horizontal diverging bars: win rate relative to the 50% balance line. */
function divergingBars(rows: { name: string; winRate: number; n: number }[], opts: { h?: number } = {}) {
  const rowH = 30
  const H = rows.length * rowH + 34
  const W = 720
  const labelW = 104
  const plotW = W - labelW - 62
  const mid = labelW + plotW / 2
  // symmetric domain around 50%, at least ±12pts
  const maxDev = Math.max(0.12, ...rows.map((r) => Math.abs(r.winRate - 0.5)))
  const x = (wr: number) => mid + ((wr - 0.5) / maxDev) * (plotW / 2)

  const ticks = [-1, -0.5, 0, 0.5, 1].map((f) => ({ f, wr: 0.5 + f * maxDev }))

  return `<svg viewBox="0 0 ${W} ${H}" role="img" class="chart" preserveAspectRatio="xMidYMid meet">
    ${ticks.map((t) => `<line x1="${x(t.wr).toFixed(1)}" y1="20" x2="${x(t.wr).toFixed(1)}" y2="${rows.length * rowH + 22}" class="${t.f === 0 ? 'axis-line' : 'grid'}"/>
      <text x="${x(t.wr).toFixed(1)}" y="13" class="tick mid">${pct(t.wr, 0)}</text>`).join('')}
    ${rows.map((r, i) => {
      const y = 22 + i * rowH
      const cx = x(r.winRate)
      const above = r.winRate >= 0.5
      const bw = Math.max(2, Math.abs(cx - mid))
      // keep the value legible: if it would collide with the row label, tuck it inside the bar
      const outsideX = above ? mid + bw + 8 : mid - bw - 8
      const collides = !above && outsideX < labelW + 46
      const vx = collides ? mid - bw + 8 : outsideX
      const anchor = collides ? 'start' : above ? 'start' : 'end'
      return `<g class="bar-g">
        <title>${esc(r.name)}: ${pct(r.winRate)} win rate over ${r.n} games</title>
        <rect x="0" y="${y - 4}" width="${W}" height="${rowH - 4}" class="hover-band"/>
        <text x="${labelW - 12}" y="${y + 15}" class="row-label">${esc(r.name)}</text>
        <rect x="${(above ? mid : mid - bw).toFixed(1)}" y="${y + 3}" width="${bw.toFixed(1)}" height="16" rx="4"
          fill="${above ? 'var(--pos)' : 'var(--neg)'}"/>
        <text x="${vx.toFixed(1)}" y="${y + 15}"
          class="bar-value${collides ? ' bar-value-in' : ''}" text-anchor="${anchor}">${pct(r.winRate)}</text>
      </g>`
    }).join('')}
  </svg>`
}

/** Vertical histogram with an optional threshold marker. */
function histogram(buckets: { label: string; v: number }[], marker?: { at: number; label: string }) {
  const W = 720, H = 240, padL = 46, padB = 34, padT = 16
  const plotW = W - padL - 16, plotH = H - padB - padT
  const max = Math.max(1, ...buckets.map((b) => b.v))
  const bw = plotW / buckets.length
  const gridVals = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f))
  return `<svg viewBox="0 0 ${W} ${H}" role="img" class="chart" preserveAspectRatio="xMidYMid meet">
    ${gridVals.map((g) => {
      const y = padT + plotH - (g / max) * plotH
      return `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - 16}" y2="${y.toFixed(1)}" class="grid"/>
        <text x="${padL - 8}" y="${(y + 4).toFixed(1)}" class="tick" text-anchor="end">${g}</text>`
    }).join('')}
    ${buckets.map((b, i) => {
      const h = (b.v / max) * plotH
      const x = padL + i * bw
      return `<g class="bar-g"><title>${esc(b.label)} rounds: ${b.v} games</title>
        <rect x="${x.toFixed(1)}" y="${padT.toFixed(1)}" width="${bw.toFixed(1)}" height="${plotH}" class="hover-band"/>
        <rect x="${(x + 3).toFixed(1)}" y="${(padT + plotH - h).toFixed(1)}" width="${(bw - 6).toFixed(1)}"
          height="${h.toFixed(1)}" rx="4" fill="var(--series-1)"/>
        <text x="${(x + bw / 2).toFixed(1)}" y="${H - padB + 18}" class="tick" text-anchor="middle">${esc(b.label)}</text>
      </g>`
    }).join('')}
    ${marker ? (() => {
      const i = buckets.findIndex((b) => Number(b.label.split('-')[0]) >= marker.at)
      if (i < 0) return ''
      const x = padL + i * bw
      return `<line x1="${x.toFixed(1)}" y1="${padT}" x2="${x.toFixed(1)}" y2="${padT + plotH}" class="marker"/>
        <text x="${(x + 6).toFixed(1)}" y="${padT + 12}" class="marker-label">${esc(marker.label)}</text>`
    })() : ''}
    <line x1="${padL}" y1="${padT + plotH}" x2="${W - 16}" y2="${padT + plotH}" class="axis-line"/>
  </svg>`
}

/** Scatter of cost (x) vs win rate (y), colored by ball tier. */
function scatter(pts: { name: string; x: number; y: number; tier: string; n: number }[]) {
  const W = 720, H = 300, padL = 50, padB = 40, padT = 16, padR = 16
  const plotW = W - padL - padR, plotH = H - padB - padT
  const xs = pts.map((p) => p.x)
  const xMin = Math.min(...xs), xMax = Math.max(...xs)
  const yMin = 0.25, yMax = 0.75
  const X = (v: number) => padL + ((v - xMin) / Math.max(1, xMax - xMin)) * plotW
  const Y = (v: number) => padT + plotH - ((Math.min(yMax, Math.max(yMin, v)) - yMin) / (yMax - yMin)) * plotH
  const color: Record<string, string> = { poke: 'var(--series-1)', great: 'var(--series-2)', ultra: 'var(--series-3)' }
  const yTicks = [0.3, 0.4, 0.5, 0.6, 0.7]

  // least-squares trend line — the visual proof of (non-)correlation
  const n = pts.length
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = pts.reduce((a, b) => a + b.y, 0) / n
  let num = 0, den = 0
  for (const p of pts) { num += (p.x - mx) * (p.y - my); den += (p.x - mx) ** 2 }
  const slope = den ? num / den : 0
  const y0 = my + slope * (xMin - mx), y1 = my + slope * (xMax - mx)

  return `<svg viewBox="0 0 ${W} ${H}" role="img" class="chart" preserveAspectRatio="xMidYMid meet">
    ${yTicks.map((t) => `<line x1="${padL}" y1="${Y(t).toFixed(1)}" x2="${W - padR}" y2="${Y(t).toFixed(1)}" class="${t === 0.5 ? 'axis-line' : 'grid'}"/>
      <text x="${padL - 8}" y="${(Y(t) + 4).toFixed(1)}" class="tick" text-anchor="end">${pct(t, 0)}</text>`).join('')}
    <line x1="${X(xMin).toFixed(1)}" y1="${Y(y0).toFixed(1)}" x2="${X(xMax).toFixed(1)}" y2="${Y(y1).toFixed(1)}" class="trend"/>
    ${pts.map((p) => `<g class="dot-g"><title>${esc(p.name)} — cost ${p.x}, ${pct(p.y)} win rate (n=${p.n})</title>
      <circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="5.5" fill="${color[p.tier] ?? 'var(--series-1)'}"
        stroke="var(--surface-1)" stroke-width="2"/></g>`).join('')}
    ${[xMin, Math.round((xMin + xMax) / 2), xMax].map((v) => `<text x="${X(v).toFixed(1)}" y="${H - padB + 20}" class="tick" text-anchor="middle">${v}</text>`).join('')}
    <text x="${(padL + plotW / 2).toFixed(1)}" y="${H - 6}" class="axis-title" text-anchor="middle">draft cost (Poké Ball equivalent)</text>
  </svg>`
}

/** Single-series line over rounds. */
function line(series: { round: number; v: number }[], fmtY: (v: number) => string, color = 'var(--series-1)') {
  const W = 720, H = 220, padL = 46, padB = 34, padT = 16, padR = 16
  const plotW = W - padL - padR, plotH = H - padB - padT
  const rounds = series.map((s) => s.round)
  const xMin = Math.min(...rounds), xMax = Math.max(...rounds)
  const vMax = Math.max(...series.map((s) => s.v)) * 1.1 || 1
  const X = (r: number) => padL + ((r - xMin) / Math.max(1, xMax - xMin)) * plotW
  const Y = (v: number) => padT + plotH - (v / vMax) * plotH
  const d = series.map((s, i) => `${i ? 'L' : 'M'}${X(s.round).toFixed(1)},${Y(s.v).toFixed(1)}`).join(' ')
  const ticks = [0, 0.5, 1].map((f) => vMax * f)
  return `<svg viewBox="0 0 ${W} ${H}" role="img" class="chart" preserveAspectRatio="xMidYMid meet">
    ${ticks.map((t) => `<line x1="${padL}" y1="${Y(t).toFixed(1)}" x2="${W - padR}" y2="${Y(t).toFixed(1)}" class="grid"/>
      <text x="${padL - 8}" y="${(Y(t) + 4).toFixed(1)}" class="tick" text-anchor="end">${fmtY(t)}</text>`).join('')}
    <path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    ${series.filter((_, i) => i % Math.ceil(series.length / 12) === 0).map((s) =>
      `<g class="dot-g"><title>round ${s.round}: ${fmtY(s.v)}</title>
        <circle cx="${X(s.round).toFixed(1)}" cy="${Y(s.v).toFixed(1)}" r="4.5" fill="${color}" stroke="var(--surface-1)" stroke-width="2"/></g>`).join('')}
    ${[xMin, Math.round((xMin + xMax) / 2), xMax].map((r) => `<text x="${X(r).toFixed(1)}" y="${H - padB + 20}" class="tick" text-anchor="middle">${r}</text>`).join('')}
    <text x="${(padL + plotW / 2).toFixed(1)}" y="${H - 6}" class="axis-title" text-anchor="middle">round</text>
    <line x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}" class="axis-line"/>
  </svg>`
}

/* ---------- verdict helpers ---------- */
const verdict = (ok: boolean, warn: boolean, good: string, bad: string) =>
  `<span class="chip ${ok ? 'chip-good' : warn ? 'chip-warn' : 'chip-bad'}">${ok ? good : bad}</span>`

const h = data.headline
const tiles = [
  {
    label: 'First-player win rate', value: pct(h.firstPlayerWinRate),
    note: 'Player A moves first. 50% is fair.',
    chip: verdict(Math.abs(h.firstPlayerWinRate - 0.5) < 0.03, Math.abs(h.firstPlayerWinRate - 0.5) < 0.06,
      'balanced', `${h.firstPlayerWinRate < 0.5 ? 'second' : 'first'} player favoured`),
  },
  {
    label: 'Snowball index', value: pct(h.snowballIndex),
    note: 'How often the first kill predicts the winner. 50% = no snowball.',
    chip: verdict(h.snowballIndex < 0.6, h.snowballIndex < 0.7, 'comebacks possible', 'leads compound'),
  },
  {
    label: 'Fatigue rate', value: pct(h.fatigueRate),
    note: 'Games dragging past round 20, where forced chip damage starts.',
    chip: verdict(h.fatigueRate < 0.2, h.fatigueRate < 0.45, 'games end on their own', 'stalls are the norm'),
  },
  {
    label: 'Median length', value: `${h.medianRounds}`,
    note: `rounds · p90 ${h.p90Rounds} · max ${h.maxRounds}`,
    chip: verdict(h.medianRounds <= 14, h.medianRounds <= 20, 'tight', 'long'),
  },
  {
    label: 'Cost → win correlation', value: fmt(h.costVsWinCorrelation, 2),
    note: 'Does paying more for a Pokémon actually win games? 1.0 = perfectly rewarded.',
    chip: verdict(h.costVsWinCorrelation > 0.35, h.costVsWinCorrelation > 0.15, 'investment pays', 'premium not rewarded'),
  },
  {
    label: 'KOs per game', value: fmt(h.avgKosPerGame, 1),
    note: `first blood ~round ${fmt(h.avgFirstKoRound)}`,
    chip: verdict(h.avgKosPerGame < 9, h.avgKosPerGame < 13, 'decisive', 'high churn'),
  },
]

const lengthBuckets = Object.entries(data.lengthHistogram as Record<string, number>)
  .map(([label, v]) => ({ label, v: v as number }))
  .sort((a, b) => Number(a.label.split('-')[0]) - Number(b.label.split('-')[0]))

const unitRows = [...data.units].sort((a: any, b: any) => b.winRate - a.winRate)

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pocket Tactics — balance telemetry (${esc(data.meta.tag)})</title>
<style>
  :root{color-scheme:light dark}
  .viz-root{
    --surface-1:#fcfcfb; --page:#f9f9f7;
    --text-primary:#0b0b0b; --text-secondary:#52514e; --muted:#898781;
    --grid:#e1e0d9; --axis:#c3c2b7; --border:rgba(11,11,11,.10);
    --series-1:#2a78d6; --series-2:#eb6834; --series-3:#1baf7a;
    --pos:#2a78d6; --neg:#d03b3b; --good:#0ca30c; --warn:#fab219; --crit:#d03b3b;
  }
  @media (prefers-color-scheme:dark){:root:where(:not([data-theme="light"])) .viz-root{
    --surface-1:#1a1a19; --page:#0d0d0d;
    --text-primary:#fff; --text-secondary:#c3c2b7; --muted:#898781;
    --grid:#2c2c2a; --axis:#383835; --border:rgba(255,255,255,.10);
    --series-1:#3987e5; --series-2:#d95926; --series-3:#199e70;
    --pos:#3987e5; --neg:#e66767;
  }}
  :root[data-theme="dark"] .viz-root{
    --surface-1:#1a1a19; --page:#0d0d0d;
    --text-primary:#fff; --text-secondary:#c3c2b7; --muted:#898781;
    --grid:#2c2c2a; --axis:#383835; --border:rgba(255,255,255,.10);
    --series-1:#3987e5; --series-2:#d95926; --series-3:#199e70;
    --pos:#3987e5; --neg:#e66767;
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--page);font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
  .viz-root{background:var(--page);color:var(--text-primary);padding:40px 24px 72px;min-height:100vh}
  .wrap{max-width:880px;margin:0 auto}
  header h1{font-size:30px;font-weight:680;letter-spacing:-.02em;margin:0 0 6px}
  header p{color:var(--text-secondary);margin:0;font-size:15px;line-height:1.55}
  .meta{color:var(--muted);font-size:13px;margin-top:10px}
  .tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin:28px 0 8px}
  .tile{background:var(--surface-1);border:1px solid var(--border);border-radius:14px;padding:16px 18px}
  .tile .label{font-size:12px;font-weight:620;letter-spacing:.04em;text-transform:uppercase;color:var(--muted)}
  .tile .value{font-size:34px;font-weight:660;letter-spacing:-.02em;margin:6px 0 2px;font-variant-numeric:tabular-nums}
  .tile .note{font-size:12.5px;color:var(--text-secondary);line-height:1.45;margin-top:6px}
  .chip{display:inline-block;font-size:11.5px;font-weight:650;padding:3px 9px;border-radius:99px;margin-top:9px}
  .chip-good{background:color-mix(in srgb,var(--good) 16%,transparent);color:var(--good)}
  .chip-warn{background:color-mix(in srgb,var(--warn) 20%,transparent);color:#8a6100}
  .chip-bad{background:color-mix(in srgb,var(--crit) 15%,transparent);color:var(--crit)}
  @media (prefers-color-scheme:dark){:root:where(:not([data-theme="light"])) .chip-warn{color:var(--warn)}}
  :root[data-theme="dark"] .chip-warn{color:var(--warn)}
  section{background:var(--surface-1);border:1px solid var(--border);border-radius:16px;padding:22px 24px;margin-top:16px}
  section h2{font-size:17px;font-weight:660;margin:0 0 4px;letter-spacing:-.01em}
  section .sub{font-size:13.5px;color:var(--text-secondary);margin:0 0 14px;line-height:1.5}
  .chart{width:100%;height:auto;display:block;overflow:visible}
  .grid{stroke:var(--grid);stroke-width:1}
  .axis-line{stroke:var(--axis);stroke-width:1}
  .tick{fill:var(--muted);font-size:11px;font-variant-numeric:tabular-nums}
  .tick.mid{text-anchor:middle}
  .axis-title{fill:var(--muted);font-size:11.5px}
  .row-label{fill:var(--text-secondary);font-size:13px;text-anchor:end;font-weight:520}
  .bar-value{fill:var(--text-primary);font-size:12.5px;font-weight:620;font-variant-numeric:tabular-nums;dominant-baseline:middle}
  .bar-value-in{fill:#fff}
  .hover-band{fill:transparent}
  .bar-g:hover .hover-band,.dot-g:hover .hover-band{fill:color-mix(in srgb,var(--text-primary) 5%,transparent)}
  .dot-g:hover circle{r:7.5}
  .trend{stroke:var(--muted);stroke-width:2;stroke-dasharray:5 4;opacity:.75}
  .marker{stroke:var(--crit);stroke-width:2;stroke-dasharray:4 3}
  .marker-label{fill:var(--crit);font-size:11px;font-weight:620}
  .legend{display:flex;gap:16px;flex-wrap:wrap;margin:10px 0 0;font-size:12.5px;color:var(--text-secondary)}
  .legend i{width:10px;height:10px;border-radius:3px;display:inline-block;margin-right:6px;vertical-align:-1px}
  table{width:100%;border-collapse:collapse;font-size:13px;margin-top:6px}
  th,td{text-align:left;padding:7px 10px;border-bottom:1px solid var(--border);white-space:nowrap}
  th{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:620;cursor:pointer;user-select:none}
  th:hover{color:var(--text-primary)}
  td.num{text-align:right;font-variant-numeric:tabular-nums}
  .scroll{overflow-x:auto;max-height:460px;overflow-y:auto}
  .findings{margin:0;padding-left:20px;line-height:1.65;font-size:14.5px;color:var(--text-secondary)}
  .findings li{margin-bottom:9px}
  .findings b{color:var(--text-primary);font-weight:640}
  @media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
</style></head>
<body><div class="viz-root"><div class="wrap">
<header>
  <h1>Pocket Tactics — balance telemetry</h1>
  <p>${data.meta.finished.toLocaleString()} AI-vs-AI games simulated headlessly against the live rules engine.
  Every match is seeded and reproducible, so a rules change can be re-run against the same population.</p>
  <div class="meta">run “${esc(data.meta.tag)}” · seed ${data.meta.seed} · ${data.meta.rosterSize} Pokémon ·
  ${fmt(data.meta.elapsedSeconds ?? 0)}s · ${esc(String(data.meta.generatedAt).slice(0, 10))}</div>
</header>

<div class="tiles">
${tiles.map((t) => `<div class="tile"><div class="label">${esc(t.label)}</div><div class="value">${esc(t.value)}</div>${t.chip}<div class="note">${esc(t.note)}</div></div>`).join('')}
</div>

<section>
  <h2>Champion balance</h2>
  <p class="sub">Win rate per champion, measured against the 50% balance line. Bars right of centre are overperforming.</p>
  ${divergingBars(data.champions.map((c: any) => ({ name: c.name, winRate: c.winRate, n: c.n })))}
</section>

<section>
  <h2>Does paying more win games?</h2>
  <p class="sub">Each dot is one Pokémon: draft cost against win rate when drafted. A healthy economy slopes upward —
  flat means the premium tiers aren’t earning their price.</p>
  ${scatter(data.units.map((u: any) => ({ name: u.name, x: u.cost, y: u.winRate, tier: u.tier, n: u.n })))}
  <div class="legend">
    <span><i style="background:var(--series-1)"></i>Poké Ball tier</span>
    <span><i style="background:var(--series-2)"></i>Great Ball tier</span>
    <span><i style="background:var(--series-3)"></i>Ultra Ball tier</span>
    <span>— — trend (r = ${fmt(h.costVsWinCorrelation, 2)})</span>
  </div>
</section>

<section>
  <h2>How long games run</h2>
  <p class="sub">Distribution of game length in rounds. The marker is where champion fatigue begins — everything to its
  right is the engine forcing an ending rather than the players earning one.</p>
  ${histogram(lengthBuckets, { at: 20, label: 'fatigue starts' })}
</section>

<section>
  <h2>Economy over time</h2>
  <p class="sub">Average Poké Balls held per player at the start of each round.</p>
  ${line(data.curves.filter((c: any) => c.sample > 40).map((c: any) => ({ round: c.round, v: c.avgPoke })), (v) => fmt(v, 1))}
</section>

<section>
  <h2>Board population</h2>
  <p class="sub">Average non-champion Pokémon fielded per player. A rising line that never falls is the wall problem;
  a flat line near the cap means the board saturates.</p>
  ${line(data.curves.filter((c: any) => c.sample > 40).map((c: any) => ({ round: c.round, v: c.avgFielded })), (v) => fmt(v, 1), 'var(--series-2)')}
</section>

<section>
  <h2>Champion health</h2>
  <p class="sub">Average champion HP remaining. The slope is the real clock of the game — how fast the win condition
  actually approaches.</p>
  ${line(data.curves.filter((c: any) => c.sample > 40).map((c: any) => ({ round: c.round, v: c.avgChampHp })), (v) => pct(v, 0), 'var(--series-3)')}
</section>

<section>
  <h2>Every Pokémon</h2>
  <p class="sub">Full table — click a column to sort. Win rate is measured across games where the unit was drafted;
  deploy rate is how often a drafted card actually reached the field.</p>
  <div class="scroll"><table id="units">
    <thead><tr>
      <th data-k="name">Pokémon</th><th data-k="tier">Tier</th><th data-k="ptype">Type</th><th data-k="role">Role</th>
      <th data-k="cost" class="num">Cost</th><th data-k="winRate" class="num">Win rate</th>
      <th data-k="deployRate" class="num">Deployed</th><th data-k="avgDamage" class="num">Avg dmg</th><th data-k="n" class="num">n</th>
    </tr></thead>
    <tbody>
    ${unitRows.map((u: any) => `<tr>
      <td>${esc(u.name)}</td><td>${esc(u.tier)}</td><td>${esc(u.ptype)}</td><td>${esc(u.role)}</td>
      <td class="num">${u.cost}</td><td class="num">${pct(u.winRate)}</td>
      <td class="num">${pct(u.deployRate, 0)}</td><td class="num">${fmt(u.avgDamage)}</td><td class="num">${u.n}</td>
    </tr>`).join('')}
    </tbody>
  </table></div>
</section>

<section>
  <h2>Summons</h2>
  <p class="sub">Win rate when drafted, and how often a drafted summon actually gets cast per game.</p>
  <table><thead><tr><th>Summon</th><th class="num">Win rate</th><th class="num">Casts per draft</th><th class="num">n</th></tr></thead>
  <tbody>${data.summons.map((s: any) => `<tr><td>${esc(s.name)}</td><td class="num">${pct(s.winRate)}</td><td class="num">${fmt(s.castsPerDraft, 2)}</td><td class="num">${s.n}</td></tr>`).join('')}</tbody></table>
</section>

</div></div>
<script>
  // sortable table — the table view is also the accessibility relief for the charts
  const tbl = document.getElementById('units')
  if (tbl) {
    const rows = [...tbl.tBodies[0].rows]
    let dir = -1, last = ''
    tbl.tHead.addEventListener('click', (e) => {
      const th = e.target.closest('th'); if (!th) return
      const i = [...th.parentNode.children].indexOf(th)
      dir = last === th.dataset.k ? -dir : -1
      last = th.dataset.k
      const num = th.classList.contains('num')
      rows.sort((a, b) => {
        const av = a.cells[i].textContent.replace(/[%,]/g, ''), bv = b.cells[i].textContent.replace(/[%,]/g, '')
        return num ? (parseFloat(bv) - parseFloat(av)) * dir : bv.localeCompare(av) * dir
      })
      rows.forEach((r) => tbl.tBodies[0].appendChild(r))
    })
  }
</script>
</body></html>`

writeFileSync(new URL(`../docs/telemetry/${TAG}.html`, import.meta.url), html)
console.log(`wrote docs/telemetry/${TAG}.html (${(html.length / 1024).toFixed(0)} kB)`)
