import { createChangeViews } from './views/change-views.mjs';
import { renderResidentQuestionPreview } from './views/resident-evidence-plan.mjs';

// Routing/presentation orchestration. No statistical or data-source imports.
export async function startChangeApplication({ client, document, window, location }) {
  const root = document.querySelector('#app');
  root.textContent = 'Loading change evidence…';
  let overview;
  let generation = 0;
  const viewsFor = (payload, diagnosisEvidence = null, nextEvidence = null, residentEvidencePlan = null) => createChangeViews({ results: payload.entries ?? [payload.entry], parameters: payload.parameters, metricDefinitions: payload.metricDefinitions, simulationNotice: payload.simulationNotice, diagnosisEvidence, nextEvidence, residentEvidencePlan });
  async function render() {
    const request = ++generation;
    const hash = location.hash;
    const id = hash.match(/^#case\/([A-Za-z0-9-]+)$/)?.[1];
    const previewId = hash.match(/^#resident-preview\/([A-Za-z0-9-]+)$/)?.[1];
    try {
      if (!overview) overview = await client.getOverview();
      let html;
      if (previewId && typeof client.getResidentEvidencePlan === 'function') {
        try { html = renderResidentQuestionPreview(await client.getResidentEvidencePlan(previewId)); }
        catch { html = renderResidentQuestionPreview({ amenityId: previewId, result: { state: 'Unavailable' } }); }
      } else if (id) {
        try {
          const evidence = await client.getChangeEvidence(id);
          let diagnosisEvidence = null;
          if (typeof client.getCompetingDiagnosis === 'function') {
            try { diagnosisEvidence = await client.getCompetingDiagnosis(id); }
            catch { diagnosisEvidence = { result: { executionState: 'Unavailable' } }; }
          }
          let nextEvidence = null;
          if (typeof client.getNextBestEvidence === 'function') {
            try { nextEvidence = await client.getNextBestEvidence(id); }
            catch { nextEvidence = { result: { executionState: 'Unavailable' } }; }
          }
          let residentEvidencePlan = null;
          if (typeof client.getResidentEvidencePlan === 'function') {
            try { residentEvidencePlan = await client.getResidentEvidencePlan(id); }
            catch { residentEvidencePlan = { result: { state: 'Unavailable' } }; }
          }
          html = viewsFor(evidence, diagnosisEvidence, nextEvidence, residentEvidencePlan).evidence(id);
        }
        catch (error) { if (error.status !== 404) throw error; html = viewsFor(overview).evidence(id); }
      } else html = viewsFor(overview).overview();
      if (request !== generation) return;
      root.innerHTML = html;
      if (hash === '#parameters') { const panel = document.querySelector('#parameters'); panel.open = true; panel.scrollIntoView(); }
      else window.scrollTo(0, 0);
    } catch {
      if (request === generation) root.textContent = 'Change evidence could not be loaded. No amenity status has been inferred.';
    }
  }
  const onHashChange = () => { void render(); };
  window.addEventListener('hashchange', onHashChange);
  await render();
  return { render, dispose() { generation++; window.removeEventListener('hashchange', onHashChange); } };
}
