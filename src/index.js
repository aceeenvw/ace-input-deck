// ⊹ ACE INPUT DECK ⊹ — entry point.
// Author: aceenvw — https://github.com/aceeenvw/ace-input-deck
import './style.css';

import { loadSettings, mountSettingsPanel, onSettingsChange } from './settings.js';
import { initPanel } from './panel.js';
import { registerDict, setLocale, detectLocale } from './i18n.js';
import { META } from './build-info.js';

import enUS from '../i18n/en-us.json';
import ruRU from '../i18n/ru-ru.json';

registerDict('en-us', enUS);
registerDict('ru-ru', ruRU);

const STATE = {
    settingsMounted: false,
    panelInited: false,
    ready: false,
};

function applyLocaleFromSettings() {
    const s = loadSettings();
    setLocale(detectLocale(s.locale));
}

function tryMountSettings() {
    if (STATE.settingsMounted) return;
    const root = mountSettingsPanel();
    if (root) STATE.settingsMounted = true;
}

function init() {
    if (STATE.ready) return;
    STATE.ready = true;

    loadSettings();
    applyLocaleFromSettings();

    if (!STATE.panelInited) {
        initPanel();
        STATE.panelInited = true;
    }

    tryMountSettings();
    let retries = 0;
    const timer = setInterval(() => {
        tryMountSettings();
        if (STATE.settingsMounted || ++retries > 40) clearInterval(timer);
    }, 500);

    onSettingsChange(() => applyLocaleFromSettings());
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
    init();
}
try {
    const ctx = globalThis.SillyTavern?.getContext?.();
    const ev = ctx?.eventSource;
    const types = ctx?.event_types || ctx?.eventTypes;
    if (ev && types?.APP_READY) ev.on(types.APP_READY, init);
} catch { /* ignore */ }

// Read-only debug handle. Frozen so no caller can mutate or extend it.
try {
    globalThis.AceInputDeck = Object.freeze({
        version: META.version,
        author: META.author,
    });
} catch { /* ignore */ }
