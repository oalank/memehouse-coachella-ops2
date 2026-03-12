#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set. Add it to server/.env');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: !process.env.DATABASE_URL.includes('localhost') ? { rejectUnauthorized: false } : false,
});

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
pool.query(schema)
  .then(() => { console.log('Schema applied'); process.exit(0); })
  .catch((e) => { console.error('Schema error:', e.message); process.exit(1); });
