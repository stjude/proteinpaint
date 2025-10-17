import { copyMerge, getCompInit } from '#rx'
import { Menu, addGeneSearchbox, GeneSetEditUI, renderTable, table2col } from '#dom'
import {
	filterInit,
	getNormalRoot,
	filterPromptInit,
	getFilterItemByTag,
	negateFilter,
	filterJoin
} from '#filter/filter'
import { appInit } from '#termdb/app'
import { fillTermWrapper, get$id } from '#termsetting'
import { getCurrentCohortChartTypes } from './charts'
import { getColors } from '#shared/common.js'
import { rgb } from 'd3-color'
import { TermTypes, isNumericTerm, termType2label } from '#shared/terms.js'
import { dofetch3 } from '#common/dofetch'
import { sayerror, make_radios } from '#dom'
import { maxSampleCutoff, maxGESampleCutoff } from '../plots/volcano/defaults.ts'

/*
this
	app
		vocabApi
		opts
			genome{}
			state
				vocab{}
	state {}
		groups []
			group.name=str
			group.filter={}
		termfilter{}
			filter{}
*/

const colorScale = getColors(5)

class MassGroups {
	constructor(opts = {}) {
		this.type = 'groups'
		this.selectedGroupsIdx = new Set() // set of array index for this.state.groups[], for those selected in table ui
	}

	async init() {
		this.dom = {
			holder: this.opts.holder.append('div').style('margin', '10px')
		}
		initUI(this)
		this.tip = new Menu({ padding: '0px' }) // custom term click menu
		// submenu based on this.tip; FIXME do not use fixed x offset
		this.tip2 = new Menu({ padding: '0px', offsetX: 250, offsetY: -34, parent_menu: this.tip.d.node() })
		this.tip3 = new Menu({ padding: '0px' }) // gene search tooltip
	}

	getState(appState) {
		const state = {
			termfilter: appState.termfilter,
			groups: rebaseGroupFilter(appState),
			customTerms: appState.customTerms,
			currentCohortChartTypes: getCurrentCohortChartTypes(appState),
			matrixplots: this.app.vocabApi.termdbConfig.matrixplots
		}
		return state
	}

	async main() {
		await updateUI(this)
	}

	//////////////// rest are app-specific logic

	getMassFilter() {
		if (!this.state.termfilter.filter || this.state.termfilter.filter.lst.length == 0) {
			return { type: 'tvslst', in: true, join: '', lst: [] }
		}
		const f = getNormalRoot(structuredClone(this.state.termfilter.filter)) // strip tag
		return f
	}

	async groups2samplelst(groups) {
		const samplelstGroups = []
		const processedSamples = new Set(),
			overlap = []
		for (const g of groups) {
			const samples = await this.app.vocabApi.getFilteredSampleList(
				filterJoin([g.filter, this.state.termfilter.filter])
			)

			const items = []
			for (const sample of samples) {
				const item = { sampleId: sample.id }
				if ('name' in sample) {
					item.sample = sample.name
				}
				//items.push(item)
				if (!processedSamples.has(sample.id)) items.push(item)
				else {
					for (const pg of samplelstGroups) {
						//if (pg.name === g.name) continue
						const i = pg.items.findIndex(i => i.sampleId === sample.id)
						if (i !== -1) overlap.push(...pg.items.splice(i, 1))
					}
				}
				processedSamples.add(item.sampleId)
			}
			if (items.length) samplelstGroups.push({ name: g.name, items, color: g.color })
		}

		if (overlap.length) {
			const ok = confirm(
				'Overlap detected: 1 or more samples belong to >1 groups. A new group will be created for these "overlap" samples.'
			)
			if (!ok) return
			samplelstGroups.push({ name: 'Group overlap', items: overlap })
		}

		if (groups.length == 1) {
			/* request rest of samples not in this single group, to form group2
			 */
			const samples = await this.app.vocabApi.getFilteredSampleList(
				filterJoin([negateFilter(groups[0].filter), this.state.termfilter.filter])
			)
			if (!samples.length) throw '0 samples for the other group'
			const items = []
			for (const sample of samples) {
				const item = { sampleId: sample.id }
				if ('name' in sample) {
					item.sample = sample.name
				}
				items.push(item)
			}
			samplelstGroups.push({ name: 'Not in ' + groups[0].name, items, color: '#ccc' })
		}

		return getSamplelstTW2(samplelstGroups)
	}

