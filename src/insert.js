// Core insert / wrap / cursor logic + undo guard.
// Pure-DOM: never uses eval/Function. Content is verbatim text.

import { t } from './i18n.js';

/** Per-button click rate limit (ms). Prevents runaway-loop scenarios. */
const CLICK_RATE_LIMIT_MS = 50;
const _lastClickAt = new Map();

/** Most recent undoable snapshot, scoped to a textarea. */
const _undoSnapshots = new WeakMap();
let _undoPillEl = null;
let _undoPillTimer = null;

/**
 * True iff `s` looks like a symmetric wrap pair: even length, and the
 * second half is the reverse of the first half. Works for "" ** «» []
 * () <> «»  and for double-wraps **** ****** as well.
 */
export function isSymmetric(s) {
    if (typeof s !== 'string' || s.length === 0 || s.length % 2 !== 0) return false;
    const half = s.length / 2;
    const a = s.slice(0, half);
    const b = s.slice(half);
    // Check if `b` is the mirror of `a` (each char from `a` reversed) OR
    // equals `a` itself (e.g. "**" — both halves identical).
    if (a === b) return true;
    if (a.split('').reverse().join('') === b) return true;
    // For asymmetric pairs like «» [] () <>: half=1, accept any 2-char.
    return false;
}

/** Map of well-known asymmetric wrap pairs that we still want to wrap with. */
const ASYM_WRAP_PAIRS = new Set([
    '«»', '»«', '[]', '()', '<>', '{}', '„"', '"„', '⟨⟩',
]);

function detectWrap(content) {
    if (!content) return null;
    if (ASYM_WRAP_PAIRS.has(content)) {
        return { open: content[0], close: content[1] };
    }
    if (isSymmetric(content)) {
        const half = content.length / 2;
        return { open: content.slice(0, half), close: content.slice(half) };
    }
    return null;
}

/** Resolve the {from, to} insertion range based on insert_position. */
function resolveRange(textarea, mode) {
    const len = textarea.value.length;
    const start = textarea.selectionStart ?? len;
    const end = textarea.selectionEnd ?? len;
    if (mode === 'prepend') return { from: 0, to: 0 };
    if (mode === 'append')  return { from: len, to: len };
    return { from: start, to: end };
}

/** Splice value, fire 'input' so SillyTavern observers see the change. */
function spliceValue(textarea, from, to, replacement) {
    const before = textarea.value.slice(0, from);
    const after  = textarea.value.slice(to);
    textarea.value = before + replacement + after;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

function setCursor(textarea, anchor, head) {
    const a = Math.max(0, Math.min(textarea.value.length, anchor));
    const h = head == null ? a : Math.max(0, Math.min(textarea.value.length, head));
    try { textarea.setSelectionRange(a, h); } catch { /* ignore */ }
}

function snapshotForUndo(textarea) {
    _undoSnapshots.set(textarea, {
        value: textarea.value,
        start: textarea.selectionStart,
        end: textarea.selectionEnd,
    });
}

/**
 * Show a small "Undo" pill near the panel for ~3s. One pill at a time.
 * Clicking restores the snapshot stored in WeakMap.
 */
function showUndoPill(panelEl, textarea) {
    if (!panelEl) return;
    if (_undoPillEl?.isConnected) {
        _undoPillEl.remove();
        _undoPillEl = null;
    }
    if (_undoPillTimer) {
        clearTimeout(_undoPillTimer);
        _undoPillTimer = null;
    }

    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'aid--undo-pill';
    pill.setAttribute('aria-live', 'polite');
    const icon = document.createElement('i');
    icon.className = 'fa-solid fa-rotate-left';
    icon.setAttribute('aria-hidden', 'true');
    const lbl = document.createElement('span');
    lbl.textContent = t('aid.panel.undo');
    pill.append(icon, lbl);

    pill.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const snap = _undoSnapshots.get(textarea);
        if (!snap) return;
        textarea.value = snap.value;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        try { textarea.setSelectionRange(snap.start, snap.end); } catch { /* ignore */ }
        textarea.focus();
        _undoSnapshots.delete(textarea);
        pill.remove();
        if (_undoPillTimer) { clearTimeout(_undoPillTimer); _undoPillTimer = null; }
        if (_undoPillEl === pill) _undoPillEl = null;
    });

    panelEl.appendChild(pill);
    _undoPillEl = pill;
    _undoPillTimer = setTimeout(() => {
        if (pill.isConnected) pill.remove();
        if (_undoPillEl === pill) _undoPillEl = null;
        _undoPillTimer = null;
    }, 3000);
}

/**
 * Announce the insert to assistive tech via an aria-live region.
 * Silent for sighted users — no toasts on insert (per spec).
 */
function announce(panelEl, description) {
    if (!panelEl) return;
    let region = panelEl.querySelector('.aid--sr-live');
    if (!region) {
        region = document.createElement('div');
        region.className = 'aid--sr-live';
        region.setAttribute('aria-live', 'polite');
        region.setAttribute('aria-atomic', 'true');
        panelEl.appendChild(region);
    }
    region.textContent = '';
    // Force a reflow so the change is announced even if same text.
    void region.offsetHeight;
    region.textContent = t('aid.panel.inserted', { description: String(description || '') });
}

/**
 * Perform an insert/wrap based on a button definition.
 * @param {HTMLTextAreaElement} textarea
 * @param {object} btn  - validated button row from settings
 * @param {HTMLElement} panelEl - host for the undo pill / SR region
 * @returns {boolean} - true if inserted, false if rate-limited or invalid
 */
export function performInsert(textarea, btn, panelEl) {
    if (!(textarea instanceof HTMLTextAreaElement)) return false;
    if (!btn || typeof btn !== 'object') return false;

    // Rate limit per button.
    const now = Date.now();
    const last = _lastClickAt.get(btn.id) || 0;
    if (now - last < CLICK_RATE_LIMIT_MS) return false;
    _lastClickAt.set(btn.id, now);

    snapshotForUndo(textarea);

    const start = textarea.selectionStart ?? textarea.value.length;
    const end   = textarea.selectionEnd   ?? textarea.value.length;
    const hasSelection = end > start;
    const content = String(btn.content || '');

    // ── 1. Wrap-on-selection path ───────────────────────────────────
    if (hasSelection && btn.insert_position === 'as_is') {
        const wrap = detectWrap(content);
        if (wrap) {
            const selectedText = textarea.value.slice(start, end);
            spliceValue(textarea, start, end, wrap.open + selectedText + wrap.close);
            setCursor(
                textarea,
                start + wrap.open.length,
                start + wrap.open.length + selectedText.length,
            );
            textarea.focus();
            announce(panelEl, btn.description || btn.name);
            showUndoPill(panelEl, textarea);
            return true;
        }
    }

    // ── 2. Plain insert path ────────────────────────────────────────
    const range = resolveRange(textarea, btn.insert_position);
    spliceValue(textarea, range.from, range.to, content);

    // Cursor placement: clamped to valid range.
    const cursorOffset = Math.max(0, Math.min(content.length, btn.cursor_position | 0));
    setCursor(textarea, range.from + cursorOffset);
    textarea.focus();
    announce(panelEl, btn.description || btn.name);
    showUndoPill(panelEl, textarea);
    return true;
}
