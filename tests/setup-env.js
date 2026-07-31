// Jest setupFiles: runs before the test framework and before any module loads.
//
// `jest.mock('../src/config/supabase')` uses automock, and automock still LOADS the
// real module to infer its shape. `src/config/supabase.js` throws on purpose when
// SUPABASE_URL or SUPABASE_SERVICE_KEY are missing, so every suite that mocks it
// fails to even start on a machine without `.env` — a fresh clone or a CI runner.
//
// These placeholders make the unit suite independent of the environment. They are
// never used to reach anything: the client is mocked in every test that touches it.
// Real values, when present in `.env`, are respected and left untouched.
process.env.SUPABASE_URL         = process.env.SUPABASE_URL         || 'http://localhost:54321';
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'test-service-key-not-a-real-credential';
