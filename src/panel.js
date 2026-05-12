// Collapsible button panel that mounts inside #send_form, above #nonQRFormItems.
// All user-supplied strings rendered via textContent only (XSS-safe).

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

/**
 * Resolve the correct mount point for the panel.
 * SillyTavern's send-form is structured as:
 *   #form_sheld
 *     └── #send_form
 *           ├── #file_form
 *           └── #nonQRFormItems   (flex row: [options][textarea][send])
 *
 * We want the panel to sit ABOVE #nonQRFormItems (so above the input row)
 * but INSIDE #send_form, mirroring where Quick Reply's bar lives.
 * This avoids breaking the flex row of #nonQRFormItems.
 *
 * Returns { container, anchor } where the panel will be inserted as
 * `container.insertBefore(panel, anchor)`. Anchor may be null to append.
 */
function resolveMountSlot(target) {
    if (!target) return null;
    const nonQR = document.getElementById('nonQRFormItems');
    const sendForm = document.getElementById('send_form');
    if (sendForm && nonQR && nonQR.parentElement === sendForm) {
        return { container: sendForm, anchor: nonQR };
    }
    // Fallback A: above #send_form inside #form_sheld.
    const sheld = document.getElementById('form_sheld');
    if (sheld && sendForm && sendForm.parentElement === sheld) {
        return { container: sheld, anchor: sendForm };
    }
    // Fallback B: only used when the canonical structure isn't present.
    return { container: target.parentElement, anchor: target };
}

/** Detect the conflicting reference script and warn once. */
function detectConflictAndWarn() {
    try {
        const settings = getSettings();
        if (settings.scopeWarnedAboutInputAssistant) return;

        let detected = false;
        try {
            const scripts = globalThis.TavernHelper?.getScripts?.();
            if (Array.isArray(scripts)) {
                detected = scripts.some(s => s?.id === REFERENCE_SCRIPT_ID);
            }
        } catch { /* ignore */ }
        if (!detected) {
            detected = !!document.querySelector(`[data-script-id="${REFERENCE_SCRIPT_ID}"]`);
        }
        if (!detected) return;

        try { globalThis.toastr?.warning?.(t('aid.toast.conflict_warning'), '', { timeOut: 8000 }); } catch { /* ignore */ }
        saveSettings({ scopeWarnedAboutInputAssistant: true });
    } catch { /* ignore */ }
}

/** Build a single button DOM node. textContent only — XSS-safe. */
function buildButtonEl(btn) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'aid--btn';
    el.setAttribute('data-aid-id', btn.id);
    el.setAttribute('formnovalidate', '');
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

/** Open the Extensions tab and unfold our settings drawer. Best-effort. */
function openOurSettings() {
    try {
        const extDrawer = document.getElementById('extensions-settings-button');
        const extPanel = document.getElementById('rm_extensions_block') || document.getElementById('extensions_settings');
        if (extDrawer && extPanel && !extPanel.offsetParent) {
            extDrawer.click();
        }
        const ourDrawer = document.querySelector('.aid--settings');
        if (ourDrawer) {
            ourDrawer.scrollIntoView({ behavior: 'smooth', block: 'start' });
            const drawerContent = ourDrawer.querySelector('.inline-drawer-content');
            if (drawerContent && drawerContent.style.display === 'none') {
                ourDrawer.querySelector('.inline-drawer-toggle')?.click();
            }
        }
    } catch { /* ignore */ }
}