	updateLaunchButton() {
		// turn both off by default; selectively turn on
		this.dom.newTermSpan.style('display', 'none')
		this.dom.noGroupSelected.style('display', 'none')

		if (this.state.groups.length == 0) return // no groups

		if (this.state.groups.length == 1) {
			// only one group present, launch button is always on to work on this group
			this.dom.newTermSpan.style('display', '')
			this.dom.launchButton.text(`Create variable using "${this.state.groups[0].name}"`)
			this.dom.newTermNameInput.property('value', this.state.groups[0].name + ' vs others')
			return
		}

		// 2 or more groups, button is based on the number of selected groups
		const lst = [...this.selectedGroupsIdx]
		if (lst.length == 0) {
			// none selected
			this.dom.noGroupSelected.style('display', '')
			return
		}
		// at least 1 selected, display button
		this.dom.newTermSpan.style('display', '')
		if (lst.length == 1) {
			// only 1 selected
			this.dom.launchButton.text(`Create  variable using "${this.state.groups[lst[0]]?.name}"`)
			this.dom.newTermNameInput.property('value', this.state.groups[lst[0]].name + ' vs others')
			return
		}
		this.dom.launchButton.text(`Create variable using ${lst.length} groups`)
		this.dom.newTermNameInput.property('value', lst.map(i => this.state.groups[i].name).join(' vs '))
	}

	displayCustomTerms() {
		this.dom.customTermDiv.selectAll('*').remove()
		if (this.state.customTerms.length == 0) {
			this.dom.customTermDiv
				.append('div')
				.text('No custom variables. Use above controls to create new ones. Custom variables are added to dictionary.')
				.style('font-size', '.8em')
			return
		}
		this.dom.customTermDiv
			.append('div')
			.style('margin-bottom', '10px')
			.style('font-size', '.8em')
			.text('Following custom variables are available in all charts where variables are used. Click one to delete.')
		for (const { name, tw } of this.state.customTerms) {
			const div = this.dom.customTermDiv.append('div')
			div
				.text(name)
				.attr('class', 'sja_filter_tag_btn')
				.style('padding', '3px 6px')
				.style('border-radius', '6px')
				.style('margin-right', '5px')
				.on('click', event => {
					const deleteCallback = () => this.app.vocabApi.deleteCustomTerm(name)
					this.showGroupsMenu(event, tw, deleteCallback)
				})
		}
	}

	newId() {
		this.lastId = get$id()
		return this.lastId
	}

	showGroupsMenu(event, tw, deleteCallback) {
		const samplelstTW = structuredClone(tw)
		this.tip.clear().showunder(event.target)
		const menuDiv = this.tip.d.append('div')
		const id = this?.lastId

		const groupsInfo = menuDiv.append('div')

		const table = table2col({ holder: groupsInfo })
		table.table.style('scale', 0.9).style('margin-left', '0px')
		for (const [grpKey, grp] of Object.entries(tw.term.values)) {
			const colorSquare = grp.color
				? `<span style="display:inline-block; width:12px; height:12px; background-color:${grp.color}" ></span>`
				: `<span style="display:inline-block; width:11px; height:11px; background-color:${'#fff'}; border: 0.1px solid black" ></span>`
			const [c1, c2] = table.addRow()
			c1.html(`${colorSquare} ${grp.label}`)
			c2.html(`${grp.othersGroupSampleNum || grp.list.length} samples`)
		}

		if (this.state.currentCohortChartTypes.includes('DA') && samplelstTW.q.groups.length == 2)
			addDiffAnalysisPlotMenuItem(menuDiv, this, samplelstTW)
		addSummarizeOptions(menuDiv, this, samplelstTW, id)
		mayAddHierClusterPlotMenuItem('geneExpression', menuDiv, 'Gene expression', this.tip2, samplelstTW, id, this, true)
		mayAddMatrixMenuItems(menuDiv, 'Matrix', this.tip2, samplelstTW, id, this, this.state, true, () => this.newId)
		mayAddSamplescatterOption(menuDiv, this, samplelstTW)
		mayAddGenomebrowserOption(menuDiv, this, samplelstTW)

		//show option to delete custom variable
		menuDiv
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.text('Delete variable')
			.on('click', event => {
				deleteCallback()
				this.tip.hide()
			})
	}
}

export const groupsInit = getCompInit(MassGroups)

function addSummarizeOptions(menuDiv, self, samplelstTW, id) {
	const d = menuDiv.append('div').attr('class', 'sja_menuoption sja_sharp_border').text('Summarize')
	d.on('click', async () => {
		showTree(
			d,
			term => {
				const tw = { term }
				if (isNumericTerm(term)) tw.q = { mode: 'continuous' }
				openSummaryPlot(tw, samplelstTW, self.app, id, () => self.newId)
			},
			self.app,
			self.tip2
		)
	})
	d.insert('div').html('›').style('float', 'right')

	if (self.state.currentCohortChartTypes.includes('survival'))
		addPlotMenuItem('survival', menuDiv, 'Compare survival', self.tip2, samplelstTW, id, self, true)
	if (self.state.currentCohortChartTypes.includes('cuminc'))
		addPlotMenuItem('cuminc', menuDiv, 'Compare cumulative incidence', self.tip2, samplelstTW, id, self, true)
}

