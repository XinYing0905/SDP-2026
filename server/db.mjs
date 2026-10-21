import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const defaultDbPath = path.join(process.cwd(), 'data', 'adi-system.sqlite');

export function initDatabase(dbPath = defaultDbPath) {
  mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
  const db = new DatabaseSync(dbPath);

  // Enable WAL and foreign keys
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS facilities (
      facility_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      location TEXT NOT NULL,
      type TEXT NOT NULL,
      tier TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      operating_hours TEXT NOT NULL,
      zip_case_id TEXT,
      description TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS resident_reports (
      report_id TEXT PRIMARY KEY,
      facility_id TEXT NOT NULL REFERENCES facilities(facility_id),
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      location_detail TEXT,
      contact TEXT,
      submitted_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'unverified',
      verification_notes TEXT,
      verified_by TEXT,
      verified_at TEXT,
      maintenance_id TEXT
    );

    CREATE TABLE IF NOT EXISTS maintenance_records (
      maintenance_id TEXT PRIMARY KEY,
      facility_id TEXT NOT NULL REFERENCES facilities(facility_id),
      report_ids TEXT NOT NULL,
      title TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'medium',
      assignee TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      downtime_hours REAL NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS decision_reviews (
      review_id TEXT PRIMARY KEY,
      facility_id TEXT NOT NULL REFERENCES facilities(facility_id),
      evidence_version INTEGER NOT NULL DEFAULT 1,
      analysis_status TEXT NOT NULL DEFAULT 'monitoring',
      body TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS targeted_collections (
      collection_id TEXT PRIMARY KEY,
      facility_id TEXT NOT NULL REFERENCES facilities(facility_id),
      question_id TEXT NOT NULL,
      question_text TEXT NOT NULL,
      options TEXT NOT NULL,
      target_cohort TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS targeted_responses (
      response_id TEXT PRIMARY KEY,
      collection_id TEXT NOT NULL REFERENCES targeted_collections(collection_id),
      facility_id TEXT NOT NULL,
      question_id TEXT NOT NULL,
      selected_option TEXT NOT NULL,
      cohort TEXT NOT NULL,
      submitted_at TEXT NOT NULL
    );
  `);

  seedDefaultData(db);

  return db;
}

export const INITIAL_FACILITIES = [
  {
    facility_id: 'court-badminton-1',
    name: 'Badminton Court (Courts 1-3)',
    location: 'Sports Complex, Building 2, Ground Floor',
    type: 'Sports & Recreation',
    tier: 'A',
    status: 'open',
    operating_hours: '07:00 - 22:30',
    zip_case_id: 'C',
    description: 'Indoor 3-court multi-sport badminton facility equipped with high-bay LED floodlights. Focus facility for Milestone 1 fault reporting.'
  },
  {
    facility_id: 'community-hall-4',
    name: 'Community Hall (Building 4)',
    location: 'Building 4, Maplewood Township',
    type: 'Shared Community Space',
    tier: 'A',
    status: 'monitored',
    operating_hours: '08:00 - 21:00',
    zip_case_id: 'B',
    description: 'Shared township hall for resident gatherings, workshops, and private bookings. Experiencing sustained 8-week booking decline.'
  },
  {
    facility_id: 'tennis-court-west',
    name: 'Tennis Court (West Wing)',
    location: 'Outdoor Sports Park, West Wing',
    type: 'Outdoor Sports Park',
    tier: 'A',
    status: 'open',
    operating_hours: '06:30 - 21:30',
    zip_case_id: 'S',
    description: 'All-weather outdoor tennis courts with automated gate access. Reference benchmark with stable utilisation.'
  },
  {
    facility_id: 'clubhouse-gym-1',
    name: 'Clubhouse Fitness Centre',
    location: 'Clubhouse, Level 2',
    type: 'Fitness & Wellness',
    tier: 'B',
    status: 'open',
    operating_hours: '24 Hours',
    zip_case_id: 'F',
    description: 'Electronic access card-controlled gym with cardio and resistance equipment.'
  },
  {
    facility_id: 'function-room-a',
    name: 'Function Room A',
    location: 'Civic Pavilion, Block A',
    type: 'Civic & Events',
    tier: 'A',
    status: 'open',
    operating_hours: '09:00 - 22:00',
    zip_case_id: 'A',
    description: 'Civic multipurpose space for committee meetings, exhibitions, and resident assemblies.'
  },
  {
    facility_id: 'multipurpose-room-d',
    name: 'Multipurpose Activity Room D',
    location: 'Building 6, East Wing',
    type: 'Shared Community Space',
    tier: 'A',
    status: 'maintenance',
    operating_hours: 'Temporarily Closed',
    zip_case_id: 'D',
    description: 'Scheduled floor resurfacing and acoustic treatment in progress.'
  },
  {
    facility_id: 'meeting-room-e',
    name: 'Meeting Room E',
    location: 'Business & Study Hub, 2F',
    type: 'Business & Study',
    tier: 'A',
    status: 'open',
    operating_hours: '08:00 - 20:00',
    zip_case_id: 'E',
    description: 'Meeting room with audiovisual presentation setup and teleconference equipment.'
  },
  {
    facility_id: 'swimming-pool-main',
    name: 'Community Lap Pool',
    location: 'Aquatics Centre, Building 3',
    type: 'Aquatics & Swimming',
    tier: 'A',
    status: 'open',
    operating_hours: '06:00 - 21:00',
    zip_case_id: 'C',
    description: '25-meter 6-lane heated indoor lap pool with lifeguard observation station.'
  },
  {
    facility_id: 'squash-court-1',
    name: 'Squash Court 1',
    location: 'Sports Complex, Level 1',
    type: 'Sports & Recreation',
    tier: 'A',
    status: 'open',
    operating_hours: '08:00 - 22:00',
    zip_case_id: 'C',
    description: 'Standard glass-back squash court with sprung hardwood flooring.'
  },
  {
    facility_id: 'bbq-pavilion-north',
    name: 'BBQ Pavilion (North Green)',
    location: 'Township Central Park, North Area',
    type: 'Outdoor Social',
    tier: 'B',
    status: 'open',
    operating_hours: '11:00 - 22:00',
    zip_case_id: 'S',
    description: 'Covered outdoor barbecue pavilions with picnic bench seating and wash points.'
  },
  {
    facility_id: 'children-playroom',
    name: 'Children Indoor Playroom',
    location: 'Building 1, Ground Floor',
    type: 'Family & Children',
    tier: 'B',
    status: 'open',
    operating_hours: '09:00 - 19:30',
    zip_case_id: 'A',
    description: 'Soft-padded indoor play area with modular climbing structures and guardian seating.'
  },
  {
    facility_id: 'rooftop-study-lounge',
    name: 'Rooftop Study Lounge',
    location: 'Building 8, Rooftop Garden Level',
    type: 'Study & Co-working',
    tier: 'B',
    status: 'open',
    operating_hours: '07:00 - 23:00',
    zip_case_id: 'S',
    description: 'Quiet study tables with individual reading lighting and township Wi-Fi access.'
  }
];

function seedDefaultData(db) {
  const count = db.prepare('SELECT COUNT(*) as count FROM facilities').get().count;
  if (count > 0) return;

  const insertFacility = db.prepare(`
    INSERT INTO facilities (facility_id, name, location, type, tier, status, operating_hours, zip_case_id, description, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();
  for (const f of INITIAL_FACILITIES) {
    insertFacility.run(
      f.facility_id,
      f.name,
      f.location,
      f.type,
      f.tier,
      f.status,
      f.operating_hours,
      f.zip_case_id,
      f.description,
      now
    );
  }

  // Seed default targeted collection for Community Hall (matching CP6)
  const insertCollection = db.prepare(`
    INSERT INTO targeted_collections (collection_id, facility_id, question_id, question_text, options, target_cohort, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertCollection.run(
    'col-hall-schedule-2026',
    'community-hall-4',
    'q-schedule-fit',
    'How often does the current Community Hall schedule fit your needs?',
    JSON.stringify([
      'Almost always — I can usually book when I need to',
      'Sometimes — but I often find the slots I want are unavailable',
      "Rarely — the schedule doesn't match when I'm available",
      "I haven't tried to use the hall recently"
    ]),
    'Long-term residents (3+ years), Building 4',
    'open',
    now
  );

  // Seed default decision review for Community Hall
  const insertReview = db.prepare(`
    INSERT INTO decision_reviews (review_id, facility_id, evidence_version, analysis_status, body, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const initialHallReview = {
    reviewId: 'rev-community-hall-4',
    facilityId: 'community-hall-4',
    evidenceVersion: 1,
    analysisStatus: 'attention_needed',
    primarySignal: 'Sustained booking decline over 8 weeks (18 -> 8 sessions/week)',
    secondarySignals: [
      'No maintenance faults reported in period',
      'No resident complaints filed',
      'Booking pattern skews toward same 3 recurring groups',
      'Evening and weekend slots consistently empty'
    ],
    diagnosis: {
      label: 'Persistent Programme / Configuration Mismatch',
      rationale: 'The sustained, gradual decline without maintenance issues suggests the current hall schedule and booking structure no longer match when and how residents want to use the space.',
      keyFactors: [
        'No operational faults to explain decline',
        'Booking concentration in fixed recurring groups',
        'Evening and weekend slots persistently unused'
      ],
      explanationSufficiency: 'Partial',
      protectionSufficiency: 'Low'
    },
    evidenceGaps: [
      {
        id: 'gap-001',
        source: 'resident input',
        label: 'Resident Schedule Preferences',
        description: 'Direct resident input on whether the current hall timetable matches their availability.',
        rank: 1,
        isHighestValue: true,
        status: 'missing'
      },
      {
        id: 'gap-002',
        source: 'cohort comparison',
        label: 'Cohort Usage Comparison',
        description: 'Compare booking patterns across Building 4 cohorts to identify underserved groups.',
        rank: 2,
        isHighestValue: false,
        status: 'missing'
      },
      {
        id: 'gap-003',
        source: 'physical inspection',
        label: 'Physical Condition Verification',
        description: 'Confirm the hall is free of physical or environmental issues that deter use.',
        rank: 3,
        isHighestValue: false,
        status: 'missing'
      }
    ],
    selectedIntervention: null,
    approvalStatus: {
      isApproved: false
    }
  };

  insertReview.run(
    'rev-community-hall-4',
    'community-hall-4',
    1,
    'attention_needed',
    JSON.stringify(initialHallReview),
    now
  );

  // Seed default decision review for Badminton Court
  const initialBadmintonReview = {
    reviewId: 'rev-court-badminton-1',
    facilityId: 'court-badminton-1',
    evidenceVersion: 1,
    analysisStatus: 'monitoring',
    primarySignal: 'Single-metric dip detected in evening peak bookings',
    secondarySignals: [
      'Court 2 utilization down 35% compared to baseline',
      'Court 1 and 3 remain at normal 92% capacity',
      'Resident reports under review'
    ],
    diagnosis: {
      label: 'Suspected Localized Operational Deterioration',
      rationale: 'Isolated utilization dip specific to Court 2 suggests physical environment defect (e.g. lighting or flooring) rather than township-wide scheduling mismatch.',
      keyFactors: [
        'Dip is localized to one court only',
        'Surrounding courts operating normally',
        'Awaiting physical inspection verification'
      ],
      explanationSufficiency: 'Partial',
      protectionSufficiency: 'Moderate'
    },
    evidenceGaps: [
      {
        id: 'gap-court-01',
        source: 'physical inspection',
        label: 'Court 2 Lighting & Net Inspection',
        description: 'Inspect overhead luminaire ballast and net tension on Court 2.',
        rank: 1,
        isHighestValue: true,
        status: 'missing'
      }
    ],
    selectedIntervention: 'Repair / Restore',
    approvalStatus: {
      isApproved: false
    }
  };

  insertReview.run(
    'rev-court-badminton-1',
    'court-badminton-1',
    1,
    'monitoring',
    JSON.stringify(initialBadmintonReview),
    now
  );
}
