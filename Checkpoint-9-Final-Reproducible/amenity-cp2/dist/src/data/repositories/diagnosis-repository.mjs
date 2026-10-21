export function createDiagnosisRepository(seed) {
  const cases = structuredClone(seed);
  return Object.freeze({
    async getByAmenityId(id) { const item = cases.find(x => x.amenity.id === id); return item ? structuredClone(item) : null; }
  });
}

// Existing overview stays unchanged; separate investigation records are addressable by case URL.
export function withInvestigationRecords(base, investigations) {
  return Object.freeze({
    list: () => base.list(),
    async getById(id) { return await base.getById(id) ?? (await investigations.getByAmenityId(id))?.amenity ?? null; }
  });
}
