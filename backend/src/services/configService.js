import { db } from '../db.js'

const DEFAULTS = {
  mqtt: { host: '', port: 1883, username: '', password: '' },
  homeAssistant: { url: '', token: '', solarSensor: '', consumptionSensor: '' },
  tariffs: { type: 'fixed', fixed: 0.18, tou: [] },
}

const MASKED = '***'

function getKey(key) {
  const row = db.prepare('SELECT value FROM config WHERE key = ?').get(key)
  return row ? JSON.parse(row.value) : null
}

function setKey(key, value) {
  db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run(key, JSON.stringify(value))
}

function unmasked(incoming, stored) {
  if (!incoming || typeof incoming !== 'object') return incoming
  const result = { ...stored }
  for (const [k, v] of Object.entries(incoming)) {
    if (v === MASKED) continue
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      result[k] = unmasked(v, stored?.[k] || {})
    } else {
      result[k] = v
    }
  }
  return result
}

class ConfigService {
  get() {
    return {
      mqtt: getKey('mqtt') || DEFAULTS.mqtt,
      homeAssistant: getKey('homeAssistant') || DEFAULTS.homeAssistant,
      tariffs: getKey('tariffs') || DEFAULTS.tariffs,
      devices: this.getDevices(),
    }
  }

  set(partial) {
    const current = this.get()
    for (const key of ['mqtt', 'homeAssistant', 'tariffs']) {
      if (partial[key] !== undefined) {
        setKey(key, unmasked(partial[key], current[key]))
      }
    }
    return this.get()
  }

  getDevices() {
    return db.prepare('SELECT data FROM devices').all().map((r) => JSON.parse(r.data))
  }

  saveDevice(device) {
    db.prepare('INSERT OR REPLACE INTO devices (id, data) VALUES (?, ?)').run(device.id, JSON.stringify(device))
  }

  removeDevice(id) {
    db.prepare('DELETE FROM devices WHERE id = ?').run(id)
  }
}

export const configService = new ConfigService()
