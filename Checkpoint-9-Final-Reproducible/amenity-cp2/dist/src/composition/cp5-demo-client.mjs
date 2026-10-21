import { createDemoChangeClient } from './demo-client.mjs';
import { nextEvidenceCases } from '../data/synthetic/next-evidence-cases.mjs';
import { makeResidentPlanInput } from '../data/synthetic/resident-evidence-plan-cases.mjs';
import { createResidentPlanRepository } from '../data/repositories/resident-plan-repository.mjs';
import { createResidentEvidencePlanService } from '../services/resident-evidence-plan-service.mjs';
import { createResidentPlanClient, createLocalResidentPlanTransport } from '../api/resident-plan-client.mjs';
// Additive composition: every CP1–CP4 module/client/contract remains unchanged.
export async function createCp5DemoClient() {
  const upstreamClient = createDemoChangeClient();
  const seed = [];
  for (const c of nextEvidenceCases) seed.push(await makeResidentPlanInput(c.amenity.id, upstreamClient));
  const planningRepository = createResidentPlanRepository(seed);
  const service = createResidentEvidencePlanService({ upstreamClient, planningRepository });
  return createResidentPlanClient({ upstreamClient, transport: createLocalResidentPlanTransport(service) });
}
