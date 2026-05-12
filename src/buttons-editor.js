// Buttons editor: drag-reorderable list, inline edit form, add/duplicate/delete.
// Mounts inside the settings drawer's "Buttons" card body.

import { t, onLocaleChange } from './i18n.js';
import { stableId } from './build-info.js';
import { getSettings, saveSettings, onSettingsChange } from './settings.js';
import { validateButton } from './importexport.js';

let _editorRoot = null;
let _editingId = null;
const _dragState = { id: null, overId: null };

function el(tag, props = {}, children = []) {
    const e = document.createElement(tag);
    for (const k of Object.keys(props)) {
        if (k === 'class') e.className = props[k];
        else if (k === 'dataset') Object.assign(e.dataset, props[k]);
        else if (k === 'attrs') for (const a of Object.keys(props.attrs)) e.setAttribute(a, props.attrs[a]);
        else if (k.startsWith('on') && typeof props[k] === 'function') e.addEventListener(k.slice(2).toLowerCase(), props[k]);
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

function newBlank() {
    return {
        id: stableId('new'),
        name: '',
        description: '',
        content: '',
        cursor_position: 0,
        insert_position: 'as_is',
        group: '',
        enabled: true,
        order: (getSettings().buttons || []).length,
    };
}

function buildToolbar() {
    const tb = el('div', { class: 'aid--editor-toolbar' });
    const add = el('button', { type: 'button', class: 'aid--primary-btn', dataset: { aidEditorAction: 'add' } });
    add.append(el('i', { class: 'fa-solid fa-plus' }), el('span', { i18n: 'aid.settings.buttons_add' }, t('aid.settings.buttons_add')));
    const count = el('span', { class: 'aid--count', dataset: { aidCount: '' } });
    const hint = el('span', { class: 'aid--hint', i18n: 'aid.settings.buttons_drag_hint' }, t('aid.settings.buttons_drag_hint'));
    tb.append(add, count, hint);
    return tb;
}

function buildRow(btn) {
    const row = el('div', { class: 'aid--erow', dataset: { aidRowId: btn.id }, attrs: { tabindex: '0' } });
    row.draggable = true;

    const handle = el('span', {
        class: 'aid--drag-handle',
        attrs: { 'aria-label': t('aid.a11y.drag_handle'), title: t('aid.a11y.drag_handle'), 'data-aid-drag-handle': '' },
    });
    handle.appendChild(el('i', { class: 'fa-solid fa-grip-vertical', attrs: { 'aria-hidden': 'true' } }));
    row.appendChild(handle);

    const sw = el('label', { class: 'aid--erow-toggle' });
    const inp = el('input', { type: 'checkbox', dataset: { aidRowEnabled: '' } });
    inp.checked = btn.enabled !== false;
    const trk = el('span', { class: 'aid--switch' }, [
        el('span', { class: 'aid--switch-track' }, [el('span', { class: 'aid--switch-thumb' })]),
    ]);
    sw.append(inp, trk);
    row.appendChild(sw);

    // Face / description / group rendered via textContent only (XSS-safe).
    const meta = el('div', { class: 'aid--erow-meta' });
    meta.appendChild(el('span', { class: 'aid--erow-face' }, btn.name));
    if (btn.description) meta.appendChild(el('span', { class: 'aid--erow-desc' }, btn.description));
    if (btn.group) meta.appendChild(el('span', { class: 'aid--erow-group' }, btn.group));
    row.appendChild(meta);

    const actions = el('div', { class: 'aid--erow-actions' });
    const btnEdit = el('button', { type: 'button', class: 'aid--icon-btn', dataset: { aidRowAction: 'edit' }, attrs: { title: t('aid.editor.action_edit'), 'aria-label': t('aid.editor.action_edit') } });
    btnEdit.appendChild(el('i', { class: 'fa-solid fa-pen' }));
    const btnDup = el('button', { type: 'button', class: 'aid--icon-btn', dataset: { aidRowAction: 'duplicate' }, attrs: { title: t('aid.editor.action_duplicate'), 'aria-label': t('aid.editor.action_duplicate') } });
    btnDup.appendChild(el('i', { class: 'fa-solid fa-clone' }));
    const btnDel = el('button', { type: 'button', class: 'aid--icon-btn aid--icon-btn-danger', dataset: { aidRowAction: 'delete' }, attrs: { title: t('aid.editor.action_delete'), 'aria-label': t('aid.editor.action_delete') } });
    btnDel.appendChild(el('i', { class: 'fa-solid fa-trash' }));
    actions.append(btnEdit, btnDup, btnDel);
    row.appendChild(actions);

    return row;
}

function buildEditForm(btn) {
    const form = el('form', { class: 'aid--edit-form', dataset: { aidEditFormId: btn.id } });
    form.addEventListener('submit', (e) => e.preventDefault());

    const field = (labelKey, control) => {
        const lab = el('label', { class: 'aid--field' });
        lab.appendChild(el('span', { class: 'aid--field-label', i18n: labelKey }, t(labelKey)));
        lab.appendChild(control);
        return lab;
    };

    const name = el('input', { type: 'text', class: 'aid--input', value: btn.name, attrs: { maxlength: '16' }, dataset: { aidEditField: 'name' } });
    const desc = el('input', { type: 'text', class: 'aid--input', value: btn.description, attrs: { maxlength: '64' }, dataset: { aidEditField: 'description' } });
    const content = el('textarea', { class: 'aid--textarea', attrs: { rows: '3', maxlength: '4096' }, dataset: { aidEditField: 'content' } });
    content.value = btn.content;
    const group = el('input', { type: 'text', class: 'aid--input', value: btn.group, attrs: { maxlength: '32', placeholder: t('aid.editor.field_group_placeholder'), list: 'aid--group-list' }, dataset: { aidEditField: 'group' } });
    const cursor = el('input', { type: 'number', class: 'aid--input aid--input-num', value: String(btn.cursor_position | 0), attrs: { min: '0', step: '1' }, dataset: { aidEditField: 'cursor_position' } });

    const insWrap = el('div', { class: 'aid--seg', attrs: { role: 'radiogroup' } });
    const mkSeg = (value, labelKey, icon) => {
        const b = el('button', { type: 'button', class: 'aid--seg-btn', dataset: { aidEditSeg: value } });
        b.append(el('i', { class: `fa-solid ${icon}` }), el('span', { i18n: labelKey }, t(labelKey)));
        if (btn.insert_position === value) b.classList.add('aid--seg-btn-active');
        return b;
    };
    insWrap.append(
        mkSeg('as_is',   'aid.editor.insert_as_is',   'fa-i-cursor'),
        mkSeg('prepend', 'aid.editor.insert_prepend', 'fa-arrow-up'),
        mkSeg('append',  'aid.editor.insert_append',  'fa-arrow-down'),
    );

    // Live cursor-position preview: shows where the caret will land on insert.
    const preview = el('div', { class: 'aid--preview' });
    const updatePreview = () => {
        const c = content.value;
        const pos = Math.max(0, Math.min(c.length, Number(cursor.value) | 0));
        preview.replaceChildren();
        preview.append(
            el('span', { class: 'aid--preview-label', i18n: 'aid.editor.preview_label' }, t('aid.editor.preview_label')),
            document.createTextNode(': '),
            el('code', { class: 'aid--preview-code' }, [
                document.createTextNode(c.slice(0, pos)),
                el('span', { class: 'aid--preview-caret' }, '▏'),
                document.createTextNode(c.slice(pos)),
            ]),
        );
    };
    content.addEventListener('input', updatePreview);
    cursor.addEventListener('input', updatePreview);

    const msgs = el('div', { class: 'aid--edit-msgs', attrs: { 'aria-live': 'polite' } });

    const actions = el('div', { class: 'aid--edit-actions' });
    const save = el('button', { type: 'button', class: 'aid--primary-btn', dataset: { aidEditAction: 'save' } });
    save.append(el('i', { class: 'fa-solid fa-check' }), el('span', { i18n: 'aid.editor.action_save' }, t('aid.editor.action_save')));
    const cancel = el('button', { type: 'button', class: 'aid--ghost-btn', dataset: { aidEditAction: 'cancel' } });
    cancel.append(el('i', { class: 'fa-solid fa-xmark' }), el('span', { i18n: 'aid.editor.action_cancel' }, t('aid.editor.action_cancel')));
    actions.append(save, cancel);

    form.append(
        field('aid.editor.field_name', name),
        field('aid.editor.field_description', desc),
        field('aid.editor.field_content', content),
        field('aid.editor.field_group', group),
        el('div', { class: 'aid--field-row' }, [
            field('aid.editor.field_cursor', cursor),
            field('aid.editor.field_insert_position', insWrap),
        ]),
        preview,
        msgs,
        actions,
    );

    updatePreview();
    return form;
}

function render() {
    if (!_editorRoot) return;
    const settings = getSettings();
    const buttons = (settings.buttons || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    _editorRoot.replaceChildren();

    // Datalist powers the group field's autocomplete.
    const groupsSet = new Set();
    for (const b of buttons) if (b.group) groupsSet.add(b.group);
    const dl = el('datalist', { id: 'aid--group-list' });
    for (const g of groupsSet) dl.appendChild(el('option', { value: g }));
    _editorRoot.appendChild(dl);

    _editorRoot.appendChild(buildToolbar());

    if (buttons.length === 0) {
        _editorRoot.appendChild(el('div', { class: 'aid--empty', i18n: 'aid.settings.buttons_empty' }, t('aid.settings.buttons_empty')));
    } else {
        const list = el('div', { class: 'aid--erow-list' });
        for (const b of buttons) {
            list.appendChild(buildRow(b));
            if (_editingId === b.id) list.appendChild(buildEditForm(b));
        }
        _editorRoot.appendChild(list);
    }
    if (_editingId === '__new__') {
        _editorRoot.appendChild(buildEditForm(newBlank()));
    }

    const cnt = _editorRoot.querySelector('[data-aid-count]');
    if (cnt) cnt.textContent = t('aid.settings.buttons_count', { count: buttons.length });

    // Autofocus the first editable field of any visible edit form, and scroll
    // the form into view. Helpful both for "Add" and "Edit" actions.
    if (_editingId) {
        requestAnimationFrame(() => {
            const form = _editorRoot.querySelector('.aid--edit-form');
            if (!form) return;
            try { form.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch { /* ignore */ }
            const firstInput = form.querySelector('input, textarea, select');
            if (firstInput && typeof firstInput.focus === 'function') {
                firstInput.focus();
                if (firstInput.select && firstInput.value) firstInput.select();
            }
        });
    }
}

function findRowEl(target) {
    return target instanceof Element ? target.closest('[data-aid-row-id]') : null;
}

function commitEdit(formEl) {
    const id = formEl.getAttribute('data-aid-edit-form-id');
    const fields = {};
    formEl.querySelectorAll('[data-aid-edit-field]').forEach(node => {
        fields[node.getAttribute('data-aid-edit-field')] = node.value;
    });
    const segActive = formEl.querySelector('[data-aid-edit-seg].aid--seg-btn-active');
    fields.insert_position = segActive?.getAttribute('data-aid-edit-seg') || 'as_is';
    fields.cursor_position = Number(fields.cursor_position) || 0;

    const settings = getSettings();
    const isNew = id === '__new__' || !((settings.buttons || []).some(b => b.id === id));
    const existing = (settings.buttons || []).find(b => b.id === id);

    const candidate = {
        ...fields,
        enabled: existing ? existing.enabled !== false : true,
        order: existing ? (existing.order ?? 0) : (settings.buttons || []).length,
    };

    const v = validateButton(candidate, candidate.order);
    const msgs = formEl.querySelector('.aid--edit-msgs');
    if (!v.ok) {
        if (msgs) {
            msgs.replaceChildren();
            for (const e of v.errors) msgs.appendChild(el('div', { class: 'aid--err' }, e));
        }
        return;
    }

    let nextButtons;
    if (isNew) {
        nextButtons = (settings.buttons || []).concat([{ ...v.button, id: stableId(v.button.name + ':new') }]);
    } else {
        nextButtons = (settings.buttons || []).map(b => b.id === id ? { ...v.button, id, enabled: b.enabled !== false } : b);
    }
    saveSettings({ buttons: nextButtons });
    _editingId = null;
    render();
}

function cancelEdit() {
    _editingId = null;
    render();
}

function attachHandlers() {
    if (!_editorRoot) return;

    // Clear validation messages as soon as the user types in any edit field.
    // Avoids stale errors lingering after a fix.
    _editorRoot.addEventListener('input', (ev) => {
        const node = ev.target;
        if (!(node instanceof HTMLElement)) return;
        if (!node.hasAttribute('data-aid-edit-field')) return;
        const form = node.closest('[data-aid-edit-form-id]');
        const msgs = form?.querySelector('.aid--edit-msgs');
        if (msgs && msgs.firstChild) msgs.replaceChildren();
    });

    // Keyboard reorder: Alt+ArrowUp / Alt+ArrowDown on a focused row.
    // Accessible alternative to drag-and-drop (which is mouse/touch only).
    _editorRoot.addEventListener('keydown', (ev) => {
        if (!ev.altKey) return;
        if (ev.key !== 'ArrowUp' && ev.key !== 'ArrowDown') return;
        const target = ev.target instanceof Element ? ev.target : null;
        const rowEl = target?.closest('[data-aid-row-id]');
        if (!rowEl) return;
        ev.preventDefault();
        const id = rowEl.getAttribute('data-aid-row-id');
        const settings = getSettings();
        const list = (settings.buttons || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        const idx = list.findIndex(b => b.id === id);
        if (idx < 0) return;
        const dir = ev.key === 'ArrowUp' ? -1 : 1;
        const swapWith = idx + dir;
        if (swapWith < 0 || swapWith >= list.length) return;
        const [moved] = list.splice(idx, 1);
        list.splice(swapWith, 0, moved);
        saveSettings({ buttons: list.map((b, i) => ({ ...b, order: i })) });
        // Restore focus to the moved row after re-render.
        requestAnimationFrame(() => {
            const restored = _editorRoot.querySelector(`[data-aid-row-id="${id}"]`);
            if (restored && typeof restored.focus === 'function') restored.focus();
        });
    });

    _editorRoot.addEventListener('click', async (ev) => {
        const target = ev.target instanceof Element ? ev.target : null;
        if (!target) return;

        const toolAct = target.closest('[data-aid-editor-action]');
        if (toolAct?.getAttribute('data-aid-editor-action') === 'add') {
            ev.preventDefault();
            _editingId = '__new__';
            render();
            return;
        }

        const editAct = target.closest('[data-aid-edit-action]');
        if (editAct) {
            ev.preventDefault();
            const form = editAct.closest('[data-aid-edit-form-id]');
            if (!form) return;
            if (editAct.getAttribute('data-aid-edit-action') === 'save') commitEdit(form);
            else cancelEdit();
            return;
        }

        const seg = target.closest('[data-aid-edit-seg]');
        if (seg) {
            ev.preventDefault();
            const form = seg.closest('[data-aid-edit-form-id]');
            if (!form) return;
            form.querySelectorAll('[data-aid-edit-seg]').forEach(n => {
                n.classList.toggle('aid--seg-btn-active', n === seg);
                n.setAttribute('aria-checked', String(n === seg));
            });
            return;
        }

        const rowAct = target.closest('[data-aid-row-action]');
        if (rowAct) {
            ev.preventDefault();
            const rowEl = findRowEl(rowAct);
            if (!rowEl) return;
            const id = rowEl.getAttribute('data-aid-row-id');
            const action = rowAct.getAttribute('data-aid-row-action');
            const settings = getSettings();
            const btn = (settings.buttons || []).find(b => b.id === id);
            if (!btn) return;

            if (action === 'edit') {
                _editingId = (_editingId === id) ? null : id;
                render();
            } else if (action === 'duplicate') {
                const dup = { ...btn, id: stableId(btn.name + ':dup') };
                const list = (settings.buttons || []).slice();
                const idx = list.findIndex(b => b.id === id);
                list.splice(idx + 1, 0, dup);
                saveSettings({ buttons: list.map((b, i) => ({ ...b, order: i })) });
            } else if (action === 'delete') {
                if (!globalThis.confirm?.(t('aid.editor.delete_confirm', { name: btn.name }))) return;
                const next = (settings.buttons || []).filter(b => b.id !== id).map((b, i) => ({ ...b, order: i }));
                saveSettings({ buttons: next });
            }
            return;
        }
    });

    _editorRoot.addEventListener('change', (ev) => {
        const node = ev.target;
        if (!(node instanceof HTMLInputElement)) return;
        if (!node.hasAttribute('data-aid-row-enabled')) return;
        const rowEl = findRowEl(node);
        if (!rowEl) return;
        const id = rowEl.getAttribute('data-aid-row-id');
        const settings = getSettings();
        const next = (settings.buttons || []).map(b => b.id === id ? { ...b, enabled: node.checked } : b);
        saveSettings({ buttons: next });
    });

    // HTML5 drag-and-drop (desktop / mouse).
    _editorRoot.addEventListener('dragstart', (ev) => {
        const rowEl = findRowEl(ev.target);
        if (!rowEl) return;
        _dragState.id = rowEl.getAttribute('data-aid-row-id');
        rowEl.classList.add('aid--erow-dragging');
        try { ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', _dragState.id); } catch { /* ignore */ }
    });
    _editorRoot.addEventListener('dragend', (ev) => {
        const rowEl = findRowEl(ev.target);
        rowEl?.classList.remove('aid--erow-dragging');
        _editorRoot.querySelectorAll('.aid--erow-over').forEach(n => n.classList.remove('aid--erow-over'));
        _dragState.id = null;
        _dragState.overId = null;
    });
    _editorRoot.addEventListener('dragover', (ev) => {
        const rowEl = findRowEl(ev.target);
        if (!rowEl || !_dragState.id) return;
        ev.preventDefault();
        if (_dragState.overId !== rowEl.getAttribute('data-aid-row-id')) {
            _editorRoot.querySelectorAll('.aid--erow-over').forEach(n => n.classList.remove('aid--erow-over'));
            rowEl.classList.add('aid--erow-over');
            _dragState.overId = rowEl.getAttribute('data-aid-row-id');
        }
    });
    _editorRoot.addEventListener('drop', (ev) => {
        const rowEl = findRowEl(ev.target);
        if (!rowEl || !_dragState.id) return;
        ev.preventDefault();
        const overId = rowEl.getAttribute('data-aid-row-id');
        if (overId === _dragState.id) return;
        const settings = getSettings();
        const list = (settings.buttons || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        const fromIdx = list.findIndex(b => b.id === _dragState.id);
        const toIdx = list.findIndex(b => b.id === overId);
        if (fromIdx < 0 || toIdx < 0) return;
        const [moved] = list.splice(fromIdx, 1);
        list.splice(toIdx, 0, moved);
        saveSettings({ buttons: list.map((b, i) => ({ ...b, order: i })) });
    });

    // Touch / pen reorder via Pointer Events (HTML5 DnD doesn't fire on touch).
    // Long-press the drag handle (~250 ms) to start, then pointermove highlights
    // the row under the finger, pointerup commits the swap.
    let touchDrag = null;
    _editorRoot.addEventListener('pointerdown', (ev) => {
        if (ev.pointerType === 'mouse') return;
        const handle = ev.target instanceof Element ? ev.target.closest('[data-aid-drag-handle]') : null;
        if (!handle) return;
        const rowEl = findRowEl(handle);
        if (!rowEl) return;
        ev.preventDefault();
        const id = rowEl.getAttribute('data-aid-row-id');
        touchDrag = {
            id,
            rowEl,
            startTimer: setTimeout(() => {
                if (!touchDrag) return;
                touchDrag.active = true;
                rowEl.classList.add('aid--erow-dragging');
                try { handle.setPointerCapture?.(ev.pointerId); } catch { /* ignore */ }
            }, 250),
            active: false,
            pointerId: ev.pointerId,
        };
    });
    _editorRoot.addEventListener('pointermove', (ev) => {
        if (!touchDrag?.active) return;
        ev.preventDefault();
        const targetEl = document.elementFromPoint(ev.clientX, ev.clientY);
        const overRow = targetEl ? targetEl.closest?.('[data-aid-row-id]') : null;
        _editorRoot.querySelectorAll('.aid--erow-over').forEach(n => n.classList.remove('aid--erow-over'));
        if (overRow && overRow.getAttribute('data-aid-row-id') !== touchDrag.id) {
            overRow.classList.add('aid--erow-over');
            touchDrag.overId = overRow.getAttribute('data-aid-row-id');
        } else {
            touchDrag.overId = null;
        }
    });
    const endTouchDrag = () => {
        if (!touchDrag) return;
        clearTimeout(touchDrag.startTimer);
        if (touchDrag.active && touchDrag.overId && touchDrag.overId !== touchDrag.id) {
            const settings = getSettings();
            const list = (settings.buttons || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
            const fromIdx = list.findIndex(b => b.id === touchDrag.id);
            const toIdx = list.findIndex(b => b.id === touchDrag.overId);
            if (fromIdx >= 0 && toIdx >= 0) {
                const [moved] = list.splice(fromIdx, 1);
                list.splice(toIdx, 0, moved);
                saveSettings({ buttons: list.map((b, i) => ({ ...b, order: i })) });
            }
        }
        touchDrag.rowEl?.classList.remove('aid--erow-dragging');
        _editorRoot.querySelectorAll('.aid--erow-over').forEach(n => n.classList.remove('aid--erow-over'));
        touchDrag = null;
    };
    _editorRoot.addEventListener('pointerup', endTouchDrag);
    _editorRoot.addEventListener('pointercancel', endTouchDrag);
}

export function mountButtonsEditor(host) {
    _editorRoot = host;
    render();
    attachHandlers();

    onSettingsChange(() => render());
    onLocaleChange(() => render());
}