function mayAddGenomebrowserOption(menuDiv, self, samplelstTW) {
	if (!self.state.currentCohortChartTypes.includes('genomeBrowser')) return
	if (!self.app.vocabApi.termdbConfig.queries?.snvindel) return // for now only allow for snvindel
	if (self.app.vocabApi.termdbConfig.queries.snvindel.details) return // allows to disable this option for sjlife
	if (samplelstTW.q.groups.length != 2) return // hardcoded to only support 2 groups
	const itemdiv = menuDiv
		.append('div')
		.attr('class', 'sja_menuoption sja_sharp_border')
		.text('Compare mutations')
		.on('click', () => {
			self.tip2.clear().showunderoffset(itemdiv.node())
			const arg = {
				tip: self.tip3,
				genome: self.app.opts.genome,
				row: self.tip2.d.append('div').style('margin', '10px'),
				callback: () => {
					self.tip.hide()
					self.tip2.hide()
					self.tip3.hide()
					const [f1, f2] = makeFiltersFromTwoSampleGroups(samplelstTW)
					const config = {
						chartType: 'genomeBrowser',
						geneSearchResult: result,
						snvindel: { shown: true, filter: f1 }, // code filter in 1st tk
						subMds3TkFilters: [f2] // code filter in 2nd tk
					}
					self.app.dispatch({
						type: 'plot_create',
						config
					})
				}
			}
			const result = addGeneSearchbox(arg)
		})
	itemdiv.insert('div').html('›').style('float', 'right')
}

function makeFiltersFromTwoSampleGroups(tw) {
	const [g1, g2] = tw.q.groups
	if (!g1 || !g2) throw 'not 2 groups in tw.q.groups[]'
	return [
		{
			in: g1.in,
			join: '',
			type: 'tvslst',
			lst: [
				{
					type: 'tvs',
					tvs: {
						term: {
							name: g1.name,
							type: 'samplelst',
							values: {
								[g1.name]: {
									key: g1.name,
									label: g1.name,
									list: g1.values
								}
							}
						}
					}
				}
			]
		},
		{
			in: g2.in,
			join: '',
			type: 'tvslst',
			lst: [
				{
					type: 'tvs',
					tvs: {
						term: {
							name: g2.name,
							type: 'samplelst',
							values: {
								[g2.name]: {
									key: g2.name,
									label: g2.name,
									list: g2.values
								}
							}
						}
					}
				}
			]
		}
	]
}

function mayAddSamplescatterOption(menuDiv, self, samplelstTW) {
	// this is only for pre-made scatterplots
	if (!self.app.vocabApi.termdbConfig.scatterplots) return
	for (const plot of self.app.vocabApi.termdbConfig.scatterplots) {
		if (plot.colorTW)
			//the plot supports overlay by a color term
			menuDiv
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.text(`Overlay on ${plot.name}`)
				.on('click', () => {
					self.tip2.hide() // in case tip2 is already opened through another option
					let config = {
						chartType: 'sampleScatter',
						name: plot.name
					}
					if (plot.sampleCategory)
						//if the plot filters by a sample category, like D1, R1
						config.sampleCategory = {
							tw: structuredClone(plot.sampleCategory.tw),
							order: plot.sampleCategory.order,
							defaultValue: plot.sampleCategory.defaultValue
						}
					if (plot.sampleType) config.sampleType = plot.sampleType //if the plot specifies the sample type to customize the legend
					config.colorTW = structuredClone(samplelstTW)

					if (plot.settings) config.settings = structuredClone(plot.settings) //if the plot specifies settings
					self.app.dispatch({
						type: 'plot_create',
						config: config
					})
					self.tip.hide()
				})
	}
}

