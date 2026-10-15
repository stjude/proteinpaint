/*
Templates 3 — the PrOFILE "Template Mapping" view.

Renders a Module → Domain → plot-type overview. The module/domain layout, ordering, colors and
template labels come entirely from the data-driven mapping the dataset ships at
  termdbConfig.plotConfigByCohort[cohort].template3   (type TemplateMapping)
which the build generates from the source spreadsheet (single source of truth). Nothing here is
hardcoded — module names, domain names, colors, ordering, template labels and chart types all
come from the mapping, and template metadata is always resolved through the top-level `templates`
dictionary.

Data-backed: a plot type is shown only when a real chart exists behind it, checked against the DB:
	- Yes/No & Likert appear for a domain only if that domain has questions of the matching subtype
	  (getMultivalueTWs → term.subtype), so clicking always opens a non-empty chart.
	- Impressions (thermometer) appears only where the module has an "__Impression" domain.
	- Heatmaps (no chart engine yet) and NEW/planned templates render nothing — they have no data.

The templateKey ↔ subtype link comes from the dataset's profileForms options (config-driven bridge),
and domain term ids are resolved from the live termdb hierarchy (root → components → modules →
domains), whose ids encode <Component>__<Module>__<Domain>. Clicking opens the existing profileForms
plot pre-selected to the matching tab.

Invoked by mass/charts.js loadChartSpecificMenu via the standard chart-specific menu pattern.
*/

import type { TemplateMapping, TemplateModule, TemplateMeta } from '#types'

const EMPTY_MESSAGE = 'No templates are currently available for this cohort.'
const VALID_CHARTS = new Set(['heatmap', 'stacked_bar', 'thermometer'])
const IMPRESSION_SUFFIX = '__Impression'

