'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'

const BASE_URL = 'https://municipal-hub.com'

type BatchType = 'asset' | 'compartment' | 'apparatus'

// Normalized shape all three sources map into for rendering.
type CardItem = { id: string; code: string; primary: string; secondary: string | null }

type Format = 'sheet' | 'avery5163' | 'avery5164' | 'avery5160'

// Base sheet margins per format (in inches) — these match Avery template specs
const FORMAT_DEFAULTS: Record<Format, { top: number; left: number }> = {
  sheet:      { top: 0.5,  left: 0.5 },
  avery5160:  { top: 0.5,  left: 0.19 },
  avery5163:  { top: 1.0,  left: 0.15625 },
  avery5164:  { top: 0.5,  left: 0.15625 },
}

const FORMATS: {
  id: Format; label: string; description: string
  cols: number; qrSize: number; cardStyle: React.CSSProperties
  colGap: string; rowGap: string
}[] = [
  {
    id: 'sheet',
    label: 'Sheet (3-up)',
    description: '3 per row · full page · cut apart',
    cols: 3, qrSize: 140, colGap: '0.2in', rowGap: '0.2in',
    cardStyle: { padding: '0.2in', border: '1.5px dashed #a1a1aa', borderRadius: '8px' },
  },
  {
    id: 'avery5160',
    label: 'Avery 5160',
    description: '30 per sheet · 2⅝″ × 1″',
    cols: 3, qrSize: 56, colGap: '0.125in', rowGap: '0',
    cardStyle: {
      width: '2.625in', height: '1in',
      padding: '0.05in 0.08in',
      overflow: 'hidden', boxSizing: 'border-box' as const,
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: '6px',
    },
  },
  {
    id: 'avery5163',
    label: 'Avery 5163',
    description: '10 per sheet · 4″ × 2″',
    cols: 2, qrSize: 90, colGap: '0.1875in', rowGap: '0',
    cardStyle: {
      width: '4in', height: '2in',
      padding: '0.1in',
      overflow: 'hidden', boxSizing: 'border-box' as const,
      justifyContent: 'center' as const, alignItems: 'center' as const,
    },
  },
  {
    id: 'avery5164',
    label: 'Avery 5164',
    description: '6 per sheet · 4″ × 3⅓″',
    cols: 2, qrSize: 160, colGap: '0.1875in', rowGap: '0',
    cardStyle: {
      width: '4in', height: '3.33in',
      padding: '0.15in',
      overflow: 'hidden', boxSizing: 'border-box' as const,
      justifyContent: 'center' as const, alignItems: 'center' as const,
    },
  },
]

function OffsetBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '2px 7px', borderRadius: '4px', fontSize: '13px', fontWeight: 700,
        border: '1px solid #52525b', background: 'transparent', color: '#fff',
        cursor: 'pointer', fontFamily: 'sans-serif', lineHeight: 1.4,
      }}
    >
      {label}
    </button>
  )
}

