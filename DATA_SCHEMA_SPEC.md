# Amenity Decision Intelligence — Unified Data Specification (v1.0)

This document defines the unified data model, identifier schema, and lifecycle contracts across the Resident Mobile Touchpoint, Operator Command Center, Shared Backend (`node:sqlite`), and the Decision Review / ZIP Analysis Engine.

---

## 1. Core Data Entities

| Entity | Minimum Required Fields | Description & Lifecycle |
|---|---|---|
| **Facility** | `facilityId`, `name`, `location`, `type`, `tier`, `status`, `operatingHours`, `zipCaseId`, `description` | Global facility anchor. QR codes, resident fault tickets, operator dashboard items, and ZIP analytical models all share this identical `facilityId`. |
| **Resident Report** | `reportId`, `facilityId`, `category`, `description`, `locationDetail`, `contact`, `submittedAt`, `status`, `verificationNotes`, `verifiedBy`, `verifiedAt`, `maintenanceId` | **Public QR-scan submission**. Initial status is strictly `unverified`. Transitions to `verified_fault` or `dismissed` only after physical on-site inspection by facilities staff. |
| **Maintenance Record** | `maintenanceId`, `facilityId`, `reportIds`, `title`, `priority`, `assignee`, `status`, `downtimeHours`, `notes`, `createdAt`, `updatedAt` | Operational work order. Created when a resident report is verified as a physical fault or during routine maintenance. Status: `pending`, `in_progress`, `resolved`. |
| **Decision Review** | `reviewId`, `facilityId`, `evidenceVersion`, `analysisStatus`, `primarySignal`, `currentDiagnosis`, `explanationSufficiency`, `protectionSufficiency`, `evidenceGaps`, `selectedIntervention`, `approvalStatus` | Facility-level analytical review. Tracks changes in evidence over time (e.g. verified hardware defects vs. targeted resident surveys). |
| **Targeted Collection** | `collectionId`, `facilityId`, `questionId`, `questionText`, `targetCohort`, `status`, `openedAt`, `closedAt`, `responseCount` | **Invited resident inquiry** (e.g. long-term residents evaluating schedule fit). Strictly isolated from general public QR fault reports. |
| **Targeted Response** | `responseId`, `collectionId`, `facilityId`, `questionId`, `selectedOption`, `cohort`, `submittedAt` | Evidence response collected via invited cohort token. Used to resolve specific diagnostic uncertainties without community voting bias. |

---

## 2. Field Specifications and TypeScript Interfaces

### 2.1 Facility
```typescript
interface Facility {
  facilityId: string;        // Unique identifier, e.g. "court-badminton-1", "community-hall-4"
  name: string;              // Facility display name, e.g. "Badminton Court (Courts 1-3)"
  location: string;          // Specific location, e.g. "Sports Complex, Building 2, Ground Floor"
  type: string;              // Facility category, e.g. "Sports & Recreation", "Shared Community Space"
  tier: "A" | "B";           // Tier A (booking-based high-touch) | Tier B (access-badge based)
  status: "open" | "maintenance" | "monitored"; // Operational state
  operatingHours: string;    // e.g. "07:00 - 22:30"
  zipCaseId?: string;        // Corresponding baseline checkpoint fixture (e.g. "C", "B", "A", "D", "S")
  description: string;       // Facility description and equipment profile
}
```

### 2.2 Resident Report
```typescript
interface ResidentReport {
  reportId: string;          // Unique reference ID, e.g. "REP-MVHSZ3FM-7636"
  facilityId: string;        // Linked facility ID
  category: "lighting" | "equipment" | "cleanliness" | "hvac" | "safety" | "other";
  description: string;       // Resident's problem description
  locationDetail?: string;   // Specific court / zone, e.g. "Court 2 North End"
  contact?: string;          // Optional resident contact info or unit number
  submittedAt: string;       // ISO 8601 timestamp
  status: "unverified" | "verified_fault" | "dismissed"; // Enforced state machine
  verificationNotes?: string;// Staff on-site inspection findings
  verifiedBy?: string;       // Technician name / staff ID
  verifiedAt?: string;       // Verification timestamp
  maintenanceId?: string;    // Generated maintenance work order reference
}
```
> [!IMPORTANT]
> **Core Domain Rule**: A resident report claiming "lights are broken" is an **unverified observation**. It must NEVER be converted directly into confirmed equipment failure in the decision engine until facilities staff inspect the premises and confirm the fault via `/api/reports/:id/verify`.

### 2.3 Maintenance Record
```typescript
interface MaintenanceRecord {
  maintenanceId: string;     // Unique work order ID, e.g. "MNT-505677"
  facilityId: string;        // Linked facility ID
  reportIds: string[];       // Associated resident report IDs
  title: string;             // Work order title
  priority: "low" | "medium" | "high" | "urgent";
  assignee: string;          // Responsible technician / contractor
  status: "pending" | "in_progress" | "resolved";
  downtimeHours: number;     // Projected or actual downtime
  notes: string;             // Maintenance action notes
  createdAt: string;
  updatedAt: string;
}
```