/*
Runtime guard mirroring the converter's structural invariants. Throws a clear Error so a
malformed mapping fails loudly instead of rendering a silently-empty view. Kept structural
(not "exactly 6 templates") — that source-data invariant belongs to the converter.
*/
export function assertTemplateMapping(x: unknown): asserts x is TemplateMapping {
	const fail = (msg: string): never => {
		throw new Error(`template3 mapping invalid: ${msg}`)
	}
	if (!x || typeof x !== 'object') fail('not an object')
	const m = x as TemplateMapping
	if (!m.templates || typeof m.templates !== 'object') fail('missing templates dictionary')
	for (const [key, t] of Object.entries(m.templates)) {
		if (!t || typeof t.label !== 'string' || !t.label) fail(`template ${key} missing label`)
		if (!VALID_CHARTS.has(t.chart)) fail(`template ${key} has invalid chart ${JSON.stringify(t.chart)}`)
	}
	if (!m.legend?.forms || typeof m.legend.forms !== 'object') fail('missing legend.forms')
	if (!Array.isArray(m.modules)) fail('modules is not an array')
	for (const mod of m.modules) {
		if (!mod.name) fail('a module is missing name')
		for (const field of ['color', 'textColor'] as const) {
			if (!/^#[0-9A-Fa-f]{6}$/.test(mod[field] || '')) fail(`module ${mod.name} has invalid ${field}`)
		}
		if (!Array.isArray(mod.domains) || !mod.domains.length) fail(`module ${mod.name} has no domains`)
		for (const d of mod.domains) {
			if (!d.domain) fail(`module ${mod.name} has a domain missing its name`)
			for (const code of d.forms || []) {
				if (!m.legend.forms[code]) fail(`form code ${code} in ${d.domain} not in legend.forms`)
			}
			for (const key of Object.keys(d.templates || {})) {
				if (!m.templates[key]) fail(`domain ${d.domain} references unknown template ${key}`)
			}
		}
	}
}

export type DomainTemplates = { domain: string; templates: { key: string; meta: TemplateMeta }[] }
export type ModuleView = { name: string; color: string; textColor: string; domains: DomainTemplates[] }

/*
Pure layout builder (unit-testable without the DOM): group domains under their module in mapping
order, each carrying its declared template (key, meta) pairs resolved through mapping.templates.
Which of these actually render is decided later against the DB (data-backed gating).
*/
export function buildTemplateView(mapping: TemplateMapping): ModuleView[] {
	return mapping.modules.map((mod: TemplateModule) => ({
		name: mod.name,
		color: mod.color,
		textColor: mod.textColor,
		domains: mod.domains.map(d => ({
			domain: d.domain,
			templates: Object.keys(d.templates).map(key => ({ key, meta: mapping.templates[key] }))
		}))
	}))
}

const CHART_LABELS: { [k: string]: string } = {
	heatmap: 'Heat map',
	stacked_bar: 'Stacked Bar Chart',
	thermometer: 'Thermometer'
}

export async function makeChartBtnMenu(holder, chartsInstance, _chartType?) {
	const termdbConfig = chartsInstance.app.vocabApi.termdbConfig
	const cohortKey = termdbConfig?.selectCohort?.values?.[chartsInstance.state.activeCohort]?.keys?.[0]
	const mapping = termdbConfig?.plotConfigByCohort?.[cohortKey]?.template3

	const showMessage = (text: string, color: string) =>
		holder.append('div').style('padding', '15px').style('color', color).style('font-style', 'italic').text(text)

	if (!mapping) return void showMessage(EMPTY_MESSAGE, '#777')
	// Fail loudly on a malformed mapping rather than rendering an empty/partial view.
	try {
		assertTemplateMapping(mapping)
	} catch (e) {
		return void showMessage((e as Error).message, '#c00')
	}
	const modules = buildTemplateView(mapping)
	if (!modules.length) return void showMessage(EMPTY_MESSAGE, '#777')

	const vocabApi = chartsInstance.app.vocabApi
	const cohortValuelst: string[] | null =
		termdbConfig?.selectCohort?.values?.[chartsInstance.state.activeCohort]?.keys || null

	// Config-driven bridge: templateKey ↔ profileForms option (tab name + DB subtype). A forms
	// template is data-backed for a domain when that domain has a child of the option's subtype.
	const cohortPlots = termdbConfig?.plotConfigByCohort?.[cohortKey] || {}
	const formsOptions = (cohortPlots.profileForms?.options || cohortPlots.profileForms2?.options || []) as {
		name: string
		subtype?: string
		templateKey?: string
	}[]
	const optionByTemplateKey = new Map<string, { name: string; subtype?: string }>()
	const templateKeyBySubtype = new Map<string, string>()
	for (const o of formsOptions) {
		if (!o.templateKey) continue
		optionByTemplateKey.set(o.templateKey, { name: o.name, subtype: o.subtype })
		if (o.subtype) templateKeyBySubtype.set(o.subtype, o.templateKey)
	}

	const container = holder.append('div').attr('class', 'sjpp-templates3').style('max-width', '560px')
	const loading = container.append('div').style('padding', '15px').style('color', '#777').text('Loading…')

	// Resolve module display names to real termdb module ids by walking the dictionary components.
	// Cached; only the component hierarchy nodes (non-leaf) are traversed.
	let moduleIdMap: Promise<Map<string, string>> | undefined
	const getModuleIdMap = () => {
		if (!moduleIdMap)
			moduleIdMap = (async () => {
				const root = await vocabApi.getTermChildren({ __tree_isroot: true }, cohortValuelst)
				const components = (root?.lst || []).filter((c: { isleaf?: unknown }) => !c.isleaf)
				const perComponent = await Promise.all(
					components.map((c: { id: string }) => vocabApi.getTermChildren({ id: c.id }, cohortValuelst))
				)
				const map = new Map<string, string>()
				for (const res of perComponent) for (const mod of res?.lst || []) map.set(mod.name, mod.id)
				return map
			})()
		return moduleIdMap
	}

	// Per module: the real domain-name → id map and the "__Impression" domain id (if the module has one).
	type ModuleData = { domainIdByName: Map<string, string>; impressionId?: string }
	const moduleDataById = new Map<string, Promise<ModuleData>>()
	const getModuleData = async (moduleName: string): Promise<ModuleData> => {
		const moduleId = (await getModuleIdMap()).get(moduleName)
		if (!moduleId) return { domainIdByName: new Map() }
		let p = moduleDataById.get(moduleId)
		if (!p) {
			p = (async () => {
				const res = await vocabApi.getTermChildren({ id: moduleId }, cohortValuelst)
				const domainIdByName = new Map<string, string>()
				let impressionId: string | undefined
				for (const t of res?.lst || []) {
					domainIdByName.set(t.name, t.id)
					if (String(t.id).endsWith(IMPRESSION_SUFFIX)) impressionId = t.id
				}
				return { domainIdByName, impressionId }
			})()
			moduleDataById.set(moduleId, p)
		}
		return p
	}

	// A domain's data-backed forms template keys, derived from its children's subtypes.
	const formsKeysByDomainId = new Map<string, Promise<Set<string>>>()
	const getDomainFormsKeys = (domainId: string): Promise<Set<string>> => {
		let p = formsKeysByDomainId.get(domainId)
		if (!p) {
			p = (async () => {
				const twLst = await vocabApi.getMultivalueTWs({ parent_id: domainId })
				const keys = new Set<string>()
				for (const tw of twLst || []) {
					const key = tw?.term?.subtype && templateKeyBySubtype.get(tw.term.subtype)
					if (key) keys.add(key)
				}
				return keys
			})()
			formsKeysByDomainId.set(domainId, p)
		}
		return p
	}

	const dispatch = (config: { [key: string]: unknown }) => {
		chartsInstance.dom.tip.hide()
		chartsInstance.app.dispatch({ type: 'plot_create', id: (+new Date()).toString(16), config })
	}
	const openPlot = (domainId: string, activeTab?: string) =>
		dispatch({
			chartType: 'profileForms',
			activeCohort: chartsInstance.state.activeCohort,
			tw: { term: { id: domainId } },
			...(activeTab ? { activeTab } : {})
		})

	/*
	Build the data-backed render model: for each module, resolve its domains against the termdb and
	keep only plot types with real data — forms types present in the DB, and impressions where the
	module has an "__Impression" domain. Heatmaps and NEW templates are dropped. Empty domains and
	empty modules are omitted so the view shows only what can actually be opened.
	*/
	type Chip = { label: string; title: string; onClick: () => void }
	type RenderDomain = { domain: string; chips: Chip[] }
	type RenderModule = { name: string; color: string; textColor: string; domains: RenderDomain[] }

	const rendered: RenderModule[] = (
		await Promise.all(
			modules.map(async mod => {
				const md = await getModuleData(mod.name)
				const domains = (
					await Promise.all(
						mod.domains.map(async d => {
							const domainId = md.domainIdByName.get(d.domain)
							// Only hit the DB for domains that declare a forms template; impression-only and
							// heatmap-only domains need no subtype lookup.
							const hasFormsTemplate = d.templates.some(t => optionByTemplateKey.has(t.key))
							const formsKeys = hasFormsTemplate && domainId ? await getDomainFormsKeys(domainId) : new Set<string>()
							const chips: Chip[] = []
							for (const { key, meta } of d.templates) {
								const option = optionByTemplateKey.get(key)
								if (option) {
									// forms type (Yes/No, Likert): show only if the domain has this subtype in the DB.
									if (domainId && formsKeys.has(key))
										chips.push({
											label: `${meta.label} · ${CHART_LABELS[meta.chart] || meta.chart}`,
											title: `Open ${meta.label} for ${d.domain}`,
											onClick: () => openPlot(domainId, option.name)
										})
								} else if (meta.chart === 'thermometer' && md.impressionId) {
									// impressions: show only where the module has an __Impression domain.
									const impressionId = md.impressionId
									chips.push({
										label: `${meta.label} · ${CHART_LABELS[meta.chart] || meta.chart}`,
										title: `Open ${meta.label} for ${mod.name}`,
										onClick: () => openPlot(impressionId)
									})
								}
								// heatmaps and NEW templates have no data-backed chart → skipped.
							}
							return { domain: d.domain, chips }
						})
					)
				).filter(d => d.chips.length)
				return { name: mod.name, color: mod.color, textColor: mod.textColor, domains }
			})
		)
	).filter(mod => mod.domains.length)

	loading.remove()
	if (!rendered.length) return void showMessage(EMPTY_MESSAGE, '#777')

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

	const listDiv = container.append('div').style('max-height', '65vh').style('overflow-y', 'auto')

	const makeChip = (parent, chip: Chip) =>
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
			.attr('title', chip.title)
			.text(chip.label)
			.on('click', chip.onClick)

	for (const mod of rendered) {
		// Section header: background = module color, title = module.textColor (from the mapping).
		listDiv
			.append('div')
			.style('margin', '10px 0 4px')
			.style('padding', '4px 8px')
			.style('border-radius', '4px')
			.style('background-color', mod.color)
			.style('color', mod.textColor)
			.style('font-weight', 'bold')
			.text(mod.name)

		for (const d of mod.domains) {
			const row = listDiv
				.append('div')
				.style('display', 'flex')
				.style('flex-wrap', 'wrap')
				.style('align-items', 'baseline')
				.style('gap', '6px')
				.style('padding', '2px 8px 2px 14px')
			rows.push({ searchText: `${mod.name} ${d.domain}`.toLowerCase(), row })
			row.append('div').style('min-width', '190px').style('font-size', '.9em').text(d.domain)
			const btns = row.append('div')
			for (const chip of d.chips) makeChip(btns, chip)
		}
	}
}
