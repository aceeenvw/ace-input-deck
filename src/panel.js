// Collapsible button panel mounted directly above #send_textarea.
// Pure DOM, no innerHTML for user data, full a11y, mobile-first.

import { t, onLocaleChange } from './i18n.js';
import { performInsert } from './insert.js';
import { pushRecent, resolveRecent } from './recent.js';
import { getSettings, saveSettings, onSettingsChange } from './settings.js';

const PANEL_CLASS = 'aid--panel';
const REFERENCE_SCRIPT_ID = 'cb0f5b5d-4b2e-4581-a011-2ad29d1d18ff';

const STATE = {
    panelEl: null,
    targetEl: null,
    activeGroup: '__all__',
    mountObserver: null,
};

/** Find the SillyTavern user input textarea. */
function findTarget() {
    return document.getElementById('send_textarea');
}

/** Detect the conflicting reference script and warn once. */
function detectConflictAndWarn() {
    try {
        const settings = getSettings();
        if (settings.scopeWarnedAboutInputAssistant) return;

        let detected = false;
        // Method 1: TavernHelper API
        try {
            const scripts = globalThis.TavernHelper?.getScripts?.();
            if (Array.isArray(scripts)) {
                detected = scripts.some(s => s?.id === REFERENCE_SCRIPT_ID);
            }
        } catch { /* ignore */ }
        // Method 2: DOM marker
        if (!detected) {
            detected = !!document.querySelector(`[data-script-id="${REFERENCE_SCRIPT_ID}"]`);
        }
        if (!detected) return;

        try { globalThis.toastr?.warning?.(t('aid.toast.conflict_warning'), '', { timeOut: 8000 }); } catch { /* ignore */ }
        saveSettings({ scopeWarnedAboutInputAssistant: true });
    } catch { /* ignore */ }
}

/** Build a single button DOM node. */
function buildButtonEl(btn) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'aid--btn';
    el.setAttribute('data-aid-id', btn.id);
    el.setAttribute('formnovalidate', '');
    // textContent rendering only — XSS-safe.
    const face = document.createElement('span');
    face.className = 'aid--btn-face';
    face.textContent = btn.name;
    el.appendChild(face);
    if (btn.description) {
        el.title = btn.description;
        el.setAttribute('aria-label', btn.description);
    } else {
        el.setAttribute('aria-label', btn.name);
    }
    return el;
}

/** Build the group filter chips. */
function buildGroupChips(groups, recentVisible) {
    const wrap = document.createElement('div');
    wrap.className = 'aid--group-chips';
    wrap.setAttribute('role', 'radiogroup');
    wrap.setAttribute('aria-label', t('aid.a11y.group_chips'));

    const mkChip = (id, label) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'aid--chip';
        b.setAttribute('role', 'radio');
        b.setAttribute('data-aid-group', id);
        b.setAttribute('aria-checked', String(STATE.activeGroup === id));
        if (STATE.activeGroup === id) b.classList.add('aid--chip-active');
        const sp = document.createElement('span');
        sp.textContent = label;
        b.appendChild(sp);
        return b;
    };

    wrap.appendChild(mkChip('__all__', t('aid.panel.group_all')));
    if (recentVisible) wrap.appendChild(mkChip('__recent__', t('aid.panel.group_recent')));
    for (const g of groups) {
        wrap.appendChild(mkChip(g, g));
    }
    return wrap;
}

/** Render the contents of the panel based on current settings. */
function render(panelEl) {
    const settings = getSettings();
    const buttons = (settings.buttons || []).filter(b => b && b.enabled !== false);

    // Toggle collapsed class
    panelEl.classList.toggle('aid--collapsed', !!settings.panel?.collapsed);

    // Header text + label refresh
    const expandLabel = settings.panel?.collapsed ? t('aid.panel.expand') : t('aid.panel.collapse');
    const toggleBtn = panelEl.querySelector('[data-aid-toggle]');
    if (toggleBtn) {
        toggleBtn.setAttribute('aria-label', expandLabel);
        toggleBtn.title = expandLabel;
        toggleBtn.setAttribute('aria-expanded', String(!settings.panel?.collapsed));
    }

    const body = panelEl.querySelector('.aid--panel-body');
    if (!body) return;

    // Hide body when collapsed (CSS handles animation).
    if (settings.panel?.collapsed) return;

    // Compute groups present
    const groupsSet = new Set();
    for (const b of buttons) {
        if (b.group) groupsSet.add(String(b.group));
    }
    const groups = [...groupsSet];

    // Recent
    const recentEnabled = settings.panel?.recentEnabled !== false;
    const recentBtns = recentEnabled ? resolveRecent(settings.recentIds || [], buttons) : [];
    const recentVisible = recentEnabled && recentBtns.length > 0;

    // Reset body
    body.replaceChildren();

    // Group chips (only if multiple groups OR recent active)
    if (groups.length > 1 || recentVisible) {
        body.appendChild(buildGroupChips(groups, recentVisible));
    }

    // Decide which buttons to show
    let visible;
    if (STATE.activeGroup === '__all__') visible = buttons;
    else if (STATE.activeGroup === '__recent__') visible = recentBtns;
    else visible = buttons.filter(b => String(b.group || '') === STATE.activeGroup);

    const row = document.createElement('div');
    row.className = 'aid--btn-row';
    row.setAttribute('role', 'toolbar');
    row.setAttribute('aria-label', t('aid.a11y.button_row'));

    if (visible.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'aid--empty';
        empty.textContent = t('aid.panel.no_buttons');
        row.appendChild(empty);
    } else {
        // Sort by `order` then declaration order.
        const sorted = visible.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        for (const b of sorted) row.appendChild(buildButtonEl(b));
    }
    body.appendChild(row);
}

