import tape from 'tape'
import { select } from 'd3-selection'
import type { TemplateMapping } from '#types'
import { assertTemplateMapping, buildTemplateView, makeChartBtnMenu } from '../form3.js'

/*
Tests for the pure pieces of the Templates 3 (Template Mapping) view:

  • buildTemplateView — groups domains under their module in mapping order, each carrying its
    declared template (key, meta) pairs resolved through mapping.templates (NEW status included).
    Which of these actually render is decided later against the DB (data-backed gating), so the
    pure builder keeps every declared template.
  • assertTemplateMapping — a runtime guard that throws a clear error on structural violations
    (invalid chart, unknown template key, unlisted form code, bad color) and passes a valid mapping.
  • makeChartBtnMenu — against a fake termdb: the search hides empty module headers, and mapping
    names that do not resolve are warned about, apart from rows hidden for lacking data.
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

/*
A fake chartsInstance over a small termdb: root → component FContext → modules NC and DX.
Only NC's "Care Access" has a Yes/No question; each module has an __Impression domain.
Unmodeled term ids throw, so a change in what makeChartBtnMenu queries surfaces here.
*/
function fakeChartsInstance(mapping: TemplateMapping) {
	const childrenById: { [id: string]: { id: string; name: string; isleaf?: boolean }[] } = {
		FContext: [
			{ id: 'NC', name: 'National Context' },
			{ id: 'DX', name: 'Diagnostics' }
		],
		NC: [
			{ id: 'NC__Care Access', name: 'Care Access' },
			{ id: 'NC__Impression', name: 'Planning' }
		],
		DX: [{ id: 'DX__Impression', name: 'Planning' }]
	}
	const termdbConfig = {
		selectCohort: { values: [{ keys: ['full'] }] },
		plotConfigByCohort: {
			full: {
				template3: mapping,
				profileForms: { options: [{ name: 'Yes/No Barchart', subtype: 'YN Graph', templateKey: 'yesNo' }] }
			}
		}
	}
	const vocabApi = {
		termdbConfig,
		getTermChildren: async (term: { id?: string; __tree_isroot?: boolean }) => {
			if (term.__tree_isroot) return { lst: [{ id: 'FContext', name: 'Context' }] }
			const lst = childrenById[term.id!]
			if (!lst) throw new Error(`unmodeled getTermChildren(${term.id})`)
			return { lst }
		},
		getMultivalueTWs: async ({ parent_id }: { parent_id: string }) => {
			if (parent_id == 'NC__Care Access') return [{ term: { subtype: 'YN Graph' } }]
			throw new Error(`unmodeled getMultivalueTWs(${parent_id})`)
		}
	}
	return {
		app: { vocabApi, dispatch: (_action: unknown) => {} },
		state: { activeCohort: 0, termdbConfig },
		dom: { tip: { hide: () => {} } }
	}
}

const shownTexts = (holder: any, sel: string) =>
	holder
		.selectAll(sel)
		.nodes()
		.filter((n: HTMLElement) => n.style.display != 'none')
		.map((n: HTMLElement) => n.textContent)

tape('makeChartBtnMenu - search hides module headers with no matching domain rows', async test => {
	const holder = select('body').append('div')
	await makeChartBtnMenu(holder, fakeChartsInstance(validMapping()))
	const headers = () => shownTexts(holder, '.sjpp-templates3 > div > div[style*="font-weight"]')
	test.deepEqual(headers(), ['National Context', 'Diagnostics'], 'both module headers shown before searching')

	const input = holder.select('input[type="search"]').node() as HTMLInputElement
	input.value = 'diagnostics'
	input.dispatchEvent(new Event('input'))
	test.deepEqual(headers(), ['Diagnostics'], 'header of a module with no matching rows is hidden')

	input.value = ''
	input.dispatchEvent(new Event('input'))
	test.deepEqual(headers(), ['National Context', 'Diagnostics'], 'clearing the search shows every header again')
	if ((test as any)._ok) holder.remove()
	test.end()
})

