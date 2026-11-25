# marketing-video, reference

## Research trail (2026-08-17)

Three independent research passes, cross-checked against each other, with
every GitHub repo name verified directly via `gh repo view <owner>/<repo>`
before being trusted (LLM-suggested repo names are not reliable on their
own, several suggested here did not exist; the ones listed below do).

### Consensus finding

No single mature open-source tool handles capture → auto-edit →
scene-assembly → polished export end-to-end. A modular pipeline is the
right call, confirmed by: (1) independent WebSearch research, (2) an
independent Codex `deep-review`-role call given the same question, (3) an
independent Gemini call given the same question.

### Verified candidates (checked via `gh repo view`, not just search snippets)

| Repo | Stars | Last push | License | Verdict |
|---|---|---|---|---|
| `webadderallorg/Recordly` | 21,346 | 2026-08-15 | AGPL-3.0 | **Chosen.** Auto-zoom + `.recordly` project files + documented extension API |
| `CapSoftware/Cap` | 20,873 | 2026-08-16 | Other (check terms before any commercial reliance) | Considered, not chosen, Tauri (not Electron), no documented project file, leans team-sharing/hosting |
| `craftled/openklip` | 1 | 2026-08-10 | MIT | Promising, unproven, "agent-native... CLI and MCP... designed to be driven by coding agents." Worth a spike for the FUTURE landing-page/Remotion-track work, not used for this tool's Recordly-based flow |
| `WyattBlue/auto-editor` | ~5k | active | Unlicense | Dead-air cutting, CLI, relevant to the separate Playwright/Remotion track for unauthenticated marketing clips, not to Recordly's own editor |
| `remotion-dev/remotion` | 56.5k | active | Free ≤3 employees / paid Company License above that for automations | Relevant to the FUTURE landing-page track, not to Attio-style compliance screen-recordings (Attio explicitly forbids anything but a genuine screen recording) |
| `redotvideo/revideo` (= `midrender/revideo`, same repo, org renamed) | 3,979 | 2026-07-15 | MIT | Closest Remotion alternative if Remotion's licensing becomes a blocker |
| `opensensor/demo-forge`, `hyperframes/hyperframes` | 1 each | one-shot commit, no activity since |, | Real repos, but essentially unmaintained single-commit dumps, not usable |
| `siddharthvaddem/openscreen` |, | archived |, | Archived; community fork at `EtienneLescot/openscreen` if the zoom/easing math is ever worth porting |
| `editly` (mifi/editly) |, |, | MIT | Explicitly dropped from the plan, Codex's independent review recommended Remotion alone over combining Remotion+editly for the assembly layer |

### Reddit / real-world automation guides

Searched multiple times, multiple angles (site:reddit.com, direct site
mentions, "automate" + tool name). Found **none** for either Recordly or
Cap. This is a genuine gap, not a search failure, no user has publicly
documented automating either tool. Recordly's own `EXTENSIONS.md` is the
only primary automation-relevant documentation that exists.

### Generated video (separate finding, not used by this tool)

- Gemini Veo 3.1 can generate video with synced native audio, confirmed in
  the official Gemini API docs (billed per second). That is a different
  product category: this tool only works with real screen recordings.
- Headless Gemini CLI analysis of a YouTube video was tested (2026-08-17)
  and failed, because headless mode could not use its own fetch tools.
  Do not work around that with a skip-permissions flag, which grants far
  more than the task needs.

## Recordly launch behaviour, VERIFIED LIVE 2026-08-17

Verified with a genuine Computer Use tool (OS-level, compositor-filtered
screenshots) against Recordly **1.3.3** at `/Applications/Recordly.app`.
This section is observed fact. The editor UI map below it is still not
verified, see why in "Blocker" immediately below.

- **Recordly is a menu-bar-only app until it can record.** Launching it
  opens **no window at all**. The `Window` menu lists only
  Minimize / Zoom / Bring All to Front, no window entries. A menu-bar
  icon appears at the top right while it runs.
- Menu bar is: `Recordly  File  Edit  View  Window  Help`. The `Edit`
  menu is the **stock macOS text menu** (Undo/Redo/Cut/Copy/Paste/Select
  All/Skriveværktøjer/Autoudfyld/Start diktering/Emojis og symboler),   nothing Recordly-specific lives there.
- **Automation gotcha: focus falls to the desktop shell** after any
  Recordly menu closes, because the app owns no window. Computer Use then
  refuses the next click ("The desktop shell is frontmost"). Re-foreground
  with `open_application` between menu interactions, or grant `Finder`
  alongside `Recordly` in the allowlist.

### Blocker: TWO sequential permission gates (hit on first real use, 2026-08-17)

