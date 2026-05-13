// Persistent settings state + the Extensions-tab drawer card UI.
// Buttons CRUD lives in buttons-editor.js and is mounted inside this card.

import { t, setLocale, detectLocale, getAvailableLocales, onLocaleChange } from './i18n.js';
import { getDefaultButtons, PRESETS, instantiatePreset } from './presets.js';
import { mountButtonsEditor } from './buttons-editor.js';
import { downloadJson, readJsonFile, validateImport } from './importexport.js';
import { runMigrations, LATEST_SCHEMA } from './migrations.js';
import { META } from './build-info.js';

const KEY = 'aceInputDeck';
const STORAGE_SOFT_WARN_BYTES = 256 * 1024;
const STORAGE_HARD_CAP_BYTES = 1024 * 1024;

export const DEFAULTS = Object.freeze({
    locale: 'en-us',
    panel: {
        show: true,
        collapsed: false,           // current collapsed state, always persisted
        recentEnabled: true,
    },
    buttons: [],                    // populated on first install via getDefaultButtons()
    groups: {},                     // groupName -> { icon: 'fa-solid fa-comment' }
    recentIds: [],
    scopeWarnedAboutInputAssistant: false,
    _migrated: 0,                   // raised by runMigrations() to LATEST_SCHEMA
});

const LISTENERS = new Set();

function deepMerge(base, patch) {
    if (!patch || typeof patch !== 'object') return Array.isArray(base) ? base.slice() : { ...base };
    if (Array.isArray(patch)) return patch.slice();
    const out = Array.isArray(base) ? base.slice() : { ...base };
    for (const k of Object.keys(patch)) {
        if (k === '__proto__' || k === 'prototype' || k === 'constructor') continue;
        const v = patch[k];
        if (v && typeof v === 'object' && !Array.isArray(v)) {
            out[k] = deepMerge(base?.[k] || {}, v);
        } else if (v !== undefined) {
            out[k] = v;
        }
    }
    return out;
}

function getStore() {
    try {
        const ctx = globalThis.SillyTavern?.getContext?.();
        if (ctx?.extensionSettings) return ctx.extensionSettings;
    } catch { /* ignore */ }
    return globalThis.extension_settings || (globalThis.extension_settings = {});
}

function notify(settings) {
    for (const fn of LISTENERS) {
        try { fn(settings); } catch (e) { console.error('[aid] listener error', e); }
    }
}

export function loadSettings() {
    const store = getStore();
    let merged = deepMerge(DEFAULTS, store[KEY] || {});

    // Run schema migrations before any consumer touches the object.
    merged = runMigrations(merged);

    // First-install bootstrap: empty buttons → load default preset.
    if (!Array.isArray(merged.buttons) || merged.buttons.length === 0) {
        merged.buttons = getDefaultButtons();
    }

    store[KEY] = merged;
    return merged;
}

export function getSettings() { return loadSettings(); }

/** Estimate serialized size in bytes (UTF-8 approx). */
function approxSize(obj) {
    try { return new Blob([JSON.stringify(obj)]).size; }
    catch { return 0; }
}

export function saveSettings(patch) {
    const store = getStore();
    const current = loadSettings();
    const next = deepMerge(current, patch || {});

    // Storage cap guard.
    const size = approxSize(next);
    if (size > STORAGE_HARD_CAP_BYTES) {
        try { globalThis.toastr?.error?.(t('aid.toast.storage_exceeded')); } catch { /* ignore */ }
        return current;
    }
    if (size > STORAGE_SOFT_WARN_BYTES) {
        try { globalThis.toastr?.warning?.(t('aid.toast.storage_warning', { kb: Math.round(size / 1024) })); } catch { /* ignore */ }
    }

    store[KEY] = next;
    try {
        const ctx = globalThis.SillyTavern?.getContext?.();
        (ctx?.saveSettingsDebounced || globalThis.saveSettingsDebounced)?.();
    } catch { /* ignore */ }
    notify(next);
    return next;
}

export function resetSettings() {
    const store = getStore();
    const reset = deepMerge(DEFAULTS, {
        _migrated: LATEST_SCHEMA,
        buttons: getDefaultButtons(),
        groups: {},
    });
    store[KEY] = reset;
    try {
        const ctx = globalThis.SillyTavern?.getContext?.();
        (ctx?.saveSettingsDebounced || globalThis.saveSettingsDebounced)?.();
    } catch { /* ignore */ }
    notify(reset);
    return reset;
}

export function onSettingsChange(fn) {
    LISTENERS.add(fn);
    return () => LISTENERS.delete(fn);
}

