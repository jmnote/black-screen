# Development Notes

Background on a few non-obvious design decisions in [black-screen.js](../black-screen.js). The inline comments point here instead of repeating the full reasoning at each call site.

## Auto-hide UI & hover protection

The cursor and the on-screen toolbar (fullscreen button, bookmarks bar, settings) fade out after `HIDE_DELAY` of inactivity. Three independent flags — `isBookmarksBarHovered`, `isFullscreenButtonHovered`, `isOptionsMenuHovered` — plus `isSettingsModalOpen`, suspend that timer while the pointer is over the corresponding area (or the modal is open), so whatever's under the pointer doesn't disappear out from under it. Each area is protected on its own, regardless of the others' state.

`registerHoverProtection` wires `mouseenter`/`mouseleave` to one of these flags. It's applied to the options menu (button + dropdown together, so the bar doesn't fade mid-menu) and, via `registerBookmarksHoverProtection`, to every bookmark item, folder wrapper, and folder dropdown. It's deliberately *not* applied to `bookmarksList` itself — hover protection is scoped to actual bookmark items/folders and their dropdowns, not the empty gaps between them or the plain-text "No bookmarks" notice, since those aren't interactive elements.

`showUI()` makes the toolbar visible (used from real interaction — mouse, keyboard, touch) and then delegates timer bookkeeping to `refreshHideTimer()`. That split matters because a couple of flag changes below need the timer re-evaluated without the toolbar popping up on its own: `refreshHideTimer()` is a no-op while the UI is already hidden.

### Stuck hover flag on bookmarks re-render

`loadBookmarksBar()` re-renders by wiping and rebuilding `bookmarksList`'s children (see "Bookmarks sync" below). If the pointer happens to be resting over a bookmark element when that happens, that element is removed rather than actually left, so its `mouseleave` never fires. Without a fix, `isBookmarksBarHovered` would stay stuck `true` and hold the top UI visible forever. `loadBookmarksBar()` resets the flag to `false` before rendering and calls `refreshHideTimer()` after, so the hide timer restarts correctly *if* the toolbar is already showing — a background bookmark change (sync from another device, etc.) must not itself pop the toolbar up with no user interaction. A `mouseenter` on the freshly-rendered elements sets the flag `true` again if the pointer is still over the bar. If the pointer isn't moving at that instant, the bar can briefly lose hover protection until the next `mousemove` — an acceptable trade-off against a permanent stuck state.

### Focus vs. `:focus-within`

`hideUI()` clears `document.activeElement` before hiding, but only when that focus looks like leftover state rather than genuine keyboard navigation. A clicked button keeps browser focus after the click (without a visible focus ring), and `.top-bar:focus-within` (kept so keyboard users tabbing through the bar stay visible) would otherwise hold the bar up forever once that happens. The check excludes anything matching `:focus-visible` — a genuinely keyboard-focused element keeps its `:focus-within` protection instead of losing focus out from under whoever tabbed to it.

## Bookmarks dropdown positioning

Dropdowns use `position: fixed` so a scroll container (the bar's own horizontal scroll, or a parent dropdown's) can't clip them. That means their coordinates have to be computed in JS (`positionBookmarkDropdown`) instead of via CSS positioning relative to an ancestor.

Two placements:
- **`below`** — a top-level bar button opens its panel directly below itself.
- **`side`** — a folder nested inside another dropdown cascades to the right of that parent panel, like Chrome's own bookmark menus, flipping to the left or shifting up when it would overflow the viewport.

An open dropdown's position is computed once, from the trigger's coordinates at that moment. Scrolling the bar or resizing the window would leave it floating in the wrong spot, so those handlers just close all dropdowns instead of tracking and repositioning them continuously.

## Bookmarks sync

`loadBookmarksBar()` is called once on load and again on every `chrome.bookmarks` change event (`onCreated`, `onRemoved`, `onChanged`, `onMoved`, `onChildrenReordered`, `onImportEnded`), so the on-screen bar mirrors bookmark changes made elsewhere — Chrome's own bookmarks UI, sync from another device, etc. — instead of only reflecting whatever the tree looked like when the tab first loaded. A full re-fetch of the tree on each event is simplest and cheap enough, since these fire far less often than the mouse moves.

## Settings modal focus trap

The modal has `aria-modal="true"`, which promises Tab/Shift+Tab stay inside the dialog — but nothing does that automatically. `getSettingsModalFocusables()` finds the modal's focusable elements, and a `keydown` handler cycles focus from the last one back to the first (and vice versa with Shift+Tab) while the modal is open, so keyboard focus can't leak to the page underneath.
