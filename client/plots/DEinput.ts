import { PlotBase } from './PlotBase.ts'
import { getCompInit, copyMerge, type ComponentApi, type RxComponent } from '#rx'
import {
	filterInit,
	filterPromptInit,
	getNormalRoot,
	excludeFilterByTag,
	filterJoin,
	negateFilter
} from '#filter/filter'
import { rehydrateFilter } from '#filter/rehydrateFilter'
import { getColors } from '#shared/common.js'
import { color as d3color, rgb } from 'd3-color'
import { make_radios, renderTable, Tabs } from '#dom'
import { dofetch3 } from '#common/dofetch'
import { renderPreAnalysisData } from '#mass/groups'
import { TermTypeGroups, termType2label } from '#shared/terms.js'
import { TermTypes } from '#types'
import { uiLabel } from '#shared'

const colorScale = getColors(5)

/* Group-building submission UI for a two-group differential analysis.

Serves both differential gene expression and differential DNA methylation, selected by
config.termType (default gene expression, so existing callers are unchanged). The two differ
in only three places, all branched on `isGE` below: which ds query proves the assay exists,
which server route the pre-analysis hits, and the expression-source tabs (methylation has no
pseudobulk counterpart). The group table, filter prompt and submit flow are shared.

The results view is a separate chart, 'differentialAnalysis'; this plot only builds groups
and hands them over via renderPreAnalysisData(). */
class DEinputPlot extends PlotBase implements RxComponent {
	static type = 'DEinput'

	// expected RxComponent props, some are already declared/set in PlotBase
	type: string
	parentId?: string
	dom!: {
		[index: string]: any
	}
	components: {
		[name: string]: ComponentApi | { [name: string]: ComponentApi }
	} = {}
	// expected class-specific props
	config: any
	groups: any[]
	filterPrompt: any
	expressionSource?: 'bulk' | 'pseudobulk'
	pseudobulk?: { assay: string; memberId: string; category: string }
	hasCohort0?: boolean
	/** set once config.groups[] has been copied into this.groups[] */
	groupsSeeded?: boolean
	/** set once config.autoSubmit has triggered clickSubmit() */
	autoSubmitted?: boolean
	/** geneExpression (default) or dnaMethylation. Resolved in init() from state.config, NOT from
	 * opts: mass/plot.js hands the component only {app, holder, header, id, ...}, so config fields
	 * are not on opts and reading it in the constructor would silently always be undefined. */
	termType!: string

	constructor(opts: any, api: ComponentApi) {
		super(opts, api)
		this.type = DEinputPlot.type
		this.dom = this.getDom()
		this.groups = []
	}

	get isGE() {
		return this.termType == TermTypes.GENE_EXPRESSION
	}

	getDom() {
		// header text is set in init(), once state.config.termType is known
		const header = this.opts?.header || undefined
		const holder = this.opts.holder.append('div').style('margin', '10px')
		const expressionSource = holder.append('div').style('margin-bottom', '15px')
		const table = holder.append('div')
		const btns = holder.append('div').style('margin-top', '5px')
		const addGroup = btns.append('div').style('display', 'inline-block')
		const submit = btns
			.append('div')
			.style('display', 'none')
			.style('margin-left', '15px')
			.attr('class', 'sja_new_filter_btn sja_menuoption')
		const loading = holder.append('div').style('display', 'none').style('margin', '20px 10px').text('Loading...')
		const preAnalysis = holder
			.append('div')
			.style('display', 'none')
			.style('margin-top', '20px')
			.style('margin-left', '5px')
		const dom = { header, expressionSource, table, addGroup, submit, loading, preAnalysis }
		return dom
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		return {
			termfilter: appState.termfilter,
			config,
			// quick fix to skip history tracking as needed
			_scope_: appState._scope_
		}
	}

	async init(appState) {
		const state = this.getState(appState)
		this.termType = state.config.termType || TermTypes.GENE_EXPRESSION
		this.dom.header?.html(`Differential ${termType2label(this.termType)}`)
		await this.renderExpressionSourceUI()
	}

