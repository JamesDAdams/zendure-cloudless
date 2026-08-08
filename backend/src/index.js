import { initLogger } from './utils/logger.js'
import express from 'express'

initLogger()
import cors from 'cors'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'
import devicesRouter from './routes/devices.js'
import configRouter from './routes/config.js'
import historyRouter from './routes/history.js'
import { configService } from './services/configService.js'
import { registry } from './devices/deviceRegistry.js'
import { mqttService } from './services/mqttService.js'
import { startPolling, startHaPolling } from './services/pollingService.js'
import { historyService } from './services/historyService.js'

const __dir = dirname(fileURLToPath(import.meta.url))
const app = express()
const server = createServer(app)
const wss = new WebSocketServer({ server })

const allowedOrigin = process.env.ALLOWED_ORIGIN
app.use(cors({ origin: allowedOrigin ? new RegExp(allowedOrigin) : true }))
app.use(express.json())
app.use('/api/devices', devicesRouter)
app.use('/api/config', configRouter)
app.use('/api/history', historyRouter)

app.get('/api/health', (_, res) => res.json({ ok: true }))

const distPath = join(__dir, '../../frontend/dist')
if (existsSync(distPath)) {
  app.use(express.static(distPath))
  app.get('*', (_, res) => res.sendFile(join(distPath, 'index.html')))
}

const broadcast = (data) => {
  const msg = JSON.stringify(data)
  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(msg)
  })
}

registry.on('device:state', ({ id, state }) => {
  historyService.record(id, state)
  broadcast({ type: 'device:state', id, state })
})

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({
    type: 'init',
    devices: registry.getAll().map((d) => d.toJSON()),
  }))
})

const cfg = configService.get()
cfg.devices?.forEach((deviceCfg) => {
  try {
    const device = registry.add(deviceCfg)
    if (device.sources?.rest && device.enabled) startPolling(device)
    if (device.sources?.ha && device.enabled) startHaPolling(device)
  } catch (e) {
    console.error('Failed to load device', deviceCfg.id, e.message)
  }
})

mqttService.connect()

const PORT = process.env.PORT || 3001
server.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`)
})

