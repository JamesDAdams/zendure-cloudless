import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { ZendureDevice } from '../src/adapters/ZendureDevice.js'
import { mqttService } from '../src/services/mqttService.js'

describe('ZendureDevice.applyMqttMessage', () => {
  it('parses properties and updates state', () => {
    const device = new ZendureDevice({ id: 'd1', name: 'Test', ip: '127.0.0.1' })
    const payload = JSON.stringify({
      properties: { solarInputPower: 800, outputHomePower: 95, electricLevel: 44 },
      packData: [{ sn: 'PACK1', socLevel: 44, state: 2, power: 76, maxTemp: 3000, totalVol: 4900 }]
    })
    device.applyMqttMessage('some/topic', Buffer.from(payload))
    const state = device.getState()
    assert.equal(state.solarInputPower, 800)
    assert.equal(state.outputHomePower, 95)
    assert.equal(state.electricLevel, 44)
    assert.equal(state.packs.length, 1)
    assert.equal(state.packs[0].sn, 'PACK1')
  })

  it('parses flat property payloads and updates state', () => {
    const device = new ZendureDevice({ id: 'd1-flat', name: 'Test Flat', ip: '127.0.0.1' })
    const payload = JSON.stringify({
      solarInputPower: 187,
      outputHomePower: 156,
      electricLevel: 50
    })
    device.applyMqttMessage('some/topic', Buffer.from(payload))
    const state = device.getState()
    assert.equal(state.solarInputPower, 187)
    assert.equal(state.solarPower, 187)
    assert.equal(state.outputHomePower, 156)
    assert.equal(state.electricLevel, 50)
  })

  it('ignores invalid JSON payload silently', () => {
    const device = new ZendureDevice({ id: 'd2', name: 'Test', ip: '127.0.0.1' })
    assert.doesNotThrow(() => device.applyMqttMessage('topic', Buffer.from('not json')))
  })
})

