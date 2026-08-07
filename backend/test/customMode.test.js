import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { CustomMode } from '../src/modes/CustomMode.js'

describe('CustomMode._getCurrentSlot', () => {
  it('returns the matching slot for the current time range', () => {
    const now = new Date()
    const h = now.getHours()
    const start = `${String(h).padStart(2, '0')}:00`
    const end = `${String((h + 1) % 24).padStart(2, '0')}:00`
    const mode = new CustomMode({
      schedule: [{ start, end, type: 'discharge', power: 200, days: ['all'] }]
    })
    const slot = mode._getCurrentSlot()
    assert.ok(slot, 'should find a matching slot')
    assert.equal(slot.type, 'discharge')
    assert.equal(slot.power, 200)
  })

  it('returns undefined when no slot matches', () => {
    const mode = new CustomMode({
      schedule: [{ start: '00:00', end: '00:01', type: 'standby', power: 0, days: ['all'] }]
    })
    const now = new Date()
    if (now.getHours() === 0 && now.getMinutes() === 0) return
    const slot = mode._getCurrentSlot()
    assert.equal(slot, undefined)
  })
})