	// TODO: handle errors
	async main() {
		/* The expression-source tabs are built during init(), and Tabs.main() fires the active tab's
		callback immediately -- which calls main() before rx has assigned this.state. Bail out here
		rather than let maySeedGroups() throw on this.state.config: it sets groupsSeeded=true first,
		so the throw permanently skips seeding and config.groups[] silently never appears. The
		framework calls main() again right after init(), so nothing is lost by returning. */
		if (!this.state) return
		this.dom.preAnalysis.selectAll('*').remove()
		if (!this.expressionSource || (this.expressionSource === 'pseudobulk' && !this.pseudobulk)) {
			this.dom.table.style('display', 'none')
			this.dom.addGroup.style('display', 'none')
			this.dom.submit.style('display', 'none')
			return
		}
		this.dom.addGroup.style('display', 'inline-block')
		this.maySeedGroups()
		// set before makeGroupsUI(), which uses it when requesting each group's sample count
		this.hasCohort0 = this.groups.some(g => g.filter.lst.some(item => item.tvs?.term.type == 'cohort'))
		// awaited: on the first run makeGroupsUI() awaits the filter prompt, and it re-enables the add
		// group button at its end, which would otherwise undo the button state set by mayRenderSubmit()
		await this.makeGroupsUI()
		this.mayRenderSubmit()
		await this.mayAutoSubmit()
	}

	/* config.groups[] lets a caller launch this ui with prebuilt groups, each defined by a mass
	filter, instead of requiring the user to build both groups by hand. seeded only once: main() reruns
	on every state change, and a seeded group is editable like any other, so a rerun must not undo a
	rename, edit, or deletion */
	maySeedGroups() {
		if (this.groupsSeeded) return
		this.groupsSeeded = true
		if (!this.state.config.groups?.length) return
		/* a group built by the filter prompt embeds the mass filter, since the prompt is seeded with it
		in makeGroupsUI(); rebase the prebuilt groups the same way. without this, the sample count in the
		group table, which uses the group filter alone, would not match the sample set that clickSubmit()
		analyzes, which joins in the mass filter. the cohort filter is excluded to match the prompt, and
		to not flip hasCohort0, and thus drop filter0, for a group that did not ask for a cohort */
		const massFilter = getNormalRoot(excludeFilterByTag(structuredClone(this.state.termfilter.filter), 'cohortFilter'))
		for (const g of this.state.config.groups) {
			this.addNewGroup(filterJoin([massFilter, getNormalRoot(g.filter)]), this.groups, g.name, g.color)
		}
	}

	/* config.autoSubmit runs the analysis on the seeded groups without waiting for a click, for a caller
	that already knows the groups to compare. runs only once: main() reruns on every state change, and
	each run is a round trip to termdb/DE */
	async mayAutoSubmit() {
		if (!this.state.config.autoSubmit || this.autoSubmitted) return
		// mayRenderSubmit() hides the button when the groups cannot be compared, such as a lone group
		// under a cohort filter that cannot be negated
		if (this.dom.submit.style('display') == 'none') return
		this.autoSubmitted = true
		await this.clickSubmit(this.getSubmitGroups())
	}

	/** the groups as compared by the analysis: a lone group is compared against all other samples */
	getSubmitGroups() {
		if (this.groups.length != 1) return this.groups
		const group = this.groups[0]
		return [
			group,
			{
				name: 'Not in ' + group.name,
				color: '#ccc',
				filter: negateFilter(group.filter)
			}
		]
	}

	async renderExpressionSourceUI() {
		const config = this.app.vocabApi.termdbConfig

		/* methylation has one source, the element matrices, and no pseudobulk counterpart, so there
		is nothing to choose -- skip the tabs entirely. the ds gate mirrors the one the Groups menu
		applies (mass/groups.js): a promoter matrix OR any element type is enough, so a ds offering
		only non-promoter classes is still reachable. */
		if (!this.isGE) {
			const dm = config.queries?.dnaMethylation
			if (!dm?.promoter && !dm?.elementTypes?.length)
				throw new Error('No DNA methylation data configured for differential analysis')
			this.expressionSource = 'bulk'
			return
		}

		const hasBulk = !!config.queries?.rnaseqGeneCount
		const terms = config.termType2terms?.[TermTypeGroups.PSEUDOBULK] || []
		const hasPseudobulk = terms.length > 0
		if (!hasBulk && !hasPseudobulk)
			throw new Error('No gene expression count data configured for differential analysis')

		if (hasBulk && !hasPseudobulk) {
			this.expressionSource = 'bulk'
			return
		}

		if (!hasBulk) {
			this.expressionSource = 'pseudobulk'
			this.renderPseudobulkSelection(this.dom.expressionSource, terms)
			return
		}

		const tabs = [
			{
				label: 'Bulk RNA-seq',
				active: true,
				callback: async () => {
					this.expressionSource = 'bulk'
					await this.main()
				}
			},
			{
				label: 'Single-cell pseudobulk',
				callback: async (_event, tab) => {
					this.expressionSource = 'pseudobulk'
					tab.contentHolder.selectAll('*').remove()
					this.renderPseudobulkSelection(tab.contentHolder, terms)
					await this.main()
				}
			}
		]
		await new Tabs({ holder: this.dom.expressionSource, tabs }).main()
	}

