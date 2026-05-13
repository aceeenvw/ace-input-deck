// Schema migrations registry. Each entry runs once when settings are loaded
// at a `from` version and advances the object to `to`.

export const MIGRATIONS = [
    // 0 → 1: initial v1.0.0 schema (reserved entry).
    {
        from: 0,
        to: 1,
        fn: (s) => s,
    },

    // 1 → 2: drop legacy panel.rememberCollapsed (v1.0.2 always persists state).
    {
        from: 1,
        to: 2,
        fn: (s) => {
            if (s.panel && Object.prototype.hasOwnProperty.call(s.panel, 'rememberCollapsed')) {
                delete s.panel.rememberCollapsed;
            }
            return s;
        },
    },

    // 2 → 3: introduce settings.groups map for per-group metadata (icon only).
    {
        from: 2,
        to: 3,
        fn: (s) => {
            if (!s.groups || typeof s.groups !== 'object' || Array.isArray(s.groups)) {
                s.groups = {};
            }
            return s;
        },
    },
];

/**
 * Apply all pending migrations to `settings` based on its `_migrated` value.
 * Returns the same object (mutated) for caller convenience.
 */
export function runMigrations(settings) {
    if (!settings || typeof settings !== 'object') return settings;
    let current = Number.isFinite(settings._migrated) ? settings._migrated : 0;
    let s = settings;
    for (const m of MIGRATIONS) {
        if (current >= m.to) continue;
        if (current !== m.from) continue;
        try {
            s = m.fn(s) || s;
            s._migrated = m.to;
            current = m.to;
        } catch (e) {
            console.error(`[aid] migration ${m.from} -> ${m.to} failed`, e);
            break;
        }
    }
    return s;
}

/** Latest schema version known to this build. */
export const LATEST_SCHEMA = MIGRATIONS.length > 0
    ? MIGRATIONS[MIGRATIONS.length - 1].to
    : 0;
