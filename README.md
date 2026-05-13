# ⊹ ACE INPUT DECK ⊹

A collapsible quick-insert button deck for the SillyTavern input — designed for roleplay flow.

**Author:** aceenvw
**Version:** 1.0.4
**License:** AGPL-3.0-or-later

---

## About

⊹ ACE INPUT DECK ⊹ adds a tap-to-insert button strip directly above your SillyTavern input. Build custom snippets, wrap selected text in symmetric pairs, drop long templates, or sort buttons into icon-tagged groups — all from one collapsible bar. Ships with a Roleplay-basics preset and two more bundled packs (Russian punctuation, Markdown power), and imports button sets from the `输入助手` Tavern Helper script if you're migrating. Built mobile-first, fully bilingual (EN / RU), with an iOS-style settings drawer matching ⊹ CODE MIRROR PRO ⊹.

---

## What it does

Adds a customizable, collapsible panel of quick-insert buttons directly above the SillyTavern user input. Click a button to insert a snippet, wrap your selection, or jump to a marker — without leaving the keyboard.

- **iOS-style settings panel** in the Extensions tab — same visual language as ⊹ CODE MIRROR PRO ⊹.
- **Smart wrap-on-selection.** Highlight a word, click `**`, and it becomes `**word**`. Works for `""`, `«»`, `[]`, `()`, `***`, `~~`, and any symmetric pair.
- **Cursor placement control** — full `cursor_position` + `insert_position` model (`as_is` / `prepend` / `append`).
- **Drag-reorderable** button list with inline edit form, live preview of cursor placement, and group autocomplete. Touch reorder via long-press; keyboard reorder via Alt+↑/↓ on a focused row.
- **Group filter chips** + a "Recent" virtual group that auto-tracks your last 8 clicks.
- **Group icons.** Each group can carry an optional FontAwesome icon, picked from a curated 30-icon modal grid. Icons render on the panel chips and the editor row chips.
- **Bulk operations.** Multi-select rows in the editor → enable/disable/delete/export only the selection.
- **Undo guard:** every insert shows a 3-second ghost-undo pill — no accidental damage.
- **Import / Export** as JSON. Includes an interop adapter for the `输入助手` Tavern Helper script JSON shape.
- **Conflict detection:** if `输入助手` is also active, you get one warning toast — no hostile takeover.
- **i18n:** English (primary) + Русский, fallback chain with strict placeholder interpolation.
- **Mobile-first:** 44 pt tap targets, swipeable horizontal row, safe-area insets, `dvh` units, touch-friendly drag-and-drop.
- **Accessibility:** `aria-toolbar`, `aria-expanded`, `aria-live` insert announcements, full keyboard nav, `prefers-reduced-motion` and `forced-colors` respected.
- **Migrations registry.** Schema upgrades are versioned and traceable; old configs upgrade cleanly.
- **Security baseline:** see [Security](#security) below.

## Install

1. Place this folder in your SillyTavern `public/scripts/extensions/third-party/` directory (or use the Extensions installer with this repo URL).
2. Refresh SillyTavern.
3. Open the Extensions tab → find **⊹ ACE INPUT DECK ⊹**.
4. The panel appears above your chat input. The default "Roleplay basics" preset is loaded automatically.

## Build from source

```bash
pnpm install
pnpm run build           # production
pnpm run build:dev       # development
pnpm run watch           # rebuild on change
```

Output: `dist/index.js`. Single bundle, no external chunks.

## Default preset — "Roleplay basics"

Loaded automatically on first install. 12 buttons across 4 groups:

| Group | Buttons |
|-------|---------|
| Speech  | `""`, `**`, `****`, `«»`, `***` |
| Markers | `[ ]`, `( )`, `—`, `…`, `OOC` |
| Utility | `⏎` (newline) |
| Tags    | `<user>` |

Plus two more bundled preset packs you can load on demand:
- **Russian punctuation** — `«»`, `„"`, `—`, `–`, `…`, `№`, `₽`, `°`
- **Markdown power** — `**`, `*`, `***`, `~~`, `` ` ``, ` ``` `, `> `, `[]()`, `# / ## / ###`, `- `, `1. `

## Importing buttons from `输入助手`

If you've used the `输入助手` Tavern Helper script, you can import its JSON directly:

1. Export your `输入助手` script as JSON (the standard Tavern Helper export).
2. In ACE INPUT DECK settings → Import / Export → **Import JSON**.
3. Pick the file. The adapter detects the `data.buttons` shape and maps each row into the native schema.
4. Choose **Replace** or **Append**. Done.

## Customization

Each button has:

| Field | Description | Limit |
|-------|-------------|-------|
| Face | Display text on the button | 16 chars |
| Description | Tooltip / accessibility label | 64 chars |
| Content | What gets inserted | 4096 chars |
| Group | Free-form group label | 32 chars |
| Cursor position | Chars from start of inserted content | 0..len |
| Insert position | `at cursor` / `beginning` / `end` | enum |
| Enabled | On/off toggle | bool |

The editor includes a live cursor-position preview that shows exactly where the caret will land after insert.

## Security

Always-on, not optional:

| # | Threat | Mitigation |
|---|--------|------------|
| 1 | XSS via crafted button face/description | All user-supplied strings rendered with `textContent` only. Never `innerHTML`. |
| 2 | XSS via imported JSON | Strict pre-render validation (length caps, type checks, enum allowlists). |
| 3 | Prototype pollution via JSON | Sanitizer rejects keys `__proto__`, `prototype`, `constructor` recursively. |
| 4 | Storage bloat / DoS | Soft warn at 256 KB, hard cap at 1 MB serialized. |
| 5 | Code injection | Zero `eval`, zero `new Function`, zero template-tag evaluation. Content is verbatim text. |
| 6 | DOM listener leaks | All listeners cleaned up on `pagehide` and on panel disconnect. |
| 7 | Frozen debug surface | `globalThis.AceInputDeck` is `Object.freeze`'d, version + author only. |
| 8 | Click hijacking via rapid taps | 50 ms per-button rate limit. |
| 9 | i18n key escapes | Strict `/\{(\w+)\}/g` placeholder regex; no arbitrary key resolution. |
| 10 | File picker abuse | Imports require accept=`.json,application/json`; size capped before parse. |
| 11 | Symmetric-wrap fooling | `isSymmetric` only triggers on even-length exact mirrors; falls back to plain insert otherwise. |
| 12 | FontAwesome class injection | Strict allowlist regex `^fa-(?:solid\|regular\|brands) fa-[a-z0-9-]+$` with 64-char cap. Single literal space (no `\s+` runs). 16/16 attack payloads rejected. |
| 13 | Group metadata leakage | `groups` map never crosses the import/export boundary. Read-time re-sanitization of icon classes (defense-in-depth). |
| 14 | Migration brick risk | Each migration step wrapped in `try/catch`; failures break the chain instead of corrupting settings. Loop bounded by registry length. |

## FAQ

**Q: Does this conflict with `输入助手`?**
A: If both are active, you get one warning toast on first run. They can coexist but will overlap visually — disable one for the cleanest experience.

**Q: Where are settings stored?**
A: Inside SillyTavern's `extension_settings` blob, under the key `aceInputDeck`. Synced with ST's normal save flow.

**Q: Can I edit a button while it's on the panel?**
A: Open the Extensions tab → ⊹ ACE INPUT DECK ⊹ → Buttons → click the pencil icon on the row.

**Q: What if I make a mistake?**
A: A small **Undo** pill appears in the panel for ~3 seconds after each insert. One click restores the previous state.

## Credits

Inspired in part by the `输入助手` script. ACE INPUT DECK is an independent, fully rewritten extension with its own architecture, security model, and feature set.

## License

[AGPL-3.0-or-later](LICENSE).