/** Build the panel skeleton once. */
function buildPanelSkeleton() {
    const panel = document.createElement('div');
    panel.className = PANEL_CLASS;
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-label', t('aid.a11y.panel'));

    // Header bar with collapse toggle
    const head = document.createElement('div');
    head.className = 'aid--panel-head';

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'aid--panel-toggle';
    toggle.setAttribute('data-aid-toggle', '');
    toggle.setAttribute('aria-expanded', 'true');
    const chev = document.createElement('i');
    chev.className = 'fa-solid fa-chevron-down aid--panel-chev';
    chev.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.className = 'aid--panel-label';
    label.textContent = '⊹ INPUT DECK ⊹';
    toggle.append(chev, label);
    head.appendChild(toggle);

    const body = document.createElement('div');
    body.className = 'aid--panel-body';

    panel.append(head, body);

    // Click handlers
    panel.addEventListener('click', (ev) => {
        const target = ev.target instanceof Element ? ev.target : null;
        if (!target) return;

        // Toggle collapse
        const t1 = target.closest('[data-aid-toggle]');
        if (t1) {
            ev.preventDefault();
            const s = getSettings();
            const next = !s.panel?.collapsed;
            saveSettings({ panel: { collapsed: next } });
            return;
        }

        // Group chip
        const chip = target.closest('[data-aid-group]');
        if (chip) {
            ev.preventDefault();
            STATE.activeGroup = chip.getAttribute('data-aid-group') || '__all__';
            render(panel);
            return;
        }

        // Button click
        const btnEl = target.closest('[data-aid-id]');
        if (btnEl) {
            ev.preventDefault();
            ev.stopPropagation();
            const id = btnEl.getAttribute('data-aid-id');
            const s = getSettings();
            const btn = (s.buttons || []).find(b => b.id === id);
            if (!btn) return;
            const ta = STATE.targetEl || findTarget();
            if (!ta) return;
            const ok = performInsert(ta, btn, panel);
            if (ok) {
                saveSettings({ recentIds: pushRecent(s.recentIds || [], id) });
            }
        }
    });

    return panel;
}

/** Mount or remount the panel based on `panel.show` setting. */
function mountIfNeeded() {
    const settings = getSettings();
    const target = findTarget();
    if (!target) return false;

    const wantShow = settings.panel?.show !== false;

    // Already mounted?
    if (STATE.panelEl?.isConnected) {
        if (!wantShow) {
            STATE.panelEl.remove();
            STATE.panelEl = null;
            return true;
        }
        // Make sure it's still positioned right above target
        if (STATE.panelEl.nextElementSibling !== target) {
            target.parentElement?.insertBefore(STATE.panelEl, target);
        }
        render(STATE.panelEl);
        return true;
    }

    if (!wantShow) return true;

    const panel = buildPanelSkeleton();
    target.parentElement?.insertBefore(panel, target);
    STATE.panelEl = panel;
    STATE.targetEl = target;
    render(panel);
    detectConflictAndWarn();
    return true;
}

/** Watch for #send_textarea appearing/disappearing. */
function startObserver() {
    if (STATE.mountObserver) return;
    STATE.mountObserver = new MutationObserver(() => {
        // If our panel got removed but should exist, remount.
        if (!STATE.panelEl?.isConnected) {
            mountIfNeeded();
        }
    });
    STATE.mountObserver.observe(document.body, { childList: true, subtree: true });
}

function stopObserver() {
    STATE.mountObserver?.disconnect();
    STATE.mountObserver = null;
}

export function initPanel() {
    if (mountIfNeeded()) startObserver();
    else {
        // Retry until #send_textarea appears.
        let tries = 0;
        const timer = setInterval(() => {
            if (mountIfNeeded() || ++tries > 60) {
                clearInterval(timer);
                if (STATE.panelEl) startObserver();
            }
        }, 500);
    }

    // React to settings changes (panel toggle, button list, recents).
    onSettingsChange(() => {
        if (STATE.panelEl?.isConnected) render(STATE.panelEl);
        else mountIfNeeded();
    });

    // Re-render labels on locale change.
    onLocaleChange(() => {
        if (STATE.panelEl) {
            // Rebuild labels by re-rendering.
            STATE.panelEl.setAttribute('aria-label', t('aid.a11y.panel'));
            render(STATE.panelEl);
        }
    });

    window.addEventListener('pagehide', () => {
        stopObserver();
        STATE.panelEl?.remove();
        STATE.panelEl = null;
    }, { once: true });
}
