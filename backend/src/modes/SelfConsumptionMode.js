import { BaseMode } from './BaseMode.js'

export class SelfConsumptionMode extends BaseMode {
  constructor() {
    super('self-consumption')
  }

  async tick(device, context) {
    const state = device.getState()
    const homePower = context.homePower ?? state.outputHomePower ?? 0
    const solarPower = context.solarPower ?? state.solarPower ?? 0
    const maxOutput = state.inverseMaxPower ?? 800

    const deficit = Math.max(0, homePower - solarPower)
    const newOutput = Math.min(deficit, maxOutput)

    if (Math.abs(newOutput - (state.outputLimit ?? 0)) > 10) {
      await device.sendCommand('outputLimit', Math.round(newOutput))
    }
  }
}
