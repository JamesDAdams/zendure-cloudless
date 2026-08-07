import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import EnergyFlowSVG from '../components/EnergyFlowSVG'
import { hasSolarMapped, getDeviceValues, getMqttValue, computeHomeConsumption, computeTotalGrid } from '../utils/dashboardUtils'

describe('computeTotalGrid', () => {
  it('returns the home_consumption device grid directly when it exists (no sum with other devices)', () => {
    const allValues = [
      { grid: -500, isMqtt: true, dataType: 'home_consumption' },
      { grid: 300 },
      { grid: 120 },
    ]
    const homeDevice = allValues[0]
    expect(computeTotalGrid(homeDevice, allValues)).toBe(-500)
  })

  it('sums all device grids when no home_consumption device exists', () => {
    const allValues = [
      { grid: 300 },
      { grid: 120 },
      { grid: 80 },
    ]
    expect(computeTotalGrid(null, allValues)).toBe(500)
  })

  it('returns 0 when no devices contribute', () => {
    expect(computeTotalGrid(null, [])).toBe(0)
  })
})

describe('computeHomeConsumption', () => {
  it('computes home from grid + production, using Sortie maison for SolarFlow 800 Plus', () => {
    const allValues = [
      { grid: -500, solar: 0, home: -500, isMqtt: true, dataType: 'home_consumption' },
      { solar: 110, home: 0 },
      { solar: 120, home: 0 },
      { solar: 130, home: 100 },
    ]
    const devices = [
      { model: '' },
      { model: '' },
      { model: 'SolarFlow 800' },
      { model: 'SolarFlow 800 Plus' },
    ]
    const homeDevice = allValues[0]
    expect(computeHomeConsumption(homeDevice, allValues, devices)).toBe(170)
  })

  it('excludes the homeDevice itself from the production sum', () => {
    const allValues = [
      { grid: 300, solar: 50, home: 300, isMqtt: true, dataType: 'home_consumption' },
      { solar: 700, home: 0 },
    ]
    const devices = [{ model: '' }, { model: 'SolarFlow 800' }]
    expect(computeHomeConsumption(allValues[0], allValues, devices)).toBe(1000)
  })

  it('returns 0 when no device contributes', () => {
    expect(computeHomeConsumption(null, [], [])).toBe(0)
  })
})

describe('getMqttValue', () => {
  it('returns the mapped state value rounded', () => {
    expect(getMqttValue({ power: 123.7 }, { solar_power: 'power' }, 'solar_power')).toBe(124)
  })

  it('returns absolute value for non-battery roles — negative values become positive', () => {
    expect(getMqttValue({ power: -350 }, { solar_power: 'power' }, 'solar_power')).toBe(350)
  })

  it('preserves sign for battery_power — negative means discharging', () => {
    expect(getMqttValue({ power: -350 }, { battery_power: 'power' }, 'battery_power')).toBe(-350)
    expect(getMqttValue({ power: 250 }, { battery_power: 'power' }, 'battery_power')).toBe(250)
  })

  it('returns 0 when role is not in mappings', () => {
    expect(getMqttValue({ power: 100 }, {}, 'solar_power')).toBe(0)
  })

  it('returns 0 when state key is missing', () => {
    expect(getMqttValue({}, { solar_power: 'power' }, 'solar_power')).toBe(0)
  })
})

