import { describe, it, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const TEST_DIR = join(tmpdir(), `zendure-hist-test-${Date.now()}`)
mkdirSync(TEST_DIR, { recursive: true })
process.env.DATA_DIR = TEST_DIR

const { historyService } = await import('../src/services/historyService.js')

after(() => rmSync(TEST_DIR, { recursive: true, force: true }))

describe('historyService', () => {
  it('records and retrieves points', () => {
    const deviceId = 'dev-hist-1'
    historyService.record(deviceId, { solarPower: 800, outputHomePower: 95, electricLevel: 44, gridInputPower: 0, packInputPower: 76 })
    const points = historyService.get(deviceId, 0)
    assert.equal(points.length, 1)
    assert.equal(points[0].solarPower, 800)
    assert.equal(points[0].outputHomePower, 95)
  })

  it('getSummary calculates kWh from actual timestamps', async () => {
    const deviceId = 'dev-hist-2'
    const now = Date.now()
    const { db } = await import('../src/db.js')
    db.prepare('INSERT INTO history (device_id, ts, solar_power, output_home_power, electric_level, grid_input_power, pack_input_power) VALUES (?,?,?,?,?,?,?)').run(deviceId, now - 3600000, 1000, 500, 50, 0, 0)
    db.prepare('INSERT INTO history (device_id, ts, solar_power, output_home_power, electric_level, grid_input_power, pack_input_power) VALUES (?,?,?,?,?,?,?)').run(deviceId, now, 1000, 500, 50, 0, 0)

    const summary = historyService.getSummary(deviceId, now - 7200000)
    assert.ok(summary.totalSolar > 0.9 && summary.totalSolar < 1.1, `Expected ~1 kWh, got ${summary.totalSolar}`)
    assert.ok(summary.selfConsumed > 0.4 && summary.selfConsumed < 0.6, `Expected ~0.5 kWh, got ${summary.selfConsumed}`)
  })

  it('updateEnergyTotals accumulates solarEnergyKwh, outputHomeEnergyKwh, batteryChargeEnergyKwh, and batteryDischargeEnergyKwh', async () => {
    const deviceId = 'dev-energy-test'
    const { db } = await import('../src/db.js')
    const now = Date.now()
    db.prepare('INSERT INTO energy_totals (device_id, solar_energy_kwh, output_home_energy_kwh, pack_input_energy_kwh, pack_charge_energy_kwh, pack_discharge_energy_kwh, last_ts) VALUES (?, ?, ?, ?, ?, ?, ?)').run(deviceId, 0, 0, 0, 0, 0, now - 3600000)

    const totals = historyService.updateEnergyTotals(deviceId, { solarPower: 1000, outputHomePower: 500, batteryChargePower: 300, batteryDischargePower: 200 })
    assert.ok(totals.solarEnergyKwh > 0.9 && totals.solarEnergyKwh < 1.1, `Expected ~1 kWh, got ${totals.solarEnergyKwh}`)
    assert.ok(totals.outputHomeEnergyKwh > 0.4 && totals.outputHomeEnergyKwh < 0.6, `Expected ~0.5 kWh, got ${totals.outputHomeEnergyKwh}`)
    assert.ok(totals.batteryChargeEnergyKwh > 0.25 && totals.batteryChargeEnergyKwh < 0.35, `Expected ~0.3 kWh, got ${totals.batteryChargeEnergyKwh}`)
    assert.ok(totals.batteryDischargeEnergyKwh > 0.15 && totals.batteryDischargeEnergyKwh < 0.25, `Expected ~0.2 kWh, got ${totals.batteryDischargeEnergyKwh}`)
  })

  it('updateEnergyTotals preserves small incremental updates without prematurely rounding DB value to 0', async () => {
    const deviceId = 'dev-small-delta-test'
    const { db } = await import('../src/db.js')
    let currentTs = Date.now() - 50000
    db.prepare('INSERT INTO energy_totals (device_id, solar_energy_kwh, output_home_energy_kwh, pack_input_energy_kwh, pack_charge_energy_kwh, pack_discharge_energy_kwh, last_ts) VALUES (?, ?, ?, ?, ?, ?, ?)').run(deviceId, 0, 0, 0, 0, 0, currentTs)

    for (let i = 0; i < 10; i++) {
      currentTs += 5000
      historyService.updateEnergyTotals(deviceId, { solarPower: 187, outputHomePower: 156 }, currentTs)
    }

    const totals = historyService.getEnergyTotals(deviceId)
    assert.ok(totals.solarEnergyKwh > 0, `Expected solarEnergyKwh > 0, got ${totals.solarEnergyKwh}`)
    assert.ok(totals.outputHomeEnergyKwh > 0, `Expected outputHomeEnergyKwh > 0, got ${totals.outputHomeEnergyKwh}`)
  })
})
