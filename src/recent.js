// LRU "Recently used" tracker for button IDs.
// Capped at 8 entries. Persisted via settings.

const MAX = 8;

/**
 * Push an ID to the head of an array, deduped, capped at MAX.
 * Returns a NEW array (never mutates input).
 */
export function pushRecent(list, id) {
    if (!id) return Array.isArray(list) ? list.slice() : [];
    const clean = (Array.isArray(list) ? list : []).filter(x => typeof x === 'string' && x !== id);
    clean.unshift(String(id));
    if (clean.length > MAX) clean.length = MAX;
    return clean;
}

/** Filter recent IDs against current button list, dropping stale ones. */
export function resolveRecent(recentIds, buttons) {
    if (!Array.isArray(recentIds) || !Array.isArray(buttons)) return [];
    const byId = new Map(buttons.map(b => [b.id, b]));
    const out = [];
    for (const id of recentIds) {
        const b = byId.get(id);
        if (b && b.enabled) out.push(b);
    }
    return out;
}

export const RECENT_MAX = MAX;
