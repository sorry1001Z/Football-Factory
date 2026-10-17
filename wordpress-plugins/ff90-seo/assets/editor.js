/* global wp */
(function () {
    'use strict';
    var el = wp.element.createElement;
    var Panel = wp.editor.PluginDocumentSettingPanel;
    function Sidebar() {
        var state = wp.data.useSelect(function (select) {
            var editor = select('core/editor');
            return { id: editor.getCurrentPostId(), title: editor.getEditedPostAttribute('title') || '', content: editor.getEditedPostContent() || '', meta: editor.getEditedPostAttribute('meta') || {} };
        }, []);
        var meta = state.meta._ff90_seo || { description: '', canonical: '', noindex: false };
        var result = wp.element.useState(null), report = result[0], setReport = result[1];
        var errorState = wp.element.useState(''), error = errorState[0], setError = errorState[1];
        function update(key, value) {
            var next = Object.assign({}, meta); next[key] = value;
            wp.data.dispatch('core/editor').editPost({ meta: Object.assign({}, state.meta, { _ff90_seo: next }) });
        }
        wp.element.useEffect(function () {
            var active = true;
            var timer = setTimeout(function () {
                wp.apiFetch({ path: '/ff90-seo/v1/analyze/' + state.id, method: 'POST', data: { title: state.title, content: state.content, description: meta.description || '', canonical: meta.canonical || '' } }).then(function (r) { if (active) { setReport(r); setError(''); } }).catch(function (e) { if (active) { setReport(null); setError(e.message || 'Analysis unavailable'); } });
            }, 800);
            return function () { active = false; clearTimeout(timer); };
        }, [state.id, state.title, state.content, meta.description, meta.canonical]);
        return el(Panel, { name: 'ff90-seo-panel', title: 'FF90 SEO', className: 'ff90-seo-panel' },
            el(wp.components.TextareaControl, { label: 'Meta description', value: meta.description || '', onChange: function (v) { update('description', v); } }),
            el(wp.components.TextControl, { label: 'Canonical override (optional)', value: meta.canonical || '', onChange: function (v) { update('canonical', v); } }),
            el(wp.components.CheckboxControl, { label: 'Noindex', checked: !!meta.noindex, onChange: function (v) { update('noindex', v); } }),
            error ? el(wp.components.Notice, { status: 'error', isDismissible: false }, error) : null,
            report ? el('div', { 'aria-live': 'polite' }, el('p', null, 'Score: ' + report.score + ' / 100'), el('p', null, 'Blocking: ' + (report.blocking.join(', ') || 'none')), el('p', null, 'Warnings: ' + (report.warnings.join(', ') || 'none')), el('p', null, report.signals.heuristic ? 'Thai term count is an estimate.' : 'Scores are advisory.'), el('ul', null, report.links.map(function (link) { return el('li', { key: link.taxonomy + ':' + link.term_id }, el('a', { href: link.url, target: '_blank', rel: 'noopener' }, link.label)); })), el('p', null, 'GSC: not connected. Fact checking: not performed.')) : el('p', null, 'Analyzing locally…'));
    }
    wp.plugins.registerPlugin('ff90-seo', { render: Sidebar });
}());
