import { useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'

const TYPES = ['charge', 'discharge', 'standby']
const TYPE_COLORS = { charge: 'bg-blue-500/20 text-blue-300 border-blue-500/30', discharge: 'bg-primary/20 text-primary border-primary/30', standby: 'bg-white/10 text-white/50 border-white/20' }

const defaultSlot = { start: '00:00', end: '06:00', type: 'charge', power: 400, days: ['all'] }

export default function CustomModeConfig({ onClose, onSave }) {
  const [slots, setSlots] = useState([])
  const [form, setForm] = useState({ ...defaultSlot })

  const addSlot = () => {
    setSlots([...slots, { ...form }])
    setForm({ ...defaultSlot })
  }

  const removeSlot = (i) => setSlots(slots.filter((_, idx) => idx !== i))

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-surface border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <h2 className="font-semibold">Custom Mode - Schedule</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="space-y-2">
            {slots.map((slot, i) => (
              <div key={i} className={`flex items-center justify-between px-3 py-2 rounded-lg border text-sm ${TYPE_COLORS[slot.type]}`}>
                <span className="font-mono">{slot.start} – {slot.end}</span>
                <span className="capitalize">{slot.type}</span>
                <span>{slot.type !== 'standby' ? `${slot.power}W` : '0W'}</span>
                <button onClick={() => removeSlot(i)} className="text-white/40 hover:text-red-400"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>

          <div className="bg-surface-high rounded-xl p-4 space-y-3 border border-white/5">
            <p className="text-xs text-white/40 uppercase tracking-wider">Add Slot</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/40 mb-1 block">Start</label>
                <input type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })}
                  className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block">End</label>
                <input type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })}
                  className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
              </div>
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1 block">Type</label>
              <div className="flex gap-2">
                {TYPES.map((t) => (
                  <button key={t} onClick={() => setForm({ ...form, type: t })}
                    className={`px-3 py-1.5 rounded-lg text-xs border capitalize transition-colors ${form.type === t ? TYPE_COLORS[t] : 'bg-white/5 text-white/40 border-white/10'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            {form.type !== 'standby' && (
              <div>
                <label className="text-xs text-white/40 mb-1 block">Power (W)</label>
                <input type="number" min={0} max={1000} value={form.power} onChange={(e) => setForm({ ...form, power: Number(e.target.value) })}
                  className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
              </div>
            )}
            <button onClick={addSlot} className="flex items-center gap-2 text-sm text-primary hover:text-primary-dim">
              <Plus size={14} /> Add Slot
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-3 p-5 border-t border-white/5">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-white/10 text-sm text-white/60 hover:text-white">Cancel</button>
          <button onClick={() => onSave(slots)} disabled={slots.length === 0}
            className="px-4 py-2 rounded-lg bg-primary text-bg text-sm font-semibold hover:bg-primary-dim disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-primary">Save Schedule</button>
        </div>
      </div>
    </div>
  )
}
