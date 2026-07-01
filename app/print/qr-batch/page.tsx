'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'

const BASE_URL = 'https://municipal-hub.com'

type Asset = { id: string; asset_tag: string; serial_number: string | null }

type Format = 'sheet' | 'avery5163' | 'avery5164' | 'avery5160'

const FORMATS: { id: Format; label: string; description: string; cols: number; qrSize: number; cardStyle: React.CSSProperties }[] = [
  {
    id: 'sheet',
    label: 'Sheet (3-up)',
    description: '3 per row · full page · cut apart',
    cols: 3,
    qrSize: 140,
    cardStyle: { padding: '0.2in', border: '1.5px dashed #a1a1aa', borderRadius: '8px' },
  },
  {
    id: 'avery5160',
    label: 'Avery 5160',
    description: '30 per sheet · 2⅝″ × 1″',
    cols: 3,
    qrSize: 56,
    cardStyle: {
      width: '2.625in', height: '1in',
      padding: '0.05in 0.08in',
      overflow: 'hidden',
      boxSizing: 'border-box' as const,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: '6px',
    },
  },
  {
    id: 'avery5163',
    label: 'Avery 5163',
    description: '10 per sheet · 4″ × 2″',
    cols: 2,
    qrSize: 112,
    cardStyle: {
      width: '4in', height: '2in',
      padding: '0.1in 0.15in',
      overflow: 'hidden',
      boxSizing: 'border-box' as const,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: '0.12in',
    },
  },
  {
    id: 'avery5164',
    label: 'Avery 5164',
    description: '6 per sheet · 4″ × 3⅓″',
    cols: 2,
    qrSize: 160,
    cardStyle: {
      width: '4in', height: '3.33in',
      padding: '0.15in',
      overflow: 'hidden',
      boxSizing: 'border-box' as const,
    },
  },
]

function AssetCard({ asset, itemName, qrSize, cardStyle, isRow, tagFontSize = '11px', metaFontSize = '9px' }: {
  asset: Asset
  itemName: string
  qrSize: number
  cardStyle: React.CSSProperties
  isRow: boolean
  tagFontSize?: string
  metaFontSize?: string
}) {
  const qrValue = `${BASE_URL}/scan?type=asset&code=${encodeURIComponent(asset.asset_tag)}`
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
        <p style={{ fontFamily: 'monospace', fontSize: tagFontSize, fontWeight: 700, color: '#18181b', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {asset.asset_tag}
        </p>
        {asset.serial_number && (
          <p style={{ fontSize: metaFontSize, color: '#71717a', margin: '1px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {asset.serial_number}
          </p>
        )}
        <p style={{ fontSize: metaFontSize, color: '#a1a1aa', margin: '1px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {itemName}
        </p>
      </div>
    </div>
  )
}

function BatchContent() {
  const searchParams = useSearchParams()
  const itemId = searchParams.get('item_id') ?? ''
  const [assets, setAssets] = useState<Asset[]>([])
  const [itemName, setItemName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [format, setFormat] = useState<Format>('sheet')

  useEffect(() => {
    if (!itemId) { setError('No item specified.'); setLoading(false); return }
    fetch(`/api/assets-for-item?item_id=${encodeURIComponent(itemId)}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); return }
        setAssets(data.assets)
        setItemName(data.item_name)
      })
      .catch(() => setError('Failed to load assets.'))
      .finally(() => setLoading(false))
  }, [itemId])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', fontFamily: 'sans-serif' }}>
        <p style={{ color: '#71717a' }}>Loading…</p>
      </div>
    )
  }

  if (error || assets.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', fontFamily: 'sans-serif' }}>
        <p style={{ color: '#ef4444' }}>{error || 'No active assets found for this item.'}</p>
      </div>
    )
  }

  const fmt = FORMATS.find(f => f.id === format) ?? FORMATS[0]
  const isRow = format === 'avery5160' || format === 'avery5163'

  const pageStyle: React.CSSProperties = format === 'sheet'
    ? { padding: '0.5in', background: '#fff', fontFamily: 'sans-serif' }
    : format === 'avery5160'
    ? { padding: '0.5in 0.19in 0 0.19in', background: '#fff', fontFamily: 'sans-serif' }
    : format === 'avery5163'
    ? { padding: '0.5in 0.15625in 0 0.15625in', background: '#fff', fontFamily: 'sans-serif' }
    : { padding: '0.5in 0.15625in 0 0.15625in', background: '#fff', fontFamily: 'sans-serif' }

  const gap = format === 'avery5160' ? '0 0.125in' : format === 'avery5163' ? '0 0.1875in' : format === 'avery5164' ? '0 0.1875in' : '0.2in'

  return (
    <>
      {/* Controls — hidden on print */}
      <div className="no-print" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: '#18181b', padding: '10px 16px',
        display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
      }}>
        <span style={{ color: '#fff', fontFamily: 'sans-serif', fontSize: '13px', fontWeight: 600 }}>
          {itemName} QR Codes ({assets.length})
        </span>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {FORMATS.map(f => (
            <button
              key={f.id}
              onClick={() => setFormat(f.id)}
              style={{
                padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                border: format === f.id ? '2px solid #ef4444' : '1px solid #52525b',
                background: format === f.id ? '#ef4444' : 'transparent',
                color: '#fff', cursor: 'pointer', fontFamily: 'sans-serif',
              }}
              title={f.description}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => window.print()}
          style={{
            marginLeft: 'auto', padding: '6px 16px', borderRadius: '8px', fontSize: '13px',
            fontWeight: 700, background: '#b91c1c', color: '#fff', border: 'none',
            cursor: 'pointer', fontFamily: 'sans-serif',
          }}
        >
          Print
        </button>
      </div>

      {/* Print content */}
      <div style={{ ...pageStyle, paddingTop: format === 'sheet' ? '0.5in' : pageStyle.paddingTop }}>
        {format === 'sheet' && (
          <div style={{ marginBottom: '0.25in', borderBottom: '1px solid #e4e4e7', paddingBottom: '0.1in' }}>
            <p style={{ fontSize: '15px', fontWeight: 700, color: '#18181b', margin: 0 }}>{itemName}</p>
            <p style={{ fontSize: '10px', color: '#71717a', margin: '2px 0 0' }}>{assets.length} asset{assets.length !== 1 ? 's' : ''}</p>
          </div>
        )}
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${fmt.cols}, ${format === 'sheet' ? '1fr' : 'auto'})`,
          gap,
          rowGap: format === 'avery5160' ? 0 : format === 'avery5163' ? 0 : format === 'avery5164' ? 0 : '0.2in',
        }}>
          {assets.map(asset => (
            <AssetCard
              key={asset.id}
              asset={asset}
              itemName={itemName}
              qrSize={fmt.qrSize}
              cardStyle={fmt.cardStyle}
              isRow={isRow}
              tagFontSize={format === 'avery5163' ? '14px' : format === 'sheet' || format === 'avery5164' ? '13px' : '11px'}
              metaFontSize={format === 'avery5163' ? '11px' : '9px'}
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
