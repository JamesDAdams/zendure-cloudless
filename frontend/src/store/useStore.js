import { create } from 'zustand'
import { api } from '../api'


export const useStore = create((set, get) => ({
  devices: [],
  deviceStates: {},
  deviceModes: {},
  config: null,
  wsConnected: false,
  error: null,

  clearError: () => set({ error: null }),

  fetchDevices: async () => {
    try {
      const { data } = await api.get('/devices')
      const modes = {}
      data.forEach((d) => { if (d.mode) modes[d.id] = d.mode })
      set({ devices: data, deviceModes: modes })
    } catch (e) {
      set({ error: e.message })
    }
  },

  addDevice: async (config) => {
    try {
      const { data } = await api.post('/devices', config)
      set((s) => ({ devices: [...s.devices, data] }))
      return data
    } catch (e) {
      set({ error: e.message })
      throw e
    }
  },

  removeDevice: async (id) => {
    try {
      await api.delete(`/devices/${id}`)
      set((s) => ({ devices: s.devices.filter((d) => d.id !== id) }))
    } catch (e) {
      set({ error: e.message })
    }
  },

  updateDevice: async (id, patch) => {
    try {
      const { data } = await api.put(`/devices/${id}`, patch)
      set((s) => ({ devices: s.devices.map((d) => d.id === id ? { ...d, ...data } : d) }))
      return data
    } catch (e) {
      set({ error: e.message })
      throw e
    }
  },

  sendCommand: async (deviceId, command, value) => {
    try {
      const { data } = await api.post(`/devices/${deviceId}/command`, { command, value })
      return data
    } catch (e) {
      set({ error: e.message })
    }
  },

  setMode: async (deviceId, mode, modeConfig = {}) => {
    try {
      await api.post(`/devices/${deviceId}/mode`, { mode, config: modeConfig })
      set((s) => ({ deviceModes: { ...s.deviceModes, [deviceId]: mode } }))
    } catch (e) {
      set({ error: e.message })
    }
  },

  applyWsMessage: (msg) => {
    if (msg.type === 'init') {
      const states = {}
      msg.devices.forEach((d) => { states[d.id] = d.state })
      set({ deviceStates: states })
    } else if (msg.type === 'device:state') {
      set((s) => ({ deviceStates: { ...s.deviceStates, [msg.id]: msg.state } }))
    }
  },

  fetchConfig: async () => {
    const { data } = await api.get('/config')
    set({ config: data })
    return data
  },

  saveConfig: async (partial) => {
    try {
      const current = get().config || {}
      const merged = deepMerge(current, partial)
      await api.put('/config', merged)
      set({ config: merged })
    } catch (e) {
      set({ error: e.message })
    }
  },

  testMqtt: async (mqttCfg) => {
    const { data } = await api.post('/config/mqtt/test', mqttCfg || {})
    return data
  },

  testHa: async (haCfg) => {
    const { data } = await api.post('/config/ha/test', haCfg || {})
    return data
  },

  fetchHistory: async (deviceId, since) => {
    const { data } = await api.get(`/history/${deviceId}?since=${since}`)
    return data
  },

  fetchHistorySummary: async (deviceId, since) => {
    const { data } = await api.get(`/history/${deviceId}/summary?since=${since}`)
    return data
  },

  setWsConnected: (v) => set({ wsConnected: v }),
}))

function deepMerge(target, source) {
  const result = { ...target }
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key])
    } else {
      result[key] = source[key]
    }
  }
  return result
}
