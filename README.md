# marketing-video

Turn a real screen-recorded product walkthrough into a polished demo/marketing
video using [Recordly](https://github.com/webadderallorg/Recordly) (open-source
screen recorder/editor). Produces a `.recordly` project file ready for manual
review and export and never exports or publishes anything itself.

`SKILL.md` tells an agent (Claude Code or Codex) when to use the workflow and
which constraints it must never skip. The rest of the repo holds the research,
the operational runbook and the verified notes behind those rules.

**Why publish this:** the interesting part is less the script than the
working method. Every claim about Recordly in this repo is marked as verified
live, unverified, or retracted, with the date and the test that settled it.
Several AI-suggested GitHub repos turned out not to exist; they were checked
with `gh repo view` before anything was built on them.

## Why Recordly (decided 2026-08-17)

Researched via WebSearch + an independent Codex `deep-review`-role call +
an independent Gemini call, all given the same question independently.
Every GitHub repo name was verified directly with `gh repo view` before being
trusted. Several AI-suggested repo names in the raw research output did not
exist; the ones below do.

**Consensus finding:** no single mature open-source tool handles capture →
auto-edit → scene-assembly → polished export end-to-end. A modular pipeline
is the right call, confirmed by three independent sources.

**Recordly chosen over Cap** (`CapSoftware/Cap`) because:
- Recordly has **automatic zoom suggestions based on cursor activity built
  in**. That solves the hardest unsolved problem (auto-zoom) without
  reimplementing zoom math in ffmpeg.
- Recordly persists **`.recordly` project files**. That matches the target
  workflow exactly: prepare everything automatically, hand the same project
  file to a human for review/tweaks, they export.
- Recordly has a documented extension API (`registerRenderHook`, permission
  system, TypeScript types), read directly from its `EXTENSIONS.md`, not
  from marketing copy.
- Cap is Tauri-based (not Electron), has no documented project-file format,
  and leans toward team-sharing/hosting rather than editing automation.
- AGPL-3.0, free for commercial use. No licensing blocker (unlike Remotion,
  which requires a paid Company License once an org exceeds 3 employees and
  is building an automation).

Full candidate comparison table (stars, license, verdict per repo) is in
[`reference.md`](reference.md).

## Files

- [`runbook.md`](runbook.md): the operational checklist. Start here when
  actually recording something.
- [`rc.js`](rc.js): drives a Recordly renderer over CDP:
  `node rc.js '<expr>' [windowType]`.
- [`reference.md`](reference.md): research trail, verified UI/behaviour
  notes, and the gotchas behind the runbook's rules.

## Prerequisites

- Recordly installed: `/Applications/Recordly.app` (macOS arm64; verify the
  current release with `gh release view --repo webadderallorg/Recordly`
  before assuming a cached version number is current). Verify any new
  download against the release's `SHA256SUMS.txt` before installing.
- macOS Screen Recording + Accessibility permissions granted to Recordly
  (System Settings → Privacy & Security), required for cursor tracking and
  auto-zoom.
- A genuine **Computer Use** tool (OS-level mouse/keyboard/window
  automation). Chrome DevTools MCP alone is NOT sufficient, it only drives
  browser tabs, not the native Recordly window.

## Workflow

### 1. Capture

Two paths depending on whether the walkthrough needs a real logged-in
session:

- **Authenticated flow** (the common case): drive the real browser via
  Chrome DevTools MCP against the user's actual logged-in Chrome, while
  Computer Use starts/stops Recordly's own native screen recorder around
  the same screen. Don't use a fresh Playwright-launched browser for this,   it has no login session.
- **Unauthenticated / scripted flow** (B-roll, marketing clips needing no
  real account): a standalone Playwright script with the `recordVideo`
  context option captures directly; import the resulting file into Recordly
  afterward (README-confirmed supported: "Open existing recordings... from
  the app").

Before recording, write a short beat list: each meaningful step, in order,
with a one-line caption ("Connecting to Attio via OAuth", "Lead syncs to
Attio as a person"). This drives the caption/annotation step below and
keeps pacing deliberate rather than free-form.

### 2. Edit (Computer Use drives Recordly's editor)

1. Open Recordly, import the captured recording (or it opens directly if
   captured via Recordly's own recorder).
2. Let Recordly's automatic zoom suggestions apply, check first before
   hand-writing any zoom region; don't assume the auto-suggestions missed
   something.
3. Add text/caption annotations at each beat from the beat list.
4. Trim dead space at start/end; leave mid-flow pacing as auto-zoom
   produced it unless it's obviously wrong.
5. Save as a `.recordly` project file.

### 3. Handoff: stop here

Report the `.recordly` project file's path back. Do not export, do not
publish, do not submit anywhere. The human opens the same project, makes
their own small adjustments, and exports themselves.

## Automation without Computer Use

A raw `screencapture` (full-screen) + AppleScript/System Events fallback
was tried once (2026-08-17) and abandoned: it captures the ENTIRE screen,
not just Recordly's window, and on the first attempt captured an unrelated
live session the user had open at the time. That's a real privacy/scope
problem, not hypothetical. If genuine Computer Use isn't available, stop
and say so rather than falling back to blind full-screen capture.

## Status

**Partially verified live (2026-08-17, Recordly 1.3.3, macOS 26).**

The big correction: **do not automate Recordly with mouse clicks.** It is
an Electron app whose tray popover ignores synthetic clicks and which
opens no ordinary window. Launch it with
`--remote-debugging-port=9333` and drive `window.electronAPI` over CDP
instead. Full API surface and the working recipe are in `reference.md`.

- **Verified:** Electron/CDP control path; both permission gates (Screen
  Recording *and* Accessibility, revealed one at a time, each needing a
  relaunch); `getScreenRecordingPermissionStatus()` → `granted`;
  `openSourceSelector()` creates its window; menu structure
  (`Open Projects ⌘O`, `Save Project ⌘S`, `Save Project As ⇧⌘S`).
- **Verified and important:** capture is **whole-screen only** on this
  machine, `getSources` returns three screens and zero windows. Scope a
  take by dedicating one display to it, not by picking a window.
- **Known defect in 1.3.3:** the `source-selector` renderer never mounts
  (`#root` empty). Use `getSources()` + `selectSource()` instead of its UI.
- **⚠️ Automated recording loses auto-zoom.** Record→stop over CDP
  produces a valid mp4, but does *not* spawn Recordly's
  `recordly-native-cursor-monitor`, so no `.cursor.json` is written and
  auto-zoom has no data. Verified by recording twice and diffing the
  output. **Have a human press record from the tray**, and automate the
  content and the edit instead. Details in `runbook.md` §4.
- **Still unverified:** `switchToEditor` and the editor UI map (timeline,
  auto-zoom pills, captions, Save/Export).

This partly undercuts the original reason for choosing Recordly over Cap
(built-in auto-zoom). It is still the right tool *with* a human on the
record button; revisit the comparison if fully hands-off capture ever
becomes a requirement.

## Install as an agent skill

```bash
# Claude Code
git clone https://github.com/olepbach-dev/marketing-video-skill ~/.claude/skills/marketing-video
# OpenAI Codex
git clone https://github.com/olepbach-dev/marketing-video-skill ~/.agents/skills/marketing-video
```

## About

Built by Ole Cramer-Bach at Taktflow ApS (Aalborg, Denmark), where we help
companies put AI to work in operations. Product demos are recorded from the
real product; this workflow exists so the recording and editing are fast
without faking the footage.

## License

MIT for the files in this repo. Recordly itself is AGPL-3.0 and installed
separately.
