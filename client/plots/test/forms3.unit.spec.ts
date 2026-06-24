import tape from 'tape'
import { buildTemplates3Model } from '../profile/forms3.ts'
import { subtypesToChartTypes } from '../profile/formsChartTypes.ts'

/*
Tests the two pure pieces behind the DB-driven Templates 3 matrix/list picker:

subtypesToChartTypes() — maps the child subtypes present under a domain to chart-type names:
	- single subtype → one name; both subtypes → both names in canonical options order
	- order independent of input; unknown/empty subtype set → []

buildTemplates3Model() — groups domains under their module using a derived chartTypesByDomain map:
	- groups by the module segment of the id, preserving first-seen order; derives domain display name
	- per-domain chart-type buttons come straight from the map
	- a cross-domain chart is attached under every domain it spans
	- empty config yields no groups
*/

const OPTIONS = [
	{ name: 'Yes/No Barchart', subtype: 'YN Graph' },
	{ name: 'Likert Scale', subtype: 'Likert Graph' }
]

tape('subtypesToChartTypes - single subtype maps to its name', test => {
	test.deepEqual(subtypesToChartTypes(new Set(['YN Graph']), OPTIONS), ['Yes/No Barchart'])
	test.deepEqual(subtypesToChartTypes(new Set(['Likert Graph']), OPTIONS), ['Likert Scale'])
	test.end()
})

tape('subtypesToChartTypes - both subtypes returned in canonical order regardless of input', test => {
	// input Set built Likert-first, but output follows OPTIONS order (Yes/No first)
	test.deepEqual(subtypesToChartTypes(new Set(['Likert Graph', 'YN Graph']), OPTIONS), [
		'Yes/No Barchart',
		'Likert Scale'
	])
	test.end()
})

tape('subtypesToChartTypes - unknown or empty subtypes yield empty', test => {
	test.deepEqual(subtypesToChartTypes(new Set(), OPTIONS), [], 'empty set => []')
	test.deepEqual(subtypesToChartTypes(new Set(['Bogus Graph']), OPTIONS), [], 'unmatched subtype => []')
	test.end()
})

tape('buildTemplates3Model - groups by module, derives names, preserves order', test => {
	const cfg = {
		options: OPTIONS,
		domains: [
			{ id: 'FContext__National Context__Care Access and Utilization' },
			{ id: 'FDiagnostics__Diagnostics__General Laboratory' }
		]
	}
	const types = new Map([
		['FContext__National Context__Care Access and Utilization', ['Yes/No Barchart']],
		['FDiagnostics__Diagnostics__General Laboratory', ['Likert Scale']]
	])
	const groups = buildTemplates3Model(cfg, types)
	test.deepEqual(
		groups.map(g => g.module),
		['National Context', 'Diagnostics'],
		'one group per module in first-seen order'
	)
	test.deepEqual(
		groups[0].domains.map(d => d.name),
		['Care Access and Utilization'],
		'domain display name is the third id segment'
	)
	test.deepEqual(groups[0].domains[0].plotTypes, ['Yes/No Barchart'], 'chart types come from the derived map')
	test.end()
})

tape('buildTemplates3Model - multi chart-type domain carries both from the map', test => {
	const cfg = { options: OPTIONS, domains: [{ id: 'FContext__National Context__Care Access and Utilization' }] }
	const types = new Map([
		['FContext__National Context__Care Access and Utilization', ['Yes/No Barchart', 'Likert Scale']]
	])
	const groups = buildTemplates3Model(cfg, types)
	test.deepEqual(
		groups[0].domains[0].plotTypes,
		['Yes/No Barchart', 'Likert Scale'],
		'both derived chart types surface'
	)
	test.end()
})

tape('buildTemplates3Model - cross-domain chart attached under each spanned domain', test => {
	const heatmap = { label: 'Heat Map', chartType: 'matrix', domains: ['FContext__A__Alpha', 'FContext__B__Beta'] }
	const cfg = { options: OPTIONS, domains: [{ id: 'FContext__A__Alpha' }], crossDomainCharts: [heatmap] }
	const types = new Map([['FContext__A__Alpha', ['Likert Scale']]])
	const groups = buildTemplates3Model(cfg, types)
	const alpha = groups.find(g => g.module == 'A')!.domains[0]
	const beta = groups.find(g => g.module == 'B')!.domains[0]
	test.equal(alpha.cross[0]?.label, 'Heat Map', 'heatmap attached to a forms domain it spans')
	test.equal(beta.name, 'Beta', 'spanned domain with no forms charts is created from the id')
	test.equal(beta.cross[0]?.label, 'Heat Map', 'heatmap also attached to the cross-only domain')
	test.deepEqual(beta.plotTypes, [], 'cross-only domain has no forms chart-type buttons')
	test.end()
})

tape('buildTemplates3Model - empty config yields no groups', test => {
	test.deepEqual(buildTemplates3Model({}, new Map()), [], 'no domains and no cross-domain charts => empty')
	test.end()
})
