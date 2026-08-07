import { AutoMode } from './AutoMode.js'
import { SelfConsumptionMode } from './SelfConsumptionMode.js'
import { TOUMode } from './TOUMode.js'
import { CustomMode } from './CustomMode.js'
import { configService } from '../services/configService.js'
import { haService } from '../services/haService.js'
import { registry } from '../devices/deviceRegistry.js'

class ModeEngine {
  constructor() {
    this.deviceModes = new Map()
    this.tickTimers = new Map()
  }

  _createMode(modeName, modeConfig = {}) {
    const tariffs = configService.get().tariffs || {}
    const touPrices = (tariffs.tou || []).map((t) => t.price).filter((p) => typeof p === 'number')
    const ctx = {
      tariffType: tariffs.type,
      currentPrice: tariffs.fixed,
      minPrice: touPrices.length ? Math.min(...touPrices) : 0,
      maxPrice: touPrices.length ? Math.max(...touPrices) : 0,
      ...modeConfig,
    }
    switch (modeName) {
      case 'auto': return new AutoMode(ctx)
      case 'self-consumption': return new SelfConsumptionMode()
      case 'tou': return new TOUMode(ctx)
      case 'custom': return new CustomMode(ctx)
      default: return null
    }
  }

  setMode(deviceId, modeName, modeConfig = {}) {
    const device = registry.get(deviceId)
    if (!device) throw new Error(`Device ${deviceId} not found`)

    const mode = this._createMode(modeName, modeConfig)
    if (!mode) throw new Error(`Unknown mode: ${modeName}`)

    this.deviceModes.set(deviceId, { mode, modeName, modeConfig })
    this._startTick(deviceId)
  }

  getMode(deviceId) {
    return this.deviceModes.get(deviceId)?.modeName || null
  }

  _startTick(deviceId) {
    if (this.tickTimers.has(deviceId)) clearInterval(this.tickTimers.get(deviceId))

    const tick = async () => {
      const entry = this.deviceModes.get(deviceId)
      const device = registry.get(deviceId)
      if (!entry || !device) return

      const context = {}
      try { context.solarPower = await haService.getSolarProduction(device) } catch {}
      try { context.homePower = await haService.getHomeConsumption(device) } catch {}

      try {
        await entry.mode.tick(device, context)
      } catch (e) {
        console.error('Mode tick failed for', deviceId, e.message)
      }
    }

    tick()
    this.tickTimers.set(deviceId, setInterval(tick, 30000))
  }

  stopMode(deviceId) {
    if (this.tickTimers.has(deviceId)) {
      clearInterval(this.tickTimers.get(deviceId))
      this.tickTimers.delete(deviceId)
    }
    this.deviceModes.delete(deviceId)
  }
}

export const modeEngine = new ModeEngine()
