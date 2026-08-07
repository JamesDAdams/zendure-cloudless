import { db } from '../db.js'

const insertStmt = db.prepare(`
  INSERT INTO history (device_id, ts, solar_power, output_home_power, electric_level, grid_input_power, pack_input_power)
  VALUES (@device_id, @ts, @solar_power, @output_home_power, @electric_level, @grid_input_power, @pack_input_power)
`)

const HISTORY_MIN_INTERVAL_MS = 60_000
const HISTORY_RETENTION_DAYS = 30

class HistoryService {
  constructor() {
    this._lastRecord = {}
    this._pruneTimer = setInterval(() => this._pruneOld(), 3_600_000)
    this._pruneTimer.unref?.()
    this._pruneOld()
  }

  _pruneOld() {
    const cutoff = Date.now() - HISTORY_RETENTION_DAYS * 86_400_000
    db.prepare('DELETE FROM history WHERE ts < ?').run(cutoff)
  }

  record(deviceId, state) {
    const now = Date.now()
    this.updateEnergyTotals(deviceId, state)
    if (this._lastRecord[deviceId] && now - this._lastRecord[deviceId] < HISTORY_MIN_INTERVAL_MS) return
    this._lastRecord[deviceId] = now
    insertStmt.run({
      device_id: deviceId,
      ts: now,
      solar_power: state.solarPower ?? state.solar_power ?? 0,
      output_home_power: state.outputHomePower ?? state.home_power ?? 0,
      electric_level: state.electricLevel ?? state.battery_soc ?? 0,
      grid_input_power: state.gridInputPower ?? state.grid_power ?? 0,
      pack_input_power: state.packInputPower ?? (state.battery_power > 0 ? state.battery_power : 0),
    })
  }

  getEnergyTotals(deviceId) {
    const row = db.prepare('SELECT solar_energy_kwh, output_home_energy_kwh, pack_input_energy_kwh, pack_charge_energy_kwh, pack_discharge_energy_kwh FROM energy_totals WHERE device_id = ?').get(deviceId)
    const solarEnergyKwh = row ? (row.solar_energy_kwh || 0) : 0
    const outputHomeEnergyKwh = row ? (row.output_home_energy_kwh || 0) : 0
    const packInputEnergyKwh = row ? (row.pack_input_energy_kwh || 0) : 0
    const packChargeEnergyKwh = row ? (row.pack_charge_energy_kwh || 0) : 0
    const packDischargeEnergyKwh = row ? (row.pack_discharge_energy_kwh || row.pack_input_energy_kwh || 0) : 0
    return {
      solarEnergyKwh,
      outputHomeEnergyKwh,
      packInputEnergyKwh,
      packChargeEnergyKwh,
      packDischargeEnergyKwh,
      batteryChargeEnergyKwh: packChargeEnergyKwh,
      batteryDischargeEnergyKwh: packDischargeEnergyKwh,
    }
  }

