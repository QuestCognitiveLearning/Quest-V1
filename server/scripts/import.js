// Bulk-import legacy CSV exports into Supabase Postgres via direct connection.
// Run with:  npm run import
//
// Reads ~/Downloads/<Entity>_export.csv files, parses them, upserts into the
// matching tables in dependency order. Uses the direct pg connection (bypasses
// RLS naturally — connecting as the postgres role).

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { parse } from 'csv-parse/sync';
import pg from 'pg';

if (!process.env.SUPABASE_DB_PASSWORD && !process.env.DATABASE_URL) {
  console.error('✗ Set SUPABASE_DB_PASSWORD in .env (or DATABASE_URL)');
  process.exit(1);
}

const client = new pg.Client({
  host: 'aws-1-us-west-1.pooler.supabase.com',
  port: 5432,
  user: 'postgres.lgymrkodypbqghyjocxg',
  password: process.env.SUPABASE_DB_PASSWORD,
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
});

const DOWNLOADS = path.join(os.homedir(), 'Downloads');

const IMPORT_ORDER = [
  { csv: 'Curriculum_export (1).csv',        table: 'curricula' },
  { csv: 'Unit_export (1).csv',              table: 'units' },
  { csv: 'Subunit_export.csv',               table: 'subunits' },
  { csv: 'Class_export.csv',                 table: 'classes' },
  { csv: 'Video_export.csv',                 table: 'videos' },
  { csv: 'Article_export.csv',               table: 'articles' },
  { csv: 'Quiz_export.csv',                  table: 'quizzes' },
  { csv: 'Question_export.csv',              table: 'questions' },
  { csv: 'AttentionCheck_export.csv',        table: 'attention_checks' },
  { csv: 'InquirySession_export.csv',        table: 'inquiry_sessions' },
  { csv: 'CaseStudy_export.csv',             table: 'case_studies' },
  { csv: 'StudentEnrollment_export.csv',     table: 'student_enrollments' },
  { csv: 'StudentProgress_export.csv',       table: 'student_progress' },
  { csv: 'LearningSession_export.csv',       table: 'learning_sessions' },
  { csv: 'QuizResult_export.csv',            table: 'quiz_results' },
  { csv: 'QuestionResponse_export.csv',      table: 'question_responses' },
  { csv: 'AttentionCheckResponse_export.csv',table: 'attention_check_responses' },
  { csv: 'InquiryResponse_export.csv',       table: 'inquiry_responses' },
  { csv: 'CaseStudyResponse_export.csv',     table: 'case_study_responses' },
  { csv: 'Assignment_export.csv',            table: 'assignments' },
  { csv: 'SessionFeedback_export.csv',       table: 'session_feedback' },
  { csv: 'Achievement_export.csv',           table: 'achievements' },
  { csv: 'Notification_export.csv',          table: 'notifications' },
  { csv: 'UnitImage_export.csv',             table: 'unit_images' },
  { csv: 'VideoQuestionResponse_export.csv', table: 'video_question_responses' },
  { csv: 'LiveSession_export.csv',           table: 'live_sessions' },
  { csv: 'LiveSessionParticipant_export.csv',table: 'live_session_participants' },
  { csv: 'LiveSessionResponse_export.csv',   table: 'live_session_responses' },
  { csv: 'QuestathonTest_export.csv',        table: 'questathon_tests' },
  { csv: 'TestImprovement_export.csv',       table: 'test_improvements' },
  { csv: 'QuestathonPoints_export.csv',      table: 'questathon_points' },
  { csv: 'QuestathonReferral_export.csv',    table: 'questathon_referrals' },
  { csv: 'ReferralCode_export.csv',          table: 'referral_codes' },
  { csv: 'QuestathonFeedback_export.csv',    table: 'questathon_feedback' },
];

// Columns that contain JSON-encoded text in the CSV — must be parsed before insert.
const JSON_COLUMNS = {
  inquiry_sessions: ['anchor_options', 'bridge_options', 'stress_test_mc_options', 'relevant_past_memories'],
  inquiry_responses: ['conversation_history'],
  session_feedback: ['tags'],
  questathon_tests: ['answers'],
  test_improvements: ['categories'],
};

// Columns we have to drop because they aren't in our schema or are not yet supported.
const DROP_COLUMNS = new Set([]);

// Tables with a unique-pair constraint beyond `id`. Rows colliding on the pair
// are deduplicated (keeping the most recently updated) before insert.
const DEDUPE_KEYS = {
  student_progress: ['student_id', 'subunit_id'],
  student_enrollments: ['student_id', 'class_id'],
};

function dedupe(rows, keys) {
  const m = new Map();
  const newer = (a, b) =>
    new Date(a.updated_date || a.created_date || 0).getTime() >=
    new Date(b.updated_date || b.created_date || 0).getTime();
  for (const r of rows) {
    const k = keys.map((c) => r[c]).join('|');
    if (!m.has(k) || newer(r, m.get(k))) m.set(k, r);
  }
  return [...m.values()];
}

// Cache of valid columns per table (queried once at startup).
const TABLE_COLUMNS = new Map();

async function loadTableColumns(table) {
  if (TABLE_COLUMNS.has(table)) return TABLE_COLUMNS.get(table);
  const { rows } = await client.query(
    `select column_name from information_schema.columns
     where table_schema = 'public' and table_name = $1`,
    [table]
  );
  const cols = new Set(rows.map((r) => r.column_name));
  TABLE_COLUMNS.set(table, cols);
  return cols;
}