function addDiffAnalysisPlotMenuItem(div, self, samplelstTW) {
	// DA app can be applied to multiple datatypes. show options based on availability for each datatype
	if (self.app.vocabApi.termdbConfig.queries?.rnaseqGeneCount) {
		// hardcoded! rnaseq genecount will correspond to gene exp term type on DA ui
		const itemDiv = div
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.text(`Differential ${termType2label(TermTypes.GENE_EXPRESSION)} Analysis`)
			.on('click', async e => {
				// self.tip2.hide() // in case tip2 is already opened through another option
				//Move this to diff analysis plot??
				//Do the check but not add to the state??
				const groups = []
				for (const group of samplelstTW.q.groups) {
					if (group.values && group.values.length > 0) {
						groups.push(group)
					} else {
						throw 'group does not contain samples for differential analysis'
					}
				}

				// get actual numbers of samples with rnaseq count
				const body = {
					genome: self.app.vocabApi.vocab.genome,
					dslabel: self.app.vocabApi.vocab.dslabel,
					samplelst: { groups },
					filter: self.state.termfilter.filter,
					filter0: self.state.termfilter.filter0,
					preAnalysis: true
				}
				const preAnalysisData = await dofetch3('DEanalysis', { body })

				const tip = self.tip2
				if (!preAnalysisData?.data) {
					tip.clear().showunderoffset(itemDiv.node())
					sayerror(tip.d.append('div'), 'Error retrieving pre-analysis data')
					throw new Error('no data returned from pre-analysis request')
				}

				const numControl = preAnalysisData.data[samplelstTW.q.groups[0].name]
				const numCase = preAnalysisData.data[samplelstTW.q.groups[1].name]

				if (numControl + numCase > maxSampleCutoff) {
					if (preAnalysisData.data.alert)
						preAnalysisData.data.alert += ` | Sample size ${
							numControl + numCase
						} exceeds max sample size of ${maxSampleCutoff}. Please reduce sample size.`
					else
						preAnalysisData.data.alert = `Sample size ${
							numControl + numCase
						} exceeds max sample size of ${maxSampleCutoff}. Please reduce sample size.`
				}

				// display actual numbers of samples with rnaseq count
				tip.clear().showunderoffset(itemDiv.node())
				const menuDiv = tip.d.append('div')
				const table = table2col({ holder: menuDiv })
				table.table.style('margin-left', '5px').style('padding', '5px 10px')
				{
					const controlGColor = samplelstTW.term.values[samplelstTW.q.groups[0].name].color
					const colorSquareCtrl = controlGColor
						? `<span style="display:inline-block; width:12px; height:12px; background-color:${controlGColor}" ></span>`
						: `<span style="display:inline-block; width:11px; height:11px; background-color:${'#fff'}; border: 0.1px solid black" ></span>`
					const [c1, c2] = table.addRow()
					c1.html(
						`<span style="font-size:.8em;font-weight:bold">CONTROL</span> ${colorSquareCtrl} ${samplelstTW.q.groups[0].name}`
					)
					c2.html(`${numControl} samples`)
				}
				{
					const caseGColor = samplelstTW.term.values[samplelstTW.q.groups[1].name].color
					const colorSquareCase = caseGColor
						? `<span style="display:inline-block; width:12px; height:12px; background-color:${caseGColor}" ></span>`
						: `<span style="display:inline-block; width:11px; height:11px; background-color:${'#fff'}; border: 0.1px solid black" ></span>`
					const [c1, c2] = table.addRow()
					c1.html(
						`<span style="font-size:.8em;font-weight:bold">CASE</span> ${colorSquareCase} ${samplelstTW.q.groups[1].name}`
					)
					c2.html(`${numCase} samples`)
				}

				// display errors
				const alertDiv = menuDiv.append('div')
				if (preAnalysisData.data.alert) {
					sayerror(alertDiv, preAnalysisData.data.alert)
				}

				// option to launch DE
				const sample_size_limit = 8
				if (!preAnalysisData.data.alert) {
					const options =
						numControl + numCase >= maxGESampleCutoff
							? [{ label: 'Wilcoxon', value: 'wilcoxon' }]
							: numControl <= sample_size_limit && numCase <= sample_size_limit
							? [
									{ label: 'edgeR', value: 'edgeR' },
									{ label: 'Limma', value: 'limma' }
							  ]
							: [
									{ label: 'edgeR', value: 'edgeR' },
									{ label: 'Wilcoxon', value: 'wilcoxon' },
									{ label: 'Limma', value: 'limma' }
							  ]

					const launchDEDiv = menuDiv.append('div').style('margin', '8px 5px').style('padding', '5px 10px')
					const radioRow = launchDEDiv.append('tr')
					let selectedMethod = options[0].value

					radioRow
						.append('td')
						.html('Method')
						.attr('aria-label', 'DE Method')
						.attr('class', 'sja-termdb-config-row-label')
						.style('padding', '5px')

					const cell = radioRow.append('td')
					const radioBtnDiv = cell.append('div')

					make_radios({
						holder: radioBtnDiv,
						inputName: `de-method-${Date.now()}`,
						options: options.map((o, i) => ({
							...o,
							title: `${o.label} method`,
							checked: i === 0 // preselect first option
						})),
						styles: {
							display: 'inline-block',
							padding: '0 12px 0 0'
						},
						callback: v => (selectedMethod = v)
					})

					launchDEDiv
						.append('button')
						.style('border', 'none')
						.style('border-radius', '20px')
						.style('padding', '10px 15px')
						.text(`Run Differential ${termType2label(TermTypes.GENE_EXPRESSION)} Analysis`)
						.on('click', async () => {
							const config = {
								chartType: 'differentialAnalysis',
								state: self.state,
								samplelst: { groups },
								termType: TermTypes.GENE_EXPRESSION,
								tw: samplelstTW,
								settings: { volcano: { method: selectedMethod } }
							}
							tip.hide()
							self.tip.hide()
							self.app.dispatch({
								type: 'plot_create',
								config
							})
						})
				}
			})
	}

	if (self.app.vocabApi.termdbConfig.allowedTermTypes?.includes(TermTypes.METABOLITE_INTENSITY)) {
		div.append('div').text('DA should support metabolite')
	}

	// small text to explain which is case/control. always show this for all DA
	div
		.append('div')
		.html(
			`<span style="font-size:.8em;font-weight:bold">CASE</span> ${samplelstTW.q.groups[1].name}
		&nbsp;
		<span style="font-size:.8em;font-weight:bold">CONTROL</span> ${samplelstTW.q.groups[0].name}`
		)
		.style('font-size', '0.8em')
		.style('opacity', 0.8)
		.style('padding', '3px 3px 3px 10px')
}

