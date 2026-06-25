<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:android-studio-agent-rules -->
# ⚠️ Android Studio Agent (Claude) — READ THIS FIRST

## STARTING POINT FOR EVERY SESSION AND EVERY BUILD

**Before doing anything else, read `ANDROID_HANDOFF.md` in the project root.**

This is mandatory. It defines:
- Division of responsibility between this agent (Android Studio) and Claude Code (VS Code)
- When a native APK rebuild is actually required vs. just a git push
- The standard handoff sequence between agents
- Guardrails — what this agent must NOT edit
- Known pitfalls hit in practice

## Your Primary Jobs
1. Gradle sync / dependency resolution
2. Build APK (`assembleDebug`) and deploy to the **physical phone** (not an emulator)
3. Report build errors back to Claude Code — do not patch native source directly

Do not edit `app/`, `components/`, or `lib/` — those belong to Claude Code.
<!-- END:android-studio-agent-rules -->
