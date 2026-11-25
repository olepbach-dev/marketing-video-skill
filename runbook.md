# Recordly runbook (CDP)

Operational recipe for driving Recordly **1.3.3** on macOS 26. Verified
live 2026-08-17 except where marked UNVERIFIED. Background and the "why"
live in [`reference.md`](reference.md); this file is the checklist.

Do **not** automate Recordly with mouse clicks, the tray popover ignores
synthetic clicks and the app opens no ordinary window. Everything below
goes through the Chrome DevTools Protocol.

> **Honest state: capture works, but automated capture loses auto-zoom.**
> Verified live 2026-08-17: launch, CDP attach, permissions, `getSources`,
> `selectSource`, and record→stop all work, a real mp4 is produced.
> **But** starting the recording over CDP does *not* spawn Recordly's
> `recordly-native-cursor-monitor`, so no `.cursor.json` sidecar is
> written and **auto-zoom has no data to work from**. That is the one
> feature Recordly was chosen for. See §4. `switchToEditor` and the
> editor DOM remain unmapped.

## 0. Before anything: scope the capture

> **Correction, 2026-08-26.** A note from 2026-08-25 claimed that
> window-scoped capture works, because `getSources()` returned real windows
> and `selectSource()` accepted and echoed a window id. A test disproved it:
> with a window id selected and read back, the result was a 57-second capture
> of the entire display (3024x1964).
>
> **On macOS, Recordly 1.3.3 always captures a display.** The window-handle
> path in the source only applies on other platforms. Selecting a window id
> changes the tray label, not what is recorded.
>
> **So scope the display before every take.** Nothing in the API protects
> you, and both the selection read-back and the stop result will report
> success while the whole desktop is being recorded.

**Historical note (2026-08-17), kept because it may recur:** Recordly was
observed recording a WHOLE DISPLAY, with `getSources` returning zero
windows on macOS 26, window-scoped capture appeared unavailable, and the
agent's own screenshot filtering does nothing to protect the recording.
If `getSources` ever returns screens only again, fall back to the
display-scoping discipline below.

So, before a take:

1. Decide which display is the stage.
2. Put **only** the app being demoed on it. Move everything else, chat,
   editors, other browser profiles, notifications, to another display or
   close it.
3. If you cannot see that display yourself (e.g. the app is not in your
   Computer Use allowlist), **ask the user to confirm it is clear**.
   Do not guess.
4. Consider Do Not Disturb, a notification banner lands in the video.

## 1. Launch with the debugging port

`open -a` on an **already-running** app silently discards `--args`. You
must kill it first, every time:

```bash
pkill -f Recordly; sleep 3
open -a Recordly --args --remote-debugging-port=9333
sleep 7
curl -s http://127.0.0.1:9333/json/list
```

⚠️ **Never use port 9222**, a normally running Chrome with
remote debugging often uses it, and probing it pulls an unrelated browser
session into the agent's context.

`rc.js` (in this repo, ~40 lines, plain Node with the
global `WebSocket`) evaluates an expression in a renderer:

```bash
node rc.js '<js expression>' [windowTypeSubstring]
```

Window types: `hud-overlay` (always present), `source-selector`,
`countdown`, `editor`, `update-toast`.

## 2. Confirm permissions

Both gates must already be granted by a human, Screen Recording *and*
Accessibility (the latter drives cursor tracking, which drives auto-zoom).
Recordly reveals them one at a time, each needing a relaunch.

```bash
node rc.js '(async()=>(await window.electronAPI.getScreenRecordingPermissionStatus()).status)()'
# → "granted"
```

## 3. Pick the source

```bash
node rc.js '(async()=>{
  const s = await window.electronAPI.getSources({
    types:["screen","window"], thumbnailSize:{width:160,height:90}, fetchWindowIcons:true
  });
  return s.map(x => x.id + " | " + x.name);
})()'
```

Expect screens only, e.g. `screen:0:0 | Screen 1`. Then:

```bash
node rc.js 'window.electronAPI.selectSource("<source id>"), "ok"'
node rc.js '(async()=>await window.electronAPI.getSelectedSource())()'
```

