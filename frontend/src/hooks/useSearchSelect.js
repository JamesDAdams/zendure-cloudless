import { useState, useRef, useEffect } from 'react'

export function useSearchSelect(fetcher, {
  initialQuery = '',
  getValue,
  commitOnBlur = true,
  onCommit,
  onPick,
  onEmpty,
} = {}) {
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [searched, setSearched] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const timer = useRef(null)
  const blurTimer = useRef(null)
  const selectTimer = useRef(null)
  const reqSeq = useRef(0)
  const selectingRef = useRef(false)
  const isFocusedRef = useRef(false)
  const queryRef = useRef(query)
  const prevInitialQueryRef = useRef(initialQuery)

  useEffect(() => {
    if (prevInitialQueryRef.current !== initialQuery) {
      prevInitialQueryRef.current = initialQuery
      if (!isFocusedRef.current) {
        setQuery(initialQuery)
        queryRef.current = initialQuery
      }
    }
  }, [initialQuery])

  useEffect(() => {
    return () => {
      clearTimeout(timer.current)
      clearTimeout(blurTimer.current)
      clearTimeout(selectTimer.current)
      reqSeq.current++
    }
  }, [])

  const search = (q) => {
    setQuery(q)
    queryRef.current = q
    setHighlightedIndex(-1)
    clearTimeout(timer.current)
    const seq = ++reqSeq.current
    if (!q) {
      setResults([])
      setSearched(false)
      setOpen(false)
      onEmpty?.()
      return
    }
    timer.current = setTimeout(async () => {
      try {
        const res = await fetcher(q)
        if (seq !== reqSeq.current) return
        setResults((res || []).slice(0, 20))
        if (isFocusedRef.current) {
          setOpen(true)
          setHighlightedIndex(res?.length ? 0 : -1)
        }
        setSearched(true)
      } catch {
        if (seq !== reqSeq.current) return
        setResults([])
        if (isFocusedRef.current) {
          setOpen(true)
          setHighlightedIndex(-1)
        }
        setSearched(true)
      }
    }, 300)
  }

  const defaultGetValue = (item) => {
    if (typeof item === 'string') return item
    if (!item) return ''
    return item.entity_id || item.name || item.id || ''
  }

  const select = (item, customGetValue = getValue || defaultGetValue) => {
    selectingRef.current = true
    const fn = typeof customGetValue === 'function' ? customGetValue : defaultGetValue
    const val = typeof item === 'string' ? item : fn(item)
    setQuery(val)
    queryRef.current = val
    setResults([])
    setOpen(false)
    setSearched(false)
    setHighlightedIndex(-1)
    onPick?.(item)
    onCommit?.(val)
    clearTimeout(selectTimer.current)
    selectTimer.current = setTimeout(() => { selectingRef.current = false }, 200)
  }

  const handleFocus = () => {
    isFocusedRef.current = true
    if (query && results.length) {
      setOpen(true)
      setHighlightedIndex(0)
    }
  }

  const handleBlur = () => {
    isFocusedRef.current = false
    clearTimeout(blurTimer.current)
    blurTimer.current = setTimeout(() => {
      if (!selectingRef.current) {
        setOpen(false)
        if (commitOnBlur) {
          onCommit?.(queryRef.current)
        }
      }
    }, 150)
  }

  const handleKeyDown = (e) => {
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1))
    } else if (e.key === 'Enter' && highlightedIndex >= 0 && highlightedIndex < results.length) {
      e.preventDefault()
      select(results[highlightedIndex], getValue)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return { query, results, open, searched, highlightedIndex, search, select, handleFocus, handleBlur, handleKeyDown }
}
