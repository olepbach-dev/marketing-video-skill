---
name: marketing-video
description: Turn a real screen-recorded product walkthrough into a polished demo or marketing video using Recordly (open-source screen recorder and editor). Use for marketplace or store-review videos, landing-page demo clips and similar. Hands off a .recordly project file for human review and export; never exports or publishes on its own.
---

# Marketing and demo video (Recordly)

The full workflow, research trail and verified notes live next to this file:
read `README.md`, then `runbook.md` before recording, and `reference.md` for
the Recordly API surface and known defects.

## When to use

Any request for a polished demo or marketing video where the deliverable is a
real screen recording of the product. Do not use it for AI-generated video.

## Hard constraints

- **Drive Recordly over CDP, not with clicks.** Recordly is an Electron app.
  Its tray popover ignores synthetic clicks and it opens no ordinary window.
  Launch it with `open -a Recordly --args --remote-debugging-port=9333` and
  call `window.electronAPI` over the DevTools Protocol (`rc.js`). Do not use
  port 9222, which an ordinary Chrome session often occupies.
- **Recordly records a whole display, not a window** (verified on macOS 26).
  Before any take, dedicate one display to the recording and move unrelated
  work elsewhere. If you cannot see that display, ask the user to confirm it
  is clear.
- **Never auto-export or auto-publish.** The end state is a saved
  `.recordly` project file handed back for the user's own review and export.
- **Re-verify the editor UI** when the Recordly version changes. Parts of the
  UI map come from a tutorial video and are marked unverified.
- **Let a human press record.** Recording started over CDP produces a valid
  video but no cursor data, so auto-zoom has nothing to work with
  (`runbook.md` section 4).
