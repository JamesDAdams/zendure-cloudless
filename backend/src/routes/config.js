import { Router } from 'express'
import { configService } from '../services/configService.js'
import { mqttService } from '../services/mqttService.js'
import { haService } from '../services/haService.js'

const router = Router()

router.get('/', (req, res) => {
  const cfg = configService.get()
  const safe = { ...cfg }
  if (safe.mqtt?.password) safe.mqtt = { ...safe.mqtt, password: '***' }
  if (safe.homeAssistant?.token) safe.homeAssistant = { ...safe.homeAssistant, token: '***' }
  res.json(safe)
})

router.put('/', (req, res) => {
  const prevMqtt = configService.get().mqtt
  const updated = configService.set(req.body)
  const newMqtt = updated.mqtt
  const mqttChanged = JSON.stringify(prevMqtt) !== JSON.stringify(newMqtt)
  if (mqttChanged) mqttService.connect()
  res.json({ ok: true, config: updated })
})

router.post('/mqtt/test', async (req, res) => {
  const overrides = {}
  if (req.body.host) overrides.host = req.body.host
  if (req.body.port) overrides.port = req.body.port
  if (req.body.username) overrides.username = req.body.username
  if (req.body.password && req.body.password !== '***') overrides.password = req.body.password
  try {
    const ok = await mqttService.testConnection(overrides)
    res.json({ ok })
  } catch (err) {
    res.json({ ok: false, error: err.message })
  }
})

router.post('/ha/test', async (req, res) => {
  const overrides = {}
  if (req.body.url) overrides.url = req.body.url
  if (req.body.token && req.body.token !== '***') overrides.token = req.body.token
  try {
    const ok = await haService.testConnection(overrides)
    res.json({ ok })
  } catch (err) {
    res.json({ ok: false, error: err.message })
  }
})

router.get('/ha/entities', async (req, res) => {
  try {
    const entities = await haService.searchEntities(req.query.search || '')
    res.json(entities)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/ha/devices', async (req, res) => {
  try {
    const devices = await haService.searchDevices(req.query.search || '')
    res.json(devices)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/ha/devices/:deviceId/entities', async (req, res) => {
  try {
    const entities = await haService.getDeviceEntities(req.params.deviceId)
    res.json(entities)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/mqtt/topics', (req, res) => {
  const topics = mqttService.searchTopics(req.query.search || '')
  res.json(topics)
})

export default router
