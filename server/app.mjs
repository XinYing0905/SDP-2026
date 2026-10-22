import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { initDatabase, INITIAL_FACILITIES } from './db.mjs';
import {
  getAllFacilitiesOverview,
  getFacilitySummary,
  verifyResidentReport,
  recordTargetedResponse
} from './adapter.mjs';

const rootDir = process.cwd();
const port = Number(process.env.PORT ?? 3000);
const db = initDatabase();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

async function parseBody(req) {
  const parts = [];
  let length = 0;
  for await (const chunk of req) {
    length += chunk.length;
    if (length > 1048576) throw new Error('BODY_TOO_LARGE');
    parts.push(chunk);
  }
  const str = Buffer.concat(parts).toString('utf-8');
  return str ? JSON.parse(str) : {};
}

const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
  const pathname = url.pathname;

  try {
    // ── API ROUTES ──

    // 1. Facilities Overview
    if (pathname === '/api/facilities' && req.method === 'GET') {
      const overview = getAllFacilitiesOverview(db);
      return sendJson(res, 200, overview);
    }

    // 2. Specific Facility
    const facilityMatch = /^\/api\/facilities\/([a-zA-Z0-9_-]+)$/.exec(pathname);
    if (facilityMatch && req.method === 'GET') {
      const facilityId = facilityMatch[1];
      const summary = getFacilitySummary(db, facilityId);
      if (!summary) return sendJson(res, 404, { error: 'Facility not found' });
      return sendJson(res, 200, summary);
    }

    // 3. Submit Resident Fault Report for a Facility
    const reportSubmitMatch = /^\/api\/facilities\/([a-zA-Z0-9_-]+)\/reports$/.exec(pathname);
    if (reportSubmitMatch && req.method === 'POST') {
      const facilityId = reportSubmitMatch[1];
      const body = await parseBody(req);
      const facility = db.prepare('SELECT facility_id FROM facilities WHERE facility_id = ?').get(facilityId);
      if (!facility) return sendJson(res, 404, { error: 'Facility not found' });

      const reportId = `REP-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO resident_reports (report_id, facility_id, category, description, location_detail, contact, submitted_at, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        reportId,
        facilityId,
        body.category || 'lighting',
        body.description || 'Lighting issue reported',
        body.locationDetail || '',
        body.contact || '',
        now,
        'unverified'
      );

      return sendJson(res, 201, {
        success: true,
        reportId,
        referenceId: reportId,
        facilityId,
        category: body.category || 'lighting',
        description: body.description,
        status: 'unverified',
        submittedAt: now,
        message: 'Report submitted successfully and pending staff verification'
      });
    }

    // 4. List All Reports
    if (pathname === '/api/reports' && req.method === 'GET') {
      const facilityId = url.searchParams.get('facilityId');
      let reports;
      if (facilityId) {
        reports = db.prepare(`
          SELECT r.*, f.name as facility_name, f.type as facility_type
          FROM resident_reports r
          JOIN facilities f ON r.facility_id = f.facility_id
          WHERE r.facility_id = ?
          ORDER BY r.submitted_at DESC
        `).all(facilityId);
      } else {
        reports = db.prepare(`
          SELECT r.*, f.name as facility_name, f.type as facility_type
          FROM resident_reports r
          JOIN facilities f ON r.facility_id = f.facility_id
          ORDER BY r.submitted_at DESC
        `).all();
      }
      return sendJson(res, 200, reports);
    }

    // 5. Staff Verify Resident Report
    const verifyMatch = /^\/api\/reports\/([a-zA-Z0-9_-]+)\/verify$/.exec(pathname);
    if (verifyMatch && req.method === 'POST') {
      const reportId = verifyMatch[1];
      const body = await parseBody(req);
      const action = body.action || 'verify_fault'; // 'verify_fault' | 'dismiss'

      if (action === 'dismiss') {
        const now = new Date().toISOString();
        db.prepare(`
          UPDATE resident_reports 
          SET status = 'dismissed',
              verified_by = ?,
              verified_at = ?,
              verification_notes = ?
          WHERE report_id = ?
        `).run(
          body.verifiedBy || 'Staff Inspector',
          now,
          body.verificationNotes || 'On-site inspection completed. Determined normal with no operational defect found.',
          reportId
        );
        return sendJson(res, 200, { success: true, status: 'dismissed' });
      }

      const summary = verifyResidentReport(db, reportId, {
        verifiedBy: body.verifiedBy || 'Staff Duty Technician',
        verificationNotes: body.verificationNotes || 'On-site physical inspection confirmed luminaire ballast failure and severe flickering.',
        createMaintenance: true
      });

      return sendJson(res, 200, {
        success: true,
        reportId,
        status: 'verified_fault',
        summary
      });
    }

    // 6. Maintenance Records List
    if (pathname === '/api/maintenance' && req.method === 'GET') {
      const records = db.prepare(`
        SELECT m.*, f.name as facility_name, f.type as facility_type
        FROM maintenance_records m
        JOIN facilities f ON m.facility_id = f.facility_id
        ORDER BY m.created_at DESC
      `).all();
      return sendJson(res, 200, records);
    }

    // 7. Decision Review Details
    const reviewMatch = /^\/api\/reviews\/([a-zA-Z0-9_-]+)$/.exec(pathname);
    if (reviewMatch && req.method === 'GET') {
      const facilityId = reviewMatch[1];
      const row = db.prepare('SELECT * FROM decision_reviews WHERE facility_id = ?').get(facilityId);
      if (!row) return sendJson(res, 404, { error: 'Review not found' });
      return sendJson(res, 200, JSON.parse(row.body));
    }

    // 8. Select Intervention for a Review
    const interventionMatch = /^\/api\/reviews\/([a-zA-Z0-9_-]+)\/intervention$/.exec(pathname);
    if (interventionMatch && req.method === 'POST') {
      const facilityId = interventionMatch[1];
      const body = await parseBody(req);
      const row = db.prepare('SELECT * FROM decision_reviews WHERE facility_id = ?').get(facilityId);
      if (!row) return sendJson(res, 404, { error: 'Review not found' });

      const review = JSON.parse(row.body);
      review.selectedIntervention = body.selectedIntervention;
      const now = new Date().toISOString();

      db.prepare(`
        UPDATE decision_reviews SET body = ?, updated_at = ? WHERE facility_id = ?
      `).run(JSON.stringify(review), now, facilityId);

      return sendJson(res, 200, review);
    }

    // 9. Approve Intervention Plan
    const approveMatch = /^\/api\/reviews\/([a-zA-Z0-9_-]+)\/approve$/.exec(pathname);
    if (approveMatch && req.method === 'POST') {
      const facilityId = approveMatch[1];
      const body = await parseBody(req);
      const row = db.prepare('SELECT * FROM decision_reviews WHERE facility_id = ?').get(facilityId);
      if (!row) return sendJson(res, 404, { error: 'Review not found' });

      const review = JSON.parse(row.body);
      const now = new Date().toISOString();
      review.approvalStatus = {
        isApproved: true,
        approvedBy: body.approvedBy || 'Regional Operations Lead',
        approvedAt: now,
        note: body.note || 'Plan approval recorded. Execution has not started.'
      };
      review.analysisStatus = 'action_approved';

      db.prepare(`
        UPDATE decision_reviews SET analysis_status = 'action_approved', body = ?, updated_at = ? WHERE facility_id = ?
      `).run(JSON.stringify(review), now, facilityId);

      return sendJson(res, 200, review);
    }

    // 10. Targeted Survey Collection
    const targetedCollectionMatch = /^\/api\/targeted\/collections\/([a-zA-Z0-9_-]+)$/.exec(pathname);
    if (targetedCollectionMatch && req.method === 'GET') {
      const collectionId = targetedCollectionMatch[1];
      const collection = db.prepare('SELECT * FROM targeted_collections WHERE collection_id = ?').get(collectionId);
      if (!collection) return sendJson(res, 404, { error: 'Collection not found' });
      return sendJson(res, 200, {
        ...collection,
        options: JSON.parse(collection.options)
      });
    }

    // 11. Submit Targeted Survey Response
    const targetedResponseMatch = /^\/api\/targeted\/collections\/([a-zA-Z0-9_-]+)\/responses$/.exec(pathname);
    if (targetedResponseMatch && req.method === 'POST') {
      const collectionId = targetedResponseMatch[1];
      const body = await parseBody(req);
      const result = recordTargetedResponse(db, collectionId, {
        selectedOption: body.selectedOption,
        cohort: body.cohort
      });
      return sendJson(res, 200, result);
    }

    // 12. Reset Demo State
    if (pathname === '/api/reset-demo' && req.method === 'POST') {
      db.exec(`
        DELETE FROM resident_reports;
        DELETE FROM maintenance_records;
        DELETE FROM targeted_responses;
        DELETE FROM targeted_collections;
        DELETE FROM decision_reviews;
        DELETE FROM facilities;
      `);
      // Re-initialize default seeds
      initDatabase();
      return sendJson(res, 200, { success: true, message: 'Database reset and re-seeded successfully' });
    }

    // ── STATIC FILE SERVING ──
    let filePath;
    if (pathname === '/' || pathname === '/operator') {
      filePath = path.join(rootDir, 'operator.html');
    } else if (pathname === '/resident') {
      filePath = path.join(rootDir, 'resident.html');
    } else {
      filePath = path.join(rootDir, pathname.replace(/^\//, ''));
    }

    try {
      const stats = await fs.stat(filePath);
      if (stats.isFile()) {
        const ext = path.extname(filePath);
        const mime = MIME_TYPES[ext] || 'application/octet-stream';
        const content = await fs.readFile(filePath);
        res.writeHead(200, {
          'Content-Type': mime,
          'Cache-Control': 'no-cache, no-store'
        });
        return res.end(content);
      }
    } catch {
      // file not found
    }

    // Fallback 404
    sendJson(res, 404, { error: 'Not found', pathname });

  } catch (err) {
    console.error('Server Error:', err);
    sendJson(res, 500, { error: err.message || 'Internal Server Error' });
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`ADI Unified Intelligence System Running on port ${port}`);
  console.log(`- Operator Dashboard: http://localhost:${port}/operator.html`);
  console.log(`- Resident Home:      http://localhost:${port}/resident.html`);
  console.log(`=======================================================`);
});