function coerce(row, table) {
  const out = {};
  for (let [k, v] of Object.entries(row)) {
    if (DROP_COLUMNS.has(k)) continue;
    if (v === '' || v === undefined) continue;

    if (v === 'true')  v = true;
    if (v === 'false') v = false;

    // For JSON columns: leave the raw CSV string in place and let PG cast it
    // to jsonb. Parsing in JS and re-passing the JS array confuses pg's
    // type coercion (it serializes JS arrays as Postgres array literals, not JSON).
    // Validate JSON shape first so we drop malformed values rather than fail.
    if (JSON_COLUMNS[table]?.includes(k) && typeof v === 'string') {
      try { JSON.parse(v); }
      catch { continue; }
    }

    out[k] = v;
  }
  return out;
}

function collectUsers(records, table) {
  const users = new Map();
  const add = (id, email, name) => {
    if (!id) return;
    const existing = users.get(id) || {};
    users.set(id, {
      id,
      email: email || existing.email || `${id}@imported.local`,
      full_name: name || existing.full_name || null,
    });
  };

  for (const r of records) {
    add(r.created_by_id, r.created_by, null);
    if (table === 'student_enrollments') {
      add(r.student_id, r.student_email, r.student_full_name);
    }
    if (table === 'classes' || table === 'curricula' || table === 'assignments') {
      add(r.teacher_id, null, null);
    }
    if (table === 'questathon_referrals') {
      add(r.referrer_id, null, null);
      add(r.referred_id, null, null);
    }
    if (
      [
        'student_progress', 'learning_sessions', 'quiz_results',
        'question_responses', 'attention_check_responses', 'inquiry_responses',
        'case_study_responses', 'session_feedback', 'questathon_tests',
        'test_improvements', 'questathon_points', 'achievements',
        'referral_codes', 'questathon_feedback', 'video_question_responses',
      ].includes(table)
    ) {
      add(r.student_id, null, null);
    }
    if (table === 'notifications') add(r.user_id, null, null);
  }
  return [...users.values()];
}

function readCsv(file) {
  const full = path.join(DOWNLOADS, file);
  if (!fs.existsSync(full)) return [];
  const text = fs.readFileSync(full, 'utf8');
  if (!text.trim()) return [];
  try {
    return parse(text, {
      columns: true,
      skip_empty_lines: true,
      relax_quotes: true,
      relax_column_count: true,
    });
  } catch (err) {
    console.error(`✗ Parse error in ${file}:`, err.message);
    return [];
  }
}

// Upsert rows in batches using INSERT ... ON CONFLICT (id) DO UPDATE.
async function upsert(table, rows) {
  if (rows.length === 0) return 0;
  const validCols = await loadTableColumns(table);

  // Union of keys actually present, intersected with the table's real columns.
  const keySet = new Set();
  for (const r of rows) for (const k of Object.keys(r)) keySet.add(k);
  const cols = [...keySet].filter((k) => validCols.has(k));
  if (cols.length === 0) return 0;

  const BATCH = 200;
  let total = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const params = [];
    const valuePlaceholders = slice
      .map((r) => {
        const row = cols.map((c) => {
          params.push(r[c] === undefined ? null : r[c]);
          return `$${params.length}`;
        });
        return `(${row.join(',')})`;
      })
      .join(',');
    const updateSet = cols
      .filter((c) => c !== 'id')
      .map((c) => `${c} = excluded.${c}`)
      .join(',');

    const sql = `
      insert into ${table} (${cols.join(',')})
      values ${valuePlaceholders}
      on conflict (id) do update set ${updateSet}
    `;
    try {
      await client.query(sql, params);
      total += slice.length;
    } catch (err) {
      console.error(`✗ ${table} batch ${i}: ${err.message}`);
      throw err;
    }
  }
  return total;
}

async function run() {
  await client.connect();
  console.log('Connected.\n');

  // Disable FK enforcement during bulk import — source data has orphan refs
  // (e.g. users that existed in one Legacy snapshot but not in others). Any
  // truly unreferenced rows can be cleaned up post-import.
  await client.query("set session_replication_role = 'replica'");

  console.log('→ Phase 1: seeding users referenced across all CSVs');
  const all = new Map();
  for (const { csv, table } of IMPORT_ORDER) {
    const records = readCsv(csv);
    for (const u of collectUsers(records, table)) {
      if (!all.has(u.id)) all.set(u.id, u);
    }
  }
  const userRows = [...all.values()];
  const usersInserted = await upsert('users', userRows);
  console.log(`  ✓ users: ${usersInserted}\n`);

  console.log('→ Phase 2: importing entities in dependency order');
  for (const { csv, table } of IMPORT_ORDER) {
    const records = readCsv(csv);
    if (records.length === 0) {
      console.log(`  - ${table.padEnd(30)} (no data)`);
      continue;
    }
    let cleaned = records.map((r) => coerce(r, table));
    if (DEDUPE_KEYS[table]) cleaned = dedupe(cleaned, DEDUPE_KEYS[table]);
    try {
      const inserted = await upsert(table, cleaned);
      console.log(`  ✓ ${table.padEnd(30)} ${inserted}`);
    } catch {
      console.log(`  ✗ ${table.padEnd(30)} failed`);
    }
  }

  await client.end();
  console.log('\nDone.');
}

run().catch(async (err) => {
  console.error('Fatal:', err);
  try { await client.end(); } catch {}
  process.exit(1);
});