describe('ZendureDevice MQTT Publishing', () => {
  it('includes mqttPublishEnabled in toJSON', () => {
    const device = new ZendureDevice({
      id: 'd3',
      name: 'SolarFlow 800',
      ip: '192.168.1.100',
      mqttPublishEnabled: true
    })
    const json = device.toJSON()
    assert.equal(json.mqttPublishEnabled, true)
  })

  it('publishes state to MQTT under zendure-cloudless-slug/state topic when mqttPublishEnabled is true', async () => {
    const device = new ZendureDevice({
      id: 'd4',
      name: 'SolarFlow 800',
      ip: '192.168.1.100',
      mqttPublishEnabled: true
    })

    const published = []
    const originalPublish = mqttService.publish
    mqttService.publish = (topic, payload, options) => {
      published.push({ topic, payload, options })
      return true
    }

    try {
      device.publishMqttDiscovery()
      assert.ok(published.length > 0)
      const solarConfig = published.find((p) => p.topic.includes('solarPower/config'))
      assert.ok(solarConfig)
      assert.equal(solarConfig.payload.state_topic, 'zendure-cloudless-solarflow-800/state')
      assert.equal(solarConfig.payload.device_class, 'power')

      const solarEnergyConfig = published.find((p) => p.topic.includes('solarEnergyKwh/config'))
      assert.ok(solarEnergyConfig)
      assert.equal(solarEnergyConfig.payload.device_class, 'energy')
      assert.equal(solarEnergyConfig.payload.state_class, 'total_increasing')

      const chargeEnergyConfig = published.find((p) => p.topic.includes('batteryChargeEnergyKwh/config'))
      assert.ok(chargeEnergyConfig)
      assert.equal(chargeEnergyConfig.payload.device_class, 'energy')
      assert.equal(chargeEnergyConfig.payload.state_class, 'total_increasing')

      const dischargeEnergyConfig = published.find((p) => p.topic.includes('batteryDischargeEnergyKwh/config'))
      assert.ok(dischargeEnergyConfig)
      assert.equal(dischargeEnergyConfig.payload.device_class, 'energy')
      assert.equal(dischargeEnergyConfig.payload.state_class, 'total_increasing')
    } finally {
      mqttService.publish = originalPublish
    }
  })

  it('includes solar, charge, and discharge energy totals in telemetry state published to MQTT', () => {
    const device = new ZendureDevice({
      id: 'd5',
      name: 'SolarFlow 800',
      ip: '192.168.1.100',
      mqttPublishEnabled: true
    })

    const published = []
    const originalPublish = mqttService.publish
    mqttService.publish = (topic, payload, options) => {
      published.push({ topic, payload, options })
      return true
    }

    try {
      const payload = JSON.stringify({
        properties: { solarInputPower: 500, outputPackPower: 300, packInputPower: 0, electricLevel: 50 },
        packData: [{ sn: 'PACK1', socLevel: 50, state: 1, power: 300, maxTemp: 3000, totalVol: 4900 }]
      })
      device.applyMqttMessage('some/topic', Buffer.from(payload))

      const stateMsg = published.find((p) => p.topic === 'zendure-cloudless-solarflow-800/state')
      assert.ok(stateMsg, 'Expected state message published to zendure-cloudless-solarflow-800/state')
      assert.notEqual(stateMsg.payload.solarEnergyKwh, undefined)
      assert.notEqual(stateMsg.payload.batteryChargeEnergyKwh, undefined)
      assert.notEqual(stateMsg.payload.batteryDischargeEnergyKwh, undefined)
      assert.equal(stateMsg.payload.electricLevel, 50)
      assert.equal(stateMsg.payload.batterySoc, 50)
      assert.equal(stateMsg.payload.soc, 50)
    } finally {
      mqttService.publish = originalPublish
    }
  })

  it('computes battery SOC from pack average when electricLevel is missing', () => {
    const device = new ZendureDevice({
      id: 'd6',
      name: 'SolarFlow 800 Plus',
      ip: '192.168.1.100',
      mqttPublishEnabled: true
    })

    const published = []
    const originalPublish = mqttService.publish
    mqttService.publish = (topic, payload, options) => {
      published.push({ topic, payload, options })
      return true
    }

    try {
      const payload = JSON.stringify({
        properties: { solarInputPower: 400 },
        packData: [
          { sn: 'PACK1', socLevel: 60, state: 1, power: 200 },
          { sn: 'PACK2', socLevel: 80, state: 1, power: 200 }
        ]
      })
      device.applyMqttMessage('some/topic', Buffer.from(payload))

      const stateMsg = published.find((p) => p.topic === 'zendure-cloudless-solarflow-800-plus/state')
      assert.ok(stateMsg)
      assert.equal(stateMsg.payload.electricLevel, 70)
      assert.equal(stateMsg.payload.batterySoc, 70)
      assert.equal(stateMsg.payload.soc, 70)
    } finally {
      mqttService.publish = originalPublish
    }
  })

  it('converts hyperTmp Kelvin tenth to Celsius in normalized state (e.g. 2971 -> 24.0)', () => {
    const device = new ZendureDevice({ id: 'd7', name: 'Test Temp', ip: '127.0.0.1' })
    const payload = JSON.stringify({
      properties: { hyperTmp: 2971 }
    })
    device.applyMqttMessage('some/topic', Buffer.from(payload))
    const state = device.getState()
    assert.equal(state.hyperTmp, 24.0)
    assert.equal(state.deviceTemp, 24.0)
  })

  it('preserves existing metrics during partial MQTT/REST updates instead of resetting to zero', () => {
    const device = new ZendureDevice({ id: 'd8', name: 'Test Partial', ip: '127.0.0.1' })
    
    // First full report
    const fullPayload = JSON.stringify({
      properties: {
        solarInputPower: 500,
        outputHomePower: 150,
        outputPackPower: 100,
        packInputPower: 0,
        electricLevel: 75,
        hyperTmp: 2971,
        minSoc: 50,
        socSet: 900
      },
      packData: [{ sn: 'PACK1', socLevel: 75, state: 1, power: 100 }]
    })
    device.applyMqttMessage('some/topic', Buffer.from(fullPayload))
    let state = device.getState()
    assert.equal(state.solarInputPower, 500)
    assert.equal(state.outputHomePower, 150)
    assert.equal(state.electricLevel, 75)
    assert.equal(state.hyperTmp, 24.0)
    assert.equal(state.packs.length, 1)

    // Second report with only solarInputPower updated
    const partialPayload = JSON.stringify({
      properties: { solarInputPower: 550 }
    })
    device.applyMqttMessage('some/topic', Buffer.from(partialPayload))
    state = device.getState()

    assert.equal(state.solarInputPower, 550)
    assert.equal(state.outputHomePower, 150)
    assert.equal(state.batteryChargePower, 100)
    assert.equal(state.electricLevel, 75)
    assert.equal(state.hyperTmp, 24.0)
    assert.equal(state.packs.length, 1)
  })

  it('publishes status entities without state_class for Home Assistant Activity log', () => {
    const device = new ZendureDevice({
      id: 'd9',
      name: 'SolarFlow 800 Status',
      ip: '192.168.1.100',
      mqttPublishEnabled: true
    })

    const published = []
    const originalPublish = mqttService.publish
    mqttService.publish = (topic, payload, options) => {
      published.push({ topic, payload, options })
      return true
    }

    try {
      device.publishMqttDiscovery()
      const batteryStateConfig = published.find((p) => p.topic.includes('batteryState/config'))
      assert.ok(batteryStateConfig, 'Expected batteryState discovery topic')
      assert.equal(batteryStateConfig.payload.state_class, undefined)
      assert.equal(batteryStateConfig.payload.value_template, '{{ value_json.batteryState }}')
    } finally {
      mqttService.publish = originalPublish
    }
  })

  it('ensures MQTT discovery state_topic matches published state topic when device has no name', () => {
    const device = new ZendureDevice({
      id: 'zendure-12345',
      ip: '192.168.1.100',
      mqttPublishEnabled: true
    })

    const published = []
    const originalPublish = mqttService.publish
    mqttService.publish = (topic, payload, options) => {
      published.push({ topic, payload, options })
      return true
    }

    try {
      device.applyMqttMessage('some/topic', Buffer.from(JSON.stringify({
        properties: { solarInputPower: 300, electricLevel: 80 }
      })))

      const discoveryMsg = published.find((p) => p.topic.includes('/config'))
      assert.ok(discoveryMsg, 'Expected discovery payload')
      const discoveryStateTopic = discoveryMsg.payload.state_topic

      const stateMsg = published.find((p) => p.topic.endsWith('/state'))
      assert.ok(stateMsg, 'Expected state payload')
      assert.equal(stateMsg.topic, discoveryStateTopic, 'Discovery state_topic must match state topic')
    } finally {
      mqttService.publish = originalPublish
    }
  })

  it('prevents zeroing out electricLevel and power sensors during partial MQTT reports', () => {
    const device = new ZendureDevice({
      id: 'd10',
      name: 'Partial Zero Test',
      ip: '192.168.1.100',
      mqttPublishEnabled: true
    })

    const published = []
    const originalPublish = mqttService.publish
    mqttService.publish = (topic, payload, options) => {
      published.push({ topic, payload, options })
      return true
    }

    try {
      // 1. Initial report with 85% SOC
      device.applyMqttMessage('some/topic', Buffer.from(JSON.stringify({
        properties: { electricLevel: 85, solarInputPower: 400, outputHomePower: 200 }
      })))

      let stateMsg = published[published.length - 1]
      assert.equal(stateMsg.payload.electricLevel, 85)
      assert.equal(stateMsg.payload.solarPower, 400)
      assert.equal(stateMsg.payload.outputHomePower, 200)

      // 2. Partial report with electricLevel undefined (glitch) and only solarInputPower updated
      device.applyMqttMessage('some/topic', Buffer.from(JSON.stringify({
        properties: { solarInputPower: 450 }
      })))

      stateMsg = published[published.length - 1]
      assert.equal(stateMsg.payload.electricLevel, 85, 'SOC should retain previous 85% when missing from partial update')
      assert.equal(stateMsg.payload.solarPower, 450)
      assert.equal(stateMsg.payload.outputHomePower, 200, 'outputHomePower should retain previous 200W')

      // 3. Explicit 0% SOC report when battery is genuinely empty
      device.applyMqttMessage('some/topic', Buffer.from(JSON.stringify({
        properties: { electricLevel: 0 }
      })))

      stateMsg = published[published.length - 1]
      assert.equal(stateMsg.payload.electricLevel, 0, 'Explicit 0% SOC should be accepted when battery is empty')
    } finally {
      mqttService.publish = originalPublish
    }
  })
})

