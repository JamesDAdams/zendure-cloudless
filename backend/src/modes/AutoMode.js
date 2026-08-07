import { BaseMode } from './BaseMode.js'

export class AutoMode extends BaseMode {
  constructor(config = {}) {
    super('auto')
    this.tariffType = config.tariffType || 'fixed'
    this.currentPrice = config.currentPrice || 0
    this.minPrice = config.minPrice || 0
    this.maxPrice = config.maxPrice || 0
  }

  _isPriceLow() {
    if (this.tariffType === 'fixed') return false
    const range = this.maxPrice - this.minPrice
    if (range === 0) return false
    return (this.currentPrice - this.minPrice) / range < 0.25
  }

  async tick(device, context) {
    const state = device.getState()
    const solarPower = context.solarPower ?? state.solarPower ?? 0
    const homePower = context.homePower ?? state.outputHomePower ?? 0
    const surplus = Math.max(0, solarPower - homePower)
    const maxOutput = state.inverseMaxPower ?? 800
    const hasMeter = state.gridState === 1

    if (hasMeter) {
      const gridImport = state.gridInputPower ?? 0
      const newOutput = Math.min(gridImport + (state.outputLimit ?? 0), maxOutput)
      if (Math.abs(newOutput - (state.outputLimit ?? 0)) > 10) {
        await device.sendCommand('outputLimit', Math.round(newOutput))
      }
    } else {
      const chargeTarget = this._isPriceLow() ? Math.min(1000, surplus + 500) : surplus
      if (Math.abs(chargeTarget - (state.inputLimit ?? 0)) > 10) {
        await device.sendCommand('inputLimit', Math.round(chargeTarget))
      }
      await device.sendCommand('outputLimit', 200)
    }
  }
}