### 2.4 Decision Review
```typescript
interface DecisionReview {
  reviewId: string;          // e.g. "rev-court-badminton-1"
  facilityId: string;
  evidenceVersion: number;   // Incremental version integer (1, 2, ...)
  analysisStatus: "monitoring" | "attention_needed" | "diagnosing" | "action_approved" | "outcome_reviewed";
  primarySignal: string;     // High-level signal summary
  currentDiagnosis: {
    label: string;
    rationale: string;
    keyFactors: string[];
    explanationSufficiency: "Low" | "Partial" | "High";
    protectionSufficiency: "Low" | "Moderate" | "High";
  };
  evidenceGaps: Array<{
    id: string;
    label: string;
    source: string;
    description: string;
    isHighestValue: boolean;
    status: "missing" | "in_progress" | "collected";
  }>;
  selectedIntervention?: string; // e.g. "Repair / Restore", "Reprogramme"
  approvalStatus: {
    isApproved: boolean;
    approvedBy?: string;
    approvedAt?: string;
    note?: string;
  };
}
```

### 2.5 Targeted Collection & Response
```typescript
interface TargetedCollection {
  collectionId: string;      // Matching CP6 collection ID, e.g. "col-hall-schedule-2026"
  facilityId: string;        // Linked facility ID: "community-hall-4"
  questionId: string;        // "q-schedule-fit"
  questionText: string;      // "How often does the current Community Hall schedule fit your needs?"
  options: string[];
  targetCohort: string;      // "Long-term residents (3+ years), Building 4"
  status: "open" | "closed";
  responseCount: number;
}

interface TargetedResponse {
  responseId: string;
  collectionId: string;
  facilityId: string;
  questionId: string;
  selectedOption: string;
  cohort: string;
  submittedAt: string;
}
```

---

## 3. The 12 Monitored Township Facilities & ZIP Case Mappings

| facilityId | Facility Name | Facility Type | Default State | ZIP Case Fixture | Primary Role |
|---|---|---|---|---|---|
| `court-badminton-1` | Badminton Court (Courts 1-3) | Sports & Recreation | `open` | Case C (Single-metric anomaly) | **Milestone 1 Walkthrough Case** (QR scan lighting defect & verification) |
| `community-hall-4` | Community Hall (Building 4) | Shared Community Space | `monitored` | Case B (Persistent booking decline) | **Targeted Survey & Rescheduling Case** (CP6-CP8 Core Workflow) |
| `tennis-court-west` | Tennis Court (West Wing) | Outdoor Sports Park | `open` | Case S (Stable baseline) | Healthy benchmark facility |
| `clubhouse-gym-1` | Clubhouse Fitness Centre | Fitness & Wellness | `open` | Case F (Tier B access badge data) | Badge swipe frequency facility |
| `function-room-a` | Function Room A | Civic & Events | `open` | Case A (Temporary dip, then returned) | Natural recovery benchmark |
| `multipurpose-room-d`| Multipurpose Activity Room D| Shared Community Space | `maintenance` | Case D (Known maintenance closure)| Scheduled maintenance closure |
| `meeting-room-e` | Meeting Room E | Business & Study | `open` | Case E (Missing observation period) | Data quality monitoring case |
| `swimming-pool-main` | Community Lap Pool | Aquatics & Swimming | `open` | Custom Tier A | High-frequency water quality monitoring |
| `squash-court-1` | Squash Court 1 | Sports & Recreation | `open` | Custom Tier A | Consumable equipment wear monitoring |
| `bbq-pavilion-north` | BBQ Pavilion (North Green) | Outdoor Social | `open` | Custom Tier B | Seasonal reservation monitoring |
| `children-playroom` | Children Indoor Playroom | Family & Children | `open` | Custom Tier B | Safety and hygiene inspection |
| `rooftop-study-lounge`| Rooftop Study Lounge | Study & Co-working | `open` | Custom Tier B | Quiet study space environment monitoring |

---

## 4. End-to-End Workflow Sequence (Milestone 1)

```
[Resident Mobile Client]                    [Shared Server / SQLite]               [Operator Command Center]
       |                                               |                                       |
       | 1. Scan facility QR code (?facilityId=court-badminton-1)                              |
       |---------------------------------------------->|                                       |
       |    GET /api/facilities/court-badminton-1      |                                       |
       |<----------------------------------------------|                                       |
       |    Renders facility details, location, status |                                       |
       |                                               |                                       |
       | 2. Submit lighting issue form                 |                                       |
       |---------------------------------------------->|                                       |
       |    POST /api/facilities/:id/reports           |                                       |
       |    (Inserted into SQLite with 'unverified')   |                                       |
       |<----------------------------------------------|                                       |
       |    Returns tracking reference ID ("REP-...")  |                                       |
       |                                               | 3. Operator refreshes or polls        |
       |                                               |<--------------------------------------|
       |                                               |    GET /api/reports                   |
       |                                               |-------------------------------------->|
       |                                               |    Displays unverified report badge   |
       |                                               |                                       |
       |                                               | 4. On-site staff inspects and verifies|
       |                                               |<--------------------------------------|
       |                                               |    POST /api/reports/:id/verify       |
       |                                               |    { action: "verify_fault",          |
       |                                               |      verificationNotes: "..." }       |
       |                                               |                                       |
       |                                               |    Updates status -> 'verified_fault' |
       |                                               |    Generates maintenance work order   |
       |                                               |    Upgrades facility evidence review  |
       |                                               |-------------------------------------->|
       |                                               |    Returns updated facility status    |
```
