import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

let BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
let spawnedServer = null;

test.before(async () => {
  try {
    const res = await fetch(`${BASE_URL}/api/facilities`, { signal: AbortSignal.timeout(1200) });
    if (res.ok) return;
  } catch {
    // If no running server is detected, start a dedicated test server on port 3099
    BASE_URL = 'http://127.0.0.1:3099';
    spawnedServer = spawn(process.execPath, ['server/app.mjs'], {
      env: { ...process.env, PORT: '3099' },
      stdio: 'ignore'
    });

    for (let i = 0; i < 25; i++) {
      await new Promise((r) => setTimeout(r, 200));
      try {
        const res = await fetch(`${BASE_URL}/api/facilities`, { signal: AbortSignal.timeout(600) });
        if (res.ok) return;
      } catch {
        // continue waiting
      }
    }
  }
});

test.after(() => {
  if (spawnedServer) {
    spawnedServer.kill();
  }
});

test('Amenity Decision Intelligence System - End-to-End Suite', async (t) => {

  await t.test('1. Static File Serving', async () => {
    const operatorRes = await fetch(`${BASE_URL}/operator.html`);
    assert.equal(operatorRes.status, 200);
    const opText = await operatorRes.text();
    assert.match(opText, /Operator Command Center|Township Amenity Decision Intelligence/i);

    const residentRes = await fetch(`${BASE_URL}/resident.html?facilityId=court-badminton-1`);
    assert.equal(residentRes.status, 200);
    const resText = await residentRes.text();
    assert.match(resText, /Resident Mobile Touchpoint/i);
  });

  await t.test('2. Facility Catalog and Overview API', async () => {
    const res = await fetch(`${BASE_URL}/api/facilities`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.totals, 'Should contain totals');
    assert.equal(data.totals.totalFacilities, 12, 'Should have exactly 12 facilities pre-seeded');
    assert.ok(Array.isArray(data.facilities), 'Should contain facilities array');
    assert.equal(data.facilities.length, 12);
  });

  await t.test('3. Specific Facility Summary & Review Contract', async () => {
    const res = await fetch(`${BASE_URL}/api/facilities/court-badminton-1`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.facility.facility_id, 'court-badminton-1');
    assert.ok(data.facility.name);
    assert.ok(Array.isArray(data.reports));
    assert.ok(Array.isArray(data.maintenance));
    assert.ok(data.review, 'Should contain linked decision review');
    const diag = data.review.diagnosis || data.review.currentDiagnosis;
    assert.ok(diag, 'Should contain diagnosis');
    assert.ok(diag.label);
  });

  let createdReportId = null;

  await t.test('4. Resident Fault Reporting - Initial Unverified State Machine', async () => {
    const payload = {
      category: 'lighting',
      description: 'Automated Test: Light flickering on Court 2',
      locationDetail: 'Court 2 North Corner',
      contact: 'Unit #12-04'
    };

    const res = await fetch(`${BASE_URL}/api/facilities/court-badminton-1/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.reportId.startsWith('REP-'));
    assert.equal(data.status, 'unverified', 'Core rule: New reports must strictly start as unverified');
    createdReportId = data.reportId;
  });

  await t.test('5. Verify Resident Report via Staff On-Site Inspection', async () => {
    assert.ok(createdReportId, 'Must have a created report ID');

    const verifyPayload = {
      action: 'verify_fault',
      verifiedBy: 'Inspector Test Bot',
      verificationNotes: 'On-site physical inspection confirmed: ballast unit replacement required.'
    };

    const res = await fetch(`${BASE_URL}/api/reports/${createdReportId}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(verifyPayload)
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.status, 'verified_fault');
    assert.ok(data.summary, 'Should return updated facility summary');
  });

  await t.test('6. Maintenance Work Orders Tracking', async () => {
    const res = await fetch(`${BASE_URL}/api/maintenance`);
    assert.equal(res.status, 200);
    const records = await res.json();
    assert.ok(Array.isArray(records));
    assert.ok(records.length > 0, 'Should have active maintenance work orders');
  });

  await t.test('7. Decision Review Intervention Selection & Operator Approval', async () => {
    // Select intervention
    const selRes = await fetch(`${BASE_URL}/api/reviews/court-badminton-1/intervention`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selectedIntervention: 'Repair / Restore' })
    });
    assert.equal(selRes.status, 200);
    const selData = await selRes.json();
    assert.equal(selData.selectedIntervention, 'Repair / Restore');

    // Operator Approval
    const appRes = await fetch(`${BASE_URL}/api/reviews/court-badminton-1/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        approvedBy: 'Lead Operator Test',
        note: 'Approved during automated verification suite.'
      })
    });
    assert.equal(appRes.status, 200);
    const appData = await appRes.json();
    assert.equal(appData.approvalStatus.isApproved, true);
    assert.equal(appData.analysisStatus, 'action_approved');
  });

  await t.test('8. Targeted Evidence Survey Flow', async () => {
    // Fetch survey collection
    const getRes = await fetch(`${BASE_URL}/api/targeted/collections/col-hall-schedule-2026`);
    assert.equal(getRes.status, 200);
    const colData = await getRes.json();
    assert.equal(colData.collection_id, 'col-hall-schedule-2026');
    assert.ok(Array.isArray(colData.options));

    // Submit targeted survey response
    const subRes = await fetch(`${BASE_URL}/api/targeted/collections/col-hall-schedule-2026/responses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        selectedOption: 'Sometimes — but I often find the slots I want are unavailable',
        cohort: 'Long-term residents (3+ years), Building 4'
      })
    });
    assert.equal(subRes.status, 200);
    const subData = await subRes.json();
    assert.equal(subData.accepted, true);
    assert.ok(subData.responseId);
  });
});
