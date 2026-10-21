// Delivery-only export. Runtime HTML contains rendered snapshots + navigation, no product engines.
import fs from 'node:fs/promises';
import { productPresentation } from './cp5-storytelling.mjs';
import { createDemoChangeClient } from '../src/composition/demo-client.mjs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { renderResidentEvidencePlan, renderResidentQuestionPreview } from '../frontend/views/resident-evidence-plan.mjs';
import { renderNextEvidence } from '../frontend/views/next-evidence.mjs';
const root = path.resolve(import.meta.dirname, '..'), out = path.resolve(root, '../checkpoint-5-review');
const artifact = path.join(out, 'Checkpoint-5-Interactive-Preview.html');
const cases = JSON.parse(await fs.readFile(path.join(out, 'Acceptance-Cases-A-X.json'), 'utf8')).cases;
const protectedPaths = ['src', 'frontend', 'tests'];
async function fingerprints() {
  const result = {};
  for (const dir of protectedPaths) for (const p of await fs.readdir(path.join(root, dir), { recursive: true })) {
    if (!/\.(mjs|css|html|ts|json)$/.test(p)) continue;
    const file = path.join(dir, p);
    result[file] = crypto.createHash('sha256').update(await fs.readFile(path.join(root, file))).digest('hex');
  }
  return result;
}
const before = await fingerprints();
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const css = (await Promise.all(['styles.css', 'next-evidence.css', 'resident-evidence-plan.css'].map(f => fs.readFile(path.join(root, 'frontend', f), 'utf8')))).join('\n').replace(/@import\s+url\([^;]+;/g, '');
const quickCases = ['C', 'D', 'E', 'I', 'Q', 'S', 'W', 'A'];
const quick = quickCases.map(c => `<a href="#operator/${c}/pair">Case ${c}</a>`).join('');
const labels = { C: 'Selected programme-fit pair', D: 'Pair tie', E: 'Unresolved protection question tie', I: 'No valid pair', Q: 'Stale input', S: 'Neutral dependency wording', W: 'Unable to assess versus voluntary skip', A: 'Not eligible — inspection winner' };
const cards = cases.map(c => `<a class="review-case" href="#operator/${c.case}/pair"><span class="small-label">CASE ${c.case}</span><h3>${esc(labels[c.case] ?? c.description)}</h3><p>${esc(c.actualState)}</p><span>Open Operator case →</span></a>`).join('');
const templates = [];
templates.push(`<template id="screen-qa"><main class="review-main"><div class="eyebrow">CP5 · OFFLINE / READ-ONLY REVIEW</div><h1>Operator &amp; Resident previews</h1><p>One file. All case screens, styles and navigation are included. Start with Case C to review the selected question and the separate mobile Resident Preview.</p><p>Other cases demonstrate ties, unavailable pairs, stale input and resident-input restrictions. All data is simulated. No answers can be submitted or stored.</p><h2>Priority review cases</h2><nav class="review-shortcuts">${quick}</nav><h2>All 24 acceptance cases</h2><div class="review-cases">${cards}</div></main></template>`);
for (const c of cases) {
  const letter = c.case, envelope = { contractVersion: 'resident-evidence-plan.v1', amenityId: c.input.amenityId, result: c.output };
  let operator = renderResidentEvidencePlan(envelope).replaceAll(`href="#resident-preview/${c.input.amenityId}"`, `href="#resident/${letter}"`);
  // Tie cases show their actual alternative wording without selecting a pair or enabling a resident question.
  const alternatives = c.output.selectedPair ? '' : [...new Map(c.output.pairs.filter(p => p.eligible).map(p => [p.questionId, p])).values()].map(p => `<article class="evidence-card"><span class="small-label">UNSELECTED ALTERNATIVE · ${esc(p.targetGapId)}</span><h3>${esc(p.wording)}</h3><p>Documented current-use/relevant-knowledge cohort; dependency is not assumed. No pair is selected and no Resident question is enabled.</p></article>`).join('');
  const upstream = renderNextEvidence(c.input.nextEvidenceEnvelope);
  templates.push(`<template id="screen-operator-${letter}"><main class="review-main"><div class="review-page-heading"><div><span class="eyebrow">OPERATOR · CASE ${letter} · SIMULATED ACCEPTANCE FIXTURE</span><h1>${esc(labels[letter] ?? c.description)}</h1><p>${esc(c.description)}</p></div><a class="quiet-button" href="#qa">All review cases</a></div><nav class="review-shortcuts"><a href="#operator/${letter}/pair">Jump to Best Question × Best Cohort</a>${c.output.selectedPair ? `<a href="#resident/${letter}">Open mobile Resident Preview</a>` : '<span>No Resident question selected</span>'}</nav>${operator}${alternatives ? `<section class="review-alternatives"><h2>Question wording under review — alternatives only</h2>${alternatives}</section>` : ''}<details class="observations"><summary>Inspect the unchanged CP4 evidence-source context</summary>${upstream}</details><p class="metric-note">Acceptance-case snapshots only. No source reranking, response collection, evidence update, diagnosis reassessment, intervention or AI runs in this file.</p></main></template>`);
  const resident = renderResidentQuestionPreview(envelope).replaceAll(`href="#case/${c.input.amenityId}"`, `href="#operator/${letter}/pair"`);
  templates.push(`<template id="screen-resident-${letter}"><section class="resident-review-stage"><nav class="review-shortcuts"><a href="#operator/${letter}/pair">← Back to Operator · Case ${letter}</a><a href="#qa">All review cases</a></nav><p class="resident-stage-label">${c.output.selectedPair ? 'SEPARATE RESIDENT EXPERIENCE · MOBILE PREVIEW' : 'RESIDENT PREVIEW BLOCKED · NO PAIR SELECTED'}</p><div class="phone-shell"><div class="phone-speaker" aria-hidden="true"></div><div class="phone-content">${resident}</div><div class="phone-home" aria-hidden="true"></div></div><p class="resident-readonly">Static preview only — no option selection, submission, storage or network requests.</p></section></template>`);
}
const canonical = cases.find(c => c.case === 'C');
const demoClient = createDemoChangeClient();
const change = (await demoClient.getChangeEvidence(canonical.input.amenityId)).entry.result;
const overview = (await demoClient.getOverview()).entries.filter(e => ['A','C','D','E','F','S'].includes(e.input.id));
const product = productPresentation(canonical, esc,
  renderResidentEvidencePlan({ contractVersion: 'resident-evidence-plan.v1', amenityId: canonical.input.amenityId, result: canonical.output }).replaceAll('href="#resident-preview/NB-C"', 'href="#demo/resident"'),
  renderNextEvidence(canonical.input.nextEvidenceEnvelope), change, overview);
templates.push(...product.templates);
const manifest = Object.fromEntries(cases.map(c => [c.case, { state: c.actualState, selected: Boolean(c.output.selectedPair) }]));
const navigation = `
(() => {
  'use strict';
  const cases = ${JSON.stringify(manifest)};
  const app = document.getElementById('review-app');
  const screenLabel = document.getElementById('screen-label');
  function resolveRoute(hash) {
    if (!hash || hash === '#home') return { template: 'screen-home', label: 'Amenity Overview · Product Demo', jump: false };
    if (hash === '#qa') return { template: 'screen-qa', label: 'Technical QA / Acceptance Cases', jump: false };
    if (['#demo/evidence', '#demo/pair', '#demo/resident', '#demo/amenity-A', '#demo/amenity-C', '#demo/amenity-D', '#demo/amenity-E', '#demo/amenity-F', '#demo/amenity-S'].includes(hash)) return { template: 'screen-demo-' + hash.split('/')[1], label: hash === '#demo/resident' ? 'Resident Preview' : 'Community Hall · Product Demo', jump: false };
    const match = /^#(operator|resident)\\/([A-X])(?:\\/(pair))?$/.exec(hash);
    if (!match || !cases[match[2]] || (match[1] === 'resident' && match[3])) return { template: 'screen-home', label: 'Amenity Overview · Product Demo', jump: false };
    return { template: 'screen-' + match[1] + '-' + match[2], label: (match[1] === 'operator' ? 'Operator' : 'Resident preview') + ' · Case ' + match[2] + ' · ' + cases[match[2]].state, jump: match[1] === 'operator' && match[3] === 'pair' };
  }
  function render() {
    const route = resolveRoute(location.hash);
    const template = document.getElementById(route.template);
    app.replaceChildren(template.content.cloneNode(true));
    screenLabel.textContent = route.label;
    document.title = 'Amenity Decision Intelligence';
    if (route.jump) document.getElementById('resident-evidence-plan')?.scrollIntoView({ block: 'start' });
    else window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', render);
  // Re-clicking a current jump link must still scroll to the plan section.
  document.addEventListener('click', event => {
    const anchor = event.target.closest?.('a[href^="#"]');
    if (anchor && anchor.getAttribute('href') === location.hash) { event.preventDefault(); render(); }
  });
  render();
})();`;
new vm.Script(navigation); // Syntax verification of the exact embedded navigation code.
const html = `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'"><title>Amenity Decision Intelligence</title><style>${css}
${product.css}
html{scroll-padding-top:112px}body{background:#f6f8fa;color:#263b49;font-family:Arial,sans-serif}a:focus-visible{outline:3px solid #3b8f91;outline-offset:3px}[hidden]{display:none!important}
.review-toolbar{position:sticky;top:0;z-index:20;background:#fff;border-bottom:1px solid #dfe6eb;padding:14px 24px;display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap}.review-toolbar a{font-weight:700;color:#2d6971}.review-toolbar small{display:block;color:#627783;margin-top:5px}.review-shortcuts{display:flex;flex-wrap:wrap;gap:9px;margin:20px 0}.review-shortcuts a{display:inline-block;padding:10px 14px;border:1px solid #cbdde0;border-radius:6px;background:#fff;color:#315f68;font-size:12px}.review-shortcuts span{font-size:12px;padding:10px;color:#6c7f89}
.review-main{width:100%;max-width:1240px;margin:0 auto;padding:32px 28px}.review-main>p{font-size:14px;line-height:1.7}.review-page-heading{display:flex;align-items:center;justify-content:space-between;gap:22px}.review-page-heading h1{margin-top:12px}.review-cases{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-top:20px}.review-case{display:block;background:white;border:1px solid #dfe6eb;border-radius:8px;padding:20px}.review-case h3{margin:12px 0;font-size:17px;line-height:1.5}.review-case p{font-size:13px}.review-case>span:last-child{font-size:12px;color:#315f68}.review-alternatives .evidence-card{margin-top:14px}.review-alternatives h3{line-height:1.6}#resident-evidence-plan{scroll-margin-top:112px}
.resident-review-stage{padding:24px;min-height:calc(100vh - 90px);background:#eaf0f2}.resident-review-stage>.review-shortcuts{max-width:700px;margin:0 auto 24px}.resident-stage-label{text-align:center;font-size:11px;letter-spacing:1px;color:#506b78;margin-bottom:20px}.phone-shell{width:min(414px,100%);margin:0 auto;border:9px solid #263b49;border-radius:35px;background:#fafcfd;box-shadow:0 14px 30px #263b491c;overflow:hidden}.phone-speaker{width:72px;height:5px;background:#263b49;border-radius:9px;margin:12px auto}.phone-content .resident-preview{width:100%;margin:0;padding:22px 18px 12px}.phone-content h1{font-size:25px;line-height:1.3}.phone-content h2{font-size:18px;line-height:1.55}.phone-content .evidence-card{padding:17px}.phone-content .small-label{font-size:8px;line-height:1.8}.phone-content .preview-options li{font-size:13px;line-height:1.5;padding:13px 11px}.phone-content p{font-size:12px;line-height:1.7}.phone-home{width:105px;height:4px;background:#8da0ab;border-radius:6px;margin:16px auto 10px}.resident-readonly{max-width:430px;margin:22px auto;text-align:center;font-size:12px;line-height:1.7;color:#536d79}
@media(max-width:800px){.review-cases{grid-template-columns:repeat(2,minmax(0,1fr))}.review-page-heading{display:block}.review-main{padding:24px 16px}.review-toolbar{padding:12px 16px}.review-toolbar small{font-size:10px}.resident-review-stage{padding:20px 12px}}@media(max-width:500px){.review-cases{grid-template-columns:1fr}.phone-shell{border-width:6px}.review-toolbar{position:relative}html{scroll-padding-top:12px}#resident-evidence-plan{scroll-margin-top:12px}}
</style></head><body><header class="review-toolbar"><div><a href="#home">Amenity Decision Intelligence</a><small>From signals to safer intervention decisions.</small><small id="screen-label" aria-live="polite" class="route-label"></small></div><nav class="demo-mode-nav" aria-label="Review modes"><a href="#home">Product Demo</a><a href="#qa">Technical QA</a></nav></header><div id="review-app"></div><noscript><p>This self-contained review needs JavaScript enabled for internal screen navigation. No network or server is required.</p></noscript>${templates.join('\n')}<script>${navigation}</script></body></html>`;
// Check every actual anchor against the exact route resolver and target templates.
const ids = new Set([...html.matchAll(/<template id="([^"]+)"/g)].map(m => m[1]));
const links = [...html.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
const badLinks = links.filter(h => !['#home', '#qa', ...['#demo/evidence', '#demo/pair', '#demo/resident', '#demo/amenity-A', '#demo/amenity-C', '#demo/amenity-D', '#demo/amenity-E', '#demo/amenity-F', '#demo/amenity-S']].includes(h) && !/^#(operator|resident)\/[A-X](?:\/pair)?$/.test(h));
// Execute navigation with an offline DOM stand-in for every case, including blocked residents/back routes.
const navigated = [];
let rendered = null, hashHandler;
const nodes = Object.fromEntries([...ids].map(id => [id, { content: { cloneNode: () => ({ id }) } }]));
nodes['review-app'] = { replaceChildren: node => { rendered = node.id; } };
nodes['screen-label'] = { textContent: '' };
nodes['resident-evidence-plan'] = { scrollIntoView() {} };
const context = { document: { getElementById: id => nodes[id], addEventListener() {}, title: '' }, location: { hash: '#home' }, window: { addEventListener: (name, fn) => { if (name === 'hashchange') hashHandler = fn; }, scrollTo() {} } };
vm.runInNewContext(navigation, context);
for (const c of cases) for (const screen of ['operator', 'resident']) {
  context.location.hash = `#${screen}/${c.case}${screen === 'operator' ? '/pair' : ''}`; hashHandler();
  const expected = `screen-${screen}-${c.case}`;
  if (rendered !== expected) throw new Error(`Unresolved route: ${context.location.hash}`);
  navigated.push(context.location.hash);
}
for (const href of links) {
  context.location.hash = href; hashHandler();
  const match = /^#(operator|resident)\/([A-X])(?:\/pair)?$/.exec(href);
  const expected = href === '#home' ? 'screen-home' : href === '#qa' ? 'screen-qa' : href.startsWith('#demo/') ? 'screen-demo-' + href.split('/')[1] : match ? `screen-${match[1]}-${match[2]}` : null;
  if (!expected || rendered !== expected || !ids.has(rendered)) badLinks.push(href);
}
const hasExternalResources = /@import|<script[^>]+src=|<link\b|<iframe\b|\b(?:src|href)="(?!#|data:)/i.test(html);
if (badLinks.length || hasExternalResources) throw new Error('Review artifact contains unresolved/external links: ' + badLinks.join(', '));
await fs.writeFile(artifact, html);
const after = await fingerprints();
if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Approved application/test files changed during export.');
const verification = { artifact: path.basename(artifact), cases: cases.length, embeddedScreens: ids.size, internalAnchorsVerified: links.length, offlineRoutesExercised: navigated, allLinksInternallyResolved: true, externalResources: false, networkCalls: false, applicationAndTestsUnchanged: true, snapshotDataOnly: true, mobileResidentShell: true };
await fs.writeFile(path.join(out, 'Interactive-Preview-Verification.json'), JSON.stringify(verification, null, 2));
console.log(JSON.stringify({ ...verification, offlineRoutesExercised: navigated.length, bytes: Buffer.byteLength(html) }, null, 2));
