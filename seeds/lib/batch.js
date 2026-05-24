'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
const SCHEMA = 'condor';

async function insert(table, rows, opts = {}) {
  if (!rows.length) return [];
  const SIZE = opts.chunkSize || 50;
  const results = [];
  for (let i = 0; i < rows.length; i += SIZE) {
    const chunk = rows.slice(i, i + SIZE);
    const { data, error } = await supabase
      .schema(SCHEMA)
      .from(table)
      .insert(chunk)
      .select();
    if (error) {
      console.error(`[batch] ${table} chunk ${i}:`, error.message);
      throw error;
    }
    results.push(...data);
  }
  return results;
}

async function upsert(table, rows, onConflict, opts = {}) {
  if (!rows.length) return [];
  const SIZE = opts.chunkSize || 50;
  const results = [];
  for (let i = 0; i < rows.length; i += SIZE) {
    const chunk = rows.slice(i, i + SIZE);
    const { data, error } = await supabase
      .schema(SCHEMA)
      .from(table)
      .upsert(chunk, { onConflict })
      .select();
    if (error) {
      console.error(`[upsert] ${table} chunk ${i}:`, error.message);
      throw error;
    }
    results.push(...data);
  }
  return results;
}

async function query(table, filter = {}) {
  let q = supabase.schema(SCHEMA).from(table).select('*');
  for (const [k, v] of Object.entries(filter)) q = q.eq(k, v);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

module.exports = { supabase, SCHEMA, insert, upsert, query };