/* Group metadata helpers ───────────────────────────────────────── */

export function getGroupIcon(name) {
    if (!name) return '';
    const g = getSettings().groups || {};
    const entry = g[String(name)];
    if (!entry || typeof entry.icon !== 'string') return '';
    // Defense in depth: re-sanitize on read so a hand-edited extension_settings
    // file can't smuggle a malicious class string into rendered DOM.
    return sanitizeIconClass(entry.icon);
}

/**
 * Set or clear a group's icon. Pass an empty string to clear. Strict
 * sanitization: only fa-solid/fa-regular/fa-brands prefixed classes are
 * accepted to prevent arbitrary class injection.
 */
export function setGroupIcon(name, icon) {
    const groupName = String(name || '').trim();
    if (!groupName) return;
    const safe = sanitizeIconClass(icon);
    const cur = getSettings().groups || {};
    const next = { ...cur };
    if (!safe) {
        delete next[groupName];
    } else {
        next[groupName] = { ...(cur[groupName] || {}), icon: safe };
    }
    saveSettings({ groups: next });
}

/** Drop entries for groups no longer referenced by any button. Idempotent. */
export function pruneOrphanGroups() {
    const s = getSettings();
    const used = new Set();
    for (const b of s.buttons || []) if (b.group) used.add(String(b.group));
    const groups = s.groups || {};
    const next = {};
    let changed = false;
    for (const name of Object.keys(groups)) {
        if (used.has(name)) next[name] = groups[name];
        else changed = true;
    }
    if (changed) saveSettings({ groups: next });
}

// Strict allowlist for FontAwesome class strings to prevent class-name
// injection. Single literal space separator; no whitespace runs, no
// newlines, no extra classes appended.
function sanitizeIconClass(raw) {
    if (typeof raw !== 'string') return '';
    const trimmed = raw.trim();
    if (!trimmed) return '';
    if (trimmed.length > 64) return '';
    if (!/^fa-(?:solid|regular|brands) fa-[a-z0-9-]+$/.test(trimmed)) return '';
    return trimmed;
}

/* ════════════════════════════════════════════════════════════════
   Drawer card UI (iOS-style, mirrors CMP visual language)
   ════════════════════════════════════════════════════════════════ */

function el(tag, props = {}, children = []) {
    const e = document.createElement(tag);
    for (const k of Object.keys(props)) {
        if (k === 'class') e.className = props[k];
        else if (k === 'dataset') Object.assign(e.dataset, props[k]);
        else if (k.startsWith('on') && typeof props[k] === 'function') e.addEventListener(k.slice(2).toLowerCase(), props[k]);
        else if (k === 'attrs') for (const a of Object.keys(props.attrs)) e.setAttribute(a, props.attrs[a]);
        else if (k === 'i18n') e.setAttribute('data-i18n', props[k]);
        else e[k] = props[k];
    }
    for (const c of [].concat(children)) {
        if (c == null) continue;
        if (typeof c === 'string') e.appendChild(document.createTextNode(c));
        else e.appendChild(c);
    }
    return e;
}

function applyTranslations(root) {
    root.querySelectorAll('[data-i18n]').forEach(node => {
        const key = node.getAttribute('data-i18n');
        node.textContent = t(key);
    });
    root.querySelectorAll('[data-i18n-title]').forEach(node => {
        const key = node.getAttribute('data-i18n-title');
        const v = t(key);
        node.title = v;
        node.setAttribute('aria-label', v);
    });
}

function buildLocaleSection(root) {
    const sec = el('section', { class: 'aid--card', dataset: { section: 'locale' } });
    const head = el('header', { class: 'aid--card-head' }, [
        el('i', { class: 'fa-solid fa-language' }),
        el('h4', { i18n: 'aid.settings.section_locale' }, t('aid.settings.section_locale')),
    ]);
    const body = el('div', { class: 'aid--card-body' });
    const row = el('label', { class: 'aid--row' });
    row.appendChild(el('span', { class: 'aid--row-label', i18n: 'aid.settings.locale' }, t('aid.settings.locale')));
    const sel = el('select', { class: 'aid--select', dataset: { aidField: 'locale' } });
    sel.appendChild(el('option', { value: 'auto', i18n: 'aid.settings.locale_auto' }, t('aid.settings.locale_auto')));
    for (const loc of getAvailableLocales()) sel.appendChild(el('option', { value: loc.code }, loc.label));
    row.appendChild(sel);
    body.appendChild(row);
    sec.append(head, body);
    return sec;
}

