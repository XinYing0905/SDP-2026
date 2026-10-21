import { CONTRACT_VERSION, ChangeServiceError, wireClone } from '../shared/change-contract.mjs';

// Application service: repository and statistical implementation are injected.
export function createChangeEvidenceService({ repository, detectChange, parameters, metricDefinitions, simulationNotice }) {
  const config = structuredClone(parameters);
  const definitions = structuredClone(metricDefinitions);
  const common = () => ({ contractVersion: CONTRACT_VERSION, dataProvenance: 'Simulated input data', parameters: config, metricDefinitions: definitions, simulationNotice });
  const analyze = record => ({
    input: { id: record.id, name: record.name, tier: record.tier, description: record.description },
    result: detectChange(record, config)
  });
  return Object.freeze({
    async getOverview() { return wireClone({ ...common(), kind: 'overview', entries: (await repository.list()).map(analyze) }); },
    async getChangeEvidence(id) {
      const record = await repository.getById(id);
      if (!record) throw new ChangeServiceError('AMENITY_NOT_FOUND', 'Amenity not found', 404);
      return wireClone({ ...common(), kind: 'evidence', entry: analyze(record) });
    }
  });
}
