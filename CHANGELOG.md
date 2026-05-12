# Changelog

All notable changes to ⊹ ACE INPUT DECK ⊹ are documented here.

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