  updateEnergyTotals(deviceId, state) {
    const now = Date.now()
    const row = db.prepare('SELECT solar_energy_kwh, output_home_energy_kwh, pack_input_energy_kwh, pack_charge_energy_kwh, pack_discharge_energy_kwh, last_ts FROM energy_totals WHERE device_id = ?').get(deviceId)

    let solarEnergyKwh = row ? (row.solar_energy_kwh || 0) : 0
    let outputHomeEnergyKwh = row ? (row.output_home_energy_kwh || 0) : 0
    let packInputEnergyKwh = row ? (row.pack_input_energy_kwh || 0) : 0
    let packChargeEnergyKwh = row ? (row.pack_charge_energy_kwh || 0) : 0
    let packDischargeEnergyKwh = row ? (row.pack_discharge_energy_kwh || row.pack_input_energy_kwh || 0) : 0
    const lastTs = row ? row.last_ts : 0

    const solarPower = state.solarPower ?? state.solar_power ?? 0
    const outputHomePower = state.outputHomePower ?? state.home_power ?? 0
    const packChargePower = state.batteryChargePower ?? state.outputPackPower ?? 0
    const packDischargePower = state.batteryDischargePower ?? state.packInputPower ?? (state.battery_power > 0 ? state.battery_power : 0)

    if (lastTs > 0 && now > lastTs) {
      const deltaHours = (now - lastTs) / 3_600_000
      if (deltaHours <= 24) {
        solarEnergyKwh += (solarPower / 1000) * deltaHours
        outputHomeEnergyKwh += (outputHomePower / 1000) * deltaHours
        packChargeEnergyKwh += (packChargePower / 1000) * deltaHours
        packDischargeEnergyKwh += (packDischargePower / 1000) * deltaHours
        packInputEnergyKwh = packDischargeEnergyKwh
      }
    }

    solarEnergyKwh = parseFloat(solarEnergyKwh.toFixed(3))
    outputHomeEnergyKwh = parseFloat(outputHomeEnergyKwh.toFixed(3))
    packInputEnergyKwh = parseFloat(packInputEnergyKwh.toFixed(3))
    packChargeEnergyKwh = parseFloat(packChargeEnergyKwh.toFixed(3))
    packDischargeEnergyKwh = parseFloat(packDischargeEnergyKwh.toFixed(3))

    db.prepare(`
      INSERT INTO energy_totals (device_id, solar_energy_kwh, output_home_energy_kwh, pack_input_energy_kwh, pack_charge_energy_kwh, pack_discharge_energy_kwh, last_ts)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(device_id) DO UPDATE SET
        solar_energy_kwh = excluded.solar_energy_kwh,
        output_home_energy_kwh = excluded.output_home_energy_kwh,
        pack_input_energy_kwh = excluded.pack_input_energy_kwh,
        pack_charge_energy_kwh = excluded.pack_charge_energy_kwh,
        pack_discharge_energy_kwh = excluded.pack_discharge_energy_kwh,
        last_ts = excluded.last_ts
    `).run(deviceId, solarEnergyKwh, outputHomeEnergyKwh, packInputEnergyKwh, packChargeEnergyKwh, packDischargeEnergyKwh, now)

    return {
      solarEnergyKwh,
      outputHomeEnergyKwh,
      packInputEnergyKwh,
      packChargeEnergyKwh,
      packDischargeEnergyKwh,
      batteryChargeEnergyKwh: packChargeEnergyKwh,
      batteryDischargeEnergyKwh: packDischargeEnergyKwh,
    }
  }

  get(deviceId, since = 0) {
    return db.prepare(
      'SELECT ts, solar_power as solarPower, output_home_power as outputHomePower, electric_level as electricLevel, grid_input_power as gridInputPower, pack_input_power as packInputPower FROM history WHERE device_id = ? AND ts >= ? ORDER BY ts ASC'
    ).all(deviceId, since)
  }

  getSummary(deviceId, since = 0) {
    const points = this.get(deviceId, since)
    if (points.length < 2) return { totalSolar: 0, selfConsumed: 0, gridImport: 0, batteryOutput: 0 }

    let totalSolar = 0, selfConsumed = 0, gridImport = 0, batteryOutput = 0
    for (let i = 1; i < points.length; i++) {
      const intervalH = (points[i].ts - points[i - 1].ts) / 3_600_000
      totalSolar += (points[i].solarPower / 1000) * intervalH
      selfConsumed += (points[i].outputHomePower / 1000) * intervalH
      gridImport += (points[i].gridInputPower / 1000) * intervalH
      batteryOutput += (points[i].packInputPower / 1000) * intervalH
    }

    return {
      totalSolar: Math.round(totalSolar * 100) / 100,
      selfConsumed: Math.round(selfConsumed * 100) / 100,
      gridImport: Math.round(gridImport * 100) / 100,
      batteryOutput: Math.round(batteryOutput * 100) / 100,
    }
  }
}

export const historyService = new HistoryService()
