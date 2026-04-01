import { PlotBase, defaultUiLabels } from './PlotBase.ts'
import { getCompInit, copyMerge, type ComponentApi, type RxComponent } from '#rx'
import { term0_term2_defaultQ } from './controls'
import { t0_t2_defaultQ as term0_term2_defaultQ_surv } from './survival/survival.ts'
import { fillTermWrapper } from '#termsetting'
import { filterInit, filterPromptInit, getNormalRoot, excludeFilterByTag, filterJoin } from '#filter/filter'
import { getColors } from '#shared/common.js'
import { rgb } from 'd3-color'
import { renderTable } from '#dom'
import { dofetch3 } from '#common/dofetch'
import { renderPreAnalysisData } from '#mass/groups'

const colorScale = getColors(5)

// TODO: need to also consider filter0 whenever pp filter is considered
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

	constructor(opts, api) {
		super(opts, api)
		this.type = DEinputPlot.type
		this.opts = opts
		this.dom = this.getDom()
		this.groups = []
	}

	getDom() {
		const header = this.opts.header.html('Differential Gene Expression')
		const holder = this.opts.holder.append('div').style('margin', '10px')
		const table = holder.append('div')
		const btns = holder.append('div')
		const addGroup = btns.append('div').style('display', 'inline-block')
		const submit = btns
			.append('div')
			.style('display', 'none')
			.style('margin-left', '15px')
			.attr('class', 'sja_new_filter_btn sja_menuoption')
		const preAnalysis = holder.append('div').style('display', 'none').style('margin-top', '20px')
		const dom = { header, table, addGroup, submit, preAnalysis }
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

	async init(/*appState*/) {
		//const state = this.getState(appState)
		//this.renderSubmit()
	}

	// TODO: handle errors
	async main() {
		this.makeGroupUI()
	}

	async makeGroupUI() {
		/*// message
		div
			.append('div')
			.style('margin', '15px 0px')
			.text(
				'Group samples by mutation status. Samples are assigned to first possible group. Only tested samples are considered.'
			)*/

		// filter prompt
		if (!this.filterPrompt) {
			this.filterPrompt = await filterPromptInit({
				holder: this.dom.addGroup,
				vocabApi: this.app.vocabApi,
				emptyLabel: 'Add group',
				header_mode: 'hide_search',
				callback: async f => {
					const filter = getNormalRoot(f)
					this.addNewGroup(filter, this.groups)
					await this.makeGroupUI()
				},
				debug: this.opts.debug
			})
		}

		// filterPrompt.main() always empties the filterUiRoot data
		const filter = structuredClone(this.filter)
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
							await this.makeGroupUI()
						} else {
							this.groups[i].name = newName
							await this.makeGroupUI()
						}
					}
				},
				{
					label: 'COLOR',
					editCallback: async (i, cell) => {
						this.groups[i].color = cell.color
						this.makeGroupUI()
					}
				},
				//{ label: '#SAMPLE' }, // will re-enable when filtered sample count can be supported for gdc
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
				// { value: 'n=' + (await self.vocabApi.getFilteredSampleCount(g.filter)) }, // will re-enable when filtered sample count can be supported for gdc
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
					this.makeGroupUI()
				})

			// create filter ui in its cell
			const group = this.groups[i]
			filterInit({
				holder: row[3].__td,
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
					this.makeGroupUI()
				}
			}).main(group.filter)
		}

		if (!this.groups.length) return

		this.dom.submit.style('display', 'inline-block')
		if (this.groups.length == 1) {
			// single group of samples, compare with all other samples
			// see code in groups2samplelst() in client/mass/groups.js
			this.dom.submit.text(`Analyze ${this.groups[0].name} vs others`)
			this.dom.submit.on('click', async () => {
				throw new Error('not yet supported')
			})
		} else if (this.groups.length == 2) {
			// two groups of samples, compare these groups
			this.dom.submit.text(`Analyze ${this.groups[0].name} vs ${this.groups[1].name}`)
			this.dom.submit.on('click', async () => {
				const groups: any[] = []
				const termValues: any = {}
				for (const g of this.groups) {
					const samples = await this.app.vocabApi.getFilteredSampleList(
						filterJoin([g.filter, this.state.termfilter.filter])
					)
					const sampleIds = samples.map(s => {
						return { sampleId: s }
					})
					groups.push({
						name: g.name,
						in: true,
						values: sampleIds
					})
					termValues[g.name] = {
						color: g.color,
						key: g.name,
						label: g.name,
						list: sampleIds
					}
				}

				const samplelstTW = {
					q: { groups },
					term: {
						name: groups.map(g => g.name).join(' vs '),
						type: 'samplelst',
						values: termValues
					}
				}

				// get actual numbers of samples with rnaseq count
				const body = {
					genome: this.app.vocabApi.vocab.genome,
					dslabel: this.app.vocabApi.vocab.dslabel,
					samplelst: { groups },
					filter: this.state.termfilter.filter,
					filter0: this.state.termfilter.filter0,
					preAnalysis: true
				}
				const preAnalysisData = await dofetch3('termdb/DE', { body })

				// render sample counts
				this.dom.preAnalysis.style('display', 'block')
				renderPreAnalysisData({ preAnalysisData, samplelstTW, groups, holder: this.dom.preAnalysis, self: this })
			})
		} else {
			throw new Error('cannot exceed 2 groups')
		}
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
}

export const DEinputInit = getCompInit(DEinputPlot)
export const componentInit = DEinputInit

export async function getPlotConfig(opts, app) {
	try {
		// don't supply defaultQ if term.bins or term.q is defined (e.g. if q.mode='continuous', shouldn't override it with defaultQ)
		if (opts.term) {
			const defaultQ: any = opts.term.bins || opts.term.q ? undefined : { geneVariant: { type: 'predefined-groupset' } }
			await fillTermWrapper(opts.term, app.vocabApi, defaultQ)
		}
		if (opts.term2) {
			const defaultQ =
				opts.term2.bins || opts.term2.q
					? undefined
					: opts.term.term.type == 'survival'
					? term0_term2_defaultQ_surv
					: term0_term2_defaultQ
			await fillTermWrapper(opts.term2, app.vocabApi, defaultQ)
		}
		if (opts.term0) {
			const defaultQ =
				opts.term0.bins || opts.term0.q
					? undefined
					: opts.term.term.type == 'survival'
					? term0_term2_defaultQ_surv
					: term0_term2_defaultQ
			await fillTermWrapper(opts.term0, app.vocabApi, defaultQ)
		}
	} catch (e: any) {
		if (e.stack) console.log(e.stack)
		throw `${e} [summaryInput getPlotConfig()]`
	}

	const config = {
		chartType: 'summaryInput',
		settings: {},
		controlLabels: Object.assign({}, defaultUiLabels, app.vocabApi.termdbConfig.uiLabels || {})
	}

	// may apply term-specific changes to the default object
	return copyMerge(config, opts)
}
