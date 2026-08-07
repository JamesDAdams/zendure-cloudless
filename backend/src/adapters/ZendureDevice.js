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
    const props = raw.properties || {}
    const packs = raw.packData || []

    const normalizedPacks = packs.map((p) => ({
      sn: p.sn,
      socLevel: p.socLevel ?? 0,
      state: p.state ?? 0,
      power: p.power ?? 0,
      maxTemp: p.maxTemp ? parseFloat(((p.maxTemp - 2731) / 10).toFixed(1)) : 0,
      totalVol: p.totalVol ?? 0,
      packType: p.packType ?? 0,
      capacityKwh: packCapacityKwh(p.sn),
    }))

    const minSocPct = parseFloat(((props.minSoc ?? 0) / 10).toFixed(1))
    const socSetPct = parseFloat(((props.socSet ?? 1000) / 10).toFixed(1))

    const packAverageSoc = normalizedPacks.length > 0
      ? Math.round(normalizedPacks.reduce((s, p) => s + (p.socLevel ?? 0), 0) / normalizedPacks.length)
      : 0

    const electricLevel = (props.electricLevel != null && props.electricLevel > 0)
      ? props.electricLevel
      : (props.socLevel ?? props.electric_level ?? packAverageSoc)

    const totalCapacityKwh = parseFloat(normalizedPacks.reduce((s, p) => s + p.capacityKwh, 0).toFixed(2))
    const availableEnergyKwh = parseFloat((Math.max(0, electricLevel - minSocPct) / 100 * totalCapacityKwh).toFixed(2))

    const chargePower = props.outputPackPower ?? 0
    const dischargePower = props.packInputPower ?? 0
    let batteryState = 'Idle'
    if (chargePower > 0) batteryState = 'Charging'
    else if (dischargePower > 0) batteryState = 'Discharging'

    const rawVol = props.BatVolt ?? (normalizedPacks[0]?.totalVol ?? 0)
    const batteryVoltage = rawVol > 0 ? parseFloat((rawVol / 100).toFixed(2)) : 0

    const rawTmp = props.hyperTmp ?? 0
    const deviceTemp = rawTmp > 0 ? parseFloat(((rawTmp - 2731) / 10).toFixed(1)) : 0

    const remainInputTime = props.remainInputTime ?? 0
    const remainOutTime = props.remainOutTime ?? 0

    const normalized = {
      ...props,
      sn: raw.sn,
      product: raw.product,
      solarPower: props.solarInputPower ?? 0,
      solarInputPower: props.solarInputPower ?? 0,
      solarPower1: props.solarPower1 ?? 0,
      solarPower2: props.solarPower2 ?? 0,
      outputHomePower: props.outputHomePower ?? 0,
      outputPackPower: chargePower,
      packInputPower: dischargePower,
      gridInputPower: props.gridInputPower ?? 0,
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
      packState: props.packState ?? 0,
      remainOutTime,
      remainInputTime,
      outputLimit: props.outputLimit ?? 0,
      inputLimit: props.inputLimit ?? 1000,
      minSoc: minSocPct,
      socSet: socSetPct,
      smartMode: props.smartMode ?? 0,
      inverseMaxPower: props.inverseMaxPower ?? 800,
      acStatus: props.acStatus ?? 0,
      dcStatus: props.dcStatus ?? 0,
      gridState: props.gridState ?? 0,
      pvStatus: props.pvStatus ?? 0,
      IOTState: props.IOTState ?? 0,
      deviceTemp,
      reverseState: props.reverseState ?? 0,
      gridStandard: props.gridStandard ?? 0,
      chargeMaxLimit: props.chargeMaxLimit ?? 0,
      phaseSwitch: props.phaseSwitch ?? 0,
      batCalTime: props.batCalTime ?? 0,
      socCompSwitch: props.socCompSwitch ?? 0,
      rssi: props.rssi ?? 0,
      switchCnt: props.switchCnt ?? 0,
      bindstate: props.bindstate ?? 0,
      voltWakeup: props.voltWakeup ?? 0,
      isError: props.is_error ?? 0,
      aiState: props.aiState ?? 0,
      factoryModeState: props.factoryModeState ?? 0,
      OTAState: props.OTAState ?? 0,
      net: props.net ?? 0,
      dataReady: props.dataReady ?? 0,
      localAPIEnable: props.localAPIEnable ?? 0,
      writeRsp: props.writeRsp ?? 0,
      heatState: props.heatState ?? 0,
      lampSwitch: props.lampSwitch ?? 0,
      pass: props.pass ?? 0,
      socLimit: props.socLimit ?? 0,
      socStatus: props.socStatus ?? 0,
      faultLevel: props.faultLevel ?? 0,
      oldMode: props.oldMode ?? 0,
      gridReverse: props.gridReverse ?? 0,
      acMode: props.acMode ?? 0,
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
      mqttService.publish(stateTopic, normalized)
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
