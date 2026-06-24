/*
Templates 3 chart-button menu: a Module → Domain → Chart-type matrix/list view.

Unlike Templates 2 (chart-type tabs over a termdb tree), this surfaces every
template-bearing domain grouped under its PrOFILE module, with each available
chart type shown as a labelled button next to the domain. A domain may expose
multiple chart types, and a single visualization may span several domains; both
are first-class here so users can see at a glance what exists and open it in one click.

Config is read on the client from termdbConfig.plotConfigByCohort[cohort].profileForms2:
  - domains[]            forms3 reads only each entry's `id` (the template-bearing domains to surface).
                         The same entries carry `plotTypes` for Templates v1/v2, which forms3 ignores.
  - options[]            { name, subtype }  the subtype → chart-type-name map (profileFormsOptions)
  - crossDomainCharts[]  { label, chartType, domains[], config } charts spanning domains (e.g. heatmaps)

Each domain's chart types are derived from the database via getChartTypesByDomain (the child terms'
subtypes), NOT from the config's plotTypes — so this picker can never drift from the data and a
domain becomes multi-chart-type automatically when its children span two subtypes. (When Templates 3
replaces v1/v2, plotTypes can be dropped from the dataset config.)

Module + domain display names are derived from the domain id, which the build encodes as
  <Component>__<Module>__<Domain>   e.g. 'FContext__National Context__Care Access and Utilization'
so no extra metadata is needed. Module accent color comes from termdbConfig.colorMap[module].

Forms buttons dispatch a profileForms2 plot pre-selected to that chart type (config.activeTab);
cross-domain buttons dispatch the chart type declared in config. Invoked by mass/charts.js
loadChartSpecificMenu via the standard chart-specific menu pattern.
*/

import { getChartTypesByDomain, type FormsOption } from './formsChartTypes'

export type FormsDomain = { id: string }
/*
PLACEHOLDER contract — a chart that spans multiple domains (e.g. a heatmap). Dispatched as-is via
{ chartType, ...config }. No such plot is wired in PrOFILE yet; the dataset's example points at the
generic 'matrix' chart until real heatmap terms/config land. See openCross() below.
*/
export type CrossDomainChart = {
	label: string
	chartType: string
	domains?: string[]
	config?: { [key: string]: unknown }
}
export type Forms2Config = {
	options?: FormsOption[]
	domains?: FormsDomain[]
	crossDomainCharts?: CrossDomainChart[]
}

export type DomainEntry = {
	id: string
	name: string
	plotTypes: string[]
	cross: CrossDomainChart[]
	searchText: string
}
export type ModuleGroup = { module: string; domains: DomainEntry[] }

/*
Pure model builder: group template-bearing domains under their PrOFILE module, preserving
first-seen order from the config. Module/domain display names come from the domain id
(<Component>__<Module>__<Domain>). Each domain's chart-type buttons come from chartTypesByDomain
(derived from the DB by getChartTypesByDomain, already in canonical options order). Cross-domain
charts are attached under each domain they span. Exported separately from the DOM rendering and the
DB fetch so the grouping is unit-testable with a plain map.
*/
export function buildTemplates3Model(cfg: Forms2Config, chartTypesByDomain: Map<string, string[]>): ModuleGroup[] {
	const order: string[] = []
	const byModule = new Map<string, Map<string, DomainEntry>>()

	const ensure = (id: string): DomainEntry => {
		const parts = id.split('__')
		const moduleName = parts[1] || 'Other'
		const domainName = parts.slice(2).join(' / ') || id
		let domains = byModule.get(moduleName)
		if (!domains) {
			domains = new Map<string, DomainEntry>()
			byModule.set(moduleName, domains)
			order.push(moduleName)
		}
		let entry = domains.get(id)
		if (!entry) {
			entry = {
				id,
				name: domainName,
				plotTypes: [],
				cross: [],
				searchText: `${moduleName} ${domainName}`.toLowerCase()
			}
			domains.set(id, entry)
		}
		return entry
	}

	for (const d of cfg.domains || []) {
		const entry = ensure(d.id)
		entry.plotTypes = chartTypesByDomain.get(d.id) || []
	}
	// A cross-domain chart is discoverable under each domain it spans (functional req: charts across domains).
	for (const c of cfg.crossDomainCharts || []) for (const did of c.domains || []) ensure(did).cross.push(c)

	return order.map(module => ({ module, domains: [...byModule.get(module)!.values()] }))
}