function buildPanelSection() {
    const sec = el('section', { class: 'aid--card', dataset: { section: 'panel' } });
    sec.append(
        el('header', { class: 'aid--card-head' }, [
            el('i', { class: 'fa-solid fa-grip-lines' }),
            el('h4', { i18n: 'aid.settings.section_panel' }, t('aid.settings.section_panel')),
        ]),
        el('div', { class: 'aid--card-body aid--toggle-list' }, [
            buildToggleRow('panel.show', 'aid.settings.panel_show'),
            buildToggleRow('panel.recentEnabled', 'aid.settings.panel_recent_enabled'),
        ]),
    );
    return sec;
}

function buildToggleRow(path, labelKey) {
    const row = el('label', { class: 'aid--toggle-row' });
    row.appendChild(el('span', { class: 'aid--row-label', i18n: labelKey }, t(labelKey)));
    const sw = el('span', { class: 'aid--switch' });
    const inp = el('input', { type: 'checkbox', dataset: { aidField: path } });
    const tr  = el('span', { class: 'aid--switch-track' }, [el('span', { class: 'aid--switch-thumb' })]);
    sw.append(inp, tr);
    row.appendChild(sw);
    return row;
}

function buildButtonsSection() {
    const sec = el('section', { class: 'aid--card', dataset: { section: 'buttons' } });
    sec.append(
        el('header', { class: 'aid--card-head' }, [
            el('i', { class: 'fa-solid fa-grip' }),
            el('h4', { i18n: 'aid.settings.section_buttons' }, t('aid.settings.section_buttons')),
        ]),
        el('div', { class: 'aid--card-body', dataset: { aidEditorRoot: '' } }),
    );
    return sec;
}

function buildPresetsSection() {
    const sec = el('section', { class: 'aid--card', dataset: { section: 'presets' } });
    const head = el('header', { class: 'aid--card-head' }, [
        el('i', { class: 'fa-solid fa-rectangle-list' }),
        el('h4', { i18n: 'aid.settings.section_presets' }, t('aid.settings.section_presets')),
    ]);
    const body = el('div', { class: 'aid--card-body' });

    const chipRow = el('div', { class: 'aid--preset-chips' });
    for (const id of Object.keys(PRESETS)) {
        const p = PRESETS[id];
        chipRow.appendChild(el('button', {
            type: 'button', class: 'aid--ghost-btn aid--preset-chip',
            dataset: { aidPreset: id }, i18n: p.nameKey,
        }, t(p.nameKey)));
    }
    body.appendChild(chipRow);

    const ctrl = el('div', { class: 'aid--preset-ctrl' });
    const modeWrap = el('div', { class: 'aid--seg', attrs: { role: 'radiogroup' } });
    const modeAppend = el('button', {
        type: 'button', class: 'aid--seg-btn aid--seg-btn-active',
        dataset: { aidPresetMode: 'append' },
    });
    modeAppend.appendChild(el('i', { class: 'fa-solid fa-plus' }));
    modeAppend.appendChild(el('span', { i18n: 'aid.settings.preset_mode_append' }, t('aid.settings.preset_mode_append')));
    const modeReplace = el('button', {
        type: 'button', class: 'aid--seg-btn',
        dataset: { aidPresetMode: 'replace' },
    });
    modeReplace.appendChild(el('i', { class: 'fa-solid fa-arrows-rotate' }));
    modeReplace.appendChild(el('span', { i18n: 'aid.settings.preset_mode_replace' }, t('aid.settings.preset_mode_replace')));
    modeWrap.append(modeAppend, modeReplace);

    const loadBtn = el('button', { type: 'button', class: 'aid--primary-btn', dataset: { aidAction: 'preset-load' } });
    loadBtn.appendChild(el('i', { class: 'fa-solid fa-download' }));
    loadBtn.appendChild(el('span', { i18n: 'aid.settings.preset_load' }, t('aid.settings.preset_load')));

    ctrl.append(modeWrap, loadBtn);
    body.appendChild(ctrl);

    sec.append(head, body);
    return sec;
}