	renderPseudobulkSelection(holder, terms) {
		const assayMap = new Map<string, Map<string, any[]>>()
		for (const term of terms) {
			if (!assayMap.has(term.assay)) assayMap.set(term.assay, new Map())
			const memberMap = assayMap.get(term.assay)!
			if (!memberMap.has(term.memberId)) memberMap.set(term.memberId, [])
			memberMap.get(term.memberId)!.push(term)
		}

		const renderAssay = (assayHolder, assay, memberMap) => {
			assayHolder.selectAll('*').remove()
			const renderMember = (memberHolder, memberId, memberTerms) => {
				memberHolder.selectAll('*').remove()
				memberHolder.append('div').style('opacity', 0.7).text(`Select from ${memberId}:`)
				make_radios({
					holder: memberHolder,
					inputName: `sjpp-de-pseudobulk-${this.id}-${assay}-${memberId}`,
					options: memberTerms.map(term => ({
						label: term.name,
						value: term.id,
						checked:
							this.pseudobulk?.assay === assay &&
							this.pseudobulk?.memberId === memberId &&
							this.pseudobulk?.category === (term.category || term.id),
						testid: `sjpp-de-pseudobulk-category-${term.id}`
					})),
					styles: { display: 'block', padding: '3px 5px' },
					callback: async value => {
						const term = memberTerms.find(term => term.id == value)
						this.pseudobulk = { assay, memberId, category: term.category || term.id }
						await this.main()
					}
				})
			}

			if (memberMap.size === 1) {
				const [memberId, memberTerms] = memberMap.entries().next().value
				renderMember(assayHolder, memberId, memberTerms)
			} else {
				const memberTabs = Array.from(memberMap, ([memberId, memberTerms]) => ({
					label: memberId,
					callback: (_event, tab) => renderMember(tab.contentHolder, memberId, memberTerms)
				}))
				new Tabs({ holder: assayHolder, tabs: memberTabs }).main()
			}
		}

		if (assayMap.size === 1) {
			const [assay, memberMap] = Array.from(assayMap)[0]
			holder.append('div').text('Single-cell pseudobulk ' + termType2label(assay))
			renderAssay(holder.append('div'), assay, memberMap)
		} else {
			const assayTabs = Array.from(assayMap, ([assay, memberMap]) => ({
				label: termType2label(assay),
				callback: (_event, tab) => renderAssay(tab.contentHolder, assay, memberMap)
			}))
			new Tabs({ holder, tabs: assayTabs, linePosition: 'right', tabsPosition: 'vertical' }).main()
		}
	}

