import { describe, it, expect } from 'vitest'
import { computeBatteryOutputKwh } from '../pages/HistoryPage'

describe('computeBatteryOutputKwh', () => {
  it('correctly calculates battery output kWh for hourly breakdown', () => {
    const points = [
      { ts: Date.now(), solarPower: 0, outputHomePower: 200, packInputPower: 200 },
      { ts: Date.now(), solarPower: 0, outputHomePower: 300, packInputPower: 300 },
    ]

    expect(computeBatteryOutputKwh(points)).toBe(0.25)
  })

  it('returns 0 kWh when battery is not discharging', () => {
    const points = [
      { ts: Date.now(), solarPower: 500, outputHomePower: 200, packInputPower: 0 },
    ]

    expect(computeBatteryOutputKwh(points)).toBe(0)
  })

  it('returns 0 kWh for empty points array', () => {
    expect(computeBatteryOutputKwh([])).toBe(0)
  })
})
