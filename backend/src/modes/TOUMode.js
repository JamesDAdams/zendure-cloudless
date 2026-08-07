import { BaseMode } from './BaseMode.js'

export class TOUMode extends BaseMode {
  constructor(config = {}) {
    super('tou')
    this.lowThreshold = config.lowThreshold ?? 0.25
    this.highThreshold = config.highThreshold ?? 0.5
    this.minPrice = config.minPrice || 0
    this.maxPrice = config.maxPrice || 0
    this.currentPrice = config.currentPrice || 0
  }

  _getPriceTier() {
    const range = this.maxPrice - this.minPrice
    if (range === 0) return 'medium'
    const ratio = (this.currentPrice - this.minPrice) / range
    if (ratio < this.lowThreshold) return 'low'
    if (ratio < this.highThreshold) return 'medium'
    return 'high'
  }

  async tick(device, context) {
    const state = device.getState()
    const solarPower = context.solarPower ?? state.solarPower ?? 0
    const homePower = context.homePower ?? state.outputHomePower ?? 0
    const surplus = Math.max(0, solarPower - homePower)
    const maxOutput = state.inverseMaxPower ?? 800
    const minSoc = state.minSoc ?? 50
    const currentSoc = state.electricLevel ?? 0
    const tier = this._getPriceTier()

    if (tier === 'low') {
      await device.sendCommand('inputLimit', Math.min(1000, surplus + 500))
      await device.sendCommand('outputLimit', 0)
    } else if (tier === 'medium') {
      await device.sendCommand('inputLimit', Math.min(1000, surplus))
      if (currentSoc > minSoc + 10) {
        await device.sendCommand('outputLimit', Math.round(maxOutput * 0.5))
      } else {
        await device.sendCommand('outputLimit', 0)
      }
    } else {
      await device.sendCommand('inputLimit', Math.min(1000, surplus))
      if (currentSoc > minSoc) {
        await device.sendCommand('outputLimit', maxOutput)
      }
    }
  }
}