	async makeGroupsUI() {
		// filter prompt
		if (!this.filterPrompt) {
			this.filterPrompt = await filterPromptInit({
				holder: this.dom.addGroup,
				vocabApi: this.app.vocabApi,
				emptyLabel: 'Add group',
				header_mode: this.opts?.header_mode,
				callback: async f => {
					const filter = getNormalRoot(f)
					this.addNewGroup(filter, this.groups)
					await this.main()
				},
				debug: this.opts.debug
			})
		}

		// filterPrompt.main() always empties the filterUiRoot data
		const filter = structuredClone(this.state?.termfilter?.filter)
		this.filterPrompt.main(excludeFilterByTag(filter, 'cohortFilter')) // provide mass filter to limit the term tree

		if (!this.groups.length) {
			// no groups, hide table
			this.dom.table.style('display', 'none')
			return
		}

		// clear table and populate rows
		this.dom.table.style('display', 'block').selectAll('*').remove()
		const tableArg: any = {
			div: this.dom.table,
			columns: [
				{}, // blank column to add delete buttons
				{
					label: 'NAME',
					editCallback: async (i, cell) => {
						const newName = cell.value
						const index = this.groups.findIndex(group => group.name == newName)
						if (index != -1) {
							alert(`Group named ${newName} already exists`)
							await this.main()
						} else {
							this.groups[i].name = newName
							await this.main()
						}
					}
				},
				{
					label: 'COLOR',
					editCallback: async (i, cell) => {
						this.groups[i].color = cell.color
						this.main()
					}
				},
				// dataset may rename what a row counts (GDC: cases, not samples)
				{ label: `#${uiLabel(this.app.vocabApi.termdbConfig?.uiLabels, 'Sample', 'Sample').toUpperCase()}` },
				{ label: 'FILTER' }
			],
			rows: [],
			striped: false, // no alternating row bg color so delete button appears more visible
			showLines: false
		}

		for (const g of this.groups) {
			tableArg.rows.push([
				{}, // blank cell to add delete button
				{ value: g.name }, // to allow click to show <input>
				{ color: g.color },
				{ value: '' }, // filled in asynchronously below, so one slow count does not hold up the table
				{} // blank cell to show filter ui
			])
		}

		renderTable(tableArg)

		// after rendering table, iterate over rows again to fill cells with control elements
		for (const [i, row] of tableArg.rows.entries()) {
			// add delete button in 1st cell
			row[0].__td
				.append('div')
				.attr('class', 'sja_menuoption')
				.style('padding', '1px 6px')
				.html('&times;')
				.on('click', () => {
					this.groups.splice(i, 1)
					this.main()
				})

			// fill the #SAMPLE cell. not awaited: the table is already rendered, and on gdc each count
			// is a /cases round trip
			this.app.vocabApi
				.getFilteredSampleCount(this.groups[i].filter, this.hasCohort0 ? null : this.state.termfilter.filter0)
				.then(n => row[3].__td.text(n))
				.catch(e => row[3].__td.text('n/a').attr('title', e?.message || e))

			// create filter ui in its cell
			const group = this.groups[i]
			filterInit({
				holder: row[4].__td,
				vocabApi: this.app.vocabApi,
				header_mode: 'hide_search',
				callback: f => {
					if (!f || f.lst.length == 0) {
						// blank filter (user removed last tvs from this filter), delete this element from groups[]
						const i = this.groups.findIndex(g => g.name == group.name)
						this.groups.splice(i, 1)
					} else {
						// update filter
						group.filter = f
					}
					this.main()
				}
			}).main(group.filter)
		}

		this.dom.addGroup.select('.sja_new_filter_btn').style('pointer-events', 'auto').style('opacity', 1)
	}

	addNewGroup(filter, groups, name?: string, color?: string) {
		if (!groups) throw 'groups is missing'
		if (!name) {
			const base = 'New group'
			name = base
			for (let i = 0; ; i++) {
				name = base + (i === 0 ? '' : ' ' + i)
				if (!groups.find(g => g.name === name)) break
			}
		}
		const newGroup = {
			name,
			filter,
			color: color || rgb(colorScale(groups.length)).formatHex()
		}
		groups.push(newGroup)
	}

	mayRenderSubmit() {
		if (!this.groups.length || (this.groups.length == 1 && this.hasCohort0)) {
			// currently unable to negate filter0, so enforcing two-group
			// comparison when cohort0 is used
			this.dom.submit.style('display', 'none')
			return
		}
		this.dom.submit.style('display', 'inline-block')
		if (this.groups.length == 1) {
			// single group of samples, compare with all other samples
			this.dom.submit.text(`Submit (${this.groups[0].name} vs others)`)
			this.dom.submit.on('click', async () => {
				await this.clickSubmit(this.getSubmitGroups())
			})
		} else if (this.groups.length == 2) {
			// two groups of samples, compare these groups
			this.dom.addGroup.select('.sja_new_filter_btn').style('pointer-events', 'none').style('opacity', 0.5)
			this.dom.submit.text(`Submit (${this.groups[0].name} vs ${this.groups[1].name})`)
			this.dom.submit.on('click', async () => {
				await this.clickSubmit(this.groups)
			})
		} else {
			throw new Error('cannot exceed 2 groups')
		}
	}

