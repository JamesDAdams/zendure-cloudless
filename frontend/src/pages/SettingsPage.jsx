import { useState, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { CheckCircle, XCircle } from 'lucide-react'

function Input({ label, ...props }) {
  return (
    <div>
      <label className="text-xs text-white/40 mb-1 block">{label}</label>
      <input {...props} className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-primary/50" />
    </div>
  )
}

export default function SettingsPage() {
  const { fetchConfig, saveConfig, testMqtt, testHa } = useStore()
  const [mqttStatus, setMqttStatus] = useState(null)
  const [haStatus, setHaStatus] = useState(null)
  const [local, setLocal] = useState(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => { fetchConfig().then((c) => setLocal(JSON.parse(JSON.stringify(c)))) }, [])

  if (!local) return <div className="flex-1 flex items-center justify-center text-white/40">Loading...</div>

  const setNested = (path, value) => {
    setLocal((prev) => {
      const next = { ...prev }
      const keys = path.split('.')
      let cur = next
      for (let i = 0; i < keys.length - 1; i++) { cur[keys[i]] = { ...cur[keys[i]] }; cur = cur[keys[i]] }
      cur[keys[keys.length - 1]] = value
      return next
    })
  }

  const handleSave = async () => {
    await saveConfig({ ...local })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="flex-1 p-6 overflow-auto">
      <h1 className="text-xl font-semibold mb-6">Settings</h1>

      <div className="max-w-2xl space-y-6">
        <Section title="MQTT Broker">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Host" value={local.mqtt?.host || ''} onChange={(e) => setNested('mqtt.host', e.target.value)} placeholder="192.168.1.x" />
            <Input label="Port" type="number" value={local.mqtt?.port || 1883} onChange={(e) => setNested('mqtt.port', Number(e.target.value))} />
            <Input label="Username" value={local.mqtt?.username || ''} onChange={(e) => setNested('mqtt.username', e.target.value)} />
            <Input label="Password" type="password" value={local.mqtt?.password === '***' ? '' : local.mqtt?.password || ''} onChange={(e) => setNested('mqtt.password', e.target.value)} placeholder={local.mqtt?.password === '***' ? 'saved — leave blank to keep' : ''} />
          </div>
          <TestButton label="Test MQTT" status={mqttStatus} onTest={async () => { const r = await testMqtt(local.mqtt); setMqttStatus(r) }} />
        </Section>

        <Section title="Home Assistant">
          <div className="space-y-3">
            <Input label="HA URL" value={local.homeAssistant?.url || ''} onChange={(e) => setNested('homeAssistant.url', e.target.value)} placeholder="http://homeassistant.local:8123" />
            <Input label="Long-lived Token" type="password" value={local.homeAssistant?.token === '***' ? '' : local.homeAssistant?.token || ''} onChange={(e) => setNested('homeAssistant.token', e.target.value)} placeholder={local.homeAssistant?.token === '***' ? 'saved — leave blank to keep' : ''} />
          </div>
          <TestButton label="Test HA" status={haStatus} onTest={async () => { const r = await testHa(local.homeAssistant); setHaStatus(r) }} />
        </Section>

        <Section title="Electricity Tariffs">
          <div className="space-y-3">
            <div className="flex gap-2">
              {['fixed', 'tou'].map((t) => (
                <button key={t} onClick={() => setNested('tariffs.type', t)}
                  className={`px-3 py-1.5 rounded-lg text-xs capitalize border transition-colors ${local.tariffs?.type === t ? 'bg-primary/10 text-primary border-primary/30' : 'bg-surface text-white/50 border-white/5 hover:text-white'}`}>
                  {t === 'tou' ? 'Time of Use' : 'Fixed Price'}
                </button>
              ))}
            </div>
            {local.tariffs?.type !== 'tou' ? (
              <Input label="Price (€/kWh)" type="number" step="0.01" value={local.tariffs?.fixed || 0} onChange={(e) => setNested('tariffs.fixed', Number(e.target.value))} />
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-white/40">Price slots (€/kWh)</p>
                {(local.tariffs?.tou || []).map((slot, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input label="Start" value={slot.start || ''} onChange={(e) => setNested(`tariffs.tou.${i}.start`, e.target.value)} />
                    <Input label="End" value={slot.end || ''} onChange={(e) => setNested(`tariffs.tou.${i}.end`, e.target.value)} />
                    <Input label="Price" type="number" step="0.01" value={slot.price || 0} onChange={(e) => setNested(`tariffs.tou.${i}.price`, Number(e.target.value))} />
                    <button onClick={() => setLocal((prev) => ({ ...prev, tariffs: { ...prev.tariffs, tou: (prev.tariffs?.tou || []).filter((_, j) => j !== i) } }))}
                      className="mt-5 px-2 py-1.5 rounded-lg text-xs text-red-400 border border-white/10 hover:border-red-400/40">
                      Remove
                    </button>
                  </div>
                ))}
                <button onClick={() => setNested('tariffs.tou', [...(local.tariffs?.tou || []), { start: '07:00', end: '20:00', price: 0.25 }])}
                  className="px-3 py-1.5 rounded-lg text-xs text-primary border border-primary/30 hover:bg-primary/10">
                  + Add slot
                </button>
              </div>
            )}
          </div>
        </Section>

        <div className="flex justify-end items-center gap-3">
          {saved && <span className="text-xs text-primary">Saved</span>}
          <button onClick={handleSave} className="px-5 py-2 rounded-lg bg-primary text-bg font-semibold text-sm hover:bg-primary-dim">
            Save Settings
          </button>
        </div>
      </div>

    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="bg-surface rounded-xl border border-white/5 p-5">
      <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-4">{title}</h2>
      {children}
    </div>
  )
}

function TestButton({ label, status, onTest }) {
  return (
    <div className="mt-3 space-y-1">
      <div className="flex items-center gap-3">
        <button onClick={onTest} className="text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white/70">
          {label}
        </button>
        {status?.ok === true && <span className="flex items-center gap-1 text-xs text-primary"><CheckCircle size={12} /> Connected</span>}
        {status?.ok === false && <span className="flex items-center gap-1 text-xs text-red-400"><XCircle size={12} /> Failed</span>}
      </div>
      {status?.ok === false && status?.error && (
        <p className="text-xs text-red-400/80 pl-1">{status.error}</p>
      )}
    </div>
  )
}
