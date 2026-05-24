'use client'

import { QRCodeSVG } from 'qrcode.react'

interface Props {
  personnelId: string
  name: string
  deptName: string
  role: string
  employeeNumber: string | null
}

export default function MemberCardClient({ personnelId, name, deptName, role, employeeNumber }: Props) {
  const token = `FO7:P:${personnelId}`

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', padding: '1in', background: '#fff', minHeight: '100vh' }}>
      {/* Print button — hidden in print */}
      <div style={{ marginBottom: '0.5in' }} className="no-print">
        <button
          onClick={() => window.print()}
          style={{
            background: '#991b1b',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            padding: '10px 24px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Print Card
        </button>
        <p style={{ marginTop: '8px', fontSize: '12px', color: '#71717a' }}>
          Print on cardstock and cut to wallet size (3.375" × 2.125").
        </p>
      </div>

      {/* Card — 3.375" × 2.125" */}
      <div
        style={{
          width: '3.375in',
          height: '2.125in',
          border: '1px solid #d4d4d8',
          borderRadius: '8px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 1px 4px rgba(0,0,0,0.10)',
        }}
      >
        {/* Red header bar */}
        <div
          style={{
            background: '#991b1b',
            color: '#fff',
            padding: '4px 10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            {deptName}
          </span>
          <span style={{ fontSize: '8px', opacity: 0.75, letterSpacing: '0.05em' }}>FireOps7</span>
        </div>

        {/* Card body */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'stretch', padding: '8px 10px', gap: '8px' }}>
          {/* Left: name + role */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#18181b', lineHeight: 1.2, wordBreak: 'break-word' }}>
              {name}
            </div>
            <div style={{ fontSize: '10px', color: '#52525b', marginTop: '4px' }}>{role}</div>
            {employeeNumber && (
              <div style={{ fontSize: '9px', color: '#a1a1aa', marginTop: '2px' }}>#{employeeNumber}</div>
            )}
          </div>

          {/* Right: QR code */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <QRCodeSVG
              value={token}
              size={80}
              level="M"
              marginSize={1}
            />
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            background: '#f4f4f5',
            borderTop: '1px solid #e4e4e7',
            padding: '3px 10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: '7px', color: '#a1a1aa', fontFamily: 'monospace' }}>{token}</span>
          <span style={{ fontSize: '7px', color: '#a1a1aa' }}>Personnel ID Card</span>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; padding: 0; background: #fff; }
          @page { size: 3.375in 2.125in; margin: 0; }
          div[style*="3.375in"] { box-shadow: none !important; border-radius: 0 !important; }
        }
      `}</style>
    </div>
  )
}
