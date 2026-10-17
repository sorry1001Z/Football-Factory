/* global wp, ff90QAPanel */
(function () {
    'use strict';
    var el = wp.element.createElement;
    function Panel() {
        var state = wp.data.useSelect(function (select) { var e = select('core/editor'); return { id: e.getCurrentPostId(), meta: e.getEditedPostAttribute('meta') || {}, saving: e.isSavingPost() }; }, []);
        var result = wp.element.useState(null), report = result[0], setReport = result[1];
        var sources = state.meta._ff90_qa_sources || [];
        wp.element.useEffect(function () {
            var active = true;
            if (!state.saving) { wp.apiFetch({path: '/ff90-qa/v1/posts/' + state.id}).then(function (r) { if (active) setReport(r); }).catch(function () { if (active) setReport(null); }); }
            return function () { active = false; };
        }, [state.id, state.saving]);
        return el(wp.editor.PluginDocumentSettingPanel, {name: 'ff90-content-qa', title: 'Content QA'},
            el(wp.components.TextareaControl, {label: 'Source URLs (one per line)', value: sources.join('\n'), onChange: function (value) { var next = value.split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean).slice(0, 50); wp.data.dispatch('core/editor').editPost({meta: Object.assign({}, state.meta, {_ff90_qa_sources: next})}); }}),
            el('p', null, 'Save as draft before independent review. Source declarations do not verify facts automatically.'),
            report ? el('p', {'aria-live': 'polite'}, 'Saved version: ' + (report.errors.join(', ') || report.fact_check)) : null,
            ff90QAPanel.canReview ? el('p', null, el('a', {href: ff90QAPanel.qaUrl}, 'Review saved facts and rights')) : el('p', null, 'A different editor must review this article.'),
            ff90QAPanel.canReview && ff90QAPanel.approvalUrl ? el('p', null, el('a', {href: ff90QAPanel.approvalUrl}, 'Approve / reject saved article')) : null);
    }
    wp.plugins.registerPlugin('ff90-content-qa', {render: Panel});
}());
