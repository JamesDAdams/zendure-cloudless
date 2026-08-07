import { useState, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { Plus, Trash2, ChevronDown, ChevronUp, Save, Edit } from 'lucide-react'
import { SearchInput } from '../components/SearchInput'
import { haConfigured, mqttConfigured } from '../utils/configUtils'
import { api } from '../api'

const FIELD_ROLES = [
  { value: 'solar_power', label: 'Solar Power (W)' },
  { value: 'solar_energy', label: 'Solar Energy (kWh)' },
  { value: 'battery_soc', label: 'Battery SOC (%)' },
  { value: 'battery_power', label: 'Battery Power (W)' },
  { value: 'home_power', label: 'Home Consumption (W)' },
  { value: 'home_energy', label: 'Home Energy (kWh)' },
  { value: 'grid_power', label: 'Grid Power (W)' },
  { value: 'grid_energy', label: 'Grid Energy (kWh)' },
  { value: 'voltage', label: 'Voltage (V)' },
  { value: 'current', label: 'Current (A)' },
  { value: 'power_total', label: 'Total Power (W)' },
  { value: 'energy_total', label: 'Total Energy (kWh)' },
]


const ZENDURE_MODELS = ['SolarFlow 800', 'SolarFlow 800 Plus', 'Hub 2000']

const POLLING_OPTIONS = [
  { value: 5, label: '5s' }, { value: 10, label: '10s' }, { value: 30, label: '30s' },
  { value: 60, label: '1 min' }, { value: 120, label: '2 min' }, { value: 300, label: '5 min' },
]

function Input({ label, ...props }) {
  return (
    <div>
      <label className="text-xs text-white/40 mb-1 block">{label}</label>
      <input {...props} className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-primary/50" />
    </div>
  )
}

function HaDeviceSearch({ onSelect, selected }) {
  const initialQuery = selected ? (selected.name + (selected.manufacturer ? ` — ${selected.manufacturer}` : '')) : ''
  return (
    <SearchInput
      label="Home Assistant Device *"
      value={initialQuery}
      endpoint="/config/ha/devices"
      placeholder="Search device..."
      emptyMessage="No devices found"
      commitOnBlur={false}
      onEmpty={() => onSelect(null)}
      onPick={onSelect}
      getValue={(d) => d.name + (d.manufacturer ? ` — ${d.manufacturer}` : '')}
      getSub={(d) => [d.manufacturer, d.model, d.entityCount != null ? `${d.entityCount} sensors` : null].filter(Boolean).join(' · ')}
    />
  )
}

function AddDeviceModal({ onClose, onAdd }) {
  const [form, setForm] = useState({
    name: '', brand: 'zendure', model: 'SolarFlow 800', ip: '',
    pollingInterval: 10, sources: { rest: true, mqtt: false, ha: false },
    mqttTopicPrefix: '', mqttPublishEnabled: false, haDevice: null, haEntityMap: {}, solarSensor: '', batteryLevelSensor: '', dataType: '',
  })
  const [error, setError] = useState(null)
  const config = useStore((s) => s.config)
  const fetchConfig = useStore((s) => s.fetchConfig)
  useEffect(() => { if (!config) fetchConfig().catch(() => {}) }, [])
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const setSource = (src) => setForm((f) => ({ ...f, sources: { rest: src === 'rest', mqtt: src === 'mqtt', ha: src === 'ha' } }))
  const activeSource = form.sources.mqtt ? 'mqtt' : form.sources.ha ? 'ha' : 'rest'
  const sourceUnconfigured = activeSource === 'ha' && !haConfigured(config) ? 'Home Assistant is not configured — set it up in Settings first.' : activeSource === 'mqtt' && !mqttConfigured(config) ? 'MQTT broker is not configured — set it up in Settings first.' : ''

  const handleHaDeviceSelect = async (device) => {
    set('haDevice', device)
    set('haEntityMap', {})
  }

  const handleAdd = async () => {
    if (form.sources.mqtt && !form.mqttTopicPrefix.trim()) {
      setError('MQTT Topic Prefix is required when using MQTT source.')
      return
    }
    if (form.sources.ha && !form.haDevice) {
      setError('Select a Home Assistant device.')
      return
    }
    try {
      setError(null)
      const payload = { ...form }
      if (form.sources.mqtt || form.sources.ha) { payload.model = ''; payload.ip = '' }
      await onAdd(payload)
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to add device.')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-surface border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-base font-semibold">Add Device</h2>
        <div>
          <label className="text-xs text-white/40 mb-1 block">Source</label>
          <select value={activeSource} onChange={(e) => setSource(e.target.value)}
            className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50">
            <option value="rest">Zendure</option>
            <option value="mqtt">MQTT</option>
            <option value="ha">Home Assistant</option>
          </select>
        </div>
        {activeSource === 'rest' && (
          <div>
            <label className="text-xs text-white/40 mb-1 block">Model</label>
            <select value={form.model} onChange={(e) => set('model', e.target.value)}
              className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50">
              {ZENDURE_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        )}
        {form.sources.rest && <Input label="IP Address" value={form.ip} onChange={(e) => set('ip', e.target.value)} placeholder="192.168.1.x" />}
        {(form.sources.rest || form.sources.ha) && (
          <div>
            <label className="text-xs text-white/40 mb-1 block">Polling Interval</label>
            <select value={form.pollingInterval} onChange={(e) => set('pollingInterval', Number(e.target.value))}
              className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50">
              {POLLING_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        )}
        {activeSource === 'rest' && (
          <div className="space-y-2 pt-2 border-t border-white/10">
            <div className="flex items-center justify-between">
              <label className="text-xs text-white/70 font-medium cursor-pointer" htmlFor="mqttPublishAdd">
                Envoi des données au serveur MQTT
              </label>
              <input
                id="mqttPublishAdd"
                type="checkbox"
                checked={Boolean(form.mqttPublishEnabled)}
                onChange={(e) => set('mqttPublishEnabled', e.target.checked)}
                className="w-4 h-4 rounded bg-bg border-white/20 text-primary focus:ring-primary focus:ring-offset-bg cursor-pointer"
              />
            </div>
          </div>
        )}
        {form.sources.mqtt && <SearchInput label="MQTT Topic Prefix *" value={form.mqttTopicPrefix} onChange={(v) => set('mqttTopicPrefix', v)} endpoint="/config/mqtt/topics" placeholder="e.g. zendure/device/sn" emptyMessage="No topics found — type the prefix manually" />}
        {form.sources.ha && (
          <div>
            <HaDeviceSearch onSelect={handleHaDeviceSelect} selected={form.haDevice} />
            <p className="text-xs text-white/40 mt-1">After adding, map entities in the device card to start collecting data.</p>
          </div>
        )}
        {(form.sources.mqtt || form.sources.ha) && (
          <div>
            <label className="text-xs text-white/40 mb-1 block">Data Type</label>
            <select value={form.dataType} onChange={(e) => set('dataType', e.target.value)}
              className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50">
              <option value="">-- Select type --</option>
              <option value="solar_production">Solar Production</option>
              <option value="battery">Battery</option>
              <option value="home_consumption">Home Consumption / Production</option>
              <option value="grid">Grid</option>
              <option value="ev_charger">EV Charger</option>
            </select>
          </div>
        )}
        <Input label="Name" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="My SolarFlow" />
        {sourceUnconfigured && <p className="text-xs text-amber-400">{sourceUnconfigured}</p>}
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-white/50 hover:text-white">Cancel</button>
          <button onClick={handleAdd}
            className="px-4 py-2 text-sm bg-primary text-black font-medium rounded-lg hover:bg-primary/80">
            Add
          </button>
        </div>
      </div>
    </div>
  )
}

function EditDeviceModal({ device, onClose, onSave }) {
  const [name, setName] = useState(device.name || '')
  const [ip, setIp] = useState(device.ip || '')
  const [mqttTopicPrefix, setMqttTopicPrefix] = useState(device.mqttTopicPrefix || '')
  const [mqttPublishEnabled, setMqttPublishEnabled] = useState(device.mqttPublishEnabled ?? false)
  const [pollingInterval, setPollingInterval] = useState(device.pollingInterval || 10)
  const [error, setError] = useState(null)

  const handleSave = async () => {
    try {
      setError(null)
      const patch = { name }
      if (device.sources?.mqtt || device.brand === 'zendure' || device.sources?.rest) patch.mqttTopicPrefix = mqttTopicPrefix.trim()
      if (device.brand === 'zendure' || device.sources?.rest) patch.mqttPublishEnabled = mqttPublishEnabled
      if (device.sources?.rest || device.sources?.ha) {
        if (device.sources?.rest) patch.ip = ip
        patch.pollingInterval = Number(pollingInterval)
      }
      await onSave(device.id, patch)
      onClose()
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to update device.')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-surface border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
        <h2 className="text-base font-semibold">Edit Device</h2>
        
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="My SolarFlow" />
        
        {device.sources?.rest && (
          <Input label="IP Address" value={ip} onChange={(e) => setIp(e.target.value)} placeholder="192.168.1.x" />
        )}
        {(device.sources?.rest || device.sources?.ha) && (
          <div>
            <label className="text-xs text-white/40 mb-1 block">Polling Interval</label>
              <select value={pollingInterval} onChange={(e) => setPollingInterval(Number(e.target.value))}
                className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50">
                {POLLING_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
        )}

        {device.sources?.mqtt && (
          <Input label="MQTT Topic Prefix" value={mqttTopicPrefix} onChange={(e) => setMqttTopicPrefix(e.target.value)} placeholder="e.g. zendure/device/sn" />
        )}

        {(device.brand === 'zendure' || device.sources?.rest) && (
          <div className="space-y-2 pt-2 border-t border-white/10">
            <div className="flex items-center justify-between">
              <label className="text-xs text-white/70 font-medium cursor-pointer" htmlFor="mqttPublishEdit">
                Envoi des données au serveur MQTT
              </label>
              <input
                id="mqttPublishEdit"
                type="checkbox"
                checked={mqttPublishEnabled}
                onChange={(e) => setMqttPublishEnabled(e.target.checked)}
                className="w-4 h-4 rounded bg-bg border-white/20 text-primary focus:ring-primary focus:ring-offset-bg cursor-pointer"
              />
            </div>
          </div>
        )}
        
        {error && <p className="text-xs text-red-400">{error}</p>}
        
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-white/50 hover:text-white">Cancel</button>
          <button onClick={handleSave}
            className="px-4 py-2 text-sm bg-primary text-black font-medium rounded-lg hover:bg-primary/80">
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

function MetricRow({ label, value }) {
  return (
    <div className="flex justify-between items-center py-1 border-b border-white/5 last:border-0">
      <span className="text-xs text-white/40">{label}</span>
      <span className="text-xs text-white font-mono">{String(value)}</span>
    </div>
  )
}

const ZENDURE_KEY_LABELS = {
  solarPower: 'Entrée solaire',
  solarPower1: 'Solaire 1',
  solarPower2: 'Solaire 2',
  outputHomePower: 'Sortie',
  batteryChargePower: 'Charge batterie',
  packInputPower: 'Entrée pack',
  gridInputPower: 'Réseau',
  electricLevel: 'Batterie',
  outputLimit: 'Limite sortie',
  inputLimit: 'Limite entrée',
  minSoc: 'SOC min',
  socSet: 'SOC cible',
  inverseMaxPower: 'Puissance max',
  remainOutTime: 'Autonomie (min)',
  hyperTmp: 'Température (°C)',
}

const ZENDURE_SUMMARY_KEYS = ['solarPower', 'outputHomePower', 'batteryChargePower', 'electricLevel']

function ZendureSummary({ state }) {
  const { electricLevel, availableEnergyKwh, totalCapacityKwh } = state
  const hasBattery = (state.batteryCount ?? 0) > 0 || (state.packs?.length ?? 0) > 0
  const summaryKeys = ZENDURE_SUMMARY_KEYS.filter(k => {
    if ((k === 'batteryChargePower' || k === 'electricLevel') && !hasBattery) return false
    return true
  })
  return (
    <div className="grid grid-cols-4 gap-2 mt-2 px-4 pb-3">
      {summaryKeys.map((k) => (
        state[k] !== undefined && (
          <div key={k} className="bg-bg rounded-lg px-2 py-2 text-center">
            <p className="text-xs text-white/40 truncate">{ZENDURE_KEY_LABELS[k] || k}</p>
            <p className="text-sm font-semibold text-white mt-0.5">
              {k === 'electricLevel'
                ? <><div>{electricLevel}%</div>{totalCapacityKwh > 0 && <div className="text-xs text-white/50 font-normal">({availableEnergyKwh}/{totalCapacityKwh}kWh)</div>}</>
                : k === 'batteryChargePower'
                ? <><div>{state[k]} W</div><div className="text-xs text-white/50 font-normal">☀ {Math.max(0, (state.solarPower ?? 0) - (state.outputHomePower ?? 0))}W · ⚡ {state.gridInputPower ?? 0}W</div></>
                : k === 'outputHomePower'
                ? `${state[k]} W / ${state.inverseMaxPower ?? 0} W`
                : k.includes('Power') || k.includes('Limit') ? `${state[k]} W` : state[k]}
            </p>
          </div>
        )
      ))}
    </div>
  )
}

function ZendurePvSummary({ state }) {
  const hasPv1 = state.solarPower1 !== undefined
  const hasPv2 = state.solarPower2 !== undefined
  if (!hasPv1 && !hasPv2) return null
  const cols = [
    hasPv1 && { label: 'PV1', value: `${state.solarPower1 ?? 0} W` },
    hasPv2 && { label: 'PV2', value: `${state.solarPower2 ?? 0} W` },
  ].filter(Boolean)
  return (
    <div className="grid grid-cols-4 gap-2 px-4 pb-3">
      {cols.map((c) => (
        <div key={c.label} className="bg-bg rounded-lg px-2 py-2 text-center">
          <p className="text-xs text-white/40 truncate">{c.label}</p>
          <p className="text-sm font-semibold text-white mt-0.5">{c.value}</p>
        </div>
      ))}
    </div>
  )
}

const ZENDURE_SECTIONS = [
  {
    title: 'Puissance',
    keys: [
      ['solarPower', 'Entrée solaire', 'W'],
      ['solarPower1', 'Solaire PV1', 'W'],
      ['solarPower2', 'Solaire PV2', 'W'],
      ['outputHomePower', 'Sortie maison', 'W'],
      ['gridInputPower', 'Réseau', 'W'],
      ['batteryChargePower', 'Puissance charge', 'W'],
      ['batteryDischargePower', 'Puissance décharge', 'W'],
      ['batteryPower', 'Puissance batterie nette', 'W'],
    ],
  },
  {
    title: 'Batterie',
    keys: [
      ['electricLevel', 'SOC', '%'],
      ['availableEnergyKwh', 'Énergie disponible', 'kWh'],
      ['totalCapacityKwh', 'Capacité totale', 'kWh'],
      ['batteryState', 'État batterie', ''],
      ['batteryVoltage', 'Tension', 'V'],
      ['batteryCount', 'Nb packs', ''],
      ['remainOutTime', 'Autonomie décharge', 'min'],
      ['remainInputTime', 'Temps de charge', 'min'],
      ['deviceTemp', 'Température', '°C'],
      ['reverseState', 'Flux inverse', ''],
      ['chargeMaxLimit', 'Limite charge max', ''],
    ],
  },
  {
    title: 'Paramètres',
    keys: [
      ['outputLimit', 'Limite sortie', 'W'],
      ['inputLimit', 'Limite entrée', 'W'],
      ['inverseMaxPower', 'Puissance max onduleur', 'W'],
      ['minSoc', 'SOC min', '%'],
      ['socSet', 'SOC cible', '%'],
      ['smartMode', 'Mode smart', ''],
      ['phaseSwitch', 'Phase', ''],
      ['socCompSwitch', 'Comp. SOC', ''],
      ['batCalTime', 'Temps calibration', ''],
    ],
  },
  {
    title: 'Système',
    keys: [
      ['acStatus', 'AC Status', ''],
      ['dcStatus', 'DC Status', ''],
      ['pvStatus', 'PV Status', ''],
      ['gridState', 'État réseau', ''],
      ['IOTState', 'IOT State', ''],
      ['packState', 'Pack State', ''],
      ['dataReady', 'Data Ready', ''],
      ['isError', 'Erreur', ''],
      ['rssi', 'RSSI', 'dBm'],
      ['switchCnt', 'Compteur switch', ''],
      ['voltWakeup', 'Volt Wakeup', 'V'],
      ['bindstate', 'Bind State', ''],
      ['net', 'Net', ''],
      ['aiState', 'AI State', ''],
      ['OTAState', 'OTA State', ''],
      ['localAPIEnable', 'API Locale', ''],
    ],
  },
]

function ZendureDetails({ state }) {
  return (
    <div className="space-y-4">
      {ZENDURE_SECTIONS.map((section) => (
        <div key={section.title}>
          <p className="text-xs font-medium text-white/30 uppercase tracking-wider mb-1">{section.title}</p>
          {section.keys
            .filter(([k]) => state[k] !== undefined && state[k] !== null)
            .map(([k, label, unit]) => (
              <MetricRow key={k} label={label} value={`${state[k]}${unit ? ' ' + unit : ''}`} />
            ))}
        </div>
      ))}
      {state.packs && state.packs.length > 0 && (
        <div>
          <p className="text-xs font-medium text-white/30 uppercase tracking-wider mb-1">Packs</p>
          {state.packs.map((p, i) => (
            <div key={i} className="ml-2 mb-2 border-l border-white/5 pl-2">
              <p className="text-xs text-white/40 mb-0.5">Pack {i + 1} — {p.sn?.slice(-6)}</p>
              <MetricRow label="SOC" value={`${p.socLevel}%`} />
              <MetricRow label="Puissance" value={`${p.power} W`} />
              <MetricRow label="Température" value={`${p.maxTemp} °C`} />
              <MetricRow label="Tension" value={`${p.totalVol > 0 ? (p.totalVol / 100).toFixed(2) : 0} V`} />
              <MetricRow label="Capacité" value={`${p.capacityKwh} kWh`} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const DATA_TYPE_SUMMARY = {
  solar_production: [
    { role: 'solar_power', label: 'Production solaire', unit: 'W' },
    { role: 'solar_energy', label: 'Énergie produite', unit: 'kWh' },
    { role: 'voltage', label: 'Tension', unit: 'V' },
    { role: 'current', label: 'Courant', unit: 'A' },
  ],
  battery: [
    { role: 'battery_soc', label: 'SOC', unit: '%' },
    { role: 'battery_power', label: 'Puissance batterie', unit: 'W' },
    { role: 'voltage', label: 'Tension', unit: 'V' },
    { role: 'current', label: 'Courant', unit: 'A' },
  ],
  home_consumption: [
    { role: 'home_power', label: 'Consommation', unit: 'W' },
    { role: 'home_energy', label: 'Énergie', unit: 'kWh' },
    { role: 'power_total', label: 'Total', unit: 'W' },
    { role: 'energy_total', label: 'Total kWh', unit: 'kWh' },
  ],
  grid: [
    { role: 'grid_power', label: 'Réseau', unit: 'W' },
    { role: 'grid_energy', label: 'Énergie réseau', unit: 'kWh' },
    { role: 'voltage', label: 'Tension', unit: 'V' },
    { role: 'current', label: 'Courant', unit: 'A' },
  ],
  ev_charger: [
    { role: 'power_total', label: 'Puissance', unit: 'W' },
    { role: 'energy_total', label: 'Session', unit: 'kWh' },
    { role: 'voltage', label: 'Tension', unit: 'V' },
    { role: 'current', label: 'Courant', unit: 'A' },
  ],
}

function MqttSummary({ device, state }) {
  const cols = DATA_TYPE_SUMMARY[device.dataType]
  if (!cols) return null
  const mappings = device.fieldMappings || {}
  const items = cols.map((col) => {
    const key = mappings[col.role]
    const value = key !== undefined ? state[key] : undefined
    return { ...col, value }
  }).filter((col) => col.value !== undefined)
  if (!items.length) return null
  return (
    <div className="grid grid-cols-4 gap-2 mt-2 px-4 pb-3">
      {items.map((col) => (
        <div key={col.role} className="bg-bg rounded-lg px-2 py-2 text-center">
          <p className="text-xs text-white/40 truncate">{col.label}</p>
          <p className="text-sm font-semibold text-white mt-0.5">{col.value} <span className="text-xs font-normal text-white/40">{col.unit}</span></p>
        </div>
      ))}
    </div>
  )
}

function HaSummary({ device, state }) {
  const cols = DATA_TYPE_SUMMARY[device.dataType]
  if (!cols) return null
  const items = cols.map((col) => {
    const value = state[col.role]
    return { ...col, value }
  }).filter((col) => col.value !== undefined && col.value !== null)
  if (!items.length) return null
  return (
    <div className="grid grid-cols-4 gap-2 mt-2 px-4 pb-3">
      {items.map((col) => (
        <div key={col.role} className="bg-bg rounded-lg px-2 py-2 text-center">
          <p className="text-xs text-white/40 truncate">{col.label}</p>
          <p className="text-sm font-semibold text-white mt-0.5">{col.value} <span className="text-xs font-normal text-white/40">{col.unit}</span></p>
        </div>
      ))}
    </div>
  )
}

function DeviceCard({ device }) {
  const deviceStates = useStore((s) => s.deviceStates)
  const removeDevice = useStore((s) => s.removeDevice)
  const updateDevice = useStore((s) => s.updateDevice)
  const [expanded, setExpanded] = useState(false)
  const [mappings, setMappings] = useState(device.fieldMappings || {})
  const [savedMappings, setSavedMappings] = useState(false)
  const [haEntityMap, setHaEntityMap] = useState(device.haEntityMap || {})

  useEffect(() => { setMappings(device.fieldMappings || {}) }, [device.fieldMappings])
  useEffect(() => { setHaEntityMap(device.haEntityMap || {}) }, [device.haEntityMap])
  const [haEntities, setHaEntities] = useState([])
  const [haEntitiesLoaded, setHaEntitiesLoaded] = useState(false)
  const [savedHaMap, setSavedHaMap] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const state = deviceStates[device.id] || device.state || {}
  const isMqttOnly = device.sources?.mqtt && !device.sources?.rest && !device.sources?.ha
  const isHaOnly = device.sources?.ha && !device.sources?.rest && !device.sources?.mqtt
  const hasData = !!state.lastUpdate
  const isZendure = device.brand === 'zendure' && !isMqttOnly && !isHaOnly

  const { packs, lastUpdate, ...flatState } = state

  const getRoleForKey = (m, key) => Object.entries(m).find(([, v]) => v === key)?.[0] || ''

  const setMapping = (key, role) => {
    setMappings((m) => {
      const next = { ...m }
      Object.keys(next).forEach((r) => { if (next[r] === key) delete next[r] })
      if (role) next[role] = key
      return next
    })
    setSavedMappings(false)
  }

  const saveMappings = async () => {
    await updateDevice(device.id, { fieldMappings: mappings })
    setSavedMappings(true)
    setTimeout(() => setSavedMappings(false), 2000)
  }

  const loadHaEntities = async () => {
    if (haEntitiesLoaded || !device.haDevice?.id) return
    try {
      const { data } = await api.get(`/config/ha/devices/${encodeURIComponent(device.haDevice.id)}/entities`)
      setHaEntities(data)
    } catch { setHaEntities([]) }
    setHaEntitiesLoaded(true)
  }

  const setHaMapping = (role, entityId) => {
    setHaEntityMap((m) => {
      const next = { ...m }
      if (entityId) next[role] = entityId
      else delete next[role]
      return next
    })
    setSavedHaMap(false)
  }

  const saveHaMap = async () => {
    await updateDevice(device.id, { haEntityMap })
    setSavedHaMap(true)
    setTimeout(() => setSavedHaMap(false), 2000)
  }

  return (
    <div className="bg-surface border border-white/5 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${hasData ? 'bg-primary' : 'bg-white/20'}`} />
          <div>
            <p className="text-sm font-medium">{device.name}</p>
            <p className="text-xs text-white/40">
              {[
                isMqttOnly ? 'MQTT' : isHaOnly ? 'Home Assistant' : device.brand,
                device.model,
                device.dataType ? device.dataType.replace(/_/g, ' ') : null,
                device.ip || device.mqttTopicPrefix,
                (device.sources?.rest || device.sources?.ha) && device.pollingInterval ? `${device.pollingInterval}s` : null
              ].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowEdit(true)} className="text-white/30 hover:text-primary p-1" title="Edit Device">
            <Edit size={14} />
          </button>
          <button onClick={() => { setExpanded((v) => { if (!v && isHaOnly) loadHaEntities(); return !v }) }} className="text-white/30 hover:text-white p-1">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          <button onClick={() => removeDevice(device.id)} className="text-white/30 hover:text-red-400 p-1">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {hasData && isZendure && <ZendureSummary state={state} />}
      {hasData && isZendure && <ZendurePvSummary state={state} />}
      {hasData && isMqttOnly && <MqttSummary device={device} state={state} />}
      {hasData && isHaOnly && <HaSummary device={device} state={state} />}
      {isHaOnly && !hasData && (
        <p className="text-xs text-amber-400/80 px-4 pb-3">No data yet — expand the card and map sensors to roles.</p>
      )}

      {expanded && (
        <div className="px-4 pb-4 border-t border-white/5 pt-3">
          {isHaOnly && (
            <div className="space-y-2">
              <label className="text-xs text-white/40 block">Map sensors to roles</label>
              {haEntities.length === 0 && !haEntitiesLoaded && device.haDevice?.id && (
                <p className="text-xs text-white/30">Loading sensors...</p>
              )}
              {haEntitiesLoaded && haEntities.length === 0 && (
                <p className="text-xs text-white/30">No sensors found for this device.</p>
              )}
              {haEntities.length > 0 && haEntities.map((e) => {
                const assignedRole = Object.entries(haEntityMap).find(([, v]) => v === e.entity_id)?.[0] || ''
                return (
                  <div key={e.entity_id} className="flex justify-between items-center py-1 border-b border-white/5 last:border-0 gap-2">
                    <span className="text-xs text-white/40 font-mono w-48 shrink-0 truncate">{e.friendly_name}</span>
                    <select
                      value={assignedRole}
                      onChange={(ev) => {
                        setHaEntityMap((m) => {
                          const next = { ...m }
                          Object.keys(next).forEach((r) => { if (next[r] === e.entity_id) delete next[r] })
                          if (ev.target.value) next[ev.target.value] = e.entity_id
                          setSavedHaMap(false)
                          return next
                        })
                      }}
                      className="flex-1 bg-transparent border border-white/10 rounded px-1 py-0.5 text-xs text-white/50 focus:outline-none focus:border-primary/50 min-w-0"
                    >
                      <option value="">—</option>
                      {FIELD_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                    <span className="text-xs text-white font-mono shrink-0">{e.state}{e.unit ? ` ${e.unit}` : ''}</span>
                  </div>
                )
              })}
              {haEntities.length > 0 && (
                <div className="flex justify-end pt-2">
                  <button onClick={saveHaMap} className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-primary/20 text-primary hover:bg-primary/30">
                    <Save size={11} />{savedHaMap ? 'Saved!' : 'Save'}
                  </button>
                </div>
              )}
            </div>
          )}
          {!isHaOnly && (!hasData ? (
            <p className="text-xs text-white/30 text-center py-2">No data received yet</p>
          ) : isZendure ? (
            <ZendureDetails state={state} />
          ) : (
            <div className="space-y-0">
              {Object.entries(flatState).map(([k, v]) => (
                <div key={k} className="flex justify-between items-center py-1 border-b border-white/5 last:border-0 gap-2">
                  <span className="text-xs text-white/40 font-mono w-32 flex-shrink-0">{k}</span>
                  {isMqttOnly && (
                    <select value={getRoleForKey(mappings, k)} onChange={(e) => setMapping(k, e.target.value)}
                      className="flex-1 bg-transparent border border-white/10 rounded px-1 py-0.5 text-xs text-white/50 focus:outline-none focus:border-primary/50 min-w-0">
                      <option value="">—</option>
                      {FIELD_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  )}
                  <span className="text-xs text-white font-mono flex-shrink-0">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                </div>
              ))}
              {isMqttOnly && hasData && (
                <div className="flex justify-end pt-2">
                  <button onClick={saveMappings} className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-primary/20 text-primary hover:bg-primary/30">
                    <Save size={11} />{savedMappings ? 'Saved!' : 'Save'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {showEdit && (
        <EditDeviceModal
          device={device}
          onClose={() => setShowEdit(false)}
          onSave={updateDevice}
        />
      )}
    </div>
  )
}

export default function DevicesPage() {
  const { devices, addDevice } = useStore()
  const [showAdd, setShowAdd] = useState(false)

  return (
    <div className="flex-1 p-6 overflow-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Devices</h1>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-primary text-black font-medium rounded-lg hover:bg-primary/80">
          <Plus size={14} /> Add Device
        </button>
      </div>

      <div className="max-w-2xl space-y-3">
        {devices.length === 0 && (
          <p className="text-sm text-white/30 text-center py-8">No devices configured yet.</p>
        )}
        {devices.map((d) => <DeviceCard key={d.id} device={d} />)}
      </div>

      {showAdd && (
        <AddDeviceModal
          onClose={() => setShowAdd(false)}
          onAdd={async (device) => { await addDevice(device); setShowAdd(false) }}
        />
      )}
    </div>
  )
}
