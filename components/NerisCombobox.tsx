'use client'

import { useState, useRef, useEffect } from 'react'

type Code = { code: string | number; label: string }
type Group = { group: string; codes: Code[] }

interface BaseProps {
  groups: Group[]
  placeholder?: string
  disabled?: boolean
}

interface SingleProps extends BaseProps {
  multiple?: false
  value: string
  onChange: (value: string) => void
}

interface MultiProps extends BaseProps {
  multiple: true
  value: string[]
  onChange: (value: string[]) => void
}

type NerisComboboxProps = SingleProps | MultiProps

export default function NerisCombobox(props: NerisComboboxProps) {
  const { groups, placeholder = 'Select…', disabled = false } = props
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const isMulti = props.multiple === true
  const singleValue = isMulti ? '' : (props as SingleProps).value
  const multiValue = isMulti ? (props as MultiProps).value : []

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 0)
  }, [open])

  const filtered = search.trim()
    ? groups
        .map(g => ({
          ...g,
          codes: g.codes.filter(
            c =>
              c.label.toLowerCase().includes(search.toLowerCase()) ||
              String(c.code).toLowerCase().includes(search.toLowerCase())
          ),
        }))
        .filter(g => g.codes.length > 0)
    : groups

  function getLabelForCode(code: string): string {
    for (const g of groups) {
      const match = g.codes.find(c => String(c.code) === code)
      if (match) return match.label
    }
    return code
  }

  function isSelected(code: string): boolean {
    return isMulti ? multiValue.includes(code) : singleValue === code
  }

  function handleSelect(code: string) {
    if (isMulti) {
      const next = multiValue.includes(code)
        ? multiValue.filter(c => c !== code)
        : [...multiValue, code]
      ;(props as MultiProps).onChange(next)
    } else {
      ;(props as SingleProps).onChange(code)
      setOpen(false)
      setSearch('')
    }
  }

  function handleRemoveTag(code: string) {
    if (isMulti) {
      ;(props as MultiProps).onChange(multiValue.filter(c => c !== code))
    }
  }

  const triggerLabel = isMulti
    ? multiValue.length > 0 ? `${multiValue.length} selected` : placeholder
    : singleValue ? getLabelForCode(singleValue) : placeholder

  const hasValue = isMulti ? multiValue.length > 0 : !!singleValue

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        className={`w-full flex items-center justify-between rounded-lg border px-3 py-2 text-sm text-left bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed
          ${open ? 'border-red-500 ring-1 ring-red-500' : 'border-zinc-300 hover:border-zinc-400'}
          ${hasValue ? 'text-zinc-900' : 'text-zinc-400'}`}
      >
        <span className="truncate">{triggerLabel}</span>
        <span className="ml-2 text-zinc-400 shrink-0 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {/* Selected tags — multi only */}
      {isMulti && multiValue.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {multiValue.map(code => (
            <span
              key={code}
              className="inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-xs text-red-700"
            >
              {getLabelForCode(code)}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemoveTag(code)}
                  className="hover:text-red-900 leading-none"
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[280px] rounded-xl bg-white border border-zinc-200 shadow-xl overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-zinc-100">
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Type to search…"
              className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </div>

          {/* Options list */}
          <div className="max-h-64 overflow-y-auto">
            {/* Clear for single */}
            {!isMulti && singleValue && !search && (
              <button
                type="button"
                onClick={() => { (props as SingleProps).onChange(''); setOpen(false) }}
                className="w-full text-left px-3 py-2 text-xs text-zinc-400 hover:bg-zinc-50 border-b border-zinc-100"
              >
                Clear selection
              </button>
            )}

            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-sm text-zinc-400 text-center">
                No results for &ldquo;{search}&rdquo;
              </p>
            ) : (
              filtered.map(g => (
                <div key={g.group}>
                  <p className="sticky top-0 px-3 py-1.5 text-xs font-semibold text-zinc-400 uppercase tracking-wide bg-zinc-50 border-b border-zinc-100">
                    {g.group}
                  </p>
                  {g.codes.map(c => {
                    const sel = isSelected(String(c.code))
                    return (
                      <button
                        key={String(c.code)}
                        type="button"
                        onClick={() => handleSelect(String(c.code))}
                        className={`w-full text-left px-3 py-2 text-sm flex items-start gap-2.5 hover:bg-red-50 transition-colors
                          ${sel ? 'bg-red-50' : ''}`}
                      >
                        {isMulti ? (
                          <span className={`shrink-0 mt-0.5 w-4 h-4 rounded border flex items-center justify-center
                            ${sel ? 'bg-red-600 border-red-600' : 'border-zinc-300 bg-white'}`}>
                            {sel && <span className="text-white text-xs leading-none">✓</span>}
                          </span>
                        ) : (
                          <span className={`shrink-0 mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center
                            ${sel ? 'border-red-600' : 'border-zinc-300'}`}>
                            {sel && <span className="w-2 h-2 rounded-full bg-red-600 block" />}
                          </span>
                        )}
                        <span className="flex-1 min-w-0">
                          <span className="text-zinc-400 text-xs font-mono mr-1.5">{c.code}</span>
                          <span className={sel ? 'text-red-700 font-medium' : 'text-zinc-800'}>{c.label}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              ))
            )}
          </div>

          {/* Multi footer */}
          {isMulti && multiValue.length > 0 && (
            <div className="px-3 py-2 border-t border-zinc-100 flex items-center justify-between bg-zinc-50">
              <span className="text-xs text-zinc-500">{multiValue.length} selected</span>
              <button
                type="button"
                onClick={() => (props as MultiProps).onChange([])}
                className="text-xs text-red-600 hover:underline"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
