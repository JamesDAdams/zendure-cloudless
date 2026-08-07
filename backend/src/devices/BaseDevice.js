export class BaseDevice {
  constructor(config) {
    this.id = config.id
    this.name = config.name
    this.brand = config.brand
    this.model = config.model
    this.ip = config.ip
    this.pollingInterval = config.pollingInterval || 10
    this.sources = config.sources || { rest: true, mqtt: true, ha: false }
    this.enabled = config.enabled !== false
    this.dataType = config.dataType || ''
    this.fieldMappings = config.fieldMappings || {}
    this.haEntity = config.haEntity || ''
    this.haDevice = config.haDevice || null
    this.haEntityMap = config.haEntityMap || {}
    this.mqttTopicPrefix = config.mqttTopicPrefix || null
    this.mqttPublishEnabled = Boolean(config.mqttPublishEnabled)
    this.state = {}
  }

  getState() {
    return this.state
  }

  setState(data) {
    this.state = { ...this.state, ...data, lastUpdate: Date.now() }
  }

  async fetchRest() {
    throw new Error('fetchRest not implemented')
  }

  async sendCommand(command, value) {
    throw new Error('sendCommand not implemented')
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      brand: this.brand,
      model: this.model,
      ip: this.ip,
      pollingInterval: this.pollingInterval,
      sources: this.sources,
      enabled: this.enabled,
      dataType: this.dataType,
      fieldMappings: this.fieldMappings,
      haEntity: this.haEntity,
      haDevice: this.haDevice,
      haEntityMap: this.haEntityMap,
      mqttTopicPrefix: this.mqttTopicPrefix,
      mqttPublishEnabled: this.mqttPublishEnabled,
      state: this.state,
    }
  }
}
