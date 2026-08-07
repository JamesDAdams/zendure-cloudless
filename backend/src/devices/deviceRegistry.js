import { createDevice } from './deviceFactory.js'
import { EventEmitter } from 'events'

class DeviceRegistry extends EventEmitter {
  constructor() {
    super()
    this.devices = new Map()
  }

  add(config) {
    const device = createDevice(config)
    this.devices.set(device.id, device)
    this.emit('device:added', device)
    return device
  }

  remove(id) {
    const device = this.devices.get(id)
    if (device) {
      this.devices.delete(id)
      this.emit('device:removed', device)
    }
  }

  get(id) {
    return this.devices.get(id)
  }

  getAll() {
    return Array.from(this.devices.values())
  }

  updateState(id, data) {
    const device = this.devices.get(id)
    if (device) {
      device.setState(data)
      this.emit('device:state', { id, state: device.getState() })
    }
  }
}

export const registry = new DeviceRegistry()
