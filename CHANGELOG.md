# Changelog

All notable changes to ⊹ ACE INPUT DECK ⊹ are documented here.

## 1.0.5 — Group-icon picker reachable

### Fixed
- The group-icon picker button (the `+` next to the group input in the
  edit form) was a native `<button disabled>` whenever the group field
  was empty. A disabled button swallows clicks entirely, so the picker
  silently did nothing on first interaction — exactly when users would
  most expect it to work (right after opening the editor for a fresh
  button).
- The button is no longer set to `disabled`. Clicking it without a
  group name now shows a toast hint *"Type a group name first to pick
  its icon"* and auto-focuses the group field, so the next keystroke
  goes where it should.
- Visual hint when the picker is unavailable kept (dashed border, lower
  opacity) so the state is still discoverable, but the button is
  reachable.
- Picker modal `z-index` raised from 10000 to 100000 to stay above any
  ST popup layer that might sit at 10000.

### Added
- New i18n key `aid.editor.group_icon_needs_name` (en + ru).

## 1.0.4 — Bulk operations, group icons, migrations registry

### New
- **Bulk operations in the buttons editor.** Each row gains a small selection
  checkbox in the leftmost column. Selecting one or more rows reveals a bulk
  action bar above the list:
  - **Selected: N** counter with an active-state border.
  - **Select all** / **Clear selection** (toggles based on current state).
  - **Enable** / **Disable** (sets the `enabled` flag on all selected rows).
  - **Export** (downloads only the selected rows as JSON, native v1 schema).
  - **Delete** (single confirm with count, drops orphan group-icon entries).
- **Group icons.** Each group can carry an optional FontAwesome icon, rendered:
  - Left of the group name on the panel's group-filter chips.
  - Left of the group label chip in editor rows.
  - As a 36 px button next to the group input in the edit form (44 px on touch).
  - Picked from a **modal with a curated 30-icon grid** (comment, quote-left,
    quote-right, asterisk, italic, bold, hashtag, at, tag, tags, bookmark,
    message, envelope, paper-plane, user, user-secret, users, mask,
    theater-masks, image, camera, film, music, code, terminal,
    wand-magic-sparkles, bolt, fire, heart, star) plus a "No icon" option.
  - Picker is keyboard-friendly (Escape closes, click-outside closes, focus
    lands on the active or first cell on open). Touch-friendly cell sizing
    on coarse pointers; 3-column grid on phones.
- **The "All" group chip now shows a layer-group icon, "Recent" shows a
  clock-rotate-left icon** for visual consistency.

### Changed
- Migration framework: added `src/migrations.js` with a proper registry
  (`from`, `to`, `fn` triplets). `loadSettings()` runs the chain on every
  load, so future schema changes are clean and traceable.
  - 0 → 1: initial schema (reserved entry).
  - 1 → 2: drops legacy `panel.rememberCollapsed` (was already informally
    handled in v1.0.2).
  - 2 → 3: introduces `settings.groups` map.
- Editor row grid is now 5 columns (select / drag / toggle / meta / actions);
  responsive breakpoints adjusted accordingly.
- The "All" and "Recent" panel chips render with leading icons.

### Security
- New strict allowlist regex for FontAwesome class strings:
  `^fa-(solid|regular|brands)\s+fa-[a-z0-9-]+$` with a 64-char max length,
  guarding against class-name injection through the icon picker or any
  future code path that hands a class string to `el.className`.
- The export payload still only emits `buttons[]`; `groups` metadata is
  not exported, and the importer does not read it. Imported JSON cannot
  inject group metadata or icon classes.
- Bulk export filename is fixed (`ace-input-deck-selection-YYYYMMDD.json`)
  with no user input reaching it.
- Migration loop is bounded by the registry length, short-circuits when
  `_migrated` is already at or past a step, and wraps each step in
  try/catch so a bad migration cannot brick settings.
- Picker modal listeners on `document` are removed on `pagehide` for
  hygiene (no functional leak in single-instance practice, but tidy).

## 1.0.3 — Segmented control overflow fix

### Fixed
- The "Insert position" segmented control (At cursor / Beginning / End) and
  the preset Append/Replace control were overflowing their parent column,
  visually crossing the card's inner border on narrow widths. Root cause:
  `.aid--seg` used `display: inline-flex` and sized to natural content
  (~330 px for three buttons) while the grid column only allocated `minmax`
  bounds that the seg ignored.
- `.aid--seg` now uses `display: flex; width: 100%; max-width: 100%`.
- `.aid--seg-btn` gets `flex: 1 1 0` + `min-width: 0` so labels can shrink
  with `text-overflow: ellipsis` instead of pushing past the border.
- `.aid--field-row` switched from `minmax(180px, 1fr) minmax(220px, 2fr)`
  (which demanded ≥412 px minimum width) to `minmax(0, 1fr) minmax(0, 2fr)`
  so the row can never demand more space than its parent provides.
- `align-items: start` on `.aid--field-row` so labels line up at the top
  even when the right column is taller than the left.
- At ≤480 px, segmented buttons now stack icon-over-label (column flow,
  smaller font) so all three options stay readable on narrow phones
  instead of ellipsizing into "B…".

## 1.0.2 — Mobile + UX polish

### Settings cleanup
- Renamed misleading "Show panel above input" toggle to **"Enable button panel"** —
  position is fixed, this is just the master on/off.
