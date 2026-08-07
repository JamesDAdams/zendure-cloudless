import { useState, useEffect } from 'react'
import { useStore } from '../store/useStore'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar,
} from 'recharts'

const SOLAR_COLORS = ['#FACC15', '#B45309', '#FEF08A', '#EAB308', '#78350F', '#F59E0B']
const CONSUMPTION_COLORS = ['#60A5FA', '#818CF8', '#A78BFA', '#38BDF8', '#8B5CF6', '#3B82F6']
const SOC_COLORS = ['#38BDF8', '#818CF8', '#A78BFA', '#60A5FA', '#3B82F6', '#2563EB']
const BATTERY_SOLAR_COLOR = '#34D399'
const BATTERY_OUTPUT_COLOR = '#38BDF8'
const EXPORT_COLOR = '#F97316'

function StatCard({ label, value, unit, color }) {
  return (
    <div className="bg-surface rounded-xl p-4 border border-white/5">
      <p className="text-xs text-white/40 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}<span className="text-sm font-normal text-white/40 ml-1">{unit}</span></p>
    </div>
  )
}

function hasBatterySupport(device) {
  if (/plus/i.test(device.model || '')) return true
  if (device.sources?.mqtt && 'battery_power' in (device.fieldMappings || {})) return true
  if (device.sources?.ha && 'battery_power' in (device.haEntityMap || {})) return true
  return false
}

function deviceSeries(device, index) {
  const isHome = device.dataType === 'home_consumption'
  const isPlus = hasBatterySupport(device)
  const solarColor = SOLAR_COLORS[index % SOLAR_COLORS.length]
  const consColor = CONSUMPTION_COLORS[index % CONSUMPTION_COLORS.length]
  const socColor = SOC_COLORS[index % SOC_COLORS.length]
  return {
    isHome,
    isPlus,
    solarHome: { key: isPlus ? `${device.name} (Maison)` : device.name, color: solarColor, stack: 'solar' },
    solarBattery: isPlus ? { key: `${device.name} (Batterie)`, color: BATTERY_SOLAR_COLOR, stack: 'solar' } : null,
    batteryOutput: isPlus ? { key: `${device.name} (Sortie Batterie)`, color: BATTERY_OUTPUT_COLOR, stack: 'solar' } : null,
    consumption: { key: device.name, color: consColor, stack: 'consumption' },
    exportKey: 'Grid Export',
    soc: { key: `SOC ${device.name}`, color: socColor },
  }
}

export function computeBatteryOutputKwh(points) {
  if (!points || points.length === 0) return 0
  const avgBatOut = points.reduce((a, p) => {
    const pack = Math.max(0, p.packInputPower || 0)
    const sol = Math.max(0, p.solarPower || 0)
    const home = Math.max(0, p.outputHomePower || 0)
    return a + Math.max(pack, home > sol ? home - sol : 0)
  }, 0) / points.length
  return Math.round((avgBatOut / 1000) * 100) / 100
}

