import { Search } from 'lucide-react'
import { api } from '../api'
import { useSearchSelect } from '../hooks/useSearchSelect'

export function SearchInput({
  label, value, onChange, endpoint, placeholder, emptyMessage = 'No results found',
  getValue = (item) => (typeof item === 'string' ? item : item.entity_id),
  getSub = (item) => (typeof item === 'object' ? item.friendly_name : null),
  onPick, commitOnBlur = true, onEmpty,
}) {
  const fetcher = async (q) => {
    const { data } = await api.get(`${endpoint}?search=${encodeURIComponent(q)}`)
    return data
  }
  const { query, results, open, searched, highlightedIndex, search, select, handleFocus, handleBlur, handleKeyDown } = useSearchSelect(
    fetcher,
    { initialQuery: value || '', commitOnBlur, onCommit: onChange, onPick, onEmpty: onEmpty || (() => onChange?.('')) }
  )

  return (
    <div className="relative">
      <label className="text-xs text-white/40 mb-1 block">{label}</label>
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
        <input value={query} onChange={(e) => search(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full bg-bg border border-white/10 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-primary/50" />
      </div>
      {open && searched && (
        <div className="absolute z-10 mt-1 w-full bg-surface border border-white/10 rounded-lg shadow-xl overflow-hidden">
          {results.length === 0 ? (
            <p className="px-3 py-2 text-sm text-white/40">{emptyMessage}</p>
          ) : (
            results.map((item, i) => {
              const display = getValue(item)
              const sub = getSub(item)
              return (
                <button key={i} onMouseDown={() => select(item, getValue)}
                  className={`w-full text-left px-3 py-2 text-xs text-white/70 hover:bg-white/5 ${i === highlightedIndex ? 'bg-white/10' : ''}`}>
                  <span className={typeof item === 'string' ? 'font-mono' : ''}>{display}</span>
                  {sub && <span className="ml-2 text-white/40">{sub}</span>}
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