Do **not** rely on `openSourceSelector()`: in 1.3.3 that window's React
root never mounts (`#root` empty, nothing appears on screen).

## 3b. CRITICAL: an invalid source id records the WHOLE SCREEN, silently

Verified live 2026-08-26. `startNativeScreenRecording("INGEN", {...})`: an id
that matches no source, returned `{"success":true,"microphoneFallbackRequired":false}`
and produced a perfectly good 7.4 s mp4 **of the entire display** (3024x1964),
not of the intended window. No error, no warning.

This is the leak path. Two mandatory guards:

1. **Before starting:** resolve the source id, then read it back.
   ```bash
   node rc.js "window.electronAPI.selectSource('<id>'), 'ok'"
   node rc.js '(async()=>await window.electronAPI.getSelectedSource())()'
   ```
   If the read-back is not the id you intended, STOP. Do not record.
2. **After stopping:** check the output dimensions before anyone looks at it.
   ```bash
   ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 <file>
   ```
   Full-display dimensions when you asked for a window means the take captured
   the desktop. Delete both the mp4 and its `.cursor.json` immediately.

Window titles change (a tab navigation renames the Chrome window), so a lookup
that matched a minute ago can return nothing now. Re-resolve immediately before
every take, never reuse an id across takes.

## 4. Record

> ### SOLVED 2026-08-26: an agent CAN press record and keep auto-zoom
>
> The 2026-08-17 finding below was correct about the symptom and wrong about
> the cause. The cursor monitor is not tied to the tray UI, it is tied to the
> app's recording STATE, and there is a renderer API for that which the
> original mapping missed: `setRecordingState`.
>
> Verified live: with no cursor-monitor process running,
> `setRecordingState("recording")` spawned
> `app.asar.unpacked/electron/native/bin/darwin-arm64/recordly-native-cursor-monitor`
> within two seconds. A subsequent CDP-started recording produced BOTH
> `recording-<ts>.mp4` and a 139 KB `recording-<ts>.mp4.cursor.json`.
>
> **Correct agent-driven sequence:**
> ```bash
> node rc.js "window.electronAPI.selectSource('<window id>'), 'ok'"
> node rc.js '(async()=>await window.electronAPI.getSelectedSource())()'   # MUST match
> node rc.js 'window.electronAPI.setRecordingState(true), "ok"'            # BOOLEAN. spawns monitor
> # confirm: pgrep -fl cursor-monitor
> node rc.js "(async()=>await window.electronAPI.startNativeScreenRecording('<window id>',{capturesSystemAudio:false,capturesMicrophone:false,microphoneDeviceId:null,microphoneLabel:null}))()"
> # ... drive the content ...
> node rc.js '(async()=>await window.electronAPI.stopNativeScreenRecording())()'
> node rc.js 'window.electronAPI.setRecordingState(false), "ok"'           # BOOLEAN. stops monitor
> # verify: both files exist, and ffprobe dimensions match the window
> ```
>
> Other renderer APIs the original map missed, worth exploring:
> `setCurrentRecordingSession`, `getCursorTelemetry`, `setCursorTelemetry`,
> `pauseCursorCapture`, `resumeCursorCapture`, `startCountdown`,
> `getRecordingPreferences`, `setRecordingPreferences`,
> `setHudOverlayCaptureProtection`.

### Historical (2026-08-17): why this was thought impossible

> ### ⚠️ Let a human press record if you want auto-zoom
>
> Verified empirically 2026-08-17 by recording twice and diffing the
> output directory:
>
> | Started via | mp4 | `.cursor.json` | `cursor-monitor` process | auto-zoom |
> |---|---|---|---|---|
> | Recordly's own tray UI | ✅ | ✅ 54 KB | ✅ spawned | ✅ |
> | `startNativeScreenRecording` over CDP | ✅ | ❌ none | ❌ never spawns | ❌ |
>
> Cursor tracking is a separate native binary
> (`recordly-native-cursor-monitor`, in `app.asar.unpacked`) that the
> main process spawns only through the app's own recording state
> machine. Calling the IPC directly skips it, silently, you still get a
> perfectly good video file, so **this failure is invisible until you
> open the editor and find no zoom suggestions.**
>
> **Recommended flow:** have the user start and stop the recording from
> the tray (one click each), and use automation for what it is actually
> good at, driving the content being demoed, and the editing afterwards.
> Use the CDP path below only when auto-zoom genuinely does not matter,
> or when you are prepared to place every zoom by hand.

