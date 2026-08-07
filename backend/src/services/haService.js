import axios from 'axios'
import WebSocket from 'ws'
import { configService } from './configService.js'

class HomeAssistantService {
  constructor() {
    this._statesCache = null
    this._statesCacheAt = 0
    this._statesCacheTTL = 30000
    this._statesPromise = null
    this._registryCache = null
    this._registryCacheAt = 0
  }

  _client() {
    const { url, token } = configService.get().homeAssistant
    if (!url || !token) throw new Error('HA not configured')
    return axios.create({
      baseURL: `${url}/api`,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      timeout: 5000,
    })
  }

  async getState(entityId) {
    const client = this._client()
    const res = await client.get(`/states/${entityId}`)
    return parseFloat(res.data.state) || 0
  }

  async getSolarProduction(device = null) {
    const solarSensor = device?.solarSensor || configService.get().homeAssistant?.solarSensor
    if (!solarSensor) return null
    return this.getState(solarSensor)
  }

  async getHomeConsumption(device = null) {
    const consumptionSensor = device?.consumptionSensor || configService.get().homeAssistant?.consumptionSensor
    if (!consumptionSensor) return null
    return this.getState(consumptionSensor)
  }

  async getStates(force = false) {
    const now = Date.now()
    const fresh = this._statesCache && now - this._statesCacheAt < this._statesCacheTTL
    if (!force && fresh) return this._statesCache
    if (this._statesCache && now - this._statesCacheAt < 2000) return this._statesCache
    if (!this._statesPromise) {
      this._statesPromise = this._fetchStates().finally(() => { this._statesPromise = null })
    }
    return this._statesPromise
  }

  async _fetchStates() {
    const client = this._client()
    const res = await client.get('/states')
    this._statesCache = res.data
    this._statesCacheAt = Date.now()
    return this._statesCache
  }

  async searchEntities(search = '') {
    const states = await this.getStates()
    const entities = states.map((e) => ({
      entity_id: e.entity_id,
      friendly_name: e.attributes?.friendly_name || e.entity_id,
      state: e.state,
      unit: e.attributes?.unit_of_measurement || '',
    }))
    if (!search) return entities.slice(0, 200)
    const q = search.toLowerCase()
    return entities
      .filter((e) => e.entity_id.toLowerCase().includes(q) || e.friendly_name.toLowerCase().includes(q))
      .slice(0, 200)
  }

  _wsConnect() {
    const { url, token } = configService.get().homeAssistant
    if (!url || !token) throw new Error('HA not configured')
    const wsUrl = url.replace(/^http/, 'ws') + '/api/websocket'
    return { ws: new WebSocket(wsUrl), token }
  }

  _wsRequest(type, payload = {}) {
    return new Promise((resolve, reject) => {
      let { ws, token } = this._wsConnect()
      let msgId = 1
      const timer = setTimeout(() => { ws.terminate(); reject(new Error('WebSocket timeout')) }, 10000)

      ws.on('message', (data) => {
        const msg = JSON.parse(data)
        if (msg.type === 'auth_required') {
          ws.send(JSON.stringify({ type: 'auth', access_token: token }))
        } else if (msg.type === 'auth_invalid') {
          clearTimeout(timer)
          ws.close()
          reject(new Error(msg.message || 'Invalid HA access token'))
        } else if (msg.type === 'auth_ok') {
          ws.send(JSON.stringify({ id: msgId, type, ...payload }))
        } else if (msg.type === 'result' && msg.id === msgId) {
          clearTimeout(timer)
          ws.close()
          if (msg.success) resolve(msg.result)
          else reject(new Error(msg.error?.message || 'WS error'))
        }
      })
      ws.on('error', (e) => { clearTimeout(timer); ws.close(); reject(e) })
    })
  }

  async _getRegistry() {
    const now = Date.now()
    if (this._registryCache && now - this._registryCacheAt < this._statesCacheTTL) {
      return this._registryCache
    }
    const [deviceRegistry, entityRegistry] = await Promise.all([
      this._wsRequest('config/device_registry/list'),
      this._wsRequest('config/entity_registry/list'),
    ])
    this._registryCache = { deviceRegistry, entityRegistry }
    this._registryCacheAt = Date.now()
    return this._registryCache
  }

  async searchDevices(search = '') {
    const { deviceRegistry, entityRegistry } = await this._getRegistry()

    const entityByDevice = {}
    for (const e of entityRegistry) {
      if (!e.device_id || e.disabled_by) continue
      entityByDevice[e.device_id] = (entityByDevice[e.device_id] || 0) + 1
    }

    const devices = deviceRegistry
      .filter((d) => (entityByDevice[d.id] || 0) > 0)
      .map((d) => ({
        id: d.id,
        name: d.name_by_user || d.name || d.id,
        manufacturer: d.manufacturer || '',
        model: d.model || '',
        entityCount: entityByDevice[d.id] || 0,
      }))

    if (!search) return devices.slice(0, 50)
    const q = search.toLowerCase()
    return devices
      .filter((d) => d.name.toLowerCase().includes(q) || d.manufacturer.toLowerCase().includes(q) || d.model.toLowerCase().includes(q))
      .slice(0, 50)
  }

  async getDeviceEntities(deviceId) {
    const [{ entityRegistry }, states] = await Promise.all([
      this._getRegistry(),
      this.getStates(),
    ])

    const stateMap = {}
    for (const s of states) {
      stateMap[s.entity_id] = s
    }

    const filtered = entityRegistry.filter((e) => e.device_id === deviceId && !e.disabled_by)
    return filtered.map((e) => {
      const state = stateMap[e.entity_id] || {}
      return {
        entity_id: e.entity_id,
        friendly_name: e.name || state.attributes?.friendly_name || e.entity_id,
        state: state.state || '',
        unit: state.attributes?.unit_of_measurement || '',
      }
    })
  }

  async testConnection(overrides = {}) {
    const cfg = { ...configService.get().homeAssistant, ...overrides }
    if (!cfg.url || !cfg.token) throw new Error('HA not configured')
    const client = axios.create({
      baseURL: `${cfg.url}/api`,
      headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
      timeout: 5000,
    })
    try {
      const res = await client.get('/')
      if (res.data.message !== 'API running.') throw new Error(`Unexpected response: ${res.data.message}`)
      return true
    } catch (err) {
      const msg = err.response
        ? `HTTP ${err.response.status}: ${err.response.data?.message || err.response.statusText}`
        : err.message
      throw new Error(msg)
    }
  }
}

export const haService = new HomeAssistantService()
