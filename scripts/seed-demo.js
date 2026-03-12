#!/usr/bin/env node
/**
 * Seed demo data: operators, project_operators, shifts.
 * Run from repo root: node scripts/seed-demo.js (or npm run seed).
 * Requires DATABASE_URL in server/.env. Idempotent: removes existing demo data then inserts fresh.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../server/.env') });
const { Pool } = require('pg');

const DEMO_PROJECT_IDS = ['demo-festival-2026', 'demo-creator-2026', 'demo-archived-2025'];
const OP_ID_PREFIX = 'DEMO-OP-';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost')
    ? { rejectUnauthorized: false }
    : false,
});

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set. Add it to server/.env and try again.');
    process.exit(1);
  }
  const client = await pool.connect();
  try {
    // 1. Remove existing demo data (order: shifts -> project_operators -> operators)
    await client.query(
      "DELETE FROM shifts WHERE project_id = ANY($1::text[])",
      [DEMO_PROJECT_IDS]
    );
    await client.query(
      "DELETE FROM project_operators WHERE project_id = ANY($1::text[])",
      [DEMO_PROJECT_IDS]
    );
    const { rows: delOps } = await client.query(
      "DELETE FROM operators WHERE op_id LIKE $1 RETURNING id",
      [OP_ID_PREFIX + '%']
    );
    console.log('Cleaned existing demo operators and project data.');

    // 2. Insert operators (15) with variation: name, phone, day_rate, reliability, tier
    const operators = [
      { name: 'Jordan Reeves', phone: '+1 555 101 0001', dayRate: 450, reliability: 5, tier: 'T1' },
      { name: 'Sam Chen', phone: '+1 555 101 0002', dayRate: 425, reliability: 5, tier: 'T1' },
      { name: 'Alex Rivera', phone: '+1 555 101 0003', dayRate: 400, reliability: 4, tier: 'T2' },
      { name: 'Morgan Blake', phone: '+1 555 101 0004', dayRate: 400, reliability: 4, tier: 'T2' },
      { name: 'Casey Dunn', phone: '+1 555 101 0005', dayRate: 375, reliability: 4, tier: 'T2' },
      { name: 'Jamie Fox', phone: '+1 555 101 0006', dayRate: 350, reliability: 3, tier: 'T2' },
      { name: 'Riley Park', phone: '+1 555 101 0007', dayRate: 350, reliability: 3, tier: 'T2' },
      { name: 'Drew Walsh', phone: '+1 555 101 0008', dayRate: 325, reliability: 3, tier: 'T2' },
      { name: 'Quinn Hayes', phone: '+1 555 101 0009', dayRate: 300, reliability: 2, tier: 'T3' },
      { name: 'Taylor Kim', phone: '+1 555 101 0010', dayRate: 275, reliability: 2, tier: 'T3' },
      { name: 'Jordan Lee', phone: '+1 555 101 0011', dayRate: 400, reliability: 5, tier: 'T1' },
      { name: 'Morgan Stone', phone: '+1 555 101 0012', dayRate: 380, reliability: 4, tier: 'T2' },
      { name: 'Avery Cole', phone: '+1 555 101 0013', dayRate: 360, reliability: 4, tier: 'T2' },
      { name: 'Skyler Grant', phone: '+1 555 101 0014', dayRate: 340, reliability: 3, tier: 'T2' },
      { name: 'Parker Bell', phone: '+1 555 101 0015', dayRate: 320, reliability: 3, tier: 'T2' },
    ];

    const insertedOps = [];
    for (let i = 0; i < operators.length; i++) {
      const o = operators[i];
      const { rows } = await client.query(
        `INSERT INTO operators (op_id, full_name, phone, day_rate, tier, reliability, hire_stage, cred_status, cred_type, planned_days)
         VALUES ($1, $2, $3, $4, $5, $6, 'Outreach', 'Not Started', 'None', 1)
         RETURNING id, op_id, full_name, day_rate, reliability`,
        [OP_ID_PREFIX + (i + 1), o.name, o.phone, o.dayRate, o.tier, o.reliability]
      );
      insertedOps.push({ id: rows[0].id, ...o });
    }
    console.log('Inserted', insertedOps.length, 'operators.');

    // 3. Project–operator assignments: festival (main backtest), creator, archived
    const defaultZones = ['House 1', 'House 2', 'House 3', 'House 4', 'Floater'];
    const stages = ['Outreach', 'Responded', 'Screened', 'Interviewing', 'Offered', 'LOA Signed', 'Confirmed'];
    const credStatuses = ['Approved', 'Approved', 'Submitted', 'Info Collected', 'Not Started', 'Denied', 'Approved', 'Submitted', 'Not Started', 'Approved', 'Approved', 'Info Collected', 'Submitted', 'Denied', 'Approved'];
    const credTypes = ['Full', 'Full', 'Full', 'Full', 'None', 'None', 'Backup', 'Full', 'None', 'Full', 'Full', 'Full', 'Full', 'None', 'Backup'];
    const availability = ['Available', 'Available', 'Partial', 'Available', 'Unavailable', 'Available', 'Partial', 'Available', 'Available', 'Available', 'Partial', 'Available', 'Available', 'Unavailable', 'Available'];
    const availableThrough = [null, null, '2026-04-15', null, null, null, '2026-04-12', null, null, null, '2026-04-18', null, null, null, null];
    const availabilityNote = [null, null, null, null, 'Out of country', null, null, null, null, null, null, null, null, 'Medical', null];

    // Festival: assign ops 0..11 to demo-festival-2026 with spread across stages and houses
    const festivalZones = ['House 1', 'House 1', 'House 2', 'House 2', 'House 3', 'House 3', 'House 4', 'House 4', 'Floater', 'House 1', 'House 2', 'Floater'];
    const festivalStages = ['Confirmed', 'Confirmed', 'Confirmed', 'LOA Signed', 'Offered', 'Interviewing', 'Screened', 'Responded', 'Confirmed', 'Confirmed', 'Outreach', 'Confirmed'];
    const festivalPlanned = [10, 10, 8, 8, 6, 5, 5, 4, 10, 9, 3, 10];
    for (let i = 0; i < 12; i++) {
      await client.query(
        `INSERT INTO project_operators (project_id, operator_id, zone, hire_stage, cred_status, cred_type, planned_days, project_day_rate, tier, availability_status, available_through, availability_note)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          'demo-festival-2026',
          insertedOps[i].id,
          festivalZones[i],
          festivalStages[i],
          credStatuses[i],
          credTypes[i],
          festivalPlanned[i],
          operators[i].dayRate,
          operators[i].tier,
          availability[i],
          availableThrough[i],
          availabilityNote[i],
        ]
      );
    }
    // Creator: assign ops 0..5
    for (let i = 0; i < 6; i++) {
      await client.query(
        `INSERT INTO project_operators (project_id, operator_id, zone, hire_stage, cred_status, cred_type, planned_days, project_day_rate, tier, availability_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          'demo-creator-2026',
          insertedOps[i].id,
          ['House 1', 'House 1', 'House 2', 'Floater', 'House 1', 'House 2'][i],
          ['Confirmed', 'Confirmed', 'LOA Signed', 'Confirmed', 'Interviewing', 'Screened'][i],
          'Approved', 'Full', [5, 5, 4, 5, 3, 4][i],
          operators[i].dayRate,
          operators[i].tier,
          'Available',
        ]
      );
    }
    // Archived: assign ops 6..10
    for (let i = 6; i <= 10; i++) {
      await client.query(
        `INSERT INTO project_operators (project_id, operator_id, zone, hire_stage, cred_status, cred_type, planned_days, project_day_rate, tier)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          'demo-archived-2025',
          insertedOps[i].id,
          defaultZones[(i - 6) % defaultZones.length],
          'Confirmed', 'Approved', 'Full', 7,
          operators[i].dayRate,
          operators[i].tier,
        ]
      );
    }
    console.log('Inserted project_operators for all 3 demo projects.');

    // 4. Shifts: active (no end_time), one on lunch (on_break true), completed with OT and break_minutes
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const projectStart = '2026-04-10';
    const projectEnd = '2026-04-19';

    // Active shift (clocked in) — op 0
    await client.query(
      `INSERT INTO shifts (shift_id, operator_id, operator_name, zone, date, start_time, end_time, break_minutes, flat_hours, ot_multiplier, day_rate, project_id)
       VALUES ($1, $2, $3, $4, $5::date, $6, NULL, 0, 12, 1.5, $7, $8)`,
      ['SH-DEMO-1', insertedOps[0].id, operators[0].name, 'House 1', today, now.toISOString(), operators[0].dayRate, 'demo-festival-2026']
    );
    // Active + on lunch — op 1
    await client.query(
      `INSERT INTO shifts (shift_id, operator_id, operator_name, zone, date, start_time, end_time, break_minutes, on_break, break_started_at, flat_hours, ot_multiplier, day_rate, project_id)
       VALUES ($1, $2, $3, $4, $5::date, $6, NULL, 0, true, $7, 12, 1.5, $8, $9)`,
      ['SH-DEMO-2', insertedOps[1].id, operators[1].name, 'House 2', today, new Date(now - 4 * 3600000).toISOString(), new Date(now - 30 * 60000).toISOString(), operators[1].dayRate, 'demo-festival-2026']
    );
    // Completed with OT and break — op 2, 3
    const completedStart = new Date(projectStart + 'T08:00:00.000Z');
    const completedEnd = new Date(projectStart + 'T20:30:00.000Z'); // 12.5 - 0.5 break = 12 worked, 4 OT
    const dayRate2 = operators[2].dayRate;
    const hourly2 = dayRate2 / 8;
    const regPay2 = 8 * hourly2;
    const otPay2 = 4 * hourly2 * 1.5;
    await client.query(
      `INSERT INTO shifts (shift_id, operator_id, operator_name, zone, date, start_time, end_time, break_minutes, flat_hours, ot_multiplier, day_rate, worked_hours, overtime_hours, overtime_pay, total_pay, project_id)
       VALUES ($1, $2, $3, $4, $5::date, $6, $7, 30, 12, 1.5, $8, 12, 4, $9, $10, $11)`,
      ['SH-DEMO-3', insertedOps[2].id, operators[2].name, 'House 3', projectStart, completedStart.toISOString(), completedEnd.toISOString(), dayRate2, otPay2, regPay2 + otPay2, 'demo-festival-2026']
    );
    const dayRate3 = operators[3].dayRate;
    const hourly3 = dayRate3 / 8;
    await client.query(
      `INSERT INTO shifts (shift_id, operator_id, operator_name, zone, date, start_time, end_time, break_minutes, flat_hours, ot_multiplier, day_rate, worked_hours, overtime_hours, overtime_pay, total_pay, project_id)
       VALUES ($1, $2, $3, $4, $5::date, $6, $7, 30, 12, 1.5, $8, 10, 2, $9, $10, $11)`,
      ['SH-DEMO-4', insertedOps[3].id, operators[3].name, 'House 4', projectStart, completedStart.toISOString(), new Date(projectStart + 'T20:00:00.000Z').toISOString(), dayRate3, 2 * (hourly3 * 1.5), 8 * hourly3 + 2 * hourly3 * 1.5, 'demo-festival-2026']
    );
    // More completed shifts for burn/runway (op 4, 5 on 2026-04-11)
    const day2 = '2026-04-11';
    const end2 = new Date(day2 + 'T19:00:00.000Z');
    const start2 = new Date(day2 + 'T07:00:00.000Z');
    for (let i = 4; i <= 5; i++) {
      const hr = operators[i].dayRate / 8;
      await client.query(
        `INSERT INTO shifts (shift_id, operator_id, operator_name, zone, date, start_time, end_time, break_minutes, flat_hours, ot_multiplier, day_rate, worked_hours, overtime_hours, overtime_pay, total_pay, project_id)
         VALUES ($1, $2, $3, $4, $5::date, $6, $7, 30, 12, 1.5, $8, 11, 3, $9, $10, $11)`,
        ['SH-DEMO-' + (5 + i), insertedOps[i].id, operators[i].name, festivalZones[i], day2, start2.toISOString(), end2.toISOString(), operators[i].dayRate, 3 * hr * 1.5, 8 * hr + 3 * hr * 1.5, 'demo-festival-2026']
      );
    }
    console.log('Inserted demo shifts (active, on lunch, completed with OT).');

    // 5. Verify: same project ids the app uses (from localStorage / URL params)
    const { rows: verifyPo } = await client.query(
      'SELECT project_id, COUNT(*) AS n FROM project_operators WHERE project_id = ANY($1::text[]) GROUP BY project_id',
      [DEMO_PROJECT_IDS]
    );
    const { rows: verifyShifts } = await client.query(
      'SELECT project_id, COUNT(*) AS n FROM shifts WHERE project_id = ANY($1::text[]) GROUP BY project_id',
      [DEMO_PROJECT_IDS]
    );
    console.log('\nVerification (project_id must match app URL/localStorage):');
    console.log('  project_operators:', verifyPo.map((r) => `${r.project_id}=${r.n}`).join(', ') || 'none');
    console.log('  shifts:', verifyShifts.map((r) => `${r.project_id}=${r.n}`).join(', ') || 'none');

    console.log('\nDemo seed complete. Use project ID demo-festival-2026 as main backtest project.');
    console.log('In the app: click "Load demo data" to seed projects and expenses (localStorage).');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
