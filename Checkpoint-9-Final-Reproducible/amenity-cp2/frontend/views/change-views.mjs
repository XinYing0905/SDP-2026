import { renderDiagnosisEvidence } from './diagnosis-evidence.mjs';
import { renderNextEvidence } from './next-evidence.mjs';
import { renderResidentEvidencePlan } from './resident-evidence-plan.mjs';
// Presentation only. Data and configuration are supplied by the service client.
export function createChangeViews({ results, parameters, metricDefinitions, simulationNotice, diagnosisEvidence = null, nextEvidence = null, residentEvidencePlan = null }) {

const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (value, unit = 'count') => value == null ? 'Unknown' : unit === 'rate' ? `${(value * 100).toFixed(1)}%` : value.toLocaleString('en', { maximumFractionDigits: 1 });
const signed = value => value == null ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(1)}`;
const badge = status => `<span class="badge ${status.toLowerCase().replaceAll(' ', '-')}"><i></i>${status}</span>`;
const shortDate = value => new Date(`${value}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const range = window => `${shortDate(window.start)} – ${shortDate(window.end)} 2026`;

function chart(metric, compact = false) {
  const width = 500, height = compact ? 100 : 150, left = 10, top = 12, bottom = height - 22;
  const values = metric.points.map(p => p.value).filter(v => v !== null);
  const max = Math.max(...values, metric.baselineValue ?? 0, 1) * 1.13;
  const x = i => left + i * (width - 2 * left) / (metric.points.length - 1);
  const y = v => bottom - (v / max) * (bottom - top);
  const baselineY = metric.baselineValue == null ? null : y(metric.baselineValue);
  let segments = [], current = [];
  metric.points.forEach((p, i) => { if (p.value === null) { if (current.length) segments.push(current); current = []; } else current.push(`${x(i)},${y(p.value)}`); });
  if (current.length) segments.push(current);
  const split = x(parameters.baselinePeriods) - (x(1) - x(0)) / 2;
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escape(metric.label)} baseline and current observations; gaps mean unknown">
    <rect x="${split}" y="0" width="${width - split}" height="${bottom + 4}" rx="6" fill="#eef3f8"/>
    ${baselineY === null ? '' : `<line x1="${left}" x2="${width - left}" y1="${baselineY}" y2="${baselineY}" stroke="#b5c2cf" stroke-dasharray="5 5"/>`}
    ${segments.map(s => `<polyline points="${s.join(' ')}" fill="none" stroke="#527b9a" stroke-width="2.5"/>`).join('')}
    ${metric.points.map((p, i) => p.value === null ? `<text x="${x(i)}" y="${bottom - 4}" text-anchor="middle" font-size="15" fill="#ad7923">?</text>` : `<circle cx="${x(i)}" cy="${y(p.value)}" r="${p.eligible ? 3.5 : 5}" fill="${p.eligible ? '#527b9a' : '#ffffff'}" stroke="${p.eligible ? '#527b9a' : '#ad7923'}" stroke-width="2"/>`).join('')}
    <text x="10" y="${height - 3}" font-size="10" fill="#778695">Historical baseline</text><text x="${split + 8}" y="${height - 3}" font-size="10" fill="#778695">Current window</text>
  </svg>`;
}
function header(active = 'Overview') {
  return `<header class="topbar"><a class="brand" href="#/"><span class="brand-mark">a<span>·</span></span><span>Amenity<span class="brand-light"> Decision Intelligence</span></span></a><div class="top-right"><span class="demo-dot"></span>Simulated township <span class="divider"></span><span class="cp-label">CHECKPOINT 02</span></div></header>
  <div class="shell"><aside><div class="aside-label">WORKSPACE</div><a class="nav-link ${active === 'Overview' ? 'active' : ''}" href="#/"><span>▦</span> Amenity overview</a><div class="aside-note"><span class="small-label">CURRENT SCOPE</span><strong>${diagnosisEvidence?.result?.executionState === 'Assessed' ? 'Change + evidence diagnosis' : 'Meaningful change'}</strong><p>Signals and context.<br>Investigation-worthy change.</p><span class="scope-pill">${diagnosisEvidence?.result?.executionState === 'Assessed' ? 'Detection + diagnosis' : 'Detection only'}</span></div><div class="aside-bottom">From signals to safer<br>intervention decisions.</div></aside><main>`;
}
function footer() { return `<footer>${escape(diagnosisEvidence?.result?.executionState === 'Assessed' ? 'All amenities and diagnosis evidence are simulated. Evidence Support is not causal probability. No intervention is recommended.' : simulationNotice)} Change Detection ≠ Diagnosis.</footer></main></div>`; }
function overview() {
  const counts = ['Stable', 'Monitoring', 'Needs Attention'].map(status => ({ status, count: results.filter(r => r.result.status === status).length }));
  return `${header()}<div class="eyebrow">AMENITY PERFORMANCE REVIEW <span>27 JUL 2026 · SIMULATED</span></div><div class="page-heading"><div><h1>Amenity overview</h1><p>Spot sustained change. Understand the evidence.</p></div><a class="quiet-button" href="#parameters">View parameters ↗</a></div>
  <div class="scope-banner"><span class="scope-icon">↗</span><div><strong>A change is a signal, not a diagnosis.</strong><p>Statuses identify changes worth investigating. They do not explain why a change occurred.</p></div></div>
  <section class="summary-grid" aria-label="Status summary">${counts.map(c => `<div class="summary-card"><span class="small-label">${c.status.toUpperCase()}</span><strong>${c.count.toString().padStart(2, '0')}</strong><span>${c.status === 'Stable' ? 'No sustained change established' : c.status === 'Monitoring' ? 'Partial signals or limited evidence' : 'Sustained, consistent signals'}</span></div>`).join('')}</section>
  <div class="section-heading"><h2>Observable amenities <span>${results.length}</span></h2><span>8-week baseline · 4-week current window</span></div>
  <div class="amenity-grid">${results.map(({ input, result: r }) => {
    const m = r.metrics[0];
    return `<a href="#case/${input.id}" class="amenity-card"><div class="card-top"><span class="tier">TIER ${input.tier}</span>${badge(r.status)}</div><h3>${escape(input.name)}</h3><div class="metric-line"><strong>${m.percentageChange == null ? '—' : `${signed(m.percentageChange)}%`}</strong><span>${escape(m.label.toLowerCase())}<br>vs historical baseline</span></div>${chart(m, true)}<div class="card-meta"><span>${r.signalConsistency.observed}/${r.metrics.length} sustained aligned signals</span><span>View evidence ↗</span></div>${r.contextualCaveats.some(c => c.type !== 'maintenance-context') ? '<div class="mini-warning">Known context affects interpretation</div>' : ''}${r.missingDataWarnings.length ? '<div class="mini-warning">Missing observations remain unknown</div>' : ''}</a>`;
  }).join('')}</div>${parameterPanel()}${footer()}`;
}
function parameterPanel() {
  const rows = [
    ['Period length', `${parameters.periodDays} days`], ['Baseline window', `${parameters.baselinePeriods} prior periods`], ['Current window', `${parameters.currentPeriods} periods`],
    ['Minimum persistence', `${parameters.minimumPersistence} consecutive periods ending latest`], ['Relative deviation', `${parameters.relativeDeviationThreshold * 100}% plus absolute floor`],
    ['Consistent signals', `${parameters.minimumConsistentSignals} in the same direction`], ['Minimum baseline / current coverage', `${parameters.minimumBaselineCoverage * 100}% / ${parameters.minimumCurrentCoverage * 100}%`],
    ...Object.entries(parameters.absoluteDeviationFloors).map(([key, v]) => [`Absolute floor · ${metricDefinitions[key].label}`, metricDefinitions[key].unit === 'rate' ? `${v * 100} percentage points` : `${v} count`]),
    ['Exceptional context', 'Exclude from behavioral means; break persistence'], ['Missing data', 'Unknown; no imputation; break persistence']
  ];
  return `<details class="parameters" id="parameters"><summary><span>Provisional MVP Parameters</span><span>${parameters.version} · expand</span></summary><p>Illustrative configuration, not scientifically universal thresholds. Defined in <code>src/config/change-detection.mjs</code>.</p><dl>${rows.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl></details>`;
}
function evidence(id) {
  const entry = results.find(x => x.input.id === id);
  if (!entry) return `${header('Evidence')}<h1>Case not found</h1><a href="#/">Return to overview</a>${footer()}`;
  const { input, result: r } = entry;
  return `${header('Evidence')}<div class="breadcrumb"><a href="#/">Amenity overview</a><span>/</span>Change evidence</div><div class="page-heading"><div><div class="eyebrow">TIER ${input.tier} · ${input.id === 'S' ? 'STABLE REFERENCE' : `CASE ${input.id}`} · SIMULATED OBSERVATIONS</div><h1>${escape(input.name)}</h1><p>${escape(input.description)}</p></div>${badge(r.status)}</div>
  <section class="status-explanation ${r.status.toLowerCase().replaceAll(' ', '-')}"><span class="small-label">WHY THIS STATUS?</span><p>${escape(r.explanation)}</p></section>
  <div class="window-bar"><div><span class="small-label">HISTORICAL BASELINE</span><strong>${range(r.baselineWindow)}</strong><span>${parameters.baselinePeriods} expected weekly periods</span></div><span class="window-arrow">→</span><div><span class="small-label">CURRENT OBSERVATIONS</span><strong>${range(r.currentWindow)}</strong><span>${parameters.currentPeriods} expected weekly periods</span></div><div><span class="small-label">ANALYSIS SCOPE</span><strong>Change detection only</strong><span>No explanation of cause</span></div></div>
  <section class="check-grid"><div><span class="small-label">01 · DEVIATION</span><strong>${r.metrics.filter(m => m.currentDirection).length} material signals</strong><p>Current mean vs own baseline. Relative threshold plus metric-specific absolute floor.</p></div><div><span class="small-label">02 · PERSISTENCE</span><strong>${r.metrics.filter(m => m.persistence.sustained).length} sustained signals</strong><p>At least ${parameters.minimumPersistence} consecutive eligible periods through the latest observation.</p></div><div><span class="small-label">03 · SIGNAL CONSISTENCY</span><strong>${r.signalConsistency.observed} / ${parameters.minimumConsistentSignals} required</strong><p>${r.signalConsistency.meetsRequirement ? 'Shared direction meets requirement.' : 'Shared-direction requirement not met.'} ${r.signalConsistency.direction ? escape(r.signalConsistency.direction.replaceAll('-', ' ')) : ''}</p></div></section>
  ${r.contextualCaveats.length ? `<section class="notice"><strong>Context affects interpretation</strong><ul>${r.contextualCaveats.map(c => `<li><b>${shortDate(c.periodStart)} · ${escape(c.type)}</b> — ${escape(c.note)} ${escape(c.interpretation)}</li>`).join('')}</ul></section>` : ''}
  ${r.missingDataWarnings.length ? `<section class="notice"><strong>Missing-data warnings · unknown stays unknown</strong><ul>${r.missingDataWarnings.map(w => `<li>${escape(w)}</li>`).join('')}</ul></section>` : ''}
  <div class="section-heading"><h2>Change evidence</h2><span>Hollow dots: exceptional context · ?: unknown</span></div>
  <section class="evidence-grid">${r.metrics.map(m => `<article class="evidence-card"><div class="evidence-title"><h3>${escape(m.label)}</h3><span class="evidence-chip">${!m.assessable ? 'Limited data' : m.persistence.sustained ? 'Sustained change' : m.latestDirection ? 'Current deviation' : 'No sustained change'}</span></div><div class="evidence-values"><div><span>Baseline mean</span><strong>${fmt(m.baselineValue, m.unit)}</strong></div><div><span>Current mean</span><strong>${fmt(m.currentValue, m.unit)}</strong></div><div><span>${m.unit === 'rate' ? 'Magnitude (pp)' : 'Change'}</span><strong>${m.unit === 'rate' ? signed(m.percentagePointChange) : m.percentageChange === null ? 'Not defined' : signed(m.percentageChange) + '%'}</strong></div></div>${chart(m)}<div class="evidence-bottom"><span>Persistence <b>${m.persistence.trailingPeriods}/${parameters.minimumPersistence}</b></span><span>Eligible baseline <b>${m.coverage.validBaseline}/${m.coverage.expectedBaseline}</b></span><span>Eligible current <b>${m.coverage.validCurrent}/${m.coverage.expectedCurrent}</b></span></div>${m.baselineValue === 0 ? '<p class="metric-note">Zero baseline: percentage change undefined; absolute magnitude is used.</p>' : ''}${!m.assessable ? '<p class="metric-note">Displayed available-value means are descriptive only; coverage is insufficient for a change conclusion.</p>' : ''}<div class="metric-note">Absolute change: ${m.magnitude === null ? 'Unknown' : signed(m.magnitude)} ${m.unit === 'rate' ? '(fraction)' : 'count'}</div></article>`).join('')}</section>
  <details class="observations"><summary>Inspect input observations <span>Raw simulated values · no imputation</span></summary><div class="table-scroll"><table><thead><tr><th>Week starting</th><th>Window</th>${r.metrics.map(m => `<th>${escape(m.label)}</th>`).join('')}<th>Context</th></tr></thead><tbody>${r.metrics[0].points.map((p, i) => `<tr><td>${p.periodStart}</td><td>${p.window}</td>${r.metrics.map(m => `<td>${fmt(m.points[i].value, m.unit)}</td>`).join('')}<td>${escape(p.context)}</td></tr>`).join('')}</tbody></table></div></details>
  ${renderDiagnosisEvidence(diagnosisEvidence)}${renderNextEvidence(nextEvidence)}${renderResidentEvidencePlan(residentEvidencePlan)}${parameterPanel()}${footer()}`;
}
return { overview, evidence };
}
