const base = { bookings: 100, uniqueUsers: 80, repeatUsers: 40 };
const start = Date.parse('2026-05-04T00:00:00Z');
const period = i => new Date(start + i * 7 * 86400000).toISOString().slice(0, 10);
function make(id, name, description, factors, options = {}) {
  const definitions = options.base ?? base;
  return {
    id, name, tier: options.tier ?? 'A', description,
    expectedStatus: options.expectedStatus,
    analysisPeriodStart: period(11),
    applicableSignals: Object.keys(definitions),
    observations: Array.from({ length: 12 }, (_, i) => ({
      periodStart: period(i),
      values: Object.fromEntries(Object.entries(definitions).map(([key, value]) => [key, i < 8 ? value : Math.round(value * (typeof factors[i - 8] === 'number' ? factors[i - 8] : factors[i - 8][key]))])),
      context: { type: 'normal' },
      maintenance: { ticketCount: 0, downtimeHours: 0 }
    }))
  };
}

export const fixtures = [
  make('A', 'Function Room', 'Case A · Temporary dip, then return near baseline', [0.40, 1.00, 1.01, 0.99], { expectedStatus: 'Stable' }),
  make('B', 'Community Hall', 'Case B · Persistent multi-signal decline', [0.72, 0.68, 0.65, 0.63], { expectedStatus: 'Needs Attention' }),
  make('C', 'Badminton Court', 'Case C · One metric changes; other signals stable', [0.60, 0.58, 0.59, 0.57].map(f => ({ bookings: f, uniqueUsers: 1, repeatUsers: 1 })), { expectedStatus: 'Monitoring' }),
  make('D', 'Multipurpose Room', 'Case D · Known closure affects observations', [1, 0.05, 0.05, 0.05], { expectedStatus: 'Monitoring' }),
  make('E', 'Meeting Room', 'Case E · Missing period and signal remain unknown', [1, 1, 1, 1], { expectedStatus: 'Monitoring' }),
  make('F', 'Clubhouse Gym', 'Case F · Tier B access signals; no booking metrics', [0.70, 0.67, 0.65, 0.62], { tier: 'B', base: { accessCount: 400, uniqueUsers: 100 }, expectedStatus: 'Needs Attention' }),
  make('S', 'Tennis Court', 'Reference · Stable observations', [1.01, 0.99, 1.02, 1], { expectedStatus: 'Stable' })
];
const closure = fixtures.find(x => x.id === 'D');
closure.observations.slice(9).forEach(row => { row.context = { type: 'closure', note: 'Known exceptional closure; recorded values do not represent ordinary availability.' }; row.maintenance = { ticketCount: 1, downtimeHours: 70 }; });
const missing = fixtures.find(x => x.id === 'E');
missing.observations = missing.observations.filter((_, i) => i !== 10);
missing.observations.at(-1).values.uniqueUsers = null;
delete missing.observations.at(-1).maintenance;

export const simulationNotice = 'All amenities and observations are simulated. Change detection only. No diagnosis or intervention is produced.';