describe('hasSolarMapped', () => {
  it('returns true for MQTT device with solar_power in fieldMappings', () => {
    const devices = [
      {
        sources: { mqtt: true },
        fieldMappings: { solar_power: 'solarInputPower' },
      },
    ]
    expect(hasSolarMapped(devices)).toBe(true)
  })

  it('returns true for HA device with solar_power in haEntityMap', () => {
    const devices = [
      {
        sources: { ha: true },
        haEntityMap: { solar_power: 'sensor.solar_power' },
      },
    ]
    expect(hasSolarMapped(devices)).toBe(true)
  })

  it('returns false for MQTT device without solar_power in fieldMappings', () => {
    const devices = [
      {
        sources: { mqtt: true },
        fieldMappings: { battery_soc: 'electricLevel' },
      },
    ]
    expect(hasSolarMapped(devices)).toBe(false)
  })

  it('returns false for HA device without solar_power in haEntityMap', () => {
    const devices = [
      {
        sources: { ha: true },
        haEntityMap: { grid_power: 'sensor.grid' },
      },
    ]
    expect(hasSolarMapped(devices)).toBe(false)
  })

  it('returns false for REST-only device', () => {
    const devices = [{ sources: { rest: true } }]
    expect(hasSolarMapped(devices)).toBe(false)
  })

  it('returns true when at least one device among many has solar_power mapped', () => {
    const devices = [
      { sources: { rest: true } },
      { sources: { mqtt: true }, fieldMappings: { battery_soc: 'elec' } },
      { sources: { ha: true }, haEntityMap: { solar_power: 'sensor.solar' } },
    ]
    expect(hasSolarMapped(devices)).toBe(true)
  })

  it('returns false for MQTT+REST hybrid device with solar_power in fieldMappings (treated as REST)', () => {
    const devices = [
      {
        sources: { mqtt: true, rest: true },
        fieldMappings: { solar_power: 'solarInputPower' },
      },
    ]
    expect(hasSolarMapped(devices)).toBe(false)
  })

  it('returns false for MQTT+HA hybrid device (treated as REST)', () => {
    const devices = [
      {
        sources: { mqtt: true, ha: true },
        fieldMappings: { solar_power: 'solarInputPower' },
      },
    ]
    expect(hasSolarMapped(devices)).toBe(false)
  })

  it('returns false for empty device list', () => {
    expect(hasSolarMapped([])).toBe(false)
  })

  it('returns false when fieldMappings is undefined for MQTT device', () => {
    const devices = [{ sources: { mqtt: true } }]
    expect(hasSolarMapped(devices)).toBe(false)
  })

  it('returns false when haEntityMap is undefined for HA device', () => {
    const devices = [{ sources: { ha: true } }]
    expect(hasSolarMapped(devices)).toBe(false)
  })
})

describe('getDeviceValues - HA device isHa flag', () => {
  it('HA device has isHa=true and isMqtt=false', () => {
    const device = {
      sources: { ha: true },
      haEntityMap: { solar_power: 'sensor.clamp_solar_power' },
    }
    const values = getDeviceValues(device, { solar_power: '100' })
    expect(values.isHa).toBe(true)
    expect(values.isMqtt).toBe(false)
  })

  it('HA device resolves value via role name directly (backend maps entity to role)', () => {
    const device = {
      sources: { ha: true },
      haEntityMap: { solar_power: 'sensor.solarEdge_power' },
    }
    const values = getDeviceValues(device, { solar_power: '750' })
    expect(values.solar).toBe(750)
    expect(values.pv1).toBe(750)
  })

  it('HA device returns 0 when role is not in state', () => {
    const device = {
      sources: { ha: true },
      haEntityMap: { solar_power: 'sensor.solarEdge_power' },
    }
    const values = getDeviceValues(device, { other_sensor: '500' })
    expect(values.solar).toBe(0)
  })

  it('HA device does not have acStatus/dcStatus/gridState/pvStatus/IOTState', () => {
    const device = {
      sources: { ha: true },
      haEntityMap: { solar_power: 'sensor.clamp_solar_power' },
    }
    const values = getDeviceValues(device, { solar_power: '100' })
    expect(values.acStatus).toBeUndefined()
    expect(values.dcStatus).toBeUndefined()
    expect(values.gridState).toBeUndefined()
    expect(values.pvStatus).toBeUndefined()
    expect(values.IOTState).toBeUndefined()
  })

  it('REST device has isHa undefined and isMqtt=false', () => {
    const device = { sources: { rest: true } }
    const values = getDeviceValues(device, { solarPower: 100 })
    expect(values.isMqtt).toBe(false)
    expect(values.isHa).toBeUndefined()
  })
})