function initUI(self) {
	self.dom.filterTableDiv = self.dom.holder.append('div').style('margin-bottom', '10px')

	// row of buttons
	const btnRow = self.dom.holder.append('div')

	// btn 1: prompt to add new group
	self.dom.addNewGroupBtnHolder = btnRow.append('span').style('margin-right', '20px')

	// btn 2: patch of controls to create new term
	self.dom.newTermSpan = btnRow.append('span') // contains "create button" and <input>, so they can toggle on/off together
	self.dom.newTermSpan.append('span').style('padding-left', '15px').text('Add variable:')
	self.dom.newTermNameInput = self.dom.newTermSpan.append('input').attr('type', 'text')

	self.dom.launchButton = self.dom.newTermSpan
		.append('span')
		.attr('class', 'sja_menuoption')
		.on('click', () => clickLaunchBtn(self))

	// msg: none selected
	self.dom.noGroupSelected = btnRow.append('span').text('No groups selected').style('opacity', 0.5)

	// bottom box to list custom terms
	self.dom.customTermDiv = self.dom.holder
		.append('div')
		.style('margin', '20px')
		.style('border-left', 'solid 1px black')
		.style('padding', '10px')
}

async function updateUI(self) {
	// prompt button is an instance to a blank filter, can only make the button after state is filled
	// but not in instance.init()

	// create "Add new group" button as needed
	if (!self.filterPrompt) {
		self.filterPrompt = await filterPromptInit({
			holder: self.dom.addNewGroupBtnHolder,
			vocabApi: self.app.vocabApi,
			emptyLabel: 'Add group',
			termdbConfig: self.app.vocabApi.termdbConfig,
			callback: f => {
				addNewGroup(self.app, f, self.state.groups)
			},
			debug: self.opts.debug
		})
	}

	// filterPrompt.main() always empties the filterUiRoot data
	self.filterPrompt.main(self.getMassFilter()) // provide mass filter to limit the term tree

	// duplicate groups[] array to mutate and add to action.state for dispatching
	const groups = structuredClone(self.state.groups)

	if (!groups.length) {
		// no groups, do not show launch button, hide table
		self.updateLaunchButton()
		self.dom.filterTableDiv.style('display', 'none')
		self.displayCustomTerms()
		return
	}

	// clear table and populate rows
	self.dom.filterTableDiv.style('display', '').selectAll('*').remove()

	const tableArg = {
		div: self.dom.filterTableDiv,
		columns: [
			{}, // blank column to add delete buttons
			{
				label: 'NAME',
				editCallback: async (i, cell) => {
					const newName = cell.value
					const index = self.state.groups.findIndex(group => group.name == newName)
					if (index != -1) {
						alert(`Group named ${newName} already exists`)
						updateUI(self)
					} else
						await self.app.dispatch({
							type: 'rename_group',
							index: i,
							newName: cell.value
						})
				}
			},
			{
				label: 'COLOR',
				editCallback: async (i, cell) => {
					await self.app.dispatch({
						type: 'change_color_group',
						index: i,
						newColor: cell.color
					})
				}
			},
			{ label: '#SAMPLE' },
			{ label: 'FILTER' }
		],
		rows: [],
		striped: false, // no alternating row bg color so delete button appears more visible
		showLines: false
	}
	for (const g of groups) {
		tableArg.rows.push([
			{}, // blank cell to add delete button
			{ value: g.name }, // to allow click to show <input>
			{ color: g.color },
			{ value: 'n=' + (await self.app.vocabApi.getFilteredSampleCount(g.filter)) },
			{} // blank cell to show filter ui
		])
	}

	// clear existing selected groups
	self.selectedGroupsIdx.clear()

	if (groups.length == 1) {
		// only one group, add index 0
		self.selectedGroupsIdx.add(0)
	} else {
		// more than 1 group, show checkboxes for each row
		tableArg.noButtonCallback = (i, node) => {
			if (node.checked) self.selectedGroupsIdx.add(i)
			else self.selectedGroupsIdx.delete(i)
			self.updateLaunchButton() // update button text, based on how many groups are selected
		}
		//
		tableArg.selectedRows = []
		for (let i = 0; i < groups.length; i++) {
			tableArg.selectedRows.push(i) // check all rows by default
			self.selectedGroupsIdx.add(i)
		}
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
				const group = groups[i]
				self.app.vocabApi.deleteGroup(group.name)
			})

		// create fitlter ui in its cell
		const group = groups[i]
		filterInit({
			holder: row[4].__td,
			vocabApi: self.app.vocabApi,
			termdbConfig: self.app.vocabApi.termdbConfig,
			callback: f => {
				if (!f || f.lst.length == 0) {
					// blank filter (user removed last tvs from this filter), delete this element from groups[]
					const i = groups.findIndex(g => g.name == group.name)
					groups.splice(i, 1)
				} else {
					// update filter
					group.filter = f
				}
				self.app.dispatch({
					type: 'app_refresh',
					state: { groups }
				})
			}
		}).main(group.filter)
	}

	self.updateLaunchButton()

	self.displayCustomTerms()
}