```bash
# start, works, but see the warning above: no cursor telemetry
node rc.js 'window.electronAPI.startNativeScreenRecording("<source id>", {
  capturesSystemAudio:false, capturesMicrophone:false,
  microphoneDeviceId:null, microphoneLabel:null
}), "started"'

# stop
node rc.js '(async()=>await window.electronAPI.stopNativeScreenRecording())()'
```

Returns `{success:false, message:…}` on refusal, check it, don't assume
success. On stop you get
`{success, path, message:"Video stored successfully (N bytes, T s)"}`.
Related: `pauseNativeScreenRecording`, `resumeNativeScreenRecording`,
`recoverNativeScreenRecording`, `getLastNativeCaptureDiagnostics`.

Recordings land in
`~/Library/Application Support/Recordly/recordings`
(`getRecordingsDirectory()`; user-changeable via
`chooseRecordingsDirectory()`), alongside a `Projects/` subdirectory.

**Verify the sidecar after every take:** a good recording has *both*
`recording-<ts>.mp4` and `recording-<ts>.mp4.cursor.json`. If the
`.cursor.json` is missing, cursor telemetry was not captured and
auto-zoom will be empty, reshoot from the tray rather than discovering
it in the editor.

**Clean up test recordings.** They are full-screen captures of the user's
actual desktop. Delete yours by exact filename when done, and never
delete files you did not create, the user may have their own takes in
the same directory.

**Two clips beat one.** If the flow contains a long wait (a worker on a
5-minute cycle, a build, a queue), stop after the trigger and start again
when the result lands. Stitch in the editor. The timeline stays real and
the video stays watchable.

## 4b. Verified against the shipped source (2026-08-26)

Recordly's recording API is **undocumented upstream**. The GitHub repo
(webadderallorg/Recordly) documents CONTRIBUTING, EXTENSIONS, LICENSE,
RELEASING and TRANSLATION_GUIDE, and describes .recordly project files in
passing, but nothing about the IPC surface this runbook drives. **The only
source of truth is the shipped bundle**, so verify against it after every
app update:

setRecordingState:e=>r.ipcRenderer.invoke("set-recording-state"

Two things were read directly out of  in 1.3.3:

### setRecordingState takes a BOOLEAN, not a string



 is used as a plain truthy test. So **any non-empty string starts it**,
including ,  and . That is a real trap: calling
 to stop a recording silently RE-STARTS the
cursor monitor and leaves the tray showing a recording that is not writing
anything. Verified live both ways:  spawns
,  stops it.

### An id that is not a window id resolves to a DISPLAY, by design



Anything that is not recognisably a  source never reaches the
 error path at all, it falls through to
and  picks the primary display. That is why a failed window lookup
produced a full-desktop capture with . The guard in §3b is
not defensive paranoia; it is the only thing standing between a typo and a
recording of the user's desktop.

### Consequence for this runbook

Everything here rides on undocumented internal IPC. An app update can change
or remove any of it without a changelog entry. Re-verify §3b and §4 against
a freshly extracted asar whenever Recordly updates, and never trust a
return value as evidence that state changed, measure it (, ,
file listing).

## 5. Edit and hand off

```bash
node rc.js 'window.electronAPI.switchToEditor(), "ok"'
```

Then, in the `editor` renderer: let the automatic zoom suggestions stand
unless they are obviously wrong, add a caption per beat, trim the head and
tail, and save with **⌘S** (`Save Project`) / **⇧⌘S** (`Save Project As`).
`⌘O` opens existing projects.

**UNVERIFIED:** the editor's own DOM, timeline, auto-zoom pill track,
"+ Add Layer", caption controls. Nobody has reached the editor yet. Map it
over CDP on the first run that gets there, and replace this paragraph with
real selectors.

## 6. Stop

Report the saved `.recordly` path and stop. Never export, never publish,
never submit. That is always a separate, explicit request.
