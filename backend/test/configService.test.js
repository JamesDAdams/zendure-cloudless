import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { mkdirSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const TEST_DIR = join(tmpdir(), `zendure-test-${Date.now()}`)
mkdirSync(TEST_DIR, { recursive: true })
process.env.DATA_DIR = TEST_DIR

const { configService } = await import('../src/services/configService.js')

describe('configService', () => {
  after(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
  })

  it('returns defaults when nothing is saved', () => {
    const cfg = configService.get()
    assert.equal(cfg.mqtt.host, '')
    assert.equal(cfg.homeAssistant.url, '')
  })

  it('saves and retrieves a value', () => {
    configService.set({ homeAssistant: { url: 'http://ha.local', token: 'realtoken' } })
    const cfg = configService.get()
    assert.equal(cfg.homeAssistant.url, 'http://ha.local')
    assert.equal(cfg.homeAssistant.token, 'realtoken')
  })

  it('does NOT overwrite real token when *** is sent', () => {
    configService.set({ homeAssistant: { url: 'http://ha.local', token: 'realtoken' } })
    configService.set({ homeAssistant: { url: 'http://ha.local', token: '***' } })
    const cfg = configService.get()
    assert.equal(cfg.homeAssistant.token, 'realtoken')
  })

  it('does NOT overwrite real mqtt password when *** is sent', () => {
    configService.set({ mqtt: { host: '192.168.1.50', port: 1883, username: '', password: 'secret' } })
    configService.set({ mqtt: { host: '192.168.1.50', port: 1883, username: '', password: '***' } })
    const cfg = configService.get()
    assert.equal(cfg.mqtt.password, 'secret')
  })

  it('saves and retrieves a device', () => {
    const device = { id: 'test-1', name: 'Test', brand: 'zendure', model: 'SolarFlow 800 Plus', ip: '192.168.1.10', pollingInterval: 10 }
    configService.saveDevice(device)
    let devices = configService.getDevices()
    assert.equal(devices.length, 1)
    assert.equal(devices[0].id, 'test-1')
    assert.equal(devices[0].name, 'Test')
    assert.equal(devices[0].ip, '192.168.1.10')
    assert.equal(devices[0].pollingInterval, 10)

    // Update device fields
    const updatedDevice = { ...devices[0], name: 'New Name', ip: '192.168.1.20', pollingInterval: 30 }
    configService.saveDevice(updatedDevice)
    devices = configService.getDevices()
    assert.equal(devices.length, 1)
    assert.equal(devices[0].name, 'New Name')
    assert.equal(devices[0].ip, '192.168.1.20')
    assert.equal(devices[0].pollingInterval, 30)
  })

  it('removes a device', () => {
    configService.removeDevice('test-1')
    assert.equal(configService.getDevices().length, 0)
  })
})