export default function HistoryPage() {
  const { devices, fetchHistory, fetchHistorySummary } = useStore()
  const [histories, setHistories] = useState({})
  const [summaries, setSummaries] = useState({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(false)
    const startOfToday = new Date().setHours(0, 0, 0, 0)
    const since = Math.min(Date.now() - 86400000, startOfToday)
    const fetches = []
    devices.forEach((device) => {
      fetches.push(
        fetchHistory(device.id, since).then((d) => {
          if (!cancelled) setHistories((prev) => ({ ...prev, [device.id]: d }))
        }).catch(() => { if (!cancelled) setLoadError(true) })
      )
      fetches.push(
        fetchHistorySummary(device.id, since).then((d) => {
          if (!cancelled) setSummaries((prev) => ({ ...prev, [device.id]: d }))
        }).catch(() => { if (!cancelled) setLoadError(true) })
      )
    })
    Promise.all(fetches).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [devices, fetchHistory, fetchHistorySummary])

  const seriesMap = {}
  devices.forEach((device, i) => { seriesMap[device.id] = deviceSeries(device, i) })

  const homeDevice = devices.find((d) => d.dataType === 'home_consumption')
  const homeSeries = homeDevice ? seriesMap[homeDevice.id] : null

  const rows = new Map()
  devices.forEach((device) => {
    const series = seriesMap[device.id]
    ;(histories[device.id] || []).forEach((p) => {
      const time = new Date(p.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      if (!rows.has(time)) rows.set(time, { time, ts: p.ts })
      const row = rows.get(time)
      if (!series.isHome) {
        const totalSolar = Math.max(0, p.solarPower || 0)
        if (series.isPlus) {
          const packInput = Math.max(0, p.packInputPower || 0)
          const solBat = Math.min(totalSolar, packInput)
          const solHome = Math.max(0, totalSolar - solBat)
          row[series.solarHome.key] = solHome
          row[series.solarBattery.key] = solBat
        } else {
          row[series.solarHome.key] = totalSolar
        }
        row[series.soc.key] = p.electricLevel
      }
    })
  })

  if (homeSeries && homeDevice) {
    (histories[homeDevice.id] || []).forEach((p) => {
      const time = new Date(p.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      if (rows.has(time)) {
        const row = rows.get(time)
        const gridVal = p.outputHomePower !== 0 ? p.outputHomePower : (p.gridInputPower || 0)
        let totalSolar = 0
        devices.forEach((d) => {
          if (d.dataType !== 'home_consumption') {
            const s = seriesMap[d.id]
            if (s?.solarHome?.key && typeof row[s.solarHome.key] === 'number') totalSolar += row[s.solarHome.key]
            if (s?.solarBattery?.key && typeof row[s.solarBattery.key] === 'number') totalSolar += row[s.solarBattery.key]
          }
        })
        row[homeSeries.consumption.key] = Math.max(0, totalSolar + gridVal)
      }
    })
  }
  const chartData = [...rows.values()].sort((a, b) => a.ts - b.ts)

  const startOfToday = new Date().setHours(0, 0, 0, 0)
  const hourlyData = Array.from({ length: 24 }, (_, hour) => {
    const startStr = `${String(hour).padStart(2, '0')}h`
    const endStr = `${String((hour + 1) % 24).padStart(2, '0')}h`
    const time = `${startStr}-${endStr}`
    const slotStart = startOfToday + hour * 3600000
    const slotEnd = slotStart + 3600000
    const row = { time }

    let totalSolarKwh = 0
    devices.forEach((device) => {
      const series = seriesMap[device.id]
      if (!series.isHome) {
        const points = (histories[device.id] || []).filter((p) => p.ts >= slotStart && p.ts < slotEnd)
        if (points.length > 0) {
          if (series.isPlus) {
            const avgSolHome = points.reduce((a, p) => {
              const sol = Math.max(0, p.solarPower || 0)
              const pack = Math.max(0, p.packInputPower || 0)
              return a + Math.max(0, sol - pack)
            }, 0) / points.length
            const avgSolBat = points.reduce((a, p) => {
              const sol = Math.max(0, p.solarPower || 0)
              const pack = Math.max(0, p.packInputPower || 0)
              return a + Math.min(sol, pack)
            }, 0) / points.length
            const solHomeKwh = Math.round((avgSolHome / 1000) * 100) / 100
            const solBatKwh = Math.round((avgSolBat / 1000) * 100) / 100
            const batOutKwh = computeBatteryOutputKwh(points)
            row[series.solarHome.key] = solHomeKwh
            row[series.solarBattery.key] = solBatKwh
            row[series.batteryOutput.key] = batOutKwh
            totalSolarKwh += (solHomeKwh + solBatKwh)
          } else {
            const avgSolarW = points.reduce((a, p) => a + Math.max(0, p.solarPower || 0), 0) / points.length
            const solarKwh = Math.round((avgSolarW / 1000) * 100) / 100
            row[series.solarHome.key] = solarKwh
            totalSolarKwh += solarKwh
          }
        }
      }
    })

    if (homeDevice && homeSeries) {
      const points = (histories[homeDevice.id] || []).filter((p) => p.ts >= slotStart && p.ts < slotEnd)
      if (points.length > 0) {
        const gridNetW = points.reduce((a, p) => {
          const val = p.outputHomePower !== 0 ? p.outputHomePower : (p.gridInputPower || 0)
          return a + val
        }, 0) / points.length
        const gridNetKwh = gridNetW / 1000
        const exportKwh = gridNetKwh < 0 ? Math.round(gridNetKwh * 100) / 100 : 0
        const homeConsKwh = Math.max(0, Math.round((totalSolarKwh + gridNetKwh) * 100) / 100)
        row[homeSeries.consumption.key] = homeConsKwh
        row[homeSeries.exportKey] = exportKwh
      }
    }

    return row
  })

  const summary = devices.reduce((acc, device) => {
    const s = summaries[device.id]
    if (!s) return acc
    acc.totalSolar += s.totalSolar || 0
    acc.selfConsumed += s.selfConsumed || 0
    acc.gridImport += s.gridImport || 0
    acc.batteryOutput += s.batteryOutput || 0
    return acc
  }, { totalSolar: 0, selfConsumed: 0, gridImport: 0, batteryOutput: 0 })
  const hasSummary = devices.some((d) => summaries[d.id])

  const lineKeys = []
  devices.forEach((device) => {
    const s = seriesMap[device.id]
    if (s.isHome) {
      lineKeys.push({ key: s.consumption.key, color: s.consumption.color, axis: 'left' })
    } else {
      lineKeys.push({ key: s.solarHome.key, color: s.solarHome.color, axis: 'left' })
      if (s.solarBattery) lineKeys.push({ key: s.solarBattery.key, color: s.solarBattery.color, axis: 'left' })
      lineKeys.push({ key: s.soc.key, color: s.soc.color, axis: 'right' })
    }
  })

  const barKeys = []
  devices.forEach((device) => {
    const s = seriesMap[device.id]
    if (s.isHome) {
      barKeys.push({ key: s.consumption.key, color: s.consumption.color, stack: s.consumption.stack })
      barKeys.push({ key: s.exportKey, color: EXPORT_COLOR, stack: 'export' })
    } else {
      barKeys.push({ key: s.solarHome.key, color: s.solarHome.color, stack: s.solarHome.stack })
      if (s.solarBattery) barKeys.push({ key: s.solarBattery.key, color: s.solarBattery.color, stack: s.solarBattery.stack })
      if (s.batteryOutput) barKeys.push({ key: s.batteryOutput.key, color: s.batteryOutput.color, stack: s.batteryOutput.stack })
    }
  })

  return (
    <div className="flex-1 p-6 overflow-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">History & Analytics</h1>
      </div>

      {!devices || devices.length === 0 ? (
        <div className="bg-surface rounded-xl p-8 text-center text-white/40 border border-white/5">
          No devices configured.
        </div>
      ) : loading ? (
        <div className="bg-surface rounded-xl p-8 text-center text-white/40 border border-white/5">
          Loading history…
        </div>
      ) : loadError || chartData.length === 0 ? (
        <div className="bg-surface rounded-xl p-8 text-center text-white/40 border border-white/5">
          {loadError ? 'Failed to load history data.' : 'No history data available for the last 24 hours.'}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-surface rounded-xl border border-white/5 p-6">
            <p className="text-sm font-medium mb-4">Power Over Time</p>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData} margin={{ left: 10, right: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#ffffff50' }} interval="preserveStartEnd" />
                <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#ffffff50' }} unit="W" />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#ffffff50' }} unit="%" domain={[0, 100]} />
                <Tooltip contentStyle={{ background: '#1A1D26', border: '1px solid #ffffff10', borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {lineKeys.map(({ key, color, axis }) => (
                  <Line key={key} yAxisId={axis} type="monotone" dataKey={key} stroke={color} dot={false} strokeWidth={2} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {hasSummary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Total Solar" value={Number(summary.totalSolar.toFixed(2))} unit="kWh" color="text-primary" />
              <StatCard label="Self-consumed" value={Number(summary.selfConsumed.toFixed(2))} unit="kWh" color="text-white" />
              <StatCard label="Grid Import" value={Number(summary.gridImport.toFixed(2))} unit="kWh" color="text-orange-400" />
              <StatCard label="Battery Output" value={Number(summary.batteryOutput.toFixed(2))} unit="kWh" color="text-sky-400" />
            </div>
          )}

          <div className="bg-surface rounded-xl border border-white/5 p-6">
            <p className="text-sm font-medium mb-4">Daily Energy Breakdown</p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={hourlyData} margin={{ top: 25, left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#ffffff50' }} />
                <YAxis tick={{ fontSize: 10, fill: '#ffffff50' }} unit=" kWh" />
                <Tooltip
                  position={{ y: -250 }}
                  allowEscapeViewBox={{ x: true, y: true }}
                  formatter={(val) => `${val} kWh`}
                  contentStyle={{ background: '#1A1D26', border: '1px solid #ffffff10', borderRadius: 8 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {barKeys.map(({ key, color, stack }) => (
                  <Bar key={key} dataKey={key} stackId={stack} fill={color} stroke="#1A1D26" strokeWidth={1} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
