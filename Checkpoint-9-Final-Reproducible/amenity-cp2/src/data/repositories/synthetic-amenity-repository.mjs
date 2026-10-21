// Implements the repository interface in shared/change-models.d.ts. No rendering or analysis.
export function createSyntheticAmenityRepository(seed) {
  const records = structuredClone(seed);
  return Object.freeze({
    async list() { return structuredClone(records); },
    async getById(id) { const record = records.find(record => record.id === id); return record ? structuredClone(record) : null; }
  });
}