async function clickLaunchBtn(self) {
	// click button to create samplelst tw
	// collect groups in use
	const groups = []
	for (const i of self.selectedGroupsIdx) {
		const g = self.state.groups[i]
		if (g) groups.push(g)
	}

	if (groups.length == 0) throw 'No groups, should not happen'

	const name = self.dom.newTermNameInput.property('value')

	// 1 or more groups are in use, generate samplelst tw and save it to state
	const tw = await self.groups2samplelst(groups)
	if (!tw) return
	tw.term.name = name
	self.app.vocabApi.addCustomTerm({ name, tw })

	self.dom.newTermSpan.style('display', 'none')
}

/*
s = {groups[ {filter} ], termfilter{filter} }
termfilter is mass global filter
if provided, need to "rebase" group's visible filter to it
a group filter contains the shadowy global filter from previous state. when new state is provided, need to replace it
*/
export function rebaseGroupFilter(s) {
	if (!s.termfilter?.filter || s.termfilter.filter.lst.length == 0) {
		// blank filter
		return s.groups
	}
	const groups = [] // new groups
	for (const g of s.groups) {
		const f = getNormalRoot(structuredClone(s.termfilter.filter))
		const f2 = getFilterItemByTag(g.filter, 'filterUiRoot')
		if (!f2) {
			//console.log('filterUiRoot not found')
			groups.push(g)
			continue
		}
		f.lst.push(f2)
		f.join = f.lst.length > 1 ? 'and' : ''
		const g2 = {
			name: g.name,
			filter: f,
			color: g.color
		}
		groups.push(g2)
	}
	return groups
}

export async function openPlot(chartType, term, term2, app, id, newId) {
	let config = {
		chartType,
		term,
		term2
	}
	if (id) config.insertBefore = id
	if (newId) config.id = newId()
	await app.dispatch({
		type: 'plot_create',
		config
	})
}

export async function openSummaryPlot(tw, samplelstTW, app, id, newId) {
	const config = {
		chartType: 'summary',
		childType: tw.q?.mode == 'continuous' ? 'violin' : 'barchart',
		term: tw,
		term2: samplelstTW
	}
	if (id) config.insertBefore = id
	if (newId) config.id = newId()
	await app.dispatch({
		type: 'plot_create',
		config
	})
}

async function showTree(
	div,
	callback,
	app,
	tip,
	treeState = { tree: { usecase: { target: 'default', detail: 'term' } } }
) {
	const activeCohort = app.getState().activeCohort
	const state = { activeCohort, ...treeState }
	tip.clear().showunderoffset(div.node())
	appInit({
		holder: tip.d,
		vocabApi: app.vocabApi,
		state,
		tree: {
			click_term: term => {
				callback(term)
				tip.hide()
				if (tip.dnode.parent_menu) tip.dnode.parent_menu.style.display = 'none'
			}
		}
	})
}
function addPlotMenuItem(chartType, div, text, tip, samplelstTW, id, parent, openOnTop = false) {
	const d = div
		.append('div')
		.attr('class', 'sja_menuoption sja_sharp_border')
		.text(text)
		.on('click', e => {
			const state = { tree: { usecase: { target: chartType, detail: 'term' } } }
			if (chartType == 'survival') state.nav = { header_mode: 'hide_search' }
			showTree(
				d,
				term => {
					openPlot(chartType, term, samplelstTW, parent.app, id, openOnTop ? () => parent.newId : null)
				},
				parent.app,
				tip,
				state
			)
		})
	d.insert('div').html('›').style('float', 'right')
}

