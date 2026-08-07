import { Router } from 'express'
import { historyService } from '../services/historyService.js'

const router = Router()

router.get('/:id', (req, res) => {
  const since = req.query.since ? parseInt(req.query.since) : Date.now() - 86400000
  const data = historyService.get(req.params.id, since)
  res.json(data)
})

router.get('/:id/summary', (req, res) => {
  const since = req.query.since ? parseInt(req.query.since) : Date.now() - 86400000
  res.json(historyService.getSummary(req.params.id, since))
})

export default router
