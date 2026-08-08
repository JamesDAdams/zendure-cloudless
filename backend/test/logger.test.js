import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { formatTimestamp, initLogger } from '../src/utils/logger.js'

describe('logger formatting', () => {
  it('generates [YYYY-MM-DD HH:mm:ss] timestamp format', () => {
    initLogger()
    const ts = formatTimestamp()
    assert.match(ts, /^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\]$/)
  })
})
