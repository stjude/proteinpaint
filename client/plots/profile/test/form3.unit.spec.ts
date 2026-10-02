import tape from 'tape'
import type { TemplateMapping } from '#types'
import { assertTemplateMapping, buildTemplateView } from '../form3.js'

/*
Tests for the pure pieces of the Templates 3 (Template Mapping) view:

  • buildTemplateView — groups domains under their module in mapping order, each carrying its
    declared template (key, meta) pairs resolved through mapping.templates (NEW status included).
    Which of these actually render is decided later against the DB (data-backed gating), so the
    pure builder keeps every declared template.
  • assertTemplateMapping — a runtime guard that throws a clear error on structural violations
    (invalid chart, unknown template key, unlisted form code, bad color) and passes a valid mapping.
*/

function validMapping(): TemplateMapping {
	return {
		dashboard: 'Test',
		legend: {
			forms: {
				SC: { label: 'Site Coordinator', dataType: 'Objective' },
				PHO: { label: 'PHO staff', dataType: 'Subjective' }
			}
		},
		templates: {
			policyEnablers: { label: 'Policy Enablers', chart: 'heatmap', aggregate: true },
			yesNo: { label: 'Yes/No', chart: 'stacked_bar' },
			impressions: { label: 'Impressions', chart: 'thermometer' },
			timeToDiagnostic: { label: 'Time to Diagnostic', chart: 'stacked_bar', status: 'NEW' }
		},
		modules: [
			{
				name: 'National Context',
				color: '#2D75BC',
				textColor: '#FFFFFF',
				domains: [
					{ domain: 'Care Access', forms: ['SC'], templates: { policyEnablers: 1, yesNo: 1 } },
					{ domain: 'Pathology', forms: ['PHO'], templates: { timeToDiagnostic: 2 } },
					{ domain: 'Planning', forms: ['SC'], templates: { impressions: 1 } }
				]
			},
			{
				name: 'Diagnostics',
				color: '#ED6329',
				textColor: '#000000',
				domains: [{ domain: 'Planning', forms: ['SC'], templates: { impressions: 1 } }]
			}
		]
	}
}

tape('buildTemplateView - groups domains under modules in order, resolving template meta', test => {
	const view = buildTemplateView(validMapping())
	test.equal(view.length, 2, 'two modules in mapping order')
	test.equal(view[0].name, 'National Context', 'module order preserved')
	test.deepEqual(
		view[0].domains.map(d => d.domain),
		['Care Access', 'Pathology', 'Planning'],
		'domain order preserved'
	)
	const careAccess = view[0].domains[0]
	test.deepEqual(
		careAccess.templates.map(t => t.key),
		['policyEnablers', 'yesNo'],
		'domain carries every declared template key, in order'
	)
	test.equal(careAccess.templates[0].meta.label, 'Policy Enablers', 'template meta resolved from the dictionary')
	test.end()
})

tape('buildTemplateView - carries NEW status onto the template meta', test => {
	const view = buildTemplateView(validMapping())
	const pathology = view[0].domains[1]
	test.equal(pathology.templates[0].meta.status, 'NEW', 'NEW status carried onto the template meta')
	test.end()
})

tape('assertTemplateMapping - accepts a valid mapping', test => {
	test.doesNotThrow(() => assertTemplateMapping(validMapping()), 'valid mapping passes')
	test.end()
})

tape('assertTemplateMapping - throws a clear error on each structural violation', test => {
	const badChart = validMapping()
	;(badChart.templates.yesNo as any).chart = 'pie'
	test.throws(() => assertTemplateMapping(badChart), /invalid chart/, 'invalid chart type')

	const unknownKey = validMapping()
	unknownKey.modules[0].domains[0].templates = { nope: 1 }
	test.throws(() => assertTemplateMapping(unknownKey), /unknown template/, 'domain references unknown template')

	const badForm = validMapping()
	badForm.modules[0].domains[0].forms = ['ZZ']
	test.throws(() => assertTemplateMapping(badForm), /not in legend\.forms/, 'form code not in legend')

	const badColor = validMapping()
	badColor.modules[0].color = 'blue'
	test.throws(() => assertTemplateMapping(badColor), /invalid color/, 'non-hex module color')

	test.throws(() => assertTemplateMapping(null), /invalid/, 'null is rejected')
	test.end()
})
