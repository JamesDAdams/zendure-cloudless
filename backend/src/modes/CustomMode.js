import { BaseMode } from './BaseMode.js'

export class CustomMode extends BaseMode {
  constructor(config = {}) {
    super('custom')
    this.schedule = config.schedule || []
  }

  _getCurrentSlot() {
    const now = new Date()
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const currentDay = dayNames[now.getDay()]
    const currentMinutes = now.getHours() * 60 + now.getMinutes()

    return this.schedule.find((slot) => {
      const dayMatch = !slot.days || slot.days.includes(currentDay) || slot.days.includes('all')
      if (!dayMatch) return false
      const [sh, sm] = slot.start.split(':').map(Number)
      const [eh, em] = slot.end.split(':').map(Number)
      const startMin = sh * 60 + sm
      const endMin = eh * 60 + em
      return currentMinutes >= startMin && currentMinutes < endMin
    })
  }

  async tick(device) {
    const slot = this._getCurrentSlot()
    if (!slot) return

    if (slot.type === 'discharge') {
      await device.sendCommand('outputLimit', slot.power ?? 200)
      await device.sendCommand('inputLimit', 0)
    } else if (slot.type === 'charge') {
      await device.sendCommand('inputLimit', slot.power ?? 400)
      await device.sendCommand('outputLimit', 0)
    } else {
      await device.sendCommand('outputLimit', 0)
      await device.sendCommand('inputLimit', 0)
    }
  }
}
