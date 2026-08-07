import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

const { haService } = await import('../src/services/haService.js')

describe('haService.testConnection', () => {
  it('throws "HA not configured" when url is empty', async () => {
    await assert.rejects(
      () => haService.testConnection({ url: '', token: 'tok' }),
      /HA not configured/
    )
  })

  it('throws "HA not configured" when token is empty', async () => {
    await assert.rejects(
      () => haService.testConnection({ url: 'http://ha.local', token: '' }),
      /HA not configured/
    )
  })
})
