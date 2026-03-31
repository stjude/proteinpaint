import { PlotBase, defaultUiLabels } from './PlotBase.ts'
import { getCompInit, copyMerge, type ComponentApi, type RxComponent } from '#rx'
import { term0_term2_defaultQ } from './controls'
import { t0_t2_defaultQ as term0_term2_defaultQ_surv } from './survival/survival.ts'
import { fillTermWrapper } from '#termsetting'
import { filterInit, filterPromptInit, getNormalRoot, excludeFilterByTag } from '#filter/filter'
import { getColors } from '#shared/common.js'
import { rgb } from 'd3-color'
import { renderTable } from '#dom'

const colorScale = getColors(5)

// TODO: should this be "DAinputPlot"?
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

	constructor(opts, api) {
		super(opts, api)
		this.type = DEinputPlot.type
		const holder = opts.holder.append('div').style('margin', '10px')
		this.dom = {
			header: opts.header.html('Differential Gene Expression'),
			holder
			/*table: opts.holder.append('div'),
			addGroup: opts.holder.append('div'),
			submit: opts.holder
				.append('div')
				.style('position', 'relative')
				.style('margin', '10px')
				.style('max-width', '200px')*/
		}
		this.groups = []
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

	renderSubmit() {
		this.dom.submitBtn = this.dom.submit
			.append('button')
			.property('disabled', true)
			.style('border', 'none')
			.style('border-radius', '20px')
			.style('padding', '10px 15px')
			.text('Submit')
			.on('click', () => {
				const { term, term2, term0, term2_surv, term0_surv, filter } = structuredClone(this.config)

				if (!term) throw 'config.term is missing'
				// if term1 is surival term, launch survival plot
				// otherwise, launch summary plot
				const chartType = term.term.type == 'survival' ? 'survival' : 'summary'
				this.app.dispatch({
					type: 'app_refresh',
					subactions: [
						{
							type: 'plot_create',
							config: {
								chartType,
								term,
								term2: chartType == 'survival' ? term2_surv : term2,
								term0: chartType == 'survival' ? term0_surv : term0,
								filter
							}
						},
						{
							type: 'plot_delete',
							id: this.id
						}
					]
				})
			})

		this.dom.submitMask = this.dom.submit
			.append('div')
			.style('position', 'absolute')
			.style('top', 0)
			.style('left', 0)
			.style('height', '100%')
			.style('width', '100%')
			.style('background-color', `rgba(255,255,255,0.7)`)
			.style('display', 'none')
	}

	async main() {
		this.makeGroupUI(this.dom.holder)
	}

	async makeGroupUI(div) {
		div.style('display', 'block')
		div.selectAll('*').remove()

		/*// message
		div
			.append('div')
			.style('margin', '15px 0px')
			.text(
				'Group samples by mutation status. Samples are assigned to first possible group. Only tested samples are considered.'
			)*/

		// filter table
		const filterTableDiv = div.append('div')
		// add new group button
		const addNewGroupBtnHolder = div.append('div')

		// filter prompt
		const filterPrompt = await filterPromptInit({
			holder: addNewGroupBtnHolder,
			vocabApi: this.app.vocabApi,
			emptyLabel: 'Add group',
			header_mode: 'hide_search',
			callback: async f => {
				console.log('f:', f)
				const filter = getNormalRoot(f)
				this.addNewGroup(filter, this.groups)
				await this.makeGroupUI(div)
			},
			debug: this.opts.debug
		})

		// filterPrompt.main() always empties the filterUiRoot data
		const filter = structuredClone(self.filter)
		filterPrompt.main(excludeFilterByTag(filter, 'cohortFilter')) // provide mass filter to limit the term tree

		if (!this.groups.length) {
			// no groups, hide table
			filterTableDiv.style('display', 'none')
			return
		}

		// clear table and populate rows
		filterTableDiv.style('display', '').selectAll('*').remove()
		const tableArg: any = {
			div: filterTableDiv,
			columns: [
				{}, // blank column to add delete buttons
				{
					label: 'NAME',
					editCallback: async (i, cell) => {
						const newName = cell.value
						const index = this.groups.findIndex(group => group.name == newName)
						if (index != -1) {
							alert(`Group named ${newName} already exists`)
							await this.makeGroupUI(div)
						} else {
							this.groups[i].name = newName
							await this.makeGroupUI(div)
						}
					}
				},
				{
					label: 'COLOR',
					editCallback: async (i, cell) => {
						this.groups[i].color = cell.color
						this.makeGroupUI(div)
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
					this.makeGroupUI(div)
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
					this.makeGroupUI(div)
				}
			}).main(group.filter)
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