	async clickSubmit(groups) {
		this.dom.loading.style('display', 'block')
		const samplelstTW: any = {
			q: { groups: [] },
			term: {
				name: groups.map(g => g.name).join(' vs '),
				type: 'samplelst',
				values: {}
			}
		}
		if (this.expressionSource === 'pseudobulk') samplelstTW.pseudobulk = this.pseudobulk
		// ignore filter0 when cohort0 is used
		const filter0 = this.hasCohort0 ? null : this.state.termfilter.filter0
		for (const g of groups) {
			const samples = await this.vocabApi!.getFilteredSampleList(
				filterJoin([g.filter, this.state.termfilter.filter]),
				filter0
			)
			const sampleIds = samples.map(s => {
				return { sampleId: s.id }
			})
			samplelstTW.q.groups.push({
				name: g.name,
				in: true,
				values: sampleIds
			})
			samplelstTW.term.values[g.name] = {
				color: g.color,
				key: g.name,
				label: g.name,
				list: sampleIds //samples need to be passed for the samplelst filter to work
			}
		}

		// get actual numbers of samples with data for this assay
		const body: any = {
			genome: this.app.vocabApi.vocab.genome,
			dslabel: this.app.vocabApi.vocab.dslabel,
			samplelst: { groups: samplelstTW.q.groups },
			filter: this.state.termfilter.filter,
			filter0,
			preAnalysis: true
		}
		if (this.expressionSource === 'pseudobulk') body.pseudobulk = this.pseudobulk
		// both routes accept the same preAnalysis body and answer with the same {data:{groupName:n}}
		const preAnalysisData = await dofetch3(this.isGE ? 'termdb/DE' : 'termdb/diffMeth', { body })

		this.dom.loading.style('display', 'none')

		// render sample counts. renderPreAnalysisData writes its own header, using the ds vocabulary
		this.dom.preAnalysis.style('display', 'block').selectAll('*').remove()

		renderPreAnalysisData({
			preAnalysisData,
			samplelstTW,
			groups: samplelstTW.q.groups,
			holder: this.dom.preAnalysis,
			termType: this.termType,
			self: this
		})
	}
}

export const DEinputInit = getCompInit(DEinputPlot)
export const componentInit = DEinputInit

const supportedTermTypes = new Set([TermTypes.GENE_EXPRESSION, TermTypes.DNA_METHYLATION])

export async function getPlotConfig(opts, app?) {
	if (opts.termType && !supportedTermTypes.has(opts.termType))
		throw new Error(`termType='${opts.termType}' is not supported by DEinput`)
	const config = {
		chartType: 'DEinput',
		// default keeps every existing caller on gene expression without passing anything
		termType: opts.termType || TermTypes.GENE_EXPRESSION,
		settings: {}
	}

	// may apply term-specific changes to the default object
	const c = copyMerge(config, opts)
	if (c.groups) c.groups = await getValidGroups(c.groups, app)
	return c
}

/* validate and normalize config.groups[], the prebuilt groups that DEinputPlot.maySeedGroups() copies
into the group table. done here so a malformed filter fails at plot creation with a clear message,
instead of deep in the filter ui: FilterClass.validateFilter() rejects a tvslst with a non-empty join
and fewer than 2 entries, and DEinputPlot.main() assumes a tvslst root when detecting a cohort term */
async function getValidGroups(groups, app) {
	if (!Array.isArray(groups)) throw 'config.groups must be an array'
	// mayRenderSubmit() has no ui for more than 2 groups
	if (groups.length > 2) throw 'config.groups[] cannot exceed 2 groups'
	/* every supplied name is reserved before any default name is filled in below. a group table row is
	found by name on edit and delete, and the samplelst tw of the analysis is keyed by name, so two
	groups must never end up with the same name -- including a default name that happens to match the
	name supplied by a later entry */
	const names = new Set()
	for (const g of groups) {
		if (!g?.filter) throw 'config.groups[] entry is missing .filter{}'
		if ('name' in g && typeof g.name != 'string') throw 'config.groups[].name must be a string'
		if (!g.name) continue
		if (names.has(g.name)) throw `duplicate config.groups[].name='${g.name}'`
		names.add(g.name)
	}

	const validated: any[] = []
	for (const g of groups) {
		// also detaches the filter from a frozen state or from the caller's object
		const filter = getNormalRoot(g.filter)
		if (!filter.lst.length) throw 'config.groups[] entry has a blank .filter{}'
		// allows a hand-coded filter to supply only term.id, like the mass filter and groups allow
		if (app?.vocabApi) await Promise.all(rehydrateFilter(filter, app.vocabApi))
		// name a group here, not in addNewGroup(), which only avoids the names of the groups added
		// before it and so could reuse a name that a later entry supplies
		const name = g.name || getUnusedGroupName(names)
		names.add(name)
		const valid = Object.assign({}, g, { filter, name })
		if ('color' in g) {
			/* store the parsed hex, not what was supplied: the color is rendered by code that may set
			it as a css value, so only a value that d3 recognizes as a color may be kept */
			const c = d3color(g.color)
			if (!c) throw `invalid config.groups[].color='${g.color}'`
			valid.color = c.formatHex()
		}
		validated.push(valid)
	}
	return validated
}

/** the first unused name of the 'New group', 'New group 1', ... series, matching addNewGroup() */
function getUnusedGroupName(names) {
	const base = 'New group'
	for (let i = 0; ; i++) {
		const name = base + (i === 0 ? '' : ' ' + i)
		if (!names.has(name)) return name
	}
}
