import { Router } from 'express'
import { registry } from '../devices/deviceRegistry.js'
import { configService } from '../services/configService.js'
import { startPolling, stopPolling, startHaPolling, stopHaPolling } from '../services/pollingService.js'
import { modeEngine } from '../modes/modeEngine.js'
import { randomUUID } from 'crypto'

import { mqttService } from '../services/mqttService.js'

const router = Router()

router.get('/', (req, res) => {
  res.json(registry.getAll().map((d) => ({ ...d.toJSON(), mode: modeEngine.getMode(d.id) })))
})

router.post('/', (req, res) => {
  const config = { id: randomUUID(), ...req.body }
  const device = registry.add(config)
  configService.saveDevice(config)
  if (device.sources?.rest && device.enabled) startPolling(device)
  if (device.sources?.mqtt && device.enabled) mqttService.subscribeDevice(device)
  if (device.sources?.ha && device.enabled) startHaPolling(device)
  res.status(201).json(device.toJSON())
})

router.get('/:id', (req, res) => {
  const device = registry.get(req.params.id)
  if (!device) return res.status(404).json({ error: 'Not found' })
  res.json(device.toJSON())
})

router.put('/:id', (req, res) => {
  const device = registry.get(req.params.id)
  if (!device) return res.status(404).json({ error: 'Not found' })
  const allowed = ['name', 'ip', 'pollingInterval', 'sources', 'enabled', 'mqttTopicPrefix', 'mqttPublishEnabled', 'haEntity', 'haDevice', 'haEntityMap', 'solarSensor', 'consumptionSensor', 'model', 'dataType', 'fieldMappings']
  const update = {}
  for (const key of allowed) {
    if (req.body[key] !== undefined) update[key] = req.body[key]
  }
  Object.assign(device, update)
  configService.saveDevice(device.toJSON())
  stopPolling(device.id)
  stopHaPolling(device.id)
  mqttService.unsubscribeDevice(device)
  if (device.sources?.rest && device.enabled) startPolling(device)
  if (device.sources?.mqtt && device.enabled) mqttService.subscribeDevice(device)
  if (device.sources?.ha && device.enabled) startHaPolling(device)
  res.json(device.toJSON())
})

router.delete('/:id', (req, res) => {
  const device = registry.get(req.params.id)
  stopPolling(req.params.id)
  stopHaPolling(req.params.id)
  if (device) mqttService.unsubscribeDevice(device)
  modeEngine.stopMode(req.params.id)
  registry.remove(req.params.id)
  configService.removeDevice(req.params.id)
  res.json({ ok: true })
})

router.post('/:id/command', async (req, res) => {
  const device = registry.get(req.params.id)
  if (!device) return res.status(404).json({ error: 'Not found' })
  const { command, value } = req.body
  try {
    const result = await device.sendCommand(command, value)
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/:id/mode', (req, res) => {
  const { mode, config: modeConfig } = req.body
  try {
    modeEngine.setMode(req.params.id, mode, modeConfig || {})
    res.json({ ok: true, mode })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

router.get('/:id/mode', (req, res) => {
  res.json({ mode: modeEngine.getMode(req.params.id) })
})

export default router
