import Database from 'better-sqlite3'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync, mkdirSync } from 'fs'

const __dir = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.DATA_DIR || join(__dir, '../../data')

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })

const db = new Database(join(DATA_DIR, 'zendure.db'))
db.pragma('journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS config (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS devices (
    id    TEXT PRIMARY KEY,
    data  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS history (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id          TEXT NOT NULL,
    ts                 INTEGER NOT NULL,
    solar_power        REAL DEFAULT 0,
    output_home_power  REAL DEFAULT 0,
    electric_level     REAL DEFAULT 0,
    grid_input_power   REAL DEFAULT 0,
    pack_input_power   REAL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_history_device_ts ON history (device_id, ts);

  CREATE TABLE IF NOT EXISTS energy_totals (
    device_id                 TEXT PRIMARY KEY,
    solar_energy_kwh          REAL DEFAULT 0,
    output_home_energy_kwh    REAL DEFAULT 0,
    pack_input_energy_kwh     REAL DEFAULT 0,
    pack_charge_energy_kwh    REAL DEFAULT 0,
    pack_discharge_energy_kwh REAL DEFAULT 0,
    last_ts                   INTEGER DEFAULT 0
  );
`)

try {
  db.exec('ALTER TABLE energy_totals ADD COLUMN pack_input_energy_kwh REAL DEFAULT 0')
} catch {}
try {
  db.exec('ALTER TABLE energy_totals ADD COLUMN pack_charge_energy_kwh REAL DEFAULT 0')
} catch {}
try {
  db.exec('ALTER TABLE energy_totals ADD COLUMN pack_discharge_energy_kwh REAL DEFAULT 0')
} catch {}

export { db, DATA_DIR }
