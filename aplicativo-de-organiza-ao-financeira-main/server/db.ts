import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

export function openDatabase(filename = process.env.DB_PATH || '.data/granae.sqlite') {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true })
  const db = new Database(filename)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, password_hash TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), name TEXT NOT NULL, type TEXT NOT NULL, opening_cents INTEGER NOT NULL DEFAULT 0, is_reserve INTEGER NOT NULL DEFAULT 0, description TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE INDEX IF NOT EXISTS accounts_user ON accounts(user_id);
    CREATE TABLE IF NOT EXISTS entries (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), account_id TEXT NOT NULL REFERENCES accounts(id), title TEXT NOT NULL, category TEXT NOT NULL, type TEXT NOT NULL CHECK(type IN ('income','expense','adjustment')), amount_cents INTEGER NOT NULL, date TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', archived_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE INDEX IF NOT EXISTS entries_user_date ON entries(user_id, date);
    CREATE TABLE IF NOT EXISTS assets (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), name TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('asset','liability')), amount_cents INTEGER NOT NULL, note TEXT NOT NULL DEFAULT '');
    CREATE TABLE IF NOT EXISTS goals (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('meta','sonho')), target_cents INTEGER NOT NULL, icon TEXT NOT NULL DEFAULT '✦', deadline TEXT, archived_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS contributions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), goal_id TEXT NOT NULL REFERENCES goals(id), amount_cents INTEGER NOT NULL, date TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS milestone_claims (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), goal_id TEXT NOT NULL REFERENCES goals(id), milestone INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(goal_id, milestone));
    CREATE TABLE IF NOT EXISTS difficulty_assessments (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), goal_id TEXT NOT NULL REFERENCES goals(id), difficulty_code TEXT NOT NULL, inputs_json TEXT NOT NULL, result_json TEXT NOT NULL, confidence_level TEXT NOT NULL, formula_version TEXT NOT NULL, calculated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS gamification_events (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), event_type TEXT NOT NULL, occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, business_date TEXT NOT NULL, idempotency_key TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, payload TEXT NOT NULL DEFAULT '{}', processed INTEGER NOT NULL DEFAULT 0, UNIQUE(user_id,idempotency_key));
    CREATE TABLE IF NOT EXISTS reward_ledger (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), event_id TEXT NOT NULL REFERENCES gamification_events(id), reward_type TEXT NOT NULL, amount INTEGER NOT NULL, reason_code TEXT NOT NULL, config_version TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(event_id,reason_code,reward_type));
    CREATE TRIGGER IF NOT EXISTS reward_ledger_no_update BEFORE UPDATE ON reward_ledger BEGIN SELECT RAISE(ABORT, 'Reward ledger is immutable'); END;
    CREATE TRIGGER IF NOT EXISTS reward_ledger_no_delete BEFORE DELETE ON reward_ledger BEGIN SELECT RAISE(ABORT, 'Reward ledger is immutable'); END;
    CREATE TABLE IF NOT EXISTS player_progress (user_id TEXT PRIMARY KEY REFERENCES users(id), xp_total INTEGER NOT NULL DEFAULT 0, level INTEGER NOT NULL DEFAULT 1, graninha_balance INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS request_keys (user_id TEXT NOT NULL REFERENCES users(id), key TEXT NOT NULL, response_json TEXT NOT NULL, PRIMARY KEY(user_id,key));
    -- Preferências de interface por conta. A coluna theme fica NULL até o usuário
    -- escolher, assim o cliente nunca sobrescreve a preferência local com um padrão.
    CREATE TABLE IF NOT EXISTS user_preferences (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, theme TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  `)
  const assetColumns = db.prepare('PRAGMA table_info(assets)').all() as { name: string }[]
  if (!assetColumns.some(column => column.name === 'installment_count')) db.exec('ALTER TABLE assets ADD COLUMN installment_count INTEGER')
  if (!assetColumns.some(column => column.name === 'first_due_date')) db.exec('ALTER TABLE assets ADD COLUMN first_due_date TEXT')
  return db
}
export type DB = ReturnType<typeof openDatabase>
