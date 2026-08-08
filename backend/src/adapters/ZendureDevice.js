import axios from 'axios'
import { BaseDevice } from '../devices/BaseDevice.js'
import { mqttService } from '../services/mqttService.js'
import { historyService } from '../services/historyService.js'

const COMMAND_MAP = {
  outputLimit: 'outputLimit',
  inputLimit: 'inputLimit',
  minSoc: 'minSoc',
  socSet: 'socSet',
  smartMode: 'smartMode',
}

const SENSORS = [
  { key: 'solarPower', name: 'Solar Power', unit: 'W', device_class: 'power', state_class: 'measurement' },
  { key: 'solarEnergyKwh', name: 'Solar Energy', unit: 'kWh', device_class: 'energy', state_class: 'total_increasing' },
  { key: 'outputHomePower', name: 'Output Home Power', unit: 'W', device_class: 'power', state_class: 'measurement' },
  { key: 'outputHomeEnergyKwh', name: 'Output Home Energy', unit: 'kWh', device_class: 'energy', state_class: 'total_increasing' },
  { key: 'batteryChargePower', name: 'Battery Charge Power', unit: 'W', device_class: 'power', state_class: 'measurement' },
  { key: 'batteryChargeEnergyKwh', name: 'Battery Charge Energy', unit: 'kWh', device_class: 'energy', state_class: 'total_increasing' },
  { key: 'batteryDischargePower', name: 'Battery Discharge Power', unit: 'W', device_class: 'power', state_class: 'measurement' },
  { key: 'batteryDischargeEnergyKwh', name: 'Battery Discharge Energy', unit: 'kWh', device_class: 'energy', state_class: 'total_increasing' },
  { key: 'electricLevel', name: 'Battery SOC', unit: '%', device_class: 'battery', state_class: 'measurement' },
  { key: 'availableEnergyKwh', name: 'Available Energy', unit: 'kWh', device_class: 'energy', state_class: 'measurement' },
  { key: 'totalCapacityKwh', name: 'Total Capacity', unit: 'kWh', device_class: 'energy', entity_category: 'diagnostic' },
  { key: 'hyperTmp', name: 'Temperature', unit: '°C', device_class: 'temperature', state_class: 'measurement' },
  { key: 'minSoc', name: 'Min SOC', unit: '%', device_class: 'battery', entity_category: 'diagnostic' },
  { key: 'socSet', name: 'Target SOC', unit: '%', device_class: 'battery', entity_category: 'diagnostic' },
  { key: 'batteryState', name: 'Battery State' },
  { key: 'packState', name: 'Pack State', entity_category: 'diagnostic' },
  { key: 'gridState', name: 'Grid State', entity_category: 'diagnostic' },
  { key: 'acStatus', name: 'AC Status', entity_category: 'diagnostic' },
]

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
}

function packCapacityKwh(sn) {
  if (!sn) return 0.96
  switch (sn[0]) {
    case 'A': return sn[3] === '3' ? 2.4 : 0.96
    case 'B': return 0.96
    case 'C': return 1.92
    default:
      console.warn(`[ZendureDevice] Unknown pack SN prefix "${sn[0]}" for SN "${sn}" — defaulting capacity to 0.96 kWh`)
      return 0.96
  }
}

export class ZendureDevice extends BaseDevice {
  constructor(config) {
    super({ ...config, brand: 'zendure' })
    this.mqttTopicPrefix = config.mqttTopicPrefix || null
  }

  async fetchRest() {
    const res = await axios.get(`http://${this.ip}/properties/report`, { timeout: 5000 })
    return this.processReport(res.data)
  }