export async function makeChartBtnMenu(holder, chartsInstance) {
	const termdbConfig = chartsInstance.app.vocabApi.termdbConfig
	const cohortKey = termdbConfig?.selectCohort?.values?.[chartsInstance.state.activeCohort]?.keys?.[0]
	const cfg: Forms2Config = termdbConfig?.plotConfigByCohort?.[cohortKey]?.profileForms2 || {}
	// Derive each domain's chart types from the DB (child subtypes), then group for display.
	const chartTypesByDomain = await getChartTypesByDomain(
		chartsInstance.app.vocabApi,
		(cfg.domains || []).map(d => d.id),
		cfg.options || []
	)
	const groups = buildTemplates3Model(cfg, chartTypesByDomain)
	/*
	Source of module colors: colorMap is built at termdb-build time from the dataset's
	hand-maintained module color table (utils/sjglobal-profile/raw/module_hex_codes →
	termdbConfig.colorMap). It is keyed by module name and, under each module, by Likert response
	CATEGORY (e.g. 'ALMOST ALWAYS') → hex — there is no standalone "module color" field. The matrix
	header below borrows a module's first category color purely as a visual accent (see accent note).
	*/
	const colorMap = termdbConfig?.colorMap || {}

	if (!groups.length) {
		holder
			.append('div')
			.style('padding', '15px')
			.style('color', '#777')
			.style('font-style', 'italic')
			.text('No templates are currently available for this cohort.')
		return
	}

	const dispatch = (config: { [key: string]: unknown }) => {
		chartsInstance.dom.tip.hide()
		chartsInstance.app.dispatch({ type: 'plot_create', id: (+new Date()).toString(16), config })
	}
	// Data-backed: forms charts open a profileForms2 plot whose questions exist in the db.
	const openForms = (domainId: string, plotType: string) =>
		dispatch({
			chartType: 'profileForms2',
			activeCohort: chartsInstance.state.activeCohort,
			tw: { term: { id: domainId } },
			activeTab: plotType
		})
	/*
	PLACEHOLDER — not yet backed by data. Cross-domain charts (e.g. heatmaps) are dispatched
	generically from their dataset-declared chartType + config. PrOFILE has no dedicated heatmap
	plot today; the only cross-domain target that exists is the generic 'matrix' chart, which is
	admin-only here and whose example config (in sjglobal.profile.ts crossDomainCharts) uses domain
	multivalue terms as a stand-in. When real heatmap terms/config land, only that dataset entry
	changes — this dispatch path stays the same.
	*/
	const openCross = (c: CrossDomainChart) =>
		dispatch({ chartType: c.chartType, activeCohort: chartsInstance.state.activeCohort, ...(c.config || {}) })

	const container = holder.append('div').attr('class', 'sjpp-templates3').style('max-width', '520px')

	// Search box: filter domain rows by module/domain name as the list scales.
	const rows: { searchText: string; row: ReturnType<typeof holder.append> }[] = []
	container
		.append('input')
		.attr('type', 'search')
		.attr('placeholder', 'Search domains')
		.style('width', '100%')
		.style('box-sizing', 'border-box')
		.style('margin', '4px 0 8px')
		.style('padding', '4px 8px')
		.on('input', function (this: HTMLInputElement) {
			const q = this.value.trim().toLowerCase()
			for (const { searchText, row } of rows) row.style('display', !q || searchText.includes(q) ? '' : 'none')
		})

	const listDiv = container.append('div').style('max-height', '60vh').style('overflow-y', 'auto')

	const makeBtn = (parent, label: string, onClick: () => void) =>
		parent
			.append('div')
			.attr('class', 'sja_filter_tag_btn')
			.style('display', 'inline-block')
			.style('margin', '0 4px 4px 0')
			.style('padding', '2px 9px')
			.style('font-size', '.85em')
			.style('border-radius', '6px')
			.style('background-color', '#cfe2f3')
			.style('color', 'black')
			.style('cursor', 'pointer')
			.text(label)
			.on('click', onClick)

	for (const { module, domains } of groups) {
		/*
		Module accent color: colorMap has no single per-module color (it stores per-Likert-category
		hexes, see the colorMap note above), so we take the module's FIRST category color as a
		presentational accent only. Falls back to neutral gray when a module has no colorMap entry.
		*/
		const accent = (Object.values(colorMap[module] || {})[0] as string) || '#999'
		listDiv
			.append('div')
			.style('margin', '10px 0 4px')
			.style('padding', '3px 8px')
			.style('border-left', `4px solid ${accent}`)
			.style('font-weight', 'bold')
			.text(module)

		for (const entry of domains) {
			const row = listDiv
				.append('div')
				.style('display', 'flex')
				.style('flex-wrap', 'wrap')
				.style('align-items', 'baseline')
				.style('gap', '6px')
				.style('padding', '2px 8px 2px 14px')
			rows.push({ searchText: entry.searchText, row })
			row.append('div').style('min-width', '180px').style('font-size', '.9em').text(entry.name)
			const btns = row.append('div')
			for (const plotType of entry.plotTypes) makeBtn(btns, plotType, () => openForms(entry.id, plotType))
			for (const c of entry.cross) makeBtn(btns, c.label, () => openCross(c))
		}
	}
}
