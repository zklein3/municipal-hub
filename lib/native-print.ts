import { registerPlugin } from '@capacitor/core'

export interface NativePrintPlugin {
  print(options?: { jobName?: string }): Promise<void>
}

// On non-native platforms this resolves immediately (no-op fallback).
const NativePrint = registerPlugin<NativePrintPlugin>('NativePrint', {
  web: {
    print: async () => { window.print() },
  },
})

export default NativePrint
