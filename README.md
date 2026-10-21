# Township Amenity Decision Intelligence (ADI) System

A unified platform connecting Resident Mobile QR fault reporting, On-site Facilities Verification, and Operator Command Center Decision Intelligence, backed by local SQLite persistence.

---

## Quick Start for Teammates

### 1. Prerequisites
- **Node.js** v22.0.0 or higher (v24.15.0 recommended).
- No external databases, tokens, or global packages are needed. Native SQLite (`node:sqlite`) is built directly into Node.js.

### 2. Run the Application
Open PowerShell or your terminal inside this project folder:

```powershell
# Start the unified backend & static server
npm start
```

### 3. Open in Browser
- **Operator Command Center:**  
  [http://localhost:3000/operator.html](http://localhost:3000/operator.html)
- **Resident Mobile QR View (Badminton Court):**  
  [http://localhost:3000/resident.html?facilityId=court-badminton-1](http://localhost:3000/resident.html?facilityId=court-badminton-1)
- **Targeted Evidence Survey (Community Hall):**  
  [http://localhost:3000/resident.html?mode=targeted](http://localhost:3000/resident.html?mode=targeted)

---

## How to Test the System

### 1. Automated Integration & API Test Suite
Run the automated end-to-end test suite using Node's native test runner:

```powershell
npm test
```

This verifies:
- Serving of Operator & Resident static portals (`/operator.html`, `/resident.html`).
- Facility catalog overview and pre-seeded SQLite records (`/api/facilities`).
- Resident defect report submission in the strictly required `unverified` state.
- Facilities technician on-site physical inspection and state transition to `verified_fault`.
- Automatic dispatch of maintenance work orders (`MNT-...`).
- Decision review update with diagnostic sufficiency and precedent case retrieval.
- Intervention plan selection and Operator approval recording.
- Targeted resident survey collection and cohort response processing.

### 2. Manual / Interactive Verification Walkthrough

#### Flow A: Resident Fault Reporting & Staff Verification
1. Start the server: `npm start` (if not already running).
2. Open Resident QR View: [http://localhost:3000/resident.html?facilityId=court-badminton-1](http://localhost:3000/resident.html?facilityId=court-badminton-1).
3. Select **Lighting** fault, type a description (e.g. `Court 2 luminaire flickering`), and click **Submit Report**.
4. Note the generated reference ID (`REP-...`) and notice the badge indicates **Pending Staff Verification**.
5. Switch to Operator Command Center: [http://localhost:3000/operator.html](http://localhost:3000/operator.html).
6. Click the **Reports & Maintenance** tab. You will see the new submission listed as `Unverified`.
7. Click **Inspect on Site** / **Verify Fault** and confirm.
8. Observe:
   - A maintenance work order (`MNT-...`) is automatically generated.
   - The status updates to `Verified Fault`.
   - The facility review at [http://localhost:3000/operator.html](http://localhost:3000/operator.html) reflects high sufficiency for hardware defect repair.

#### Flow B: Targeted Evidence Survey
1. Open Targeted Resident Survey: [http://localhost:3000/resident.html?mode=targeted](http://localhost:3000/resident.html?mode=targeted).
2. Answer the survey question regarding Community Hall scheduling.
3. Submit and verify confirmation.

#### Flow C: Underlying Decision Intelligence Engine Tests
To run the 409 unit tests for the core analytical engine (CP1–CP8):

```powershell
cd Checkpoint-9-Final-Reproducible/amenity-cp2
npm test
```

---

## How It Works

1. **Local SQLite Database (`data/adi-system.sqlite`):**
   - Pre-seeds 12 township facilities, initial decision reviews, and targeted survey collections automatically on first startup.
   - All reports, verification signatures, and maintenance tickets persist locally across restarts and refreshes.
2. **Minimal Flow (Milestone 1):**
   - Resident scans QR code at `court-badminton-1` and submits a lighting defect report.
   - Report appears in Operator under **Reports & Maintenance** as `Unverified`.
   - On-duty technician clicks **Inspect on Site** and confirms the fault.
   - Work order (`MNT-...`) is dispatched and decision review is updated to a confirmed hardware defect with `High Sufficiency`.

---

## Project Structure

```text
SDP/
├── operator.html              # Operator Command Center (Dashboard & Reviews)
├── resident.html              # Resident Mobile Touchpoint (QR & Reporting)
├── package.json               # Project manifest and start scripts
├── DATA_SCHEMA_SPEC.md        # Shared data schema and ID contracts
├── .gitignore                 # Excluded dependencies and temporary lock files
├── server/
│   ├── app.mjs                # Unified HTTP server & REST APIs
│   ├── db.mjs                 # SQLite schema & pre-seeded 12 facilities
│   └── adapter.mjs            # Domain conversion layer (unverified vs confirmed faults)
└── data/
    └── adi-system.sqlite      # Local SQLite database file
```
