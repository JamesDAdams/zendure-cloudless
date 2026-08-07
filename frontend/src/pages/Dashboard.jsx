import { useStore } from '../store/useStore'
import EnergyFlowSVG from '../components/EnergyFlowSVG'
import { Sun, Zap, Home } from 'lucide-react'
import { getDeviceValues, hasSolarMapped, computeHomeConsumption, computeTotalGrid } from '../utils/dashboardUtils'

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-surface rounded-xl p-4 flex items-center gap-3 border border-white/5">
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon size={16} />
      </div>
      <div>
        <p className="text-xs text-white/50">{label}</p>
        <p className="text-lg font-semibold">{value}</p>
      </div>
    </div>
  )
}

const PACK_STATE = { CHARGING: 2, DISCHARGING: 3 }

function PackChip({ pack }) {
  const temp = pack.maxTemp != null && pack.maxTemp !== 0 ? `${pack.maxTemp}` : '--'
  const stateLabel = pack.state === PACK_STATE.CHARGING ? 'Charging' : pack.state === PACK_STATE.DISCHARGING ? 'Discharging' : 'Idle'
  return (
    <div className="bg-surface-high rounded-lg px-3 py-2 flex flex-col gap-0.5 border border-white/5 min-w-[120px]">
      <p className="text-xs text-white/40 truncate">{pack.sn?.slice(-6)}</p>
      <p className="text-sm font-semibold text-blue-400">{pack.socLevel ?? '--'}%</p>
      <p className="text-xs text-white/50">{pack.power ?? 0}W · {temp}°C</p>
      <p className="text-xs text-white/40">{stateLabel}</p>
    </div>
  )
}

function PVChip({ label, watts }) {
  return (
    <div className="bg-surface-high rounded-lg px-3 py-2 flex flex-col gap-0.5 border border-white/5 min-w-[100px]">
      <p className="text-xs text-white/40">{label}</p>
      <p className="text-sm font-semibold text-primary">{watts}W</p>
      <div className="flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />
        <span className="text-xs text-white/40">Active</span>
      </div>
    </div>
  )
}

function StatusRow({ label, ok }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-white/50">{label}</span>
      <span className={`text-xs font-medium ${ok ? 'text-primary' : 'text-white/30'}`}>{ok ? 'OK' : 'Off'}</span>
    </div>
  )
}



