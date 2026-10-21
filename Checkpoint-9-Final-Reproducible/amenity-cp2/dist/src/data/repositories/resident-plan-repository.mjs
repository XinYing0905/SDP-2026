export function createResidentPlanRepository(seed) {
  const records = structuredClone(seed);
  return Object.freeze({ async getByAmenityId(id) { return structuredClone(records.find(r => r.amenityId === id) ?? null); } });
}