describe('getDeviceValues - solar card visibility', () => {
  it('MQTT device with solar_power mapped returns pv1 equal to solar value', () => {
    const device = {
      sources: { mqtt: true },
      fieldMappings: { solar_power: 'solarInputPower' },
    }
    const state = { solarInputPower: 350 }
    const values = getDeviceValues(device, state)
    expect(values.isMqtt).toBe(true)
    expect(values.pv1).toBe(350)
  })

  it('MQTT device with solar_power mapped returns pv1=0 when value is 0', () => {
    const device = {
      sources: { mqtt: true },
      fieldMappings: { solar_power: 'solarInputPower' },
    }
    const state = { solarInputPower: 0 }
    const values = getDeviceValues(device, state)
    expect(values.isMqtt).toBe(true)
    expect(values.pv1).toBe(0)
  })

  it('HA device with solar_power mapped returns pv1 equal to solar value', () => {
    const device = {
      sources: { ha: true },
      haEntityMap: { solar_power: 'sensor.clamp_solar_shed_power_a' },
    }
    const state = { solar_power: '520' }
    const values = getDeviceValues(device, state)
    expect(values.isHa).toBe(true)
    expect(values.pv1).toBe(520)
  })

  it('MQTT device with dataType home_consumption uses rawHome as home (no solar subtraction)', () => {
    const device = {
      sources: { mqtt: true },
      fieldMappings: { solar_power: 'solar', home_power: 'home' },
      dataType: 'home_consumption',
    }
    const state = { solar: 200, home: 800 }
    const values = getDeviceValues(device, state)
    expect(values.home).toBe(800)
  })

  it('MQTT device with dataType home_consumption maps grid to home_power when positive', () => {
    const device = {
      sources: { mqtt: true },
      fieldMappings: { solar_power: 'solar', home_power: 'home' },
      dataType: 'home_consumption',
    }
    const state = { solar: 200, home: 800 }
    const values = getDeviceValues(device, state)
    expect(values.grid).toBe(800)
  })

  it('MQTT device with negative home_power keeps signed home and grid (injection)', () => {
    const device = {
      sources: { mqtt: true },
      fieldMappings: { solar_power: 'solar', home_power: 'home' },
      dataType: 'home_consumption',
    }
    const state = { solar: 1200, home: -500 }
    const values = getDeviceValues(device, state)
    expect(values.home).toBe(-500)
    expect(values.grid).toBe(-500)
  })

  it('HA device with dataType home_consumption uses rawHome as home (no solar subtraction)', () => {
    const device = {
      sources: { ha: true },
      haEntityMap: { solar_power: 'sensor.solar', home_power: 'sensor.home' },
      dataType: 'home_consumption',
    }
    const state = { solar_power: '300', home_power: '700' }
    const values = getDeviceValues(device, state)
    expect(values.home).toBe(700)
  })

  it('HA device with negative home_power displays signed grid (injection)', () => {
    const device = {
      sources: { ha: true },
      haEntityMap: { solar_power: 'sensor.solar', home_power: 'sensor.home' },
      dataType: 'home_consumption',
    }
    const state = { solar_power: '300', home_power: '-500' }
    const values = getDeviceValues(device, state)
    expect(values.home).toBe(-500)
    expect(values.grid).toBe(-500)
  })

  it('MQTT device without home_consumption dataType keeps grid from grid_power mapping', () => {
    const device = {
      sources: { mqtt: true },
      fieldMappings: { solar_power: 'solar', home_power: 'home', grid_power: 'grid' },
      dataType: 'solar_production',
    }
    const state = { solar: 200, home: 800, grid: 300 }
    const values = getDeviceValues(device, state)
    expect(values.home).toBe(800)
    expect(values.grid).toBe(300)
  })

  it('REST device returns pv1 from solarPower1', () => {
    const device = { sources: { rest: true } }
    const state = { solarPower: 200, solarPower1: 120, solarPower2: 80 }
    const values = getDeviceValues(device, state)
    expect(values.isMqtt).toBe(false)
    expect(values.pv1).toBe(120)
    expect(values.pv2).toBe(80)
  })
})

describe('mqttHaSolarChips logic', () => {
  it('HA device produces isMqtt=false and isHa=true for chip filtering', () => {
    const device = {
      id: '2', name: 'Solar Shed',
      sources: { rest: false, mqtt: false, ha: true },
      haEntityMap: { solar_power: 'sensor.clamp_solar_shed_power_a' },
    }
    const values = getDeviceValues(device, { solar_power: 911.7 })
    expect(values.isHa).toBe(true)
    expect(values.isMqtt).toBe(false)
    expect(values.solar).toBe(912)
  })

  it('REST device produces isMqtt=false and isHa=undefined — excluded from HA/MQTT chips', () => {
    const device = { id: '1', name: 'REST Device', sources: { rest: true, mqtt: false, ha: false } }
    const values = getDeviceValues(device, {})
    expect(values.isMqtt).toBe(false)
    expect(values.isHa).toBeUndefined()
  })
})

