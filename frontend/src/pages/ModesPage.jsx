import { useState } from 'react'
import { useStore } from '../store/useStore'
import { Wand2, Home, Clock, SlidersHorizontal, Check } from 'lucide-react'
import CustomModeConfig from '../components/CustomModeConfig'

const MODES = [
  {
    id: 'auto',
    label: 'Auto Mode',
    icon: Wand2,
    color: 'text-primary',
    description: 'Intelligent automatic optimization based on hardware, conditions and tariff type. Adapts charge/discharge automatically.',
  },
  {
    id: 'self-consumption',
    label: 'Self-Consumption',
    icon: Home,
    color: 'text-violet-400',
    description: 'Maximize self-consumption. Solar covers home first, surplus charges battery, battery covers deficit.',
  },
  {
    id: 'tou',
    label: 'TOU Mode',
    icon: Clock,
    color: 'text-blue-400',
    description: 'Time-of-use tariff optimization. Charge at low price periods, discharge at high price periods.',
  },
  {
    id: 'custom',
    label: 'Custom Mode',
    icon: SlidersHorizontal,
    color: 'text-yellow-400',
    description: 'Define manual time slots with specific power output and charge/discharge type.',
  },
]

export default function ModesPage() {
  const devices = useStore((s) => s.devices)
  const deviceModes = useStore((s) => s.deviceModes)
  const setMode = useStore((s) => s.setMode)
  const [selectedDeviceId, setSelectedDeviceId] = useState(null)
  const [showCustom, setShowCustom] = useState(false)
  const [saving, setSaving] = useState(null)

  const device = selectedDeviceId
    ? devices.find((d) => d.id === selectedDeviceId)
    : devices[0]
  const currentMode = device ? deviceModes[device.id] : null

  const handleSelect = async (modeId) => {
    if (!device) return
    if (modeId === 'custom') { setShowCustom(true); return }
    setSaving(modeId)
    try { await setMode(device.id, modeId) } finally { setSaving(null) }
  }

  return (
    <div className="flex-1 p-6">
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-xl font-semibold">Select Operating Mode</h1>
        {devices.length > 1 && (
          <select
            value={device?.id || ''}
            onChange={(e) => setSelectedDeviceId(e.target.value)}
            className="bg-surface border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white ml-auto"
          >
            {devices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        )}
      </div>
      {!device && <p className="text-white/40 text-sm">No devices configured.</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
        {MODES.map(({ id, label, icon: Icon, color, description }) => {
          const isActive = currentMode === id
          return (
            <button
              key={id}
              onClick={() => handleSelect(id)}
              disabled={saving === id}
              className={`text-left p-5 rounded-xl border transition-all relative ${
                isActive
                  ? 'bg-surface border-primary/50 shadow-[0_0_20px_rgba(0,212,170,0.1)]'
                  : 'bg-surface border-white/5 hover:border-white/20 cursor-pointer'
              }`}
            >
              {isActive && (
                <span className="absolute top-3 right-3 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/30 flex items-center gap-1">
                  <Check size={10} /> Active
                </span>
              )}
              <div className={`mb-3 ${color}`}>
                <Icon size={22} />
              </div>
              <h3 className="font-semibold mb-1">{label}</h3>
              <p className="text-xs text-white/50 leading-relaxed">{description}</p>
            </button>
          )
        })}
      </div>

      {showCustom && device && (
        <CustomModeConfig
          device={device}
          onClose={() => setShowCustom(false)}
          onSave={async (schedule) => {
            await setMode(device.id, 'custom', { schedule })
            setShowCustom(false)
          }}
        />
      )}
    </div>
  )
}