- Removed the dead **"Collapsed by default"** and **"Remember last state"** toggles.
  The current collapsed state is always persisted (which is what users expect).
  Schema bumped to `_migrated: 2` to drop the legacy `panel.rememberCollapsed` key.

### Panel improvements
- Group filter chips now hide automatically when there's only one real choice
  (1 group + no recent items shown). Less clutter on simple setups.
- Active group chip auto-scrolls into view when a far-right chip is selected.
- Empty state distinguishes "no buttons configured" (shows an actionable
  "Open settings to add buttons" pill that opens the Extensions drawer) from
  "this group filter happens to be empty" (plain text).
- Stale active-group reference no longer breaks the panel — falls back to All.

### Editor improvements
- New row: `tabindex="0"` plus visible focus ring, so rows are keyboard-reachable.
- **Alt + ↑ / Alt + ↓** on a focused row reorders it. Accessible alternative
  to drag-and-drop.
- Auto-focus + auto-scroll the first input of any visible edit form on
  Add / Edit. Existing values get pre-selected for quick replacement.
- Validation errors clear as soon as the user types in the offending field —
  no more stale errors lingering after a fix.
- Drag-handle hint updated: *"Drag handle · Alt+↑/↓ on a row"*.

### Mobile optimization
- **Touch reorder via Pointer Events** — long-press the drag handle (~250 ms)
  to start, then move your finger to highlight a target row, lift to swap.
  Standard HTML5 drag-and-drop never fires on touch, so this fills the gap.
- Coarse-pointer panel buttons are now 40 px (up from 36 px) for comfortable
  taps without inflating the form footprint. Settings drawer keeps full 44 pt.
- Drag handle is 32 px wide on touch (up from 24 px) so a thumb can grab it.
- Row icon-buttons are 40 × 40 px on touch (up from 36 × 36 px).
- New `@media (max-width: 480px)` breakpoint:
  - Card padding tightened, edit form margin dropped to 0.
  - Editor inputs forced to **font-size: 16px** to suppress iOS auto-zoom.
  - I/O buttons go full-width per row instead of wrapping awkwardly.
  - The drag-handle hint is hidden on phone — handle alone is self-evident.
  - Group label chip hidden on row to save horizontal space.
- `touch-action: pan-x` + `overscroll-behavior-x: contain` on the panel's
  button row and group chips, so horizontal scroll there can't hijack
  the chat's vertical scroll.

## 1.0.1 — Mount-point fix

### Fixed
- Panel was inserted as a sibling of `#send_textarea` *inside* `#nonQRFormItems`,
  which broke the input row's flex layout (options button + textarea + send button
  no longer aligned). Panel now mounts **above `#nonQRFormItems` inside `#send_form`**,
  matching where Quick Reply's bar lives. Falls back to `#form_sheld` if the
  canonical structure isn't present, and to the legacy spot only as a last resort.
- Panel header trimmed to a compact 20 px toggle pill (was a 28 px strip).
- Button row is now a single horizontal scroll strip (28 px buttons, 4 px gap),
  matching Quick Reply density. Settings drawer controls keep full 44 pt tap
  targets on touch devices.
- Undo pill anchors to the panel head's right edge instead of the panel bottom,
  so it doesn't briefly inflate the panel height when shown.

## 1.0.0 — Initial release

### Features

- Collapsible quick-insert button panel mounted directly above `#send_textarea`.
- Smart symmetric wrap-on-selection (`""`, `**`, `«»`, `[]`, `()`, `***`, `~~`, etc.).
- Full cursor-placement model: `cursor_position` + `insert_position` (`as_is` / `prepend` / `append`).
- Drag-and-drop reorderable button list with inline edit form.
- Live cursor-position preview in the editor.
- Group filter chips on the panel; "Recent" virtual group tracks last 8 clicks (LRU).
- Undo guard: 3-second ghost-undo pill after each insert.
- Default "Roleplay basics" preset auto-loaded on first install (12 buttons across Speech / Markers / Utility / Tags).
- Two additional bundled preset packs: "Russian punctuation" and "Markdown power".
- JSON import / export with strict validation; interop adapter for the `输入助手` script JSON shape.
- One-time conflict-detection warning when `输入助手` is also active.
- Bilingual UI: English (primary) + Русский. Strict placeholder interpolation, key fallback chain.
- iOS-style settings drawer in the Extensions tab — same visual language as ⊹ CODE MIRROR PRO ⊹.
- Mobile-first: 44 pt minimum tap targets, swipeable scroll-snap row, safe-area insets, `dvh` units.
- Accessibility: `aria-toolbar`, `aria-expanded`, `aria-live` insert announcements, full keyboard nav, `prefers-reduced-motion` + `forced-colors` respected.

### Security baseline

- All user-supplied strings rendered via `textContent` — no `innerHTML` for user data.
- JSON sanitizer strips `__proto__`, `prototype`, `constructor` recursively.
- Length caps: name 16, description 64, content 4096, group 32 chars; file 1 MB.
- Storage caps: soft warn at 256 KB, hard cap at 1 MB; saves rejected over cap.
- 50 ms per-button click rate limit.
- Zero `eval`, zero `new Function`, zero template-tag evaluation.
- Frozen `globalThis.AceInputDeck` debug surface with version + author only.
- Strict `/\{(\w+)\}/g` placeholder regex for i18n.
- File imports gated on `accept=".json,application/json"` and size pre-check.