function mayAddHierClusterPlotMenuItem(chartType, div, text, tip, samplelstTW, id, parent, openOnTop = false) {
	if (!parent.state.currentCohortChartTypes.includes('geneExpression')) return
	const itemDiv = div
		.append('div')
		.attr('class', 'sja_menuoption sja_sharp_border')
		.text(text)
		.on('click', () => {
			tip.clear().showunderoffset(itemDiv.node())

			new GeneSetEditUI({
				holder: tip.d,
				genome: parent.app.opts.genome,
				geneList: [],
				vocabApi: parent.app.vocabApi,
				mode: TermTypes.GENE_EXPRESSION,
				callback: async ({ geneList, groupName }) => {
					const group = { name: groupName, lst: [], type: 'hierCluster' }
					const lst = group.lst.filter(tw => tw.term.type != 'geneExpression')

					const tws = await Promise.all(
						geneList.map(async d => {
							const gene = d.symbol || d.gene
							const unit = parent.app.vocabApi.termdbConfig.queries.geneExpression?.unit || 'Gene Expression'
							const name = `${gene} ${unit}`
							const term = { gene, name, type: 'geneExpression' }
							let tw = group.lst.find(tw => tw.term.name == d.symbol || tw.term.name == d.gene)
							if (!tw) {
								tw = { term, q: {} }
							}
							return tw
						})
					)

					// close geneset edit ui after clicking submit
					tip.hide()
					if (tip.dnode.parent_menu) tip.dnode.parent_menu.style.display = 'none'

					if (tws.length == 1) {
						const tw = tws[0]
						parent.app.dispatch({
							type: 'plot_create',
							config: {
								chartType: 'summary',
								term: tw,
								term2: samplelstTW
							}
						})
						return
					}

					if (tws.length == 2) {
						const tw = tws[0]
						const tw2 = tws[1]
						parent.app.dispatch({
							type: 'plot_create',
							config: {
								chartType: 'summary',
								term: tw,
								term2: tw2,
								colorTW: samplelstTW
							}
						})
						return
					}

					group.lst = [...lst, ...tws]

					parent.app.dispatch({
						type: 'plot_create',
						config: {
							chartType: 'hierCluster',
							termgroups: [group],
							dataType: TermTypes.GENE_EXPRESSION,
							divideBy: samplelstTW,
							settings: { hierCluster: { yDendrogramHeight: 0, clusterSamples: false } }
						}
					})
				}
			})
		})
	itemDiv.insert('div').html('›').style('float', 'right')
}

function mayAddMatrixMenuItems(div, text, tip, samplelstTW, id, parent, state, openOnTop = false, newId) {
	if (!state.currentCohortChartTypes.includes('matrix')) return
	const preBuiltMatrix = state.matrixplots
	const hasSnvIndel = parent.app.vocabApi.termdbConfig?.queries?.snvindel
	if (!preBuiltMatrix && !hasSnvIndel) return
	const itemDiv = div
		.append('div')
		.attr('class', 'sja_menuoption sja_sharp_border')
		.text(text)
		.on('click', () => {
			tip.clear().showunderoffset(itemDiv.node())

			if (preBuiltMatrix) {
				// adding buttons to divide each pre-built matrix
				const preBuiltMatrixDiv = tip.d.append('div')
				for (const plot of preBuiltMatrix) {
					preBuiltMatrixDiv
						.append('button')
						.style('margin', '10px')
						.style('padding', '10px 15px')
						.style('border-radius', '20px')
						.style('border-color', '#ededed')
						.style('display', 'inline-block')
						.text('Divide ' + plot.name)
						.on('click', async () => {
							const config = await parent.app.vocabApi.getMatrixByName(plot.name)
							config.divideBy = samplelstTW
							config.insertBefore = id
							config.settings.matrix.colw = 0
							if (newId) config.id = newId()
							parent.app.dispatch({
								type: 'plot_create',
								config
							})
							tip.hide()
							tip.dnode.parent_menu.style.display = 'none'
						})
				}
			}

			if (hasSnvIndel) {
				// adding geneSet edit UI for building new matrix
				const newMatrixDiv = tip.d.append('div')
				new GeneSetEditUI({
					holder: newMatrixDiv,
					genome: parent.app.opts.genome,
					geneList: [],
					mode: TermTypes.GENE_VARIANT,
					vocabApi: parent.app.vocabApi,
					callback: async ({ geneList, groupName }) => {
						tip.hide()
						tip.dnode.parent_menu.style.display = 'none'
						const group = { name: groupName, lst: [] }
						const lst = group.lst.filter(tw => tw.term.type != 'geneVariant')

						const tws = await Promise.all(
							geneList.map(async d => {
								const term = {
									gene: d.symbol || d.gene,
									name: d.symbol || d.gene,
									type: 'geneVariant'
								}
								let tw = group.lst.find(tw => tw.term.name == d.symbol || tw.term.name == d.gene)
								if (!tw) {
									tw = { term }
									await fillTermWrapper(tw, parent.app.vocabApi)
								} else if (!tw.$id) {
									tw.$id = await get$id(parent.app.vocabApi.getTwMinCopy({ term }))
								}
								return tw
							})
						)
						group.lst = [...lst, ...tws]
						parent.app.dispatch({
							type: 'plot_create',
							config: {
								chartType: 'matrix',
								termgroups: [group],
								dataType: TermTypes.GENE_VARIANT,
								divideBy: samplelstTW
							}
						})
					}
				})
			}
		})
	itemDiv.insert('div').html('›').style('float', 'right')
}