export default function Dashboard() {
  const devices = useStore((s) => s.devices)
  const deviceStates = useStore((s) => s.deviceStates)

  if (!devices.length) {
    return (
      <div className="flex-1 flex items-center justify-center text-white/40">
        <p>No devices configured. Go to Devices to add one.</p>
      </div>
    )
  }

  const allValues = devices.map((d) => getDeviceValues(d, deviceStates[d.id] || d.state || {}))

  const homeDevice = allValues.find((v) => (v.isMqtt || v.isHa) && v.dataType === 'home_consumption' && v.home !== 0)
  const totalSolar = allValues.reduce((s, v) => s + v.solar, 0)
  const totalHome = homeDevice
    ? computeHomeConsumption(homeDevice, allValues, devices)
    : allValues.filter((v) => !v.isMqtt).reduce((s, v) => s + v.home, 0)
  const totalGrid = computeTotalGrid(homeDevice, allValues)
  const totalBatteryCharge = allValues.reduce((s, v) => s + (v.batteryChargePower ?? 0), 0)
  const totalBatteryDischarge = allValues.reduce((s, v) => s + (v.batteryDischargePower ?? 0), 0)
  const allPacks = allValues.flatMap((v) => v.packs)
  const avgBatterySoc = allValues.filter((v) => v.batterySoc > 0).length
    ? Math.round(allValues.reduce((s, v) => s + v.batterySoc, 0) / allValues.filter((v) => v.batterySoc > 0).length)
    : 0

  const solarProducers = devices
    .map((d, i) => ({
      name: d.name,
      solar: allValues[i].solar,
      home: allValues[i].home,
      outputHomePower: allValues[i].outputHomePower ?? allValues[i].home,
      model: d.model || '',
      isMqtt: allValues[i].isMqtt,
      isHa: allValues[i].isHa,
      batteryChargePower: allValues[i].batteryChargePower ?? 0,
      batteryDischargePower: allValues[i].batteryDischargePower ?? 0,
      batteryPower: allValues[i].batteryPower,
      batterySoc: allValues[i].batterySoc,
    }))
    .filter((p) => !(p.isMqtt || p.isHa) || p.solar > 0)

  const mqttHaSolarChips = devices
    .map((d, i) => ({ name: d.name, solar: allValues[i].solar, isMqtt: allValues[i].isMqtt, isHa: allValues[i].isHa }))
    .filter((p) => (p.isMqtt || p.isHa) && p.solar > 0)

  const aggregatedState = {
    solarPower: totalSolar,
    outputHomePower: totalHome,
    gridInputPower: totalGrid,
    batteryChargePower: totalBatteryCharge,
    batteryDischargePower: totalBatteryDischarge,
    electricLevel: avgBatterySoc,
  }

  const firstZendure = allValues.find((v) => !v.isMqtt && !v.isHa)

  return (
    <div className="flex-1 p-6 flex flex-col gap-4 overflow-auto">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      <div className="flex gap-4 flex-1 min-h-0">
        <div className="flex flex-col gap-4 flex-1">
          <div className="bg-surface rounded-xl border border-white/5 flex items-center justify-center p-4" style={{ minHeight: 380 }}>
            <EnergyFlowSVG state={aggregatedState} solarProducers={solarProducers} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <StatCard icon={Sun} label="Solar Production" value={`${Math.round(totalSolar)} W`} color="bg-primary/20 text-primary" />
            <StatCard icon={Home} label="Home Consumption" value={`${Math.round(totalHome)} W`} color="bg-purple-500/20 text-purple-400" />
            <StatCard icon={Zap} label="Grid" value={`${Math.round(totalGrid)} W`} color="bg-orange-500/20 text-orange-400" />
          </div>
        </div>

        <div className="flex flex-col gap-4 w-64">
          <div className="bg-surface rounded-xl border border-white/5 p-4">
            <p className="text-xs text-white/40 uppercase tracking-wider mb-3">Battery</p>
            <div className="flex flex-col gap-2">
              {allPacks.length === 0 && avgBatterySoc === 0 && <p className="text-xs text-white/30">No battery data</p>}
              {allPacks.map((p) => <PackChip key={p.sn} pack={p} />)}
              {avgBatterySoc > 0 && (
                <div className="mt-1 pt-2 border-t border-white/5">
                  <div className="flex justify-between text-xs">
                    <span className="text-white/40">Overall SOC</span>
                    <span className="text-primary font-semibold">{avgBatterySoc}%</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {(firstZendure?.pv1 != null || firstZendure?.pv2 != null || hasSolarMapped(devices)) && (
            <div className="bg-surface rounded-xl border border-white/5 p-4">
              <p className="text-xs text-white/40 uppercase tracking-wider mb-3">Solar Inputs</p>
              <div className="flex flex-wrap gap-2">
                {firstZendure?.pv1 != null && <PVChip label="PV 1" watts={firstZendure.pv1} />}
                {firstZendure?.pv2 != null && <PVChip label="PV 2" watts={firstZendure.pv2} />}
                {mqttHaSolarChips.map((p) => (
                  <PVChip key={p.name} label={p.name} watts={p.solar} />
                ))}
              </div>
            </div>
          )}

          {firstZendure && (
            <div className="bg-surface rounded-xl border border-white/5 p-4">
              <p className="text-xs text-white/40 uppercase tracking-wider mb-2">System Status</p>
              <StatusRow label="AC" ok={firstZendure.acStatus === 1} />
              <StatusRow label="DC" ok={firstZendure.dcStatus === 1} />
              <StatusRow label="Grid" ok={firstZendure.gridState === 1} />
              <StatusRow label="PV" ok={firstZendure.pvStatus === 1} />
              <StatusRow label="IOT" ok={firstZendure.IOTState === 2} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