function buildIoSection() {
    const sec = el('section', { class: 'aid--card', dataset: { section: 'io' } });
    sec.append(
        el('header', { class: 'aid--card-head' }, [
            el('i', { class: 'fa-solid fa-arrow-right-arrow-left' }),
            el('h4', { i18n: 'aid.settings.section_io' }, t('aid.settings.section_io')),
        ]),
        el('div', { class: 'aid--card-body aid--io-row' }, [
            (() => {
                const b = el('button', { type: 'button', class: 'aid--ghost-btn', dataset: { aidAction: 'export' } });
                b.append(el('i', { class: 'fa-solid fa-download' }), el('span', { i18n: 'aid.settings.export_json' }, t('aid.settings.export_json')));
                return b;
            })(),
            (() => {
                const b = el('button', { type: 'button', class: 'aid--ghost-btn', dataset: { aidAction: 'import' } });
                b.append(el('i', { class: 'fa-solid fa-upload' }), el('span', { i18n: 'aid.settings.import_json' }, t('aid.settings.import_json')));
                return b;
            })(),
            el('input', { type: 'file', dataset: { aidImportFile: '' }, attrs: { accept: '.json,application/json', hidden: 'hidden' } }),
        ]),
    );
    return sec;
}

function buildAboutSection() {
    const sec = el('section', { class: 'aid--card', dataset: { section: 'about' } });
    sec.append(
        el('header', { class: 'aid--card-head' }, [
            el('i', { class: 'fa-solid fa-circle-info' }),
            el('h4', { i18n: 'aid.settings.section_about' }, t('aid.settings.section_about')),
        ]),
        el('div', { class: 'aid--card-body aid--about' }, [
            el('div', { class: 'aid--about-line' }, t('aid.settings.about_version', { version: META.version })),
            el('div', { class: 'aid--about-line aid--about-muted' }, t('aid.settings.about_author', { author: META.author })),
        ]),
    );
    return sec;
}

function buildSettingsTree() {
    const root = el('div', { class: 'aid--settings inline-drawer' });
    const head = el('div', { class: 'inline-drawer-toggle inline-drawer-header' }, [
        el('b', { i18n: 'aid.settings.title' }, t('aid.settings.title')),
        el('div', { class: 'inline-drawer-icon fa-solid fa-circle-chevron-down down' }),
    ]);
    const content = el('div', { class: 'inline-drawer-content' });

    const headStrip = el('div', { class: 'aid--settings-head' });
    const brand = el('div', { class: 'aid--settings-brand' });
    brand.append(el('i', { class: 'fa-solid fa-wand-magic-sparkles' }), el('span', { i18n: 'aid.settings.subtitle' }, t('aid.settings.subtitle')));
    const resetBtn = el('button', { type: 'button', class: 'aid--ghost-btn', dataset: { aidAction: 'reset' } });
    resetBtn.append(el('i', { class: 'fa-solid fa-rotate-left' }), el('span', { i18n: 'aid.settings.reset' }, t('aid.settings.reset')));
    headStrip.append(brand, resetBtn);

    content.append(
        headStrip,
        buildLocaleSection(),
        buildPanelSection(),
        buildButtonsSection(),
        buildPresetsSection(),
        buildIoSection(),
        buildAboutSection(),
    );

    root.append(head, content);
    return root;
}

function syncToggles(root) {
    const s = getSettings();
    root.querySelectorAll('[data-aid-field]').forEach(node => {
        const path = node.getAttribute('data-aid-field');
        const v = path.split('.').reduce((o, k) => (o != null ? o[k] : undefined), s);
        if (node.type === 'checkbox') node.checked = !!v;
        else node.value = v == null ? '' : String(v);
    });
}

function setNested(obj, path, val) {
    const parts = path.split('.');
    const last = parts.pop();
    let cur = obj;
    for (const p of parts) {
        if (p === '__proto__' || p === 'prototype' || p === 'constructor') return;
        if (cur[p] == null || typeof cur[p] !== 'object') cur[p] = {};
        cur = cur[p];
    }
    if (last === '__proto__' || last === 'prototype' || last === 'constructor') return;
    cur[last] = val;
}

function confirmAsync(message) {
    return Promise.resolve(globalThis.confirm ? globalThis.confirm(message) : true);
}

