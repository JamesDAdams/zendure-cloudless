import { describe, it, expect } from 'vitest'
import { haConfigured, mqttConfigured } from '../utils/configUtils'

describe('haConfigured', () => {
  it('returns false when url and token are empty', () => {
    expect(haConfigured({ homeAssistant: { url: '', token: '' } })).toBe(false)
  })

  it('returns false when url is set but token is empty', () => {
    expect(haConfigured({ homeAssistant: { url: 'http://ha.local', token: '' } })).toBe(false)
  })

  it('returns true when url and token are set', () => {
    expect(haConfigured({ homeAssistant: { url: 'http://ha.local', token: 'abc123' } })).toBe(true)
  })

  it('returns true when token is masked (***)', () => {
    expect(haConfigured({ homeAssistant: { url: 'http://ha.local', token: '***' } })).toBe(true)
  })

  it('returns false when config is null', () => {
    expect(haConfigured(null)).toBe(false)
  })
})

describe('mqttConfigured', () => {
  it('returns false when host is empty', () => {
    expect(mqttConfigured({ mqtt: { host: '' } })).toBe(false)
  })

  it('returns true when host is set', () => {
    expect(mqttConfigured({ mqtt: { host: '192.168.1.50' } })).toBe(true)
  })

  it('returns false when config is null', () => {
    expect(mqttConfigured(null)).toBe(false)
  })
})
