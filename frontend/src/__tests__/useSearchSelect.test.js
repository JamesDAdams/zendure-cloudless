// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, createElement, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { useSearchSelect } from '../hooks/useSearchSelect'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

function Harness({ fetcher, opts, captured }) {
  const api = useSearchSelect(fetcher, opts)
  useEffect(() => { captured.current = api })
  return null
}

function mount(fetcher, opts, captured) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => { root.render(createElement(Harness, { fetcher, opts, captured })) })
  return { root, container }
}

function unmount({ root, container }) {
  act(() => { root.unmount() })
  container.remove()
  vi.useRealTimers()
}

async function tick(ms) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms) })
}

describe('useSearchSelect', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('debounces the search and opens the dropdown with results after 300ms', async () => {
    const fetcher = vi.fn().mockResolvedValue(['a', 'b'])
    const captured = {}
    const ctx = mount(fetcher, {}, captured)

    act(() => { captured.current.handleFocus() })
    act(() => { captured.current.search('he') })
    expect(fetcher).not.toHaveBeenCalled()

    await tick(300)
    expect(fetcher).toHaveBeenCalledWith('he')
    expect(captured.current.results).toEqual(['a', 'b'])
    expect(captured.current.open).toBe(true)
    expect(captured.current.searched).toBe(true)
    expect(captured.current.highlightedIndex).toBe(0)

    unmount(ctx)
  })

  it('ignores stale results from out-of-order responses', async () => {
    let resolveFirst, resolveSecond
    const fetcher = vi.fn()
      .mockImplementationOnce(() => new Promise((r) => { resolveFirst = r }))
      .mockImplementationOnce(() => new Promise((r) => { resolveSecond = r }))
    const captured = {}
    const ctx = mount(fetcher, {}, captured)

    act(() => { captured.current.search('a') })
    await tick(300)
    act(() => { captured.current.search('ab') })
    await tick(300)

    act(() => { resolveSecond(['x', 'y']) })
    await tick(0)
    expect(captured.current.results).toEqual(['x', 'y'])

    act(() => { resolveFirst(['stale']) })
    await tick(0)
    expect(captured.current.results).toEqual(['x', 'y'])

    unmount(ctx)
  })

  it('commits the query on blur after 150ms when commitOnBlur is true', async () => {
    const onCommit = vi.fn()
    const captured = {}
    const ctx = mount(vi.fn().mockResolvedValue(['a']), { commitOnBlur: true, onCommit }, captured)

    act(() => { captured.current.search('he') })
    await tick(300)

    act(() => { captured.current.handleBlur() })
    expect(onCommit).not.toHaveBeenCalled()

    await tick(150)
    expect(onCommit).toHaveBeenCalledWith('he')

    unmount(ctx)
  })

  it('selects an item, commits its value and closes the dropdown', async () => {
    const onPick = vi.fn()
    const onCommit = vi.fn()
    const item = { id: 1, name: 'Alpha' }
    const captured = {}
    const ctx = mount(vi.fn().mockResolvedValue([item]), { onPick, onCommit, getValue: (it) => it.name }, captured)

    act(() => { captured.current.search('al') })
    await tick(300)

    act(() => { captured.current.select(item) })
    expect(onPick).toHaveBeenCalledWith(item)
    expect(onCommit).toHaveBeenCalledWith('Alpha')
    expect(captured.current.open).toBe(false)
    expect(captured.current.query).toBe('Alpha')

    unmount(ctx)
  })

  it('keyboard: Escape closes, arrows move highlight, Enter selects', async () => {
    const onCommit = vi.fn()
    const items = [{ id: 1, name: 'Alpha' }, { id: 2, name: 'Beta' }]
    const captured = {}
    const ctx = mount(vi.fn().mockResolvedValue(items), { onCommit, getValue: (it) => it.name }, captured)

    act(() => { captured.current.handleFocus() })
    act(() => { captured.current.search('al') })
    await tick(300)
    expect(captured.current.open).toBe(true)
    expect(captured.current.highlightedIndex).toBe(0)

    act(() => { captured.current.handleKeyDown({ key: 'Escape' }) })
    expect(captured.current.open).toBe(false)

    act(() => { captured.current.handleFocus() })
    expect(captured.current.open).toBe(true)
    expect(captured.current.highlightedIndex).toBe(0)

    act(() => { captured.current.handleKeyDown({ key: 'ArrowDown', preventDefault: vi.fn() }) })
    expect(captured.current.highlightedIndex).toBe(1)
    act(() => { captured.current.handleKeyDown({ key: 'Enter', preventDefault: vi.fn() }) })
    expect(onCommit).toHaveBeenCalledWith('Beta')

    unmount(ctx)
  })
})