function attachHandlers(root) {
    let presetMode = 'append';

    root.addEventListener('change', (ev) => {
        const node = ev.target;
        if (!(node instanceof HTMLElement)) return;

        const path = node.getAttribute('data-aid-field');
        if (path) {
            const value = node.type === 'checkbox' ? node.checked : node.value;
            const patch = {};
            setNested(patch, path, value);
            saveSettings(patch);
            if (path === 'locale') setLocale(detectLocale(value));
            return;
        }
    });

    root.addEventListener('click', async (ev) => {
        const target = ev.target instanceof Element ? ev.target : null;
        if (!target) return;

        const seg = target.closest('[data-aid-preset-mode]');
        if (seg) {
            ev.preventDefault();
            presetMode = seg.getAttribute('data-aid-preset-mode');
            root.querySelectorAll('[data-aid-preset-mode]').forEach(n => {
                n.classList.toggle('aid--seg-btn-active', n === seg);
                n.setAttribute('aria-checked', String(n === seg));
            });
            return;
        }

        const chip = target.closest('[data-aid-preset]');
        if (chip) {
            ev.preventDefault();
            root.querySelectorAll('[data-aid-preset]').forEach(n => n.classList.toggle('aid--preset-chip-active', n === chip));
            return;
        }

        const action = target.closest('[data-aid-action]');
        if (!action) return;
        const a = action.getAttribute('data-aid-action');

        if (a === 'reset') {
            ev.preventDefault();
            if (await confirmAsync(t('aid.settings.reset_confirm'))) resetSettings();
            return;
        }

        if (a === 'preset-load') {
            ev.preventDefault();
            const active = root.querySelector('.aid--preset-chip-active');
            if (!active) return;
            const id = active.getAttribute('data-aid-preset');
            const p = PRESETS[id];
            if (!p) return;
            const newButtons = instantiatePreset(id);
            if (presetMode === 'replace') {
                if (!await confirmAsync(t('aid.settings.preset_replace_confirm', { name: t(p.nameKey) }))) return;
                saveSettings({ buttons: newButtons });
            } else {
                const cur = getSettings().buttons || [];
                const merged = cur.concat(newButtons.map((b, i) => ({ ...b, order: cur.length + i })));
                saveSettings({ buttons: merged });
            }
            try { globalThis.toastr?.success?.(t('aid.settings.preset_loaded', { name: t(p.nameKey), count: newButtons.length })); } catch { /* ignore */ }
            return;
        }

        if (a === 'export') {
            ev.preventDefault();
            try {
                const n = downloadJson(getSettings().buttons || []);
                try { globalThis.toastr?.success?.(t('aid.toast.exported', { count: n })); } catch { /* ignore */ }
            } catch (e) {
                try { globalThis.toastr?.error?.(t('aid.settings.import_failed', { reason: e.message })); } catch { /* ignore */ }
            }
            return;
        }

        if (a === 'import') {
            ev.preventDefault();
            root.querySelector('[data-aid-import-file]')?.click();
            return;
        }
    });

    const fileInput = root.querySelector('[data-aid-import-file]');
    if (fileInput) {
        fileInput.addEventListener('change', async () => {
            const file = fileInput.files?.[0];
            fileInput.value = '';
            if (!file) return;
            try {
                const parsed = await readJsonFile(file);
                const result = validateImport(parsed);
                if (result.ok.length === 0) {
                    try { globalThis.toastr?.warning?.(t('aid.settings.import_no_buttons')); } catch { /* ignore */ }
                    return;
                }
                const replace = await confirmAsync(t('aid.settings.import_replace_confirm'));
                if (replace) {
                    saveSettings({ buttons: result.ok });
                } else {
                    const cur = getSettings().buttons || [];
                    saveSettings({ buttons: cur.concat(result.ok.map((b, i) => ({ ...b, order: cur.length + i }))) });
                }
                try {
                    globalThis.toastr?.success?.(t('aid.toast.imported', { count: result.ok.length }));
                    if (result.skipped.length) {
                        globalThis.toastr?.warning?.(t('aid.settings.import_results_skipped', { n: result.skipped.length }));
                    }
                } catch { /* ignore */ }
            } catch (e) {
                try { globalThis.toastr?.error?.(t('aid.settings.import_failed', { reason: e.message || 'unknown' })); } catch { /* ignore */ }
            }
        });
    }
}

export function mountSettingsPanel() {
    const host = document.getElementById('extensions_settings2') || document.getElementById('extensions_settings');
    if (!host) return null;
    if (host.querySelector('.aid--settings')) return host.querySelector('.aid--settings');

    const root = buildSettingsTree();
    host.appendChild(root);

    const editorHost = root.querySelector('[data-aid-editor-root]');
    if (editorHost) mountButtonsEditor(editorHost);

    const rerender = () => {
        applyTranslations(root);
        syncToggles(root);
    };
    rerender();
    attachHandlers(root);

    const offSettings = onSettingsChange(() => syncToggles(root));
    const offLocale   = onLocaleChange(() => rerender());

    const mo = new MutationObserver(() => {
        if (!root.isConnected) {
            offSettings?.();
            offLocale?.();
            mo.disconnect();
        }
    });
    mo.observe(host, { childList: true });

    return root;
}
