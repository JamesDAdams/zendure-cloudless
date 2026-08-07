import { registry } from '../devices/deviceRegistry.js'
import { haService } from './haService.js'

const timers = new Map()
const haTimers = new Map()

export function startPolling(device) {
  if (timers.has(device.id)) stopPolling(device.id)
  if (!device.sources?.rest || !device.enabled) return

  const tick = async () => {
    try {
      await device.fetchRest()
      registry.emit('device:state', { id: device.id, state: device.getState() })
    } catch (e) {
      console.error('Poll failed for', device.id, e.message)
    }
  }

  tick()
  const interval = setInterval(tick, device.pollingInterval * 1000)
  timers.set(device.id, interval)
}

export function stopPolling(id) {
  const t = timers.get(id)
  if (t) {
    clearInterval(t)
    timers.delete(id)
  }
}

export function startHaPolling(device) {
  if (haTimers.has(device.id)) stopHaPolling(device.id)
  if (!device.sources?.ha || !device.enabled) return
  const entityMap = device.haEntityMap || {}
  if (!Object.keys(entityMap).length) return

  const tick = async () => {
    try {
      const data = await haService.getStates()
      const byId = new Map(data.map((s) => [s.entity_id, s]))
      const state = {}
      Object.entries(entityMap).forEach(([role, entityId]) => {
        const ent = byId.get(entityId)
        if (!ent) return
        const val = parseFloat(ent.state)
        state[role] = isNaN(val) ? ent.state : val
      })
      state.lastUpdate = Date.now()
      Object.keys(entityMap).forEach((role) => {
        if (!(role in state)) delete device.state[role]
      })
      device.setState(state)
      registry.emit('device:state', { id: device.id, state: device.getState() })
    } catch (e) {
      console.error('HA poll failed for', device.id, e.message)
    }
  }

  tick()
  const interval = setInterval(tick, (device.pollingInterval || 10) * 1000)
  haTimers.set(device.id, interval)
}

export function stopHaPolling(id) {
  const t = haTimers.get(id)
  if (t) {
    clearInterval(t)
    haTimers.delete(id)
  }
}

export function restartPolling(device) {
  stopPolling(device.id)
  startPolling(device)
}