Recordly gates itself behind **two** separate TCC permissions, and it only
reveals the second one after the first is granted and the app is
relaunched. Budget two quit/relaunch cycles, not one.

**Gate 1, Screen Recording.** Attempting to use the `File` menu raises:

> Recordly needs Screen Recording permission before you start. System
> Settings has been opened. After enabling it, quit and reopen Recordly.

**Gate 2, Accessibility.** After granting Screen Recording and
relaunching, the app immediately raises a second modal on launch:

> Recordly also needs Accessibility permission for cursor tracking.
> System Settings has been opened. After enabling it, quit and reopen
> Recordly.

Gate 2 is **not optional for this workflow**: cursor tracking is what
feeds the automatic zoom suggestions, which is the entire reason Recordly
was chosen over Cap. Panes:
`x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture`
and `…?Privacy_Accessibility`.

Both are single-`OK` modals. Consequences:

- **A human must grant both.** These are system-level TCC permissions
  requiring admin authentication in System Settings → Privacy & Security.
  An agent must not toggle them (protected security settings), and
  `TCC.db` is not even readable (`authorization denied`) to verify state
  programmatically, the app's own dialogs are the only available
  evidence, so drive the state by relaunching and reading the modal.
- **Recordly must be quit and relaunched after each toggle**; enabling it
  while running is not enough. Use `osascript -e 'quit app "Recordly"'`
  then `open_application`: a clean quit, not a kill.
- Until then the editor is unreachable, so **the UI map below stays
  unverified**. Budget for this on any fresh machine.

### Recordly is Electron, drive it over CDP, not with clicks (VERIFIED 2026-08-17)

`View` menu exposes Reload / Force Reload / **Toggle Developer Tools ⌥⌘I**,
i.e. Recordly is an Electron app. This is the single most useful finding:
**the tray popover cannot be driven with synthetic clicks, but the whole
app can be driven programmatically over the Chrome DevTools Protocol.**

- **Tray left-click does nothing under automation.** Verified repeatedly,
  across all three displays: a synthetic left-click on the status item
  produces only a hover tooltip, never the popover. Electron tray
  popovers do not accept synthetic CGEvents.
- **Tray right-click DOES work**, it is a native `NSMenu`:
  `Open` / `Quit` when idle, `Stop Recording` while recording. But
  clicking `Open` still produced no visible window.
- **Recordly launches with no visible window at all.** Only a transparent
  `hud-overlay` window exists. `System Events` cannot enumerate its
  windows (AppleEvent timeout `-1712`), so AppleScript is a dead end too.

**The working entry point:**

```bash
pkill -f Recordly; sleep 3
open -a Recordly --args --remote-debugging-port=9333
curl -s http://127.0.0.1:9333/json/list
```

⚠️ **Do not use port 9222**, a normally running Chrome often listens there, and
probing it pulls an unrelated browser session into the transcript
(hit on 2026-08-17). Use a dedicated port.

`rc.js` in this repo evaluates a JS
expression in a chosen renderer:
`node rc.js '<expr>' [windowTypeSubstring]`.

**Window types** (`index.html?windowType=…`): `hud-overlay`,
`source-selector`, `countdown`, `editor`, `update-toast`.

**`window.electronAPI` surface** (verified live) includes:
`getSources`, `openSourceSelector`, `selectSource`, `getSelectedSource`,
`showSourceHighlight`, `startNativeScreenRecording`,
`stopNativeScreenRecording`, `pause/resumeNativeScreenRecording`,
`start/stopFfmpegRecording`, `storeRecordedVideo`,
`getRecordedVideoPath`, `switchToEditor`,
`getScreenRecordingPermissionStatus`, `getRecordingsDirectory`,
`openRecordingsFolder`, `nativeVideoExportStart`.

Verified working: `getScreenRecordingPermissionStatus()` →
`{success:true, status:"granted"}`, and `openSourceSelector()` really does
create the `source-selector` window.

**Known defect in 1.3.3:** the `source-selector` renderer reports
`readyState:"complete"`, `visibilityState:"visible"` but `#root` is
**empty**, the React app never mounts, and no window appears on screen.
So the selector UI could not be read. Drive source choice through
`getSources()` + `selectSource()` directly instead of the UI.

### ⚠️ Capture is WHOLE-SCREEN ONLY on this machine (VERIFIED, overrides source reading)

The bundle contains `desktopCapturer.getSources({types:["screen","window"]})`,
which *suggests* per-window capture. **Empirically it is not available
here.** Called live with the app's own parameters
(`thumbnailSize:{160,90}`, `fetchWindowIcons:true`) and Screen Recording
granted, it returns **only three screens and zero windows**:

