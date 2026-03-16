require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const hasDb = !!process.env.DATABASE_URL;
const isLocalDb = process.env.DATABASE_URL?.includes('localhost');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: hasDb && !isLocalDb ? { rejectUnauthorized: false } : false,
});

module.exports = { pool, hasDb };
