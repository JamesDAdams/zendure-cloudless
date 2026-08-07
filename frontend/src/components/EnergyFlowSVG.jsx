import React from 'react'

function Node({ x, y, icon, label, value, color }) {
  return (
    <g transform={`translate(${x},${y})`}>
      {label && <text y={-48} textAnchor="middle" fontSize={13} fill="#BAC2CA" fontWeight={500}>{label}</text>}
      <circle r={38} fill={color + '22'} stroke={color} strokeWidth={1.5} />
      <text y={-8} textAnchor="middle" dominantBaseline="middle" fontSize={22} fill={color}>{icon}</text>
      <text y={17} textAnchor="middle" dominantBaseline="middle" fontSize={13} fill="white" fontWeight={700}>{value}</text>
    </g>
  )
}

function SolarNode({ x, y, name, value, color }) {
  const displayName = name.length > 16 ? name.slice(0, 16) : name
  return (
    <g transform={`translate(${x},${y})`}>
      <text y={-48} textAnchor="middle" fontSize={13} fill="#BAC2CA" fontWeight={500}>{displayName}</text>
      <circle r={38} fill={color + '22'} stroke={color} strokeWidth={1.5} />
      <text y={-10} textAnchor="middle" dominantBaseline="middle" fontSize={22}>☀️</text>
      <text y={17} textAnchor="middle" dominantBaseline="middle" fontSize={13} fill="white" fontWeight={700}>{value}</text>
    </g>
  )
}

function Arrow({ from, to, watts, color, active, alwaysShow = false }) {
  if (watts < 0) {
    const tmp = from
    from = to
    to = tmp
    watts = -watts
  }
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len === 0) return null
  const nx = dx / len
  const ny = dy / len
  const startX = from.x + nx * 50
  const startY = from.y + ny * 50
  const endX = to.x - nx * 50
  const endY = to.y - ny * 50
  const midX = (startX + endX) / 2
  const midY = (startY + endY) / 2

  let textX = midX - ny * 20
  let textY = midY + nx * 20
  if (Math.abs(dx) < 10) {
    textX = midX - 38
    textY = midY
  }

  const isActive = active && watts > 0

  if (!isActive && !alwaysShow) return null

  const label = `${watts}W`
  const charWidth = 6.5
  const bgW = label.length * charWidth + 10
  const bgH = 16

  if (!isActive) {
    return (
      <line x1={startX} y1={startY} x2={endX} y2={endY}
        stroke={color} strokeWidth={1.5} strokeDasharray="4 4" opacity={0.2} />
    )
  }

  return (
    <g>
      <line x1={startX} y1={startY} x2={endX} y2={endY}
        stroke={color} strokeWidth={2} strokeDasharray="6 4" opacity={0.7}
        style={{ animation: 'dashFlow 1s linear infinite' }} />
      <rect x={textX - bgW / 2} y={textY - bgH / 2} width={bgW} height={bgH} rx={4} fill={color} opacity={0.25} />
      <text x={textX} y={textY}
        textAnchor="middle" dominantBaseline="middle" fontSize={11} fill={color} fontWeight={600}>{label}</text>
    </g>
  )
}

function BatteryNode({ x, y, soc, watts, color, name = 'Battery' }) {
  let displayName = name
  if (name.includes('Solarflow 800 +') || name.includes('800+')) {
    displayName = 'Batterie 800+'
  } else if (displayName.length > 20) {
    displayName = displayName.slice(0, 20)
  }
  return (
    <g transform={`translate(${x},${y})`}>
      <text y={-54} textAnchor="middle" fontSize={13} fill="#BAC2CA" fontWeight={500}>{displayName}</text>
      <circle r={46} fill={color + '22'} stroke={color} strokeWidth={1.5} />
      <text y={-28} textAnchor="middle" dominantBaseline="middle" fontSize={12} fill="white" fontWeight={700}>{soc}%</text>
      <text y={-6} textAnchor="middle" dominantBaseline="middle" fontSize={22}>🔋</text>
      <text y={22} textAnchor="middle" dominantBaseline="middle" fontSize={12} fill="white" fontWeight={700}>{watts}W</text>
    </g>
  )
}

function isSolarflow800Plus(model = '', name = '') {
  const str = `${model} ${name}`
  return /800\s*\+|800\s*plus/i.test(str)
}