```
screen | Screen 1
screen | Screen 2 (Primary)
screen | Screen 3
```

macOS 26 (Darwin 25.6) does not hand the window list to Electron's
`desktopCapturer` in this build. **Do not plan on window-scoped capture.**

**Mitigation that works:** capture is per-display, and the test machine had
three displays. Dedicate ONE display to the take, put only the browser
window being demoed on it, move everything else to the other two, and
pass that screen's source id to `selectSource()`. That gives the scoping
that window-capture would have given.

### ⚠️ Compositor screenshot filtering does NOT protect the recording

Computer Use's screenshot filtering hides non-allowlisted apps from *the
agent's own screenshots* (verified: Chrome and Adgangskoder were hidden
from a full-screen capture). **This does not extend to Recordly's
capture.** Recordly records the display through its own ScreenCaptureKit
permission, which the agent allowlist does not touch, whatever is
actually on screen lands in the `.recordly` file. The privacy problem
that killed the 2026-08-17 `screencapture` attempt is not solved by the
allowlist, only moved.

**Therefore, before any real take:** determine whether Recordly can
capture a single **window or region** rather than the full display, and
use that. If it only does full-display capture, clear the screen first
and say so explicitly rather than assuming the filter covers it. This is
the single most important thing to establish when the permission is
granted.

## Recordly editor UI map

**STATUS: PARTIALLY VERIFIED 2026-08-17.** `switchToEditor()` over CDP
does open the editor, a second renderer appears with
`windowType=editor`, `document.title === "Recordly Editor"` (confirming
the tutorial-derived guess). With **no project loaded** it renders only
an empty state: `#root` ~616 chars, controls `Open Projects` and
`Notifications alt+T`.

The substantive editor chrome, timeline, per-segment auto-zoom pills,
"+ Add Layer", caption/annotation controls, Save/Export, only mounts
once a recording is loaded, so it is still unmapped. Map it over CDP
during the first real take, when a project is open, and replace the
tutorial-derived list below with real selectors.

Everything below this line is still only from the tutorial video:
The details below are from watching a third-party YouTube tutorial video
(TechkySkills, "Create Beautiful Screen Recordings for FREE | Recordly
Full Tutorial & Features", youtube.com/watch?v=goJhBSyKlIM) at timestamp
~3:00, not from driving the app. Treat every detail as a starting
hypothesis to confirm, not a verified selector map, fill it in properly
during the first session that gets past the permission gate, and mark
each item verified only after it has been driven end to end.

Observed from the video (unverified):

- Editor window title: "Recordly Editor"; open project file shown as
  `recording-<timestamp>.recordly` in the title bar.
- Top bar: "Projects" button, "Save" button, blue "Export" button
  (top-right).
- Left panel: Background/Frame/Crop controls, Background tabs (Image /
  Video / Color / Gradient), Background Blur slider, preset
  wallpaper/color swatches, Frame section (Shadow / Radius / Padding
  sliders, "Reset" links), Crop section (Top/Bottom/Left/Right percentage
  fields).
- Center: live preview of the composed frame (background + device frame +
  recording + any webcam bubble overlay).
- Bottom: a proper timeline, not a simplified scrubber, playback
  controls, a main clip track, and small purple pill markers along a
  second track showing per-segment zoom multipliers (e.g. "1.5x", "1x")
 , these are the individual auto-zoom regions, apparently
  individually selectable/editable.
- "+ Add Layer" control near the timeline, plus icons that look like
  zoom/cut/crop tools next to the play controls.

Confirm all of the above live before writing automation against it, and
add exact accessibility labels / coordinates once observed (Computer Use
tools generally want accessibility-tree identifiers, not raw pixel
coordinates, check what the actual available Computer Use tool exposes).

## Known gotchas

- **Full-desktop screenshots are dangerous without Computer Use's window
  scoping.** A raw `screencapture` (macOS CLI) grabs the entire screen,
  not just Recordly's window. On first attempt (2026-08-17) this captured
  an unrelated live session the user had open. Don't repeat blind
  full-screen captures; use a properly scoped Computer Use tool, or don't
  automate the desktop app at all in a session without one.
- Recordly requires macOS Screen Recording permission, **confirmed
  2026-08-17**, this is a hard gate that blocks the app entirely and needs
  a human to grant it in System Settings plus a quit/relaunch. See
  "Blocker: Screen Recording permission" above for the exact dialog text
  and why an agent must not grant it itself.
- **The agent's screenshot filtering does not scope Recordly's own
  capture.** See the compositor-filtering warning above, this is the
  live privacy risk, and it is not handled by the allowlist.