function render(panelEl) {
    const settings = getSettings();
    const allButtons = settings.buttons || [];
    const buttons = allButtons.filter(b => b && b.enabled !== false);

    panelEl.classList.toggle('aid--collapsed', !!settings.panel?.collapsed);

    const expandLabel = settings.panel?.collapsed ? t('aid.panel.expand') : t('aid.panel.collapse');
    const toggleBtn = panelEl.querySelector('[data-aid-toggle]');
    if (toggleBtn) {
        toggleBtn.setAttribute('aria-label', expandLabel);
        toggleBtn.title = expandLabel;
        toggleBtn.setAttribute('aria-expanded', String(!settings.panel?.collapsed));
    }

    const body = panelEl.querySelector('.aid--panel-body');
    if (!body) return;

    // CSS handles the collapse animation; we skip rebuilding while collapsed.
    if (settings.panel?.collapsed) return;

    const groupsSet = new Set();
    for (const b of buttons) {
        if (b.group) groupsSet.add(String(b.group));
    }
    const groups = [...groupsSet];

    const recentEnabled = settings.panel?.recentEnabled !== false;
    const recentBtns = recentEnabled ? resolveRecent(settings.recentIds || [], buttons) : [];
    const recentVisible = recentEnabled && recentBtns.length > 0;

    body.replaceChildren();

    // Chips appear only when filtering offers a real choice (≥2 groups, or
    // when Recent gives a second tab beyond a single group).
    const showChips = groups.length >= 2 || (groups.length >= 1 && recentVisible) || recentVisible;
    if (showChips) {
        const chipsEl = buildGroupChips(groups, recentVisible);
        body.appendChild(chipsEl);
        requestAnimationFrame(() => {
            const active = chipsEl.querySelector('.aid--chip-active');
            active?.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
        });
    }

    let visible;
    if (!showChips || STATE.activeGroup === '__all__') visible = buttons;
    else if (STATE.activeGroup === '__recent__') visible = recentBtns;
    else if (groups.includes(STATE.activeGroup)) visible = buttons.filter(b => String(b.group || '') === STATE.activeGroup);
    else visible = buttons; // active group no longer exists; fall back to All

    const row = document.createElement('div');
    row.className = 'aid--btn-row';
    row.setAttribute('role', 'toolbar');
    row.setAttribute('aria-label', t('aid.a11y.button_row'));

    if (visible.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'aid--empty';
        // Distinguish "no buttons at all" (show CTA) from "this group is empty" (plain text).
        if (allButtons.length > 0) {
            empty.textContent = t('aid.panel.no_buttons');
        } else {
            const cta = document.createElement('button');
            cta.type = 'button';
            cta.className = 'aid--empty-cta';
            cta.setAttribute('data-aid-open-settings', '');
            cta.appendChild(document.createTextNode(t('aid.panel.no_buttons_cta')));
            const icon = document.createElement('i');
            icon.className = 'fa-solid fa-arrow-right';
            icon.setAttribute('aria-hidden', 'true');
            cta.appendChild(icon);
            empty.appendChild(cta);
        }
        row.appendChild(empty);
    } else {
        const sorted = visible.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        for (const b of sorted) row.appendChild(buildButtonEl(b));
    }
    body.appendChild(row);
}

function buildPanelSkeleton() {
    const panel = document.createElement('div');
    panel.className = PANEL_CLASS;
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-label', t('aid.a11y.panel'));

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

    panel.addEventListener('click', (ev) => {
        const target = ev.target instanceof Element ? ev.target : null;
        if (!target) return;

        const t1 = target.closest('[data-aid-toggle]');
        if (t1) {
            ev.preventDefault();
            const s = getSettings();
            const next = !s.panel?.collapsed;
            saveSettings({ panel: { collapsed: next } });
            return;
        }

        const ctaEl = target.closest('[data-aid-open-settings]');
        if (ctaEl) {
            ev.preventDefault();
            openOurSettings();
            return;
        }

        const chip = target.closest('[data-aid-group]');
        if (chip) {
            ev.preventDefault();
            STATE.activeGroup = chip.getAttribute('data-aid-group') || '__all__';
            render(panel);
            return;
        }

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
    const slot = resolveMountSlot(target);
    if (!slot?.container) return false;

    if (STATE.panelEl?.isConnected) {
        if (!wantShow) {
            STATE.panelEl.remove();
            STATE.panelEl = null;
            return true;
        }
        // Reposition if the canonical slot has shifted (DOM mutation by ST).
        const expectedNext = slot.anchor;
        const expectedParent = slot.container;
        if (
            STATE.panelEl.parentElement !== expectedParent ||
            STATE.panelEl.nextElementSibling !== expectedNext
        ) {
            expectedParent.insertBefore(STATE.panelEl, expectedNext || null);
        }
        render(STATE.panelEl);
        return true;
    }

    if (!wantShow) return true;

    const panel = buildPanelSkeleton();
    slot.container.insertBefore(panel, slot.anchor || null);
    STATE.panelEl = panel;
    STATE.targetEl = target;
    render(panel);
    detectConflictAndWarn();
    return true;
}

/** Watches for ST DOM mutations and remounts if our panel was removed. */
function startObserver() {
    if (STATE.mountObserver) return;
    STATE.mountObserver = new MutationObserver(() => {
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
        // Retry until #send_textarea appears (ST mounts the chat UI lazily).
        let tries = 0;
        const timer = setInterval(() => {
            if (mountIfNeeded() || ++tries > 60) {
                clearInterval(timer);
                if (STATE.panelEl) startObserver();
            }
        }, 500);
    }

    onSettingsChange(() => {
        if (STATE.panelEl?.isConnected) render(STATE.panelEl);
        else mountIfNeeded();
    });

    onLocaleChange(() => {
        if (STATE.panelEl) {
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
