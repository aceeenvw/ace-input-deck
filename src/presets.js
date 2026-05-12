// Built-in preset packs.
// Default "Roleplay basics" auto-loads on first install.
// Pack A and Pack B are user-loadable. No private content.

import { stableId } from './build-info.js';

/**
 * Each preset row uses raw shape; stableId is assigned at load time
 * so every load produces unique IDs (useful for append mode).
 *
 * Cursor placement convention: `cursor_position` is chars from the
 * start of `content`. For symmetric pairs like `""` we point at the
 * midpoint so the cursor lands inside the pair.
 */

const ROLEPLAY_BASICS = [
    { name: '""',     description: 'Dialogue (speech)',     content: '""',     cursor_position: 1, insert_position: 'as_is', group: 'Speech',  enabled: true },
    { name: '**',     description: 'Thought / italic',      content: '**',     cursor_position: 1, insert_position: 'as_is', group: 'Speech',  enabled: true },
    { name: '****',   description: 'Bold emphasis',         content: '****',   cursor_position: 2, insert_position: 'as_is', group: 'Speech',  enabled: true },
    { name: '«»',     description: 'Quote marks (RU/EU)',   content: '«»',     cursor_position: 1, insert_position: 'as_is', group: 'Speech',  enabled: true },
    { name: '***',    description: 'Bold-italic',           content: '******', cursor_position: 3, insert_position: 'as_is', group: 'Speech',  enabled: true },
    { name: '[ ]',    description: 'Action / stage',        content: '[]',     cursor_position: 1, insert_position: 'as_is', group: 'Markers', enabled: true },
    { name: '( )',    description: 'Aside / parenthetical', content: '()',     cursor_position: 1, insert_position: 'as_is', group: 'Markers', enabled: true },
    { name: '—',      description: 'Em dash',               content: '—',      cursor_position: 1, insert_position: 'as_is', group: 'Markers', enabled: true },
    { name: '…',      description: 'Ellipsis',              content: '…',      cursor_position: 1, insert_position: 'as_is', group: 'Markers', enabled: true },
    { name: 'OOC',    description: 'Out-of-character note', content: '[OOC: ]', cursor_position: 6, insert_position: 'as_is', group: 'Markers', enabled: true },
    { name: '⏎',      description: 'Newline at end',        content: '\n',     cursor_position: 0, insert_position: 'append', group: 'Utility', enabled: true },
    { name: '<user>', description: 'User tag',              content: '<user>', cursor_position: 6, insert_position: 'as_is', group: 'Tags',    enabled: true },
];

const RUSSIAN_PUNCTUATION = [
    { name: '«»',  description: 'Russian quotes',  content: '«»',  cursor_position: 1, insert_position: 'as_is', group: 'RU', enabled: true },
    { name: '„"',  description: 'Inner quotes',    content: '„"',  cursor_position: 1, insert_position: 'as_is', group: 'RU', enabled: true },
    { name: '—',   description: 'Em dash',         content: '—',   cursor_position: 1, insert_position: 'as_is', group: 'RU', enabled: true },
    { name: '–',   description: 'En dash',         content: '–',   cursor_position: 1, insert_position: 'as_is', group: 'RU', enabled: true },
    { name: '…',   description: 'Ellipsis',        content: '…',   cursor_position: 1, insert_position: 'as_is', group: 'RU', enabled: true },
    { name: '№',   description: 'Numero sign',     content: '№',   cursor_position: 1, insert_position: 'as_is', group: 'RU', enabled: true },
    { name: '₽',   description: 'Ruble sign',      content: '₽',   cursor_position: 1, insert_position: 'as_is', group: 'RU', enabled: true },
    { name: '°',   description: 'Degree sign',     content: '°',   cursor_position: 1, insert_position: 'as_is', group: 'RU', enabled: true },
];

const MARKDOWN_POWER = [
    { name: '**',     description: 'Bold',          content: '**',       cursor_position: 1, insert_position: 'as_is',  group: 'Markdown', enabled: true },
    { name: '*',      description: 'Italic',        content: '**',       cursor_position: 1, insert_position: 'as_is',  group: 'Markdown', enabled: true },
    { name: '***',    description: 'Bold-italic',   content: '******',   cursor_position: 3, insert_position: 'as_is',  group: 'Markdown', enabled: true },
    { name: '~~',     description: 'Strikethrough', content: '~~~~',     cursor_position: 2, insert_position: 'as_is',  group: 'Markdown', enabled: true },
    { name: '`',      description: 'Inline code',   content: '``',       cursor_position: 1, insert_position: 'as_is',  group: 'Markdown', enabled: true },
    { name: '```',    description: 'Code block',    content: '```\n\n```', cursor_position: 4, insert_position: 'as_is', group: 'Markdown', enabled: true },
    { name: '>',      description: 'Blockquote',    content: '> ',       cursor_position: 2, insert_position: 'prepend', group: 'Markdown', enabled: true },
    { name: '[]()',   description: 'Link',          content: '[]()',     cursor_position: 1, insert_position: 'as_is',  group: 'Markdown', enabled: true },
    { name: '#',      description: 'Heading 1',     content: '# ',       cursor_position: 2, insert_position: 'prepend', group: 'Markdown', enabled: true },
    { name: '##',     description: 'Heading 2',     content: '## ',      cursor_position: 3, insert_position: 'prepend', group: 'Markdown', enabled: true },
    { name: '###',    description: 'Heading 3',     content: '### ',     cursor_position: 4, insert_position: 'prepend', group: 'Markdown', enabled: true },
    { name: '- ',     description: 'List item',     content: '- ',       cursor_position: 2, insert_position: 'prepend', group: 'Markdown', enabled: true },
    { name: '1.',     description: 'Ordered list',  content: '1. ',      cursor_position: 3, insert_position: 'prepend', group: 'Markdown', enabled: true },
];

/** Internal: clone a preset row, assign a fresh stable ID, default fields. */
function instantiate(row, idx) {
    return {
        id: stableId(row.name + ':' + idx),
        name: String(row.name),
        description: String(row.description || ''),
        content: String(row.content || ''),
        cursor_position: Number.isFinite(row.cursor_position) ? row.cursor_position : 0,
        insert_position: ['as_is', 'prepend', 'append'].includes(row.insert_position) ? row.insert_position : 'as_is',
        group: String(row.group || ''),
        enabled: row.enabled !== false,
        order: idx,
    };
}

export const PRESETS = Object.freeze({
    roleplay_basics: {
        id: 'roleplay_basics',
        nameKey: 'aid.settings.preset_roleplay_basics',
        rows: ROLEPLAY_BASICS,
    },
    russian_punctuation: {
        id: 'russian_punctuation',
        nameKey: 'aid.settings.preset_russian_punctuation',
        rows: RUSSIAN_PUNCTUATION,
    },
    markdown_power: {
        id: 'markdown_power',
        nameKey: 'aid.settings.preset_markdown_power',
        rows: MARKDOWN_POWER,
    },
});

/** Materialize a preset into runtime button objects. */
export function instantiatePreset(presetId) {
    const p = PRESETS[presetId];
    if (!p) return [];
    return p.rows.map((r, i) => instantiate(r, i));
}

/** Default button set used on first install. */
export function getDefaultButtons() {
    return instantiatePreset('roleplay_basics');
}