export function addNewGroup(app, filter, groups) {
	groups = JSON.parse(JSON.stringify(groups))
	let name = 'New group'
	let i = 0
	while (1) {
		const name2 = name + (i == 0 ? '' : ' ' + i)
		if (!groups.find(g => g.name == name2)) break
		i++
	}
	name = name + (i == 0 ? '' : ' ' + i)
	const newGroup = {
		name,
		filter,
		color: rgb(colorScale(groups.length)).formatHex()
	}
	groups.push(newGroup)
	app.dispatch({
		type: 'app_refresh',
		state: { groups }
	})
}

export function getSamplelstTWFromIds(ids) {
	if (!ids) throw 'getSamplelstTWFromIds: ids is empty'
	if (!Array.isArray(ids)) throw 'getSamplelstTWFromIds: ids must be an array'
	const name = 'group'
	const values = ids.map(id => {
		return { sampleId: id }
	})
	const qgroup = {
		name: name,
		in: true,
		values
	}

	const tw = {
		isAtomic: true,
		term: { name, type: 'samplelst', values: { [name]: { key: name, list: values } } },
		q: {
			groups: [qgroup]
		}
	}
	return tw
}

export function getSamplelstFilter(ids) {
	const tw = getSamplelstTWFromIds(ids)
	const filter = getFilter(tw)
	return filter
}

export function getFilter(samplelstTW) {
	let i = 0
	let noEdit = true
	for (const field in samplelstTW.term.values) {
		const values = samplelstTW.q.groups[i].values
		samplelstTW.term.values[field].list = values
		if (values[0] && 'sample' in values[0]) noEdit = false
		i++
	}
	const filter = {
		type: 'tvslst',
		in: true,
		join: '',
		lst: [
			{
				type: 'tvs',
				tvs: { term: samplelstTW.term },
				noEdit
			}
		]
	}
	return filter
}

export function getSampleFilter(sampleId) {
	if (!sampleId) throw 'getSampleFilter: sampleId is empty'
	if (Array.isArray(sampleId)) throw 'getSampleFilter: sampleId arg cannot be an array'
	const group = { name: '', index: 0, items: [{ sampleId }] }
	const samplelst = getSamplelstTW([group], '', false)
	const filter = getFilter(samplelst)
	return filter
}

// no special handling when groups.length=1
export function getSamplelstTW2(groups) {
	const values = {}
	const qgroups = []
	for (const group of groups) {
		const samples = getGroupSamples(group)
		const qgroup = {
			name: group.name,
			in: true,
			values: samples
		}
		qgroups.push(qgroup)
		values[group.name] = { key: group.name, label: group.name, color: group.color, list: samples } //samples need to be passed for the samplelst filter to work
	}
	return {
		isAtomic: true,
		term: { name: 'groups', type: 'samplelst', values },
		q: { groups: qgroups }
	}
}

export function getSamplelstTW(groups, name = groups.length == 1 ? 'group' : 'groups', notIn = true) {
	const values = {}
	const qgroups = []
	let samples
	for (const group of groups) {
		samples = getGroupSamples(group)
		const qgroup = {
			name: group.name,
			in: true,
			values: samples
		}
		qgroups.push(qgroup)
		values[group.name] = { key: group.name, label: group.name, color: group.color, list: samples } //samples need to be passed for the samplelst filter to work
	}
	if (groups.length == 1 && notIn) {
		const name2 = 'Not in ' + groups[0].name
		values[name2] = { key: name2, label: name2, color: '#aaa', list: samples, in: false }
		qgroups.push({
			name: name2,
			in: false,
			values: samples
		})
	}
	const tw = {
		isAtomic: true,
		term: { name, type: 'samplelst', values },
		q: { groups: qgroups }
	}
	return tw
}
function getGroupSamples(group) {
	const values = []
	for (const item of group.items) {
		const value = { sampleId: item.sampleId }
		if ('sample' in item) {
			value.sample = item.sample
		}
		values.push(value)
	}
	return values
}