tape('makeChartBtnMenu - warns about mapping names not found in the termdb', async test => {
	const mapping = validMapping()
	mapping.modules[0].domains[0].domain = 'Care Acess' // misspelled, has a forms template
	mapping.modules.push({
		name: 'Ghost Module',
		color: '#000000',
		textColor: '#FFFFFF',
		domains: [{ domain: 'Planning', forms: ['SC'], templates: { impressions: 1 } }]
	})
	const holder = select('body').append('div')
	const warnings: string[] = []
	const consoleWarn = console.warn
	console.warn = (msg: string) => warnings.push(msg)
	try {
		await makeChartBtnMenu(holder, fakeChartsInstance(mapping))
	} finally {
		console.warn = consoleWarn
	}
	test.equal(warnings.length, 1, 'one warning')
	test.ok(warnings[0]?.includes('domain "National Context / Care Acess"'), 'names the unresolved domain')
	test.ok(warnings[0]?.includes('module "Ghost Module"'), 'names the unresolved module')
	test.notOk(warnings[0]?.includes('Pathology'), 'a domain hidden only for lacking data is not reported')
	if ((test as any)._ok) holder.remove()
	test.end()
})

tape('makeChartBtnMenu - a failed termdb lookup replaces Loading… with an error message', async test => {
	const chartsInstance = fakeChartsInstance(validMapping())
	chartsInstance.app.vocabApi.getTermChildren = async () => {
		throw new Error('termdb unavailable')
	}
	const holder = select('body').append('div')
	const consoleError = console.error
	console.error = () => {}
	try {
		await makeChartBtnMenu(holder, chartsInstance)
	} finally {
		console.error = consoleError
	}
	test.notOk(holder.text().includes('Loading'), 'the loading indicator is removed')
	test.ok(holder.text().includes('Templates could not be loaded: termdb unavailable'), 'the error is shown')
	if ((test as any)._ok) holder.remove()
	test.end()
})

tape('makeChartBtnMenu - NEW (planned) templates are never rendered as chart links', async test => {
	const mapping = validMapping()
	// yesNo has a matching forms option and impressions a module __Impression domain, so both would
	// render if built; marked NEW, neither may be opened.
	mapping.templates.yesNo.status = 'NEW'
	mapping.templates.impressions.status = 'NEW'
	const chartsInstance = fakeChartsInstance(mapping)
	let subtypeLookups = 0
	chartsInstance.app.vocabApi.getMultivalueTWs = async () => {
		subtypeLookups++
		return []
	}
	const holder = select('body').append('div')
	await makeChartBtnMenu(holder, chartsInstance)
	test.equal(holder.selectAll('.sja_filter_tag_btn').size(), 0, 'no chart link is rendered')
	test.ok(holder.text().includes('No templates are currently available'), 'the empty message is shown')
	test.equal(subtypeLookups, 0, 'no subtype lookup for a planned template')
	if ((test as any)._ok) holder.remove()
	test.end()
})

tape('makeChartBtnMenu - chips are focusable native buttons that open the chart', async test => {
	const chartsInstance = fakeChartsInstance(validMapping())
	const actions: any[] = []
	chartsInstance.app.dispatch = (action: unknown) => {
		actions.push(action)
	}
	const holder = select('body').append('div')
	await makeChartBtnMenu(holder, chartsInstance)

	const chips = holder.selectAll('.sja_filter_tag_btn').nodes() as HTMLElement[]
	test.ok(chips.length > 0, 'chips are rendered')
	test.ok(
		chips.every(c => c instanceof HTMLButtonElement && c.type == 'button'),
		'every chip is a native button, so Tab and Enter/Space work'
	)
	const yesNo = chips.find(c => c.textContent?.startsWith('Yes/No'))!
	yesNo.focus()
	test.equal(document.activeElement, yesNo, 'a chip can take keyboard focus')
	yesNo.click()
	test.deepEqual(
		actions.map(a => [a.type, a.config.chartType, a.config.tw.term.id, a.config.activeTab]),
		[['plot_create', 'profileForms', 'NC__Care Access', 'Yes/No Barchart']],
		'activating a chip opens profileForms on the matching domain and tab'
	)
	if ((test as any)._ok) holder.remove()
	test.end()
})
