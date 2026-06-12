# Biometric Login — Reference

## Option 1 — Device Biometric Unlock ✅ (built 2026-06-12)
"Lock screen" pattern, similar to banking apps. Email/password login still happens normally and creates the real Supabase session (cookie-based, via `@supabase/ssr`). On top of that, a device can be registered with a WebAuthn platform authenticator (Face ID / Touch ID / Windows Hello / Android fingerprint). Once registered, opening the app shows a lock screen that requires a successful biometric assertion before the dashboard renders — the existing Supabase session is what's actually authenticating, biometrics is a local re-entry gate, not a new auth factor server-side.

**How it works:**
- `biometric_credentials` table stores one row per registered device/credential: `personnel_id`, `credential_id`, `public_key`, `counter`, `device_label`, `transports`.
- Registration: Profile → Security section → "Enable on this device" → `@simplewebauthn/browser` `startRegistration()` → server verifies + stores credential.
- Unlock: dashboard layout checks for `bio_unlock` cookie. If the signed-in user has registered credentials and the cookie is missing, render `BiometricLockScreen` instead of the dashboard. User taps "Unlock" → `startAuthentication()` → server verifies assertion against stored public key, sets `bio_unlock` session cookie (cleared when browser fully closes) → page re-renders normally.
- "Use password instead" always available — falls back to normal sign-out/sign-in.
- rpID/origin derived from the request host at runtime (works for localhost + production domain).

**Key files:** `app/actions/biometric.ts`, `lib/webauthn.ts`, `components/BiometricLockScreen.tsx`, `components/BiometricSettings.tsx`, `app/(dashboard)/layout.tsx`, `app/(dashboard)/personnel/[id]/PersonnelProfileClient.tsx`

**Security note:** This is a UX convenience layer only. It does not replace the password or add a server-side auth factor — anyone with access to a valid Supabase session cookie bypasses it the same as before. True passwordless auth is Option 2 below.

---

## Option 2 — True Passkey Login (future, not built)
Replaces password entirely on registered devices using full WebAuthn registration + authentication as a real login method (no existing session required).

**Flow:**
- Registration ceremony (same WebAuthn credential table as Option 1, or a dedicated one) creates a public/private keypair; public key stored server-side, private key stays in the device's secure enclave.
- Login ceremony: user enters email (or uses discoverable credentials/autofill) → server issues a challenge → device signs it with Face ID/Touch ID/Windows Hello/fingerprint → server verifies the signature against the stored public key.
- **Session bridge**: Supabase has no native passkey sign-in (confirmed on auth-js 2.103.0). After verifying the WebAuthn assertion server-side, mint a real Supabase session via `adminClient.auth.admin.generateLink({ type: 'magiclink', email })` → extract `token_hash` from the generated link → `supabase.auth.verifyOtp({ type: 'magiclink', token_hash, email })` on a server client, which sets the normal session cookies.

**Why deferred:** Bigger build — registration/login UI changes (replacing the password form), rate limiting on the magic-link bridge, error handling for expired links, and a decision on whether passkeys *replace* or *supplement* passwords per account. Option 1 covers the "Face ID to get back in" UX most users actually want with far less risk.

**When to revisit:** If we ever want to drop passwords for return users entirely, or if a department specifically asks for passwordless login.
