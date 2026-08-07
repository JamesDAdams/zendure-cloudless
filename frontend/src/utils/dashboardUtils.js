export function getMqttValue(state, mappings, role) {
  const key = mappings?.[role]
  if (key === undefined) return 0
  const v = parseFloat(state[key])
  if (isNaN(v)) return 0
  const r = Math.round(v)
  return role === 'battery_power' ? r : Math.abs(r)
}

const HA_ROLE_KEYS = {
  solar_power: 'solar_power',
  home_power: 'home_power',
  grid_power: 'grid_power',
  battery_power: 'battery_power',
  battery_soc: 'battery_soc',
}

export function getDeviceValues(device, state) {
  const isMqttOnly = device.sources?.mqtt && !device.sources?.rest && !device.sources?.ha
  const isHaOnly = device.sources?.ha && !device.sources?.rest && !device.sources?.mqtt
  if (isMqttOnly || isHaOnly) {
    const m = isHaOnly ? HA_ROLE_KEYS : device.fieldMappings || {}
    const getVal = (role) => getMqttValue(state, m, role)
    const getSigned = (role) => {
      const key = m[role]
      if (key === undefined) return 0
      const v = parseFloat(state[key])
      if (isNaN(v)) return 0
      return Math.round(v)
    }
    const solar = getVal('solar_power')
    const rawHome = getSigned('home_power')
    const isHomeConsumption = device.dataType === 'home_consumption'
    const home = isHomeConsumption ? rawHome : getVal('home_power')
    const grid = isHomeConsumption ? rawHome : getVal('grid_power')
    const batteryPower = getVal('battery_power')
    return {
      solar,
      home,
      grid,
      batteryPower,
      batteryChargePower: batteryPower > 0 ? batteryPower : 0,
      batteryDischargePower: batteryPower < 0 ? Math.abs(batteryPower) : 0,
      batterySoc: getVal('battery_soc'),
      packs: [],
      pv1: solar,
      pv2: null,
      dataType: device.dataType || '',
      isMqtt: !isHaOnly,
      isHa: isHaOnly,
    }
  }
  const solar = state.solarPower ?? 0
  const packs = state.packs || []
  const hasBattery = packs.length > 0
  const home = hasBattery
    ? (state.outputHomePower ?? 0)
    : Math.max(0, (state.outputHomePower ?? 0) - solar)
  return {
    solar,
    home,
    grid: state.gridInputPower ?? 0,
    batteryPower: (state.batteryChargePower ?? 0) - (state.batteryDischargePower ?? 0),
    batteryChargePower: state.batteryChargePower ?? 0,
    batteryDischargePower: state.batteryDischargePower ?? 0,
    batterySoc: state.electricLevel ?? 0,
    packs,
    pv1: state.solarPower1,
    pv2: state.solarPower2,
    acStatus: state.acStatus,
    dcStatus: state.dcStatus,
    gridState: state.gridState,
    pvStatus: state.pvStatus,
    IOTState: state.IOTState,
    isMqtt: false,
  }
}

export function hasSolarMapped(devices) {
  return devices.some((d) => {
    const isMqttOnly = d.sources?.mqtt && !d.sources?.rest && !d.sources?.ha
    const isHaOnly = d.sources?.ha && !d.sources?.rest && !d.sources?.mqtt
    if (isMqttOnly) return 'solar_power' in (d.fieldMappings || {})
    if (isHaOnly) return 'solar_power' in (d.haEntityMap || {})
    return false
  })
}

export function computeHomeConsumption(homeDevice, allValues, devices) {
  const production = allValues.reduce((s, v, i) => {
    if (homeDevice && v === homeDevice) return s
    const isPlus = /plus/i.test(devices[i]?.model || '')
    return s + (isPlus ? (v.home ?? 0) : (v.solar ?? 0))
  }, 0)
  return Math.abs((homeDevice?.grid ?? 0) + production)
}

export function computeTotalGrid(homeDevice, allValues) {
  if (homeDevice) return homeDevice.grid ?? 0
  return allValues.reduce((s, v) => s + (v.grid ?? 0), 0)
}
