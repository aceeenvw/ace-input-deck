// Import / Export of the button set.
// - Strict validation with length caps and enum allowlists.
// - JSON sanitizer strips __proto__ / prototype / constructor recursively.
// - Adapter accepts the 输入助手 reference-script JSON shape for one-click migration.

import { stableId, META } from './build-info.js';
import { t } from './i18n.js';

const MAX_FILE_BYTES = 1 * 1024 * 1024; // 1 MB
const MAX_NAME = 16;
const MAX_DESC = 64;
const MAX_CONTENT = 4096;
const VALID_INSERT = new Set(['as_is', 'prepend', 'append']);
const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

/** Read a JSON file safely. Caps size, parses with prototype-pollution guard. */
export async function readJsonFile(file) {
    if (!(file instanceof File)) throw new Error(t('aid.settings.import_invalid_json'));
    if (file.size > MAX_FILE_BYTES) throw new Error(t('aid.settings.import_size_exceeded'));
    const text = await file.text();
    return parseJsonSafe(text);
}

/**
 * JSON.parse + reviver that strips dangerous keys.
 * Uses Object.create(null) for plain objects to defang prototype lookup.
 */
export function parseJsonSafe(text) {
    let raw;
    try {
        raw = JSON.parse(text);
    } catch {
        throw new Error(t('aid.settings.import_invalid_json'));
    }
    return sanitize(raw);
}

function sanitize(node) {
    if (Array.isArray(node)) return node.map(sanitize);
    if (node && typeof node === 'object') {
        const out = {};
        for (const k of Object.keys(node)) {
            if (FORBIDDEN_KEYS.has(k)) continue;
            out[k] = sanitize(node[k]);
        }
        return out;
    }
    return node;
}

/** Validate one button row. Returns {ok, button, errors[]}. */
export function validateButton(row, idx) {
    const errors = [];
    if (!row || typeof row !== 'object') {
        errors.push(`row ${idx}: not an object`);
        return { ok: false, errors };
    }

    const name = String(row.name ?? '').slice(0, MAX_NAME * 4);
    const description = String(row.description ?? '').slice(0, MAX_DESC * 4);
    const content = String(row.content ?? '');
    const insert_position = String(row.insert_position ?? 'as_is');
    const cursor_position = Number.isFinite(row.cursor_position) ? Number(row.cursor_position) : 0;
    const group = String(row.group ?? '');
    // Reference script JSON uses `enable`; native uses `enabled`. Accept both.
    const enabled = (row.enabled !== false) && (row.enable !== false);

    if (!name) errors.push(t('aid.editor.validation_name_required'));
    if (name.length > MAX_NAME) errors.push(t('aid.editor.validation_name_too_long'));
    if (description.length > MAX_DESC) errors.push(t('aid.editor.validation_description_too_long'));
    if (content.length > MAX_CONTENT) errors.push(t('aid.editor.validation_content_too_long'));
    if (!VALID_INSERT.has(insert_position)) errors.push(`row ${idx}: insert_position invalid`);
    if (cursor_position < 0 || cursor_position > content.length) errors.push(t('aid.editor.validation_cursor_out_of_range'));
    if (group.length > 32) errors.push(`row ${idx}: group too long`);

    if (errors.length) return { ok: false, errors };

    return {
        ok: true,
        errors,
        button: {
            id: stableId(name + ':' + idx),
            name,
            description,
            content,
            cursor_position,
            insert_position,
            group,
            enabled,
            order: idx,
        },
    };
}

/** Detect input shape and extract the rows array. */
function extractRows(parsed) {
    if (!parsed || typeof parsed !== 'object') return null;

    // Native v1: { $schema: 'ace-input-deck/v1', buttons: [...] }
    if (parsed.$schema === 'ace-input-deck/v1' && Array.isArray(parsed.buttons)) {
        return { rows: parsed.buttons, shape: 'native-v1' };
    }
    // Loose native: { buttons: [...] }
    if (Array.isArray(parsed.buttons)) {
        return { rows: parsed.buttons, shape: 'native-loose' };
    }
    // 输入助手 shape: { type: 'script', data: { buttons: [...] }, ... }
    if (parsed.data && Array.isArray(parsed.data.buttons)) {
        return { rows: parsed.data.buttons, shape: 'reference-script' };
    }
    // Bare array
    if (Array.isArray(parsed)) {
        return { rows: parsed, shape: 'array' };
    }
    return null;
}

/**
 * Validate a parsed payload into a list of buttons + a per-row error report.
 * @returns {{ ok: object[], skipped: {idx: number, errors: string[]}[], shape: string }}
 */
export function validateImport(parsed) {
    const found = extractRows(parsed);
    if (!found) {
        const e = new Error(t('aid.settings.import_unknown_shape'));
        e.aidImportError = true;
        throw e;
    }
    if (found.rows.length === 0) {
        const e = new Error(t('aid.settings.import_no_buttons'));
        e.aidImportError = true;
        throw e;
    }
    const ok = [];
    const skipped = [];
    found.rows.forEach((row, idx) => {
        const r = validateButton(row, idx);
        if (r.ok) ok.push(r.button);
        else skipped.push({ idx, errors: r.errors });
    });
    return { ok, skipped, shape: found.shape };
}

/** Build the export payload. Pure data, no runtime IDs leaked. */
export function buildExportPayload(buttons) {
    const cleaned = (Array.isArray(buttons) ? buttons : []).map((b, i) => ({
        name: String(b.name || ''),
        description: String(b.description || ''),
        content: String(b.content || ''),
        cursor_position: Number(b.cursor_position) || 0,
        insert_position: VALID_INSERT.has(b.insert_position) ? b.insert_position : 'as_is',
        group: String(b.group || ''),
        enabled: b.enabled !== false,
        order: Number.isFinite(b.order) ? b.order : i,
    }));
    return {
        $schema: 'ace-input-deck/v1',
        version: META.version,
        author: META.author,
        exportedAt: new Date().toISOString(),
        buttons: cleaned,
    };
}

/** Trigger a download of the buttons as a JSON file. */
export function downloadJson(buttons) {
    const payload = buildExportPayload(buttons);
    const text = JSON.stringify(payload, null, 2);
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const a = document.createElement('a');
    a.href = url;
    a.download = `ace-input-deck-buttons-${ymd}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        a.remove();
        URL.revokeObjectURL(url);
    }, 100);
    return payload.buttons.length;
}
