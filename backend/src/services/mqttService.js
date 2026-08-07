import mqtt from 'mqtt'
import { configService } from './configService.js'
import { registry } from '../devices/deviceRegistry.js'
import { EventEmitter } from 'events'

class MqttService extends EventEmitter {
  constructor() {
    super()
    this.client = null
    this.connected = false
    this.seenTopics = new Set()
  }

  connect() {
    const { host, port, username, password } = configService.get().mqtt
    if (!host) return

    if (this.client) this.client.end(true)

    const url = `mqtt://${host}:${port}`
    this.client = mqtt.connect(url, {
      username: username || undefined,
      password: password || undefined,
      reconnectPeriod: 5000,
    })

    this.client.on('connect', () => {
      this.connected = true
      this.emit('connected')
      registry.getAll().forEach((d) => {
        if (d.sources?.mqtt && d.enabled) {
          if (!d.mqttTopicPrefix) {
            console.warn(`[mqtt] Device "${d.id}" has no mqttTopicPrefix — skipping subscription`)
            return
          }
          const topic = `${d.mqttTopicPrefix}/#`
          this.client.subscribe(topic, { qos: 0 })
        }
        if (d.mqttPublishEnabled && typeof d.publishMqttDiscovery === 'function') {
          d.publishMqttDiscovery()
        }
      })
    })

    this.client.on('message', (topic, payload) => {
      const parts = topic.split('/')
      const prefix = parts.slice(0, 2).join('/')
      this.seenTopics.add(prefix)
      registry.getAll().forEach((device) => {
        if (device.sources?.mqtt && device.enabled) {
          const matched = device.applyMqttMessage?.(topic, payload)
          if (matched) registry.emit('device:state', { id: device.id, state: device.getState() })
        }
      })
      this.emit('message', { topic, payload: payload.toString() })
    })

    this.client.on('error', (err) => {
      this.connected = false
      this.emit('error', err)
    })

    this.client.on('close', () => {
      this.connected = false
    })
  }

  subscribeDevice(device) {
    if (!this.client || !this.connected) return
    if (!device.mqttTopicPrefix) return
    const topic = `${device.mqttTopicPrefix}/#`
    this.client.subscribe(topic, { qos: 0 })
  }

  unsubscribeDevice(device) {
    if (!this.client || !this.connected) return
    if (!device.mqttTopicPrefix) return
    const topic = `${device.mqttTopicPrefix}/#`
    this.client.unsubscribe(topic)
  }

  publish(topic, payload, options = { qos: 0 }) {
    if (!this.client || !this.connected) return false
    const message = typeof payload === 'string' ? payload : JSON.stringify(payload)
    this.client.publish(topic, message, options)
    return true
  }

  searchTopics(search = '') {
    const devicePrefixes = configService.getDevices()
      .map((d) => d.mqttTopicPrefix)
      .filter(Boolean)
    const topics = Array.from(new Set([...this.seenTopics, ...devicePrefixes]))
    if (!search) return topics
    const q = search.toLowerCase()
    return topics.filter((t) => t.toLowerCase().includes(q))
  }

  disconnect() {
    if (this.client) {
      this.client.end(true)
      this.client = null
      this.connected = false
    }
  }

  async testConnection(overrides = {}) {
    return new Promise((resolve, reject) => {
      const cfg = { ...configService.get().mqtt, ...overrides }
      if (!cfg.host) return reject(new Error('MQTT host not configured'))
      const client = mqtt.connect(`mqtt://${cfg.host}:${cfg.port || 1883}`, {
        username: cfg.username || undefined,
        password: cfg.password || undefined,
        connectTimeout: 4000,
      })
      client.on('connect', () => { client.end(); resolve(true) })
      client.on('error', (err) => { client.end(true); reject(err) })
    })
  }
}

export const mqttService = new MqttService()
