'use client'

import { useRef, useState } from 'react'
import SignatureCapture, { type SignatureCaptureHandle } from '../SignatureCapture'
import { inputCls, type Personnel } from './types'

// Signer state + validation shared by Use / Administer / Waste. Signature pads are drawn
// by <SignerFields>; collect() reads them and says what's missing.
export function useSigners(requiredSigs: number, myPersonnelId: string) {
  const pad1 = useRef<SignatureCaptureHandle>(null)
  const pad2 = useRef<SignatureCaptureHandle>(null)
  const [signer1Id, setSigner1Id] = useState(requiredSigs >= 1 ? myPersonnelId : '')
  const [signer2Id, setSigner2Id] = useState('')

  // secondName: how the second signer is described in error text ("second signer", "witness").
  function collect(secondName: string, secondRequiredText?: string):
    | { error: string }
    | { signer_1_id: string | null; signer_2_id: string | null; signer_1_signature: string | null; signer_2_signature: string | null } {
    const sig1 = pad1.current?.getDataUrl() ?? null
    const sig2 = pad2.current?.getDataUrl() ?? null
    if (requiredSigs >= 1 && !signer1Id) return { error: 'Signer 1 is required.' }
    if (requiredSigs >= 1 && !sig1) return { error: 'Signer 1 must sign.' }
    if (requiredSigs >= 2 && !signer2Id) return { error: secondRequiredText ?? `A ${secondName} is required for controlled substances.` }
    if (requiredSigs >= 2 && !sig2) return { error: `The ${secondName} must sign.` }
    return { signer_1_id: signer1Id || null, signer_2_id: signer2Id || null, signer_1_signature: sig1, signer_2_signature: sig2 }
  }

  return { pad1, pad2, signer1Id, setSigner1Id, signer2Id, setSigner2Id, collect }
}

export default function SignerFields({
  signers, requiredSigs, personnel, firstLabel, secondLabel, firstPad = 'Signer 1 Signature', secondPad = 'Witness Signature',
}: {
  signers: ReturnType<typeof useSigners>
  requiredSigs: number
  personnel: Personnel[]
  firstLabel: string
  secondLabel: string
  firstPad?: string
  secondPad?: string
}) {
  return (
    <>
      {requiredSigs >= 1 && (
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-700">{firstLabel} *</label>
          <select value={signers.signer1Id} onChange={e => signers.setSigner1Id(e.target.value)} className={inputCls}>
            <option value="">Select person…</option>
            {personnel.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <div className="mt-2"><SignatureCapture ref={signers.pad1} label={firstPad} /></div>
        </div>
      )}
      {requiredSigs >= 2 && (
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-700">{secondLabel} *</label>
          <select value={signers.signer2Id} onChange={e => signers.setSigner2Id(e.target.value)} className={inputCls}>
            <option value="">Select person…</option>
            {personnel.filter(p => p.id !== signers.signer1Id).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <div className="mt-2"><SignatureCapture ref={signers.pad2} label={secondPad} /></div>
        </div>
      )}
    </>
  )
}
