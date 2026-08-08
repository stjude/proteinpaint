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
import { getColors } from '#shared/common.js'
import { rgb } from 'd3-color'
import { make_radios, renderTable, Tabs } from '#dom'
import { dofetch3 } from '#common/dofetch'
import { renderPreAnalysisData } from '#mass/groups'
import { TermTypeGroups, termType2label } from '#shared/terms.js'

const colorScale = getColors(5)

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

	constructor(opts, api) {
		super(opts, api)
		this.type = DEinputPlot.type
		this.opts = opts
		this.dom = this.getDom()
		this.groups = []
	}

	getDom() {
		const header = this.opts?.header?.html('Differential Gene Expression') || undefined
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

	async init() {
		await this.renderExpressionSourceUI()
	}

	// TODO: handle errors
	async main() {
		this.dom.preAnalysis.selectAll('*').remove()
		if (!this.expressionSource || (this.expressionSource === 'pseudobulk' && !this.pseudobulk)) {
			this.dom.table.style('display', 'none')
			this.dom.addGroup.style('display', 'none')
			this.dom.submit.style('display', 'none')
			return
		}
		this.dom.addGroup.style('display', 'inline-block')
		this.makeGroupsUI()
		this.hasCohort0 = this.groups.some(g => g.filter.lst.some(item => item.tvs?.term.type == 'cohort'))
		this.mayRenderSubmit()
	}

	async renderExpressionSourceUI() {
		const config = this.app.vocabApi.termdbConfig
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
				/** 'hide_search' by default expands all terms. Passing the
				 * header_mode in opts gives the caller the flexibility to choose. */
				header_mode: this.opts?.header_mode || 'hide_search',
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
				{ label: `#${(this.app.vocabApi.termdbConfig?.uiLabels?.Sample || 'Sample').toUpperCase()}` },
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

	addNewGroup(filter, groups, name?: string) {
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
			color: rgb(colorScale(groups.length)).formatHex()
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
				const groups = [this.groups[0]]
				const otherGroup = {
					name: 'Not in ' + groups[0].name,
					color: '#ccc',
					filter: negateFilter(groups[0].filter)
				}
				groups.push(otherGroup)
				await this.clickSubmit(groups)
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
				label: g.name
			}
		}

		// get actual numbers of samples with rnaseq count
		const body: any = {
			genome: this.app.vocabApi.vocab.genome,
			dslabel: this.app.vocabApi.vocab.dslabel,
			samplelst: { groups: samplelstTW.q.groups },
			filter: this.state.termfilter.filter,
			filter0,
			preAnalysis: true
		}
		if (this.expressionSource === 'pseudobulk') body.pseudobulk = this.pseudobulk
		const preAnalysisData = await dofetch3('termdb/DE', { body })

		this.dom.loading.style('display', 'none')

		// render sample counts. renderPreAnalysisData writes its own header, using the ds vocabulary
		this.dom.preAnalysis.style('display', 'block').selectAll('*').remove()

		renderPreAnalysisData({
			preAnalysisData,
			samplelstTW,
			groups: samplelstTW.q.groups,
			holder: this.dom.preAnalysis,
			self: this
		})
	}
}

export const DEinputInit = getCompInit(DEinputPlot)
export const componentInit = DEinputInit

export async function getPlotConfig(opts) {
	const config = {
		chartType: 'DEinput',
		settings: {}
	}

	// may apply term-specific changes to the default object
	return copyMerge(config, opts)
}
