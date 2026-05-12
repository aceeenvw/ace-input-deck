# Changelog

All notable changes to ⊹ ACE INPUT DECK ⊹ are documented here.

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