describe('getDeviceValues - battery power sign for MQTT/HA', () => {
  it('MQTT device preserves negative battery_power (discharging)', () => {
    const device = { sources: { mqtt: true }, fieldMappings: { battery_power: 'battery' } }
    const values = getDeviceValues(device, { battery: -450 })
    expect(values.batteryPower).toBe(-450)
  })

  it('MQTT device keeps positive battery_power (charging)', () => {
    const device = { sources: { mqtt: true }, fieldMappings: { battery_power: 'battery' } }
    const values = getDeviceValues(device, { battery: 320 })
    expect(values.batteryPower).toBe(320)
  })

  it('HA device preserves negative battery_power (discharging)', () => {
    const device = { sources: { ha: true }, haEntityMap: { battery_power: 'sensor.battery' } }
    const values = getDeviceValues(device, { battery_power: '-230' })
    expect(values.batteryPower).toBe(-230)
  })

  it('MQTT device maps positive battery_power to batteryChargePower (charging)', () => {
    const device = { sources: { mqtt: true }, fieldMappings: { battery_power: 'battery' } }
    const values = getDeviceValues(device, { battery: 320 })
    expect(values.batteryChargePower).toBe(320)
    expect(values.batteryDischargePower).toBe(0)
  })

  it('MQTT device maps negative battery_power to batteryDischargePower (discharging)', () => {
    const device = { sources: { mqtt: true }, fieldMappings: { battery_power: 'battery' } }
    const values = getDeviceValues(device, { battery: -450 })
    expect(values.batteryChargePower).toBe(0)
    expect(values.batteryDischargePower).toBe(450)
  })

  it('HA device maps negative battery_power to batteryDischargePower (discharging)', () => {
    const device = { sources: { ha: true }, haEntityMap: { battery_power: 'sensor.battery' } }
    const values = getDeviceValues(device, { battery_power: '-230' })
    expect(values.batteryChargePower).toBe(0)
    expect(values.batteryDischargePower).toBe(230)
  })
})

describe('EnergyFlowSVG Solarflow 800+ flow logic', () => {
  it('renders active dashed line with 546W from battery to home when solar is 590W and outputHomePower is 546W even if batteryDischargePower is 0 (single-producer)', () => {
    const solarProducers = [
      {
        name: 'Solarflow 800 +',
        solar: 590,
        model: 'SolarFlow 800 Plus',
        outputHomePower: 546,
        home: 546,
        batteryChargePower: 0,
        batteryDischargePower: 0,
        batterySoc: 100,
      },
    ]
    const html = renderToString(React.createElement(EnergyFlowSVG, { state: { solarPower: 590, outputHomePower: 546 }, solarProducers }))
    expect(html).toContain('546W')
    expect(html).toContain('dashFlow')
  })

  it('renders active dashed line with 546W from battery to home in multi-producer view when batteryDischargePower is 0', () => {
    const solarProducers = [
      {
        name: 'Shed',
        solar: 1073,
        model: '',
        batteryChargePower: 0,
        batteryDischargePower: 0,
        batterySoc: 0,
      },
      {
        name: 'Solarflow 800 +',
        solar: 590,
        model: 'SolarFlow 800 Plus',
        outputHomePower: 546,
        home: 546,
        batteryChargePower: 0,
        batteryDischargePower: 0,
        batterySoc: 100,
      },
    ]
    const html = renderToString(React.createElement(EnergyFlowSVG, { state: { solarPower: 1663, outputHomePower: 454 }, solarProducers }))
    expect(html).toContain('546W')
    expect(html).toContain('dashFlow')
  })

  it('renders grid-to-battery charging flow only when batteryChargePower > solar', () => {
    const solarProducers = [
      {
        name: 'Solarflow 800 +',
        solar: 200,
        model: 'SolarFlow 800 Plus',
        outputHomePower: 0,
        home: 0,
        batteryChargePower: 600,
        batteryDischargePower: 0,
        batterySoc: 50,
      },
    ]
    const html = renderToString(React.createElement(EnergyFlowSVG, { state: { solarPower: 200, outputHomePower: 0 }, solarProducers }))
    expect(html).toContain('400W')
    expect(html).toContain('dashFlow')
  })
})