function QrCard({ item, type, groupLabel, qrSize, cardStyle, isRow }: {
  item: CardItem; type: BatchType; groupLabel: string; qrSize: number
  cardStyle: React.CSSProperties; isRow: boolean
}) {
  const qrValue = `${BASE_URL}/scan?type=${type}&code=${encodeURIComponent(item.code)}`
  const tagSize = isRow ? '11px' : '13px'
  const metaSize = isRow ? '9px' : '10px'
  return (
    <div style={{
      display: 'flex',
      flexDirection: isRow ? 'row' : 'column',
      alignItems: 'center',
      gap: isRow ? '6px' : '4px',
      pageBreakInside: 'avoid',
      breakInside: 'avoid',
      ...cardStyle,
    }}>
      <QRCodeSVG value={qrValue} size={qrSize} level="M" style={{ flexShrink: 0 }} />
      <div style={{ textAlign: isRow ? 'left' : 'center', minWidth: 0 }}>
        <p style={{ fontFamily: 'monospace', fontSize: tagSize, fontWeight: 700, color: '#18181b', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {item.primary}
        </p>
        {item.secondary && (
          <p style={{ fontSize: metaSize, color: '#71717a', margin: '1px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {item.secondary}
          </p>
        )}
        <p style={{ fontSize: metaSize, color: '#a1a1aa', margin: '1px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {groupLabel}
        </p>
      </div>
    </div>
  )
}

function BatchContent() {
  const searchParams = useSearchParams()
  const type = (searchParams.get('type') as BatchType) || 'asset'
  const itemId = searchParams.get('item_id') ?? ''
  const apparatusId = searchParams.get('apparatus_id') ?? ''
  const [items, setItems] = useState<CardItem[]>([])
  const [groupLabel, setGroupLabel] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [format, setFormat] = useState<Format>('avery5163')
  const [topOffset, setTopOffset] = useState(0)   // extra inches added to base top margin
  const [leftOffset, setLeftOffset] = useState(0) // extra inches added to base left margin

  useEffect(() => {
    if (type === 'compartment') {
      if (!apparatusId) { setError('No apparatus specified.'); setLoading(false); return }
      fetch(`/api/compartments-for-apparatus?apparatus_id=${encodeURIComponent(apparatusId)}`)
        .then(r => r.json())
        .then(data => {
          if (data.error) { setError(data.error); return }
          setItems(data.compartments.map((c: { id: string; qr_code: string; compartment_code: string; compartment_name: string }) => ({
            id: c.id, code: c.qr_code, primary: c.compartment_code, secondary: c.compartment_name || null,
          })))
          setGroupLabel(`${data.unit_number} — Compartments`)
        })
        .catch(() => setError('Failed to load compartments.'))
        .finally(() => setLoading(false))
      return
    }

    if (type === 'apparatus') {
      if (!apparatusId) { setError('No apparatus specified.'); setLoading(false); return }
      fetch(`/api/apparatus-qr?apparatus_id=${encodeURIComponent(apparatusId)}`)
        .then(r => r.json())
        .then(data => {
          if (data.error) { setError(data.error); return }
          const a = data.apparatus
          setItems([{ id: a.id, code: a.qr_code, primary: a.unit_number, secondary: a.apparatus_name || null }])
          setGroupLabel('Apparatus')
        })
        .catch(() => setError('Failed to load apparatus.'))
        .finally(() => setLoading(false))
      return
    }

    if (!itemId) { setError('No item specified.'); setLoading(false); return }
    fetch(`/api/assets-for-item?item_id=${encodeURIComponent(itemId)}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); return }
        setItems(data.assets.map((a: { id: string; asset_tag: string; serial_number: string | null }) => ({
          id: a.id, code: a.asset_tag, primary: a.asset_tag, secondary: a.serial_number,
        })))
        setGroupLabel(data.item_name)
      })
      .catch(() => setError('Failed to load assets.'))
      .finally(() => setLoading(false))
  }, [type, itemId, apparatusId])

  // Reset offsets when format changes
  function changeFormat(f: Format) {
    setFormat(f)
    setTopOffset(0)
    setLeftOffset(0)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', fontFamily: 'sans-serif' }}>
        <p style={{ color: '#71717a' }}>Loading…</p>
      </div>
    )
  }

  const emptyMessage = type === 'compartment' ? 'No active compartments with QR codes found for this apparatus.'
    : type === 'apparatus' ? 'No QR code found for this apparatus.'
    : 'No active assets found for this item.'

  if (error || items.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', fontFamily: 'sans-serif' }}>
        <p style={{ color: '#ef4444' }}>{error || emptyMessage}</p>
      </div>
    )
  }

  const fmt = FORMATS.find(f => f.id === format) ?? FORMATS[0]
  const isRow = format === 'avery5160'
  const base = FORMAT_DEFAULTS[format]
  const topIn = (base.top + topOffset).toFixed(4)
  const leftIn = (base.left + leftOffset).toFixed(4)

  const step = 0.05

  return (
    <>
      {/* Controls — hidden on print */}
      <div className="no-print" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: '#18181b', padding: '8px 14px',
        display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
      }}>
        <span style={{ color: '#fff', fontFamily: 'sans-serif', fontSize: '13px', fontWeight: 600 }}>
          {groupLabel} ({items.length})
        </span>

        {/* Format buttons */}
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
          {FORMATS.map(f => (
            <button
              key={f.id}
              onClick={() => changeFormat(f.id)}
              title={f.description}
              style={{
                padding: '3px 9px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                border: format === f.id ? '2px solid #ef4444' : '1px solid #52525b',
                background: format === f.id ? '#ef4444' : 'transparent',
                color: '#fff', cursor: 'pointer', fontFamily: 'sans-serif',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Offset nudge controls */}
        {format !== 'sheet' && (
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ color: '#a1a1aa', fontSize: '11px', fontFamily: 'sans-serif' }}>Top</span>
              <OffsetBtn label="−" onClick={() => setTopOffset(v => Math.round((v - step) * 100) / 100)} />
              <span style={{ color: '#e4e4e7', fontSize: '11px', fontFamily: 'monospace', minWidth: '38px', textAlign: 'center' }}>
                {topIn}″
              </span>
              <OffsetBtn label="+" onClick={() => setTopOffset(v => Math.round((v + step) * 100) / 100)} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ color: '#a1a1aa', fontSize: '11px', fontFamily: 'sans-serif' }}>Left</span>
              <OffsetBtn label="−" onClick={() => setLeftOffset(v => Math.round((v - step) * 100) / 100)} />
              <span style={{ color: '#e4e4e7', fontSize: '11px', fontFamily: 'monospace', minWidth: '38px', textAlign: 'center' }}>
                {leftIn}″
              </span>
              <OffsetBtn label="+" onClick={() => setLeftOffset(v => Math.round((v + step) * 100) / 100)} />
            </div>
          </div>
        )}

        <button
          onClick={() => window.print()}
          style={{
            marginLeft: 'auto', padding: '5px 14px', borderRadius: '8px', fontSize: '13px',
            fontWeight: 700, background: '#b91c1c', color: '#fff', border: 'none',
            cursor: 'pointer', fontFamily: 'sans-serif',
          }}
        >
          Print
        </button>
      </div>

      {/* Print content */}
      <div style={{
        paddingTop: `${topIn}in`,
        paddingLeft: `${leftIn}in`,
        paddingRight: 0,
        paddingBottom: 0,
        background: '#fff',
        fontFamily: 'sans-serif',
      }}>
        {format === 'sheet' && (
          <div style={{ marginBottom: '0.25in', borderBottom: '1px solid #e4e4e7', paddingBottom: '0.1in', paddingRight: '0.5in' }}>
            <p style={{ fontSize: '15px', fontWeight: 700, color: '#18181b', margin: 0 }}>{groupLabel}</p>
            <p style={{ fontSize: '10px', color: '#71717a', margin: '2px 0 0' }}>{items.length} item{items.length !== 1 ? 's' : ''}</p>
          </div>
        )}
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${fmt.cols}, ${format === 'sheet' ? '1fr' : 'max-content'})`,
          columnGap: fmt.colGap,
          rowGap: fmt.rowGap,
        }}>
          {items.map(item => (
            <QrCard
              key={item.id}
              item={item}
              type={type}
              groupLabel={groupLabel}
              qrSize={fmt.qrSize}
              cardStyle={fmt.cardStyle}
              isRow={isRow}
            />
          ))}
        </div>
      </div>

      <style>{`
        @page {
          size: 8.5in 11in;
          margin: 0;
        }
        @media print {
          .no-print { display: none !important; }
          html, body { margin: 0; padding: 0; }
        }
      `}</style>
    </>
  )
}

export default function QrBatchPage() {
  return <Suspense><BatchContent /></Suspense>
}