export default function EnergyFlowSVG({ state = {}, solarProducers = [] }) {
  const totalSolar = state.solarPower ?? 0
  const home = state.outputHomePower ?? 0
  const packInput = state.batteryChargePower ?? 0
  const packOutput = state.batteryDischargePower ?? 0
  const grid = state.gridInputPower ?? 0
  const soc = state.electricLevel ?? 0

  const count = solarProducers.length

  if (count <= 1) {
    const solarVal = count === 1 ? solarProducers[0].solar : totalSolar
    const packInVal = count === 1 ? (solarProducers[0].batteryChargePower ?? packInput) : packInput
    const packOutVal = count === 1 ? (solarProducers[0].batteryDischargePower ?? packOutput) : packOutput
    const solarName = count === 1 ? solarProducers[0].name : (state.name || 'Solar PV')
    const solarModel = count === 1 ? solarProducers[0].model : (state.model || '')
    const isPlus = isSolarflow800Plus(solarModel, solarName)

    if (isPlus) {
      const gridToBattery = Math.max(0, packInVal - solarVal)
      const isGridCharging = gridToBattery > 0
      const outputHome = count === 1 ? (solarProducers[0].outputHomePower ?? solarProducers[0].home ?? (home > 0 ? home : packOutVal)) : (home > 0 ? home : packOutVal)
      const wattsVal = isGridCharging ? gridToBattery : outputHome
      const arrowColor = isGridCharging ? "#00D4AA" : "#60A5FA"
      const pos = {
        solar: { x: 100, y: 200 },
        battery: { x: 300, y: 200 },
        home: { x: 540, y: 200 },
        grid: { x: 540, y: 400 },
      }
      return (
        <svg viewBox="0 0 680 480" className="w-full h-full" style={{ maxHeight: 420 }}>
          <Arrow from={pos.solar} to={pos.battery} watts={solarVal} color="#00D4AA" active={solarVal > 0} alwaysShow />
          {isGridCharging ? (
            <Arrow from={pos.home} to={pos.battery} watts={wattsVal} color={arrowColor} active={wattsVal > 0} alwaysShow />
          ) : (
            <Arrow from={pos.battery} to={pos.home} watts={wattsVal} color={arrowColor} active={wattsVal > 0} alwaysShow />
          )}
          <Arrow from={pos.grid} to={pos.home} watts={grid} color="#F97316" active={grid !== 0} alwaysShow />

          <SolarNode {...pos.solar} name={solarName} value={`${solarVal}W`} color="#00D4AA" />
          <BatteryNode {...pos.battery} name={`${solarName} Batt`} soc={soc} watts={packInVal > 0 ? packInVal : (packOutVal > 0 ? packOutVal : solarVal)} color="#60A5FA" />
          <Node {...pos.home} label="Home" icon="🏠" value={`${home}W`} color="#A78BFA" />
          <Node {...pos.grid} label="Grid" icon="⚡" value={`${Math.abs(grid)}W`} color="#F97316" />
        </svg>
      )
    }

    const pos = {
      solar: { x: 540, y: 80 },
      battery: { x: 260, y: 240 },
      home: { x: 540, y: 240 },
      grid: { x: 540, y: 420 },
    }
    return (
      <svg viewBox="0 0 680 480" className="w-full h-full" style={{ maxHeight: 420 }}>
        <Arrow from={pos.solar} to={pos.home} watts={solarVal} color="#00D4AA" active={solarVal > 0} alwaysShow />
        <Arrow from={packInput > 0 && solarVal > 0 ? pos.solar : pos.home} to={pos.battery} watts={packInput > 0 ? (solarVal > 0 ? Math.min(solarVal, packInput) : packInput) : 0} color="#00D4AA" active={packInput > 0} />
        <Arrow from={pos.battery} to={pos.home} watts={packOutput} color="#60A5FA" active={packOutput > 0} />
        <Arrow from={pos.grid} to={pos.home} watts={grid} color="#F97316" active={grid !== 0} alwaysShow />

        <SolarNode {...pos.solar} name={solarName} value={`${solarVal}W`} color="#00D4AA" />
        <BatteryNode {...pos.battery} name="Battery" soc={soc} watts={packInput > 0 ? packInput : packOutput} color="#60A5FA" />
        <Node {...pos.home} label="Home" icon="🏠" value={`${home}W`} color="#A78BFA" />
        <Node {...pos.grid} label="Grid" icon="⚡" value={`${Math.abs(grid)}W`} color="#F97316" />
      </svg>
    )
  }

  // Multi-producer view
  const builtinPlusProducers = solarProducers
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => isSolarflow800Plus(p.model, p.name))

  const standardProducers = solarProducers
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => !isSolarflow800Plus(p.model, p.name))

  const numStandard = standardProducers.length
  const homeX = 540
  const homeY = 260
  const homePos = { x: homeX, y: homeY }

  // Standard producers positioned ABOVE the Home node (centered around homeX = 540)
  const standardPositions = standardProducers.map((_, idx) => {
    if (numStandard === 1) return { x: homeX, y: 80 }
    const totalWidth = Math.min(360, (numStandard - 1) * 180)
    const startX = homeX - totalWidth / 2
    const spacing = numStandard > 1 ? totalWidth / (numStandard - 1) : 0
    return { x: startX + idx * spacing, y: 80 }
  })

  // Solarflow 800+ pairs (Solar + Battery) positioned on left side
  const builtinPlusPositions = builtinPlusProducers.map((_, bi) => {
    const yPos = 260 + bi * 160
    return {
      solar: { x: 100, y: yPos },
      battery: { x: 300, y: yPos },
    }
  })

  // Global battery if standard producers have battery state
  const showGlobalBattery = standardProducers.some(({ p }) => p.batterySoc > 0) || (builtinPlusProducers.length === 0 && soc > 0)
  const globalBatteryPos = {
    x: 300,
    y: 260 + builtinPlusProducers.length * 160,
  }

  const battRows = Math.max(1, builtinPlusProducers.length + (showGlobalBattery ? 1 : 0))
  const gridY = Math.max(460, 260 + battRows * 160)
  const maxX = Math.max(720, homeX + Math.ceil(numStandard / 2) * 180)
  const viewW = maxX
  const viewH = gridY + 110
  const gridPos = { x: homeX, y: gridY }

  return (
    <svg viewBox={`0 0 ${viewW} ${viewH}`} className="w-full h-full" style={{ maxHeight: 520 }}>
      {/* Standard Solar -> Home (pointing straight down into Home from above) */}
      {standardProducers.map(({ p }, idx) => (
        <Arrow key={`std-solar-${idx}`} from={standardPositions[idx]} to={homePos} watts={p.solar} color="#00D4AA" active={p.solar > 0} alwaysShow />
      ))}

      {/* Solarflow 800+ -> Battery -> Home */}
      {builtinPlusProducers.map(({ p }, bi) => {
        const gridToBattery = Math.max(0, p.batteryChargePower - p.solar)
        const isGridCharging = gridToBattery > 0
        const outputHome = p.outputHomePower ?? p.home ?? (p.batteryDischargePower > 0 ? p.batteryDischargePower : (p.solar > 0 ? p.solar : 0))
        const wattsVal = isGridCharging ? gridToBattery : outputHome
        const arrowColor = isGridCharging ? "#00D4AA" : "#60A5FA"

        return (
          <React.Fragment key={`builtin-plus-group-${bi}`}>
            {/* Solarflow 800+ to Battery */}
            <Arrow from={builtinPlusPositions[bi].solar} to={builtinPlusPositions[bi].battery} watts={p.solar} color="#00D4AA" active={p.solar > 0} alwaysShow />
            
            {/* Single Arrow between Battery and Home */}
            {isGridCharging ? (
              <Arrow from={homePos} to={builtinPlusPositions[bi].battery} watts={wattsVal} color={arrowColor} active={wattsVal > 0} alwaysShow />
            ) : (
              <Arrow from={builtinPlusPositions[bi].battery} to={homePos} watts={wattsVal} color={arrowColor} active={wattsVal > 0} alwaysShow />
            )}
          </React.Fragment>
        )
      })}

      {/* Global Battery arrows */}
      {showGlobalBattery && builtinPlusProducers.length === 0 && (
        <>
          <Arrow from={homePos} to={globalBatteryPos} watts={packInput} color="#00D4AA" active={packInput > 0} />
          <Arrow from={globalBatteryPos} to={homePos} watts={packOutput} color="#60A5FA" active={packOutput > 0} />
        </>
      )}

      {/* Grid to Home (Vertical line on right side!) */}
      <Arrow from={gridPos} to={homePos} watts={grid} color="#F97316" active={grid !== 0} alwaysShow />

      {/* Standard Solar Nodes */}
      {standardProducers.map(({ p }, idx) => (
        <SolarNode key={`std-solarnode-${idx}`} {...standardPositions[idx]} name={p.name} value={`${p.solar}W`} color="#00D4AA" />
      ))}

      {/* Solarflow 800+ Solar & Battery Nodes */}
      {builtinPlusProducers.map(({ p }, bi) => (
        <React.Fragment key={`builtin-plus-nodes-${bi}`}>
          <SolarNode {...builtinPlusPositions[bi].solar} name={p.name} value={`${p.solar}W`} color="#00D4AA" />
          <BatteryNode
            {...builtinPlusPositions[bi].battery}
            name={`${p.name} Batt`}
            soc={p.batterySoc || soc}
            watts={p.batteryChargePower > 0 ? p.batteryChargePower : (p.batteryDischargePower > 0 ? p.batteryDischargePower : p.solar)}
            color="#60A5FA"
          />
        </React.Fragment>
      ))}

      {/* Global Battery Node */}
      {showGlobalBattery && builtinPlusProducers.length === 0 && (
        <BatteryNode {...globalBatteryPos} name="Battery" soc={soc} watts={packInput > 0 ? packInput : packOutput} color="#60A5FA" />
      )}

      {/* Home & Grid Nodes */}
      <Node {...homePos} label="Home" icon="🏠" value={`${home}W`} color="#A78BFA" />
      <Node {...gridPos} label="Grid" icon="⚡" value={`${Math.abs(grid)}W`} color="#F97316" />
    </svg>
  )
}