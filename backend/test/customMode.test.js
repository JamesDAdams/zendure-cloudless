import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { CustomMode } from '../src/modes/CustomMode.js'

describe('CustomMode._getCurrentSlot', () => {
  it('returns the matching slot for the current time range', () => {
    const mode = new CustomMode({
      schedule: [{ start: '00:00', end: '24:00', type: 'discharge', power: 200, days: ['all'] }]
    })
    const slot = mode._getCurrentSlot()
    assert.ok(slot, 'should find a matching slot')
    assert.equal(slot.type, 'discharge')
    assert.equal(slot.power, 200)
  })

  it('returns undefined when no slot matches', () => {
    const mode = new CustomMode({
      schedule: [{ start: '00:00', end: '00:00', type: 'standby', power: 0, days: ['all'] }]
    })
    const slot = mode._getCurrentSlot()
    assert.equal(slot, undefined)
  })
})