  processReport(raw) {
    const prevState = this.state || {}
    const props = raw.properties || {}
    const packs = raw.packData

    const normalizedPacks = Array.isArray(packs)
      ? packs.map((p) => ({
          sn: p.sn,
          socLevel: p.socLevel ?? 0,
          state: p.state ?? 0,
          power: p.power ?? 0,
          maxTemp: p.maxTemp ? parseFloat(((p.maxTemp - 2731) / 10).toFixed(1)) : 0,
          totalVol: p.totalVol ?? 0,
          packType: p.packType ?? 0,
          capacityKwh: packCapacityKwh(p.sn),
        }))
      : (prevState.packs || [])

    const minSocPct = props.minSoc !== undefined
      ? parseFloat(((props.minSoc) / 10).toFixed(1))
      : (prevState.minSoc ?? 0)

    const socSetPct = props.socSet !== undefined
      ? parseFloat(((props.socSet) / 10).toFixed(1))
      : (prevState.socSet ?? 100)

    const packAverageSoc = normalizedPacks.length > 0
      ? Math.round(normalizedPacks.reduce((s, p) => s + (p.socLevel ?? 0), 0) / normalizedPacks.length)
      : 0

    const electricLevel = (props.electricLevel != null && props.electricLevel > 0)
      ? props.electricLevel
      : (props.socLevel ?? props.electric_level ?? (normalizedPacks.length > 0 ? packAverageSoc : (prevState.electricLevel ?? 0)))

    const totalCapacityKwh = normalizedPacks.length > 0
      ? parseFloat(normalizedPacks.reduce((s, p) => s + p.capacityKwh, 0).toFixed(2))
      : (prevState.totalCapacityKwh ?? 0)

    const availableEnergyKwh = parseFloat((Math.max(0, electricLevel - minSocPct) / 100 * totalCapacityKwh).toFixed(2))

    const chargePower = props.outputPackPower !== undefined
      ? props.outputPackPower
      : (prevState.batteryChargePower ?? prevState.outputPackPower ?? 0)

    const dischargePower = props.packInputPower !== undefined
      ? props.packInputPower
      : (prevState.batteryDischargePower ?? prevState.packInputPower ?? 0)

    const solarPower = props.solarInputPower !== undefined
      ? props.solarInputPower
      : (prevState.solarInputPower ?? prevState.solarPower ?? 0)

    const outputHomePower = props.outputHomePower !== undefined
      ? props.outputHomePower
      : (prevState.outputHomePower ?? 0)

    const gridInputPower = props.gridInputPower !== undefined
      ? props.gridInputPower
      : (prevState.gridInputPower ?? 0)

    let batteryState = 'Idle'
    if (chargePower > 0) batteryState = 'Charging'
    else if (dischargePower > 0) batteryState = 'Discharging'

    const rawVol = props.BatVolt !== undefined ? props.BatVolt : (Array.isArray(packs) ? normalizedPacks[0]?.totalVol : undefined)
    const batteryVoltage = rawVol !== undefined
      ? (rawVol > 0 ? parseFloat((rawVol / 100).toFixed(2)) : 0)
      : (prevState.batteryVoltage ?? 0)

    const rawTmp = props.hyperTmp
    const deviceTemp = rawTmp !== undefined
      ? (rawTmp > 0 ? parseFloat(((rawTmp - 2731) / 10).toFixed(1)) : 0)
      : (prevState.hyperTmp ?? prevState.deviceTemp ?? 0)

    const remainInputTime = props.remainInputTime ?? prevState.remainInputTime ?? 0
    const remainOutTime = props.remainOutTime ?? prevState.remainOutTime ?? 0

    const normalized = {
      ...prevState,
      ...props,
      sn: raw.sn ?? prevState.sn,
      product: raw.product ?? prevState.product,
      solarPower,
      solarInputPower: solarPower,
      solarPower1: props.solarPower1 ?? prevState.solarPower1 ?? 0,
      solarPower2: props.solarPower2 ?? prevState.solarPower2 ?? 0,
      outputHomePower,
      outputPackPower: chargePower,
      packInputPower: dischargePower,
      gridInputPower,
      electricLevel,
      batterySoc: electricLevel,
      soc: electricLevel,
      availableEnergyKwh,
      totalCapacityKwh,
      batteryCount: normalizedPacks.length,
      batteryVoltage,
      batteryChargePower: chargePower,
      batteryDischargePower: dischargePower,
      batteryPower: -(chargePower) + dischargePower,
      batteryState,
      packState: props.packState ?? prevState.packState ?? 0,
      remainOutTime,
      remainInputTime,
      outputLimit: props.outputLimit ?? prevState.outputLimit ?? 0,
      inputLimit: props.inputLimit ?? prevState.inputLimit ?? 1000,
      minSoc: minSocPct,
      socSet: socSetPct,
      smartMode: props.smartMode ?? prevState.smartMode ?? 0,
      inverseMaxPower: props.inverseMaxPower ?? prevState.inverseMaxPower ?? 800,
      acStatus: props.acStatus ?? prevState.acStatus ?? 0,
      dcStatus: props.dcStatus ?? prevState.dcStatus ?? 0,
      gridState: props.gridState ?? prevState.gridState ?? 0,
      pvStatus: props.pvStatus ?? prevState.pvStatus ?? 0,
      IOTState: props.IOTState ?? prevState.IOTState ?? 0,
      hyperTmp: deviceTemp,
      deviceTemp,
      reverseState: props.reverseState ?? prevState.reverseState ?? 0,
      gridStandard: props.gridStandard ?? prevState.gridStandard ?? 0,
      chargeMaxLimit: props.chargeMaxLimit ?? prevState.chargeMaxLimit ?? 0,
      phaseSwitch: props.phaseSwitch ?? prevState.phaseSwitch ?? 0,
      batCalTime: props.batCalTime ?? prevState.batCalTime ?? 0,
      socCompSwitch: props.socCompSwitch ?? prevState.socCompSwitch ?? 0,
      rssi: props.rssi ?? prevState.rssi ?? 0,
      switchCnt: props.switchCnt ?? prevState.switchCnt ?? 0,
      bindstate: props.bindstate ?? prevState.bindstate ?? 0,
      voltWakeup: props.voltWakeup ?? prevState.voltWakeup ?? 0,
      isError: props.is_error ?? props.isError ?? prevState.isError ?? 0,
      aiState: props.aiState ?? prevState.aiState ?? 0,
      factoryModeState: props.factoryModeState ?? prevState.factoryModeState ?? 0,
      OTAState: props.OTAState ?? prevState.OTAState ?? 0,
      net: props.net ?? prevState.net ?? 0,
      dataReady: props.dataReady ?? prevState.dataReady ?? 0,
      localAPIEnable: props.localAPIEnable ?? prevState.localAPIEnable ?? 0,
      writeRsp: props.writeRsp ?? prevState.writeRsp ?? 0,
      heatState: props.heatState ?? prevState.heatState ?? 0,
      lampSwitch: props.lampSwitch ?? prevState.lampSwitch ?? 0,
      pass: props.pass ?? prevState.pass ?? 0,
      socLimit: props.socLimit ?? prevState.socLimit ?? 0,
      socStatus: props.socStatus ?? prevState.socStatus ?? 0,
      faultLevel: props.faultLevel ?? prevState.faultLevel ?? 0,
      oldMode: props.oldMode ?? prevState.oldMode ?? 0,
      gridReverse: props.gridReverse ?? prevState.gridReverse ?? 0,
      acMode: props.acMode ?? prevState.acMode ?? 0,
      packs: normalizedPacks,
    }

    const energyTotals = historyService.updateEnergyTotals(this.id, normalized)
    normalized.solarEnergyKwh = energyTotals.solarEnergyKwh
    normalized.outputHomeEnergyKwh = energyTotals.outputHomeEnergyKwh
    normalized.batteryChargeEnergyKwh = energyTotals.batteryChargeEnergyKwh
    normalized.batteryDischargeEnergyKwh = energyTotals.batteryDischargeEnergyKwh
    normalized.packChargeEnergyKwh = energyTotals.packChargeEnergyKwh
    normalized.packDischargeEnergyKwh = energyTotals.packDischargeEnergyKwh

    this.setState(normalized)
    if (this.mqttPublishEnabled) {
      this.publishMqttDiscovery()
      const slug = slugify(this.name || normalized.sn || this.id)
      const stateTopic = `zendure-cloudless-${slug}/state`
      mqttService.publish(stateTopic, normalized, { retain: true })
    }
    return normalized
  }

  publishMqttDiscovery() {
    if (!this.mqttPublishEnabled) return
    const slug = slugify(this.name || this.model || this.id)
    const stateTopic = `zendure-cloudless-${slug}/state`
    const deviceId = slugify(this.id)

    const deviceObj = {
      identifiers: [`zendure_cloudless_${deviceId}`],
      name: this.name || 'Zendure SolarFlow',
      model: this.model || 'SolarFlow',
      manufacturer: 'Zendure',
    }

    SENSORS.forEach((sensor) => {
      const discoveryTopic = `homeassistant/sensor/zendure_cloudless_${deviceId}/${sensor.key}/config`
      const payload = {
        name: `${this.name || 'Zendure'} ${sensor.name}`,
        unique_id: `zendure_cloudless_${deviceId}_${sensor.key}`,
        state_topic: stateTopic,
        value_template: `{{ value_json.${sensor.key} }}`,
        unit_of_measurement: sensor.unit,
        device_class: sensor.device_class,
        state_class: sensor.state_class,
        entity_category: sensor.entity_category,
        icon: sensor.icon,
        device: deviceObj,
      }
      mqttService.publish(discoveryTopic, payload, { retain: true })
    })
  }

  async sendCommand(command, value) {
    const key = COMMAND_MAP[command]
    if (!key) throw new Error(`Unknown command: ${command}`)
    const payload = { sn: this.state.sn, properties: { [key]: value } }
    await axios.post(`http://${this.ip}/properties/write`, payload, { timeout: 5000 })
    this.setState({ [command]: value })
    return { ok: true, command, value }
  }

  applyMqttMessage(topic, payload) {
    if (this.mqttTopicPrefix && !topic.startsWith(this.mqttTopicPrefix)) return false
    try {
      const data = JSON.parse(payload.toString())
      if (data.properties || data.packData) {
        this.processReport(data)
        return true
      }
      if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
        this.setState(data)
        return true
      }
      return false
    } catch {
      return false
    }
  }
}
